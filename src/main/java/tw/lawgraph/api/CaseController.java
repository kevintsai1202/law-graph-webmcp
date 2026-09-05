package tw.lawgraph.api;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import tw.lawgraph.domain.Answer;
import tw.lawgraph.domain.ContractInput;
import tw.lawgraph.domain.Locale;

import java.time.Clock;
import java.util.List;

/** 案件流程 REST 端點。 */
@RestController
@RequestMapping("/api/cases")
public class CaseController {
    /** 啟動案件請求；documents 為勾選的書狀代碼（可省略）；mode 為 case／contract（預設 case），party／scopes 僅合約模式使用。 */
    public record StartRequest(String caseText, String locale, List<String> documents, String motionRequest,
                               String mode, String party, List<String> scopes) {}
    /** 提交人工答案請求。 */
    public record AnswersRequest(List<Answer> answers) {}

    private final CaseService service;
    private final RateLimiter limiter;
    /** 每人每日案件配額（免費開放、為了讓更多人用得到）。 */
    private final DailyCaseQuota quota;
    /** 決定配額計數身分：Google 登入者以帳號、匿名者以 IP。 */
    private final QuotaIdentityResolver identities;
    /** 使用授權：經兆國際法律事務所的登入者一律拒絕。 */
    private final tw.lawgraph.auth.AccessPolicy accessPolicy;
    private final CaseFileExtractor fileExtractor;
    /** 每日 token 預算；用盡或手動暫停時拒絕任何會呼叫 LLM 的請求。 */
    private final tw.lawgraph.usage.DailyTokenBudget budget;
    /** 測試專用便宜模型名稱（唯一允許透過 header 指定的模型）；空白代表關閉覆寫。 */
    private final String testModel;

    /** 允許呼叫端指定測試模型的 header。 */
    static final String MODEL_HEADER = "X-LawGraph-Model";

    /** 注入案件服務、IP 限流器、附件解析、每日 token 預算與測試模型名稱。 */
    public CaseController(CaseService service, @Qualifier("rateLimiter") RateLimiter limiter, DailyCaseQuota quota, QuotaIdentityResolver identities,
                          tw.lawgraph.auth.AccessPolicy accessPolicy,
                          CaseFileExtractor fileExtractor, tw.lawgraph.usage.DailyTokenBudget budget,
                          @org.springframework.beans.factory.annotation.Value("${lawgraph.test-model:gpt-5.4-nano}") String testModel) {
        this.service = service; this.limiter = limiter; this.quota = quota; this.identities = identities; this.accessPolicy = accessPolicy;
        this.fileExtractor = fileExtractor; this.budget = budget;
        this.testModel = testModel == null ? "" : testModel.trim();
    }

    /** 只有 header 值與允許的測試模型完全相同才生效，其他值一律忽略（避免被拿來挑更貴的模型）。 */
    private String modelOverride(HttpServletRequest http) {
        String requested = http.getHeader(MODEL_HEADER);
        return requested != null && !testModel.isBlank() && testModel.equals(requested.trim()) ? testModel : "";
    }

    /** 預算用盡時回 503 與可讀訊息；使用授權排除方（登入 email 命中名單）回 403；否則回 null 讓呼叫端繼續。 */
    private ResponseEntity<?> budgetGate(String locale) {
        if (accessPolicy.currentUserBlocked()) {
            boolean zhLocale = "zh-TW".equalsIgnoreCase(locale == null ? "" : locale.trim());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiExceptionHandler.error(tw.lawgraph.auth.AccessPolicy.ERROR_CODE, tw.lawgraph.auth.AccessPolicy.message(zhLocale)));
        }
        if (!budget.exhausted()) return null;
        var snapshot = budget.snapshot();
        boolean zh = "zh-TW".equalsIgnoreCase(locale == null ? "" : locale.trim());
        String alternative = zh
                ? " 也可安裝 Law Powers 技能（https://kevintsai1202.github.io/law-powers/），用自己的 AI Agent 分析，不受額度限制。"
                : " You can also install the Law Powers skills (https://kevintsai1202.github.io/law-powers/) and run the analysis with your own AI agent, with no limit.";
        String message = (snapshot.paused()
                ? (zh ? "服務暫停中：今日 AI 額度已用完，請明天再試。" : "Service paused: today's AI budget has been used up. Please try again tomorrow.")
                : (zh ? "今日 AI 額度（" + snapshot.dailyLimit() + " tokens）已用完，請明天再試。"
                      : "Today's AI budget (" + snapshot.dailyLimit() + " tokens) has been used up. Please try again tomorrow."))
                + alternative;
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(ApiExceptionHandler.error("DAILY_TOKEN_LIMIT", message));
    }

    /**
     * 每人每日配額用盡時回 429 DAILY_CASE_LIMIT，訊息說明原因（免費開放、為了讓更多人用得到才設上限）；
     * 否則扣一次配額並回 null 讓呼叫端繼續。
     */
    private ResponseEntity<?> quotaGate(QuotaIdentityResolver.Identity identity, String locale) {
        if (quota.tryAcquire(identity.hash(), identity.limit())) return null;
        var snapshot = quota.snapshot(identity.hash(), identity.limit());
        boolean zh = "zh-TW".equalsIgnoreCase(locale == null ? "" : locale.trim());
        // 匿名者提醒：登入 Google 每天可多分析幾次
        String loginTip = identity.member() ? ""
                : zh ? " 用 Google 登入後每天可分析 " + identities.memberLimit() + " 次。"
                     : " Sign in with Google to get " + identities.memberLimit() + " analyses per day.";
        String message = zh
                ? "今日 " + snapshot.limit() + " 次分析已用完（" + snapshot.used() + " / " + snapshot.limit() + "）。本站免費開放，為了讓更多人都能使用，每人每天最多分析 "
                  + snapshot.limit() + " 次，明天（台北時間）會重新計算。" + loginTip + "想不受限制，可安裝 Law Powers 技能（https://kevintsai1202.github.io/law-powers/）用自己的 AI Agent 分析。"
                : "You have used today's " + snapshot.limit() + " analyses (" + snapshot.used() + " / " + snapshot.limit() + "). This site is free, so each person gets at most "
                  + snapshot.limit() + " analyses per day to keep it available for more people; the count resets at midnight Taipei time." + loginTip + " For unlimited use, install the Law Powers skills (https://kevintsai1202.github.io/law-powers/) and run the analysis with your own AI agent.";
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(ApiExceptionHandler.error("DAILY_CASE_LIMIT", message));
    }

    /** 啟動新案件，成功回 201。 */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> start(@RequestBody StartRequest request, HttpServletRequest http) {
        if (request.caseText() == null || request.caseText().isBlank()) {
            return ResponseEntity.badRequest().body(ApiExceptionHandler.error("INVALID_INPUT", "caseText must not be blank"));
        }
        ResponseEntity<?> gate = budgetGate(request.locale());
        if (gate != null) return gate;
        if (!limiter.tryAcquire(clientIp(http))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ApiExceptionHandler.error("RATE_LIMITED", "max cases per hour reached"));
        }
        var identity = identities.resolve(http);
        ResponseEntity<?> quotaGate = quotaGate(identity, request.locale());
        if (quotaGate != null) return quotaGate;
        Locale loc = Locale.fromCode(request.locale());
        List<String> documents = request.documents() == null ? List.of() : request.documents();
        String model = modelOverride(http);
        // 統計脈絡交給 CaseService，於流程啟動前寫入 case_event
        var context = new CaseStartContext(identity.kind(), identity.hash(), model);
        CaseStatus created = CaseMode.CONTRACT.equals(CaseMode.normalize(request.mode()))
                ? service.startContract(new ContractInput(request.caseText().trim(), loc, request.party(), request.scopes(), documents, model), context)
                : service.start(request.caseText().trim(), loc, documents, request.motionRequest() == null ? "" : request.motionRequest(), context);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /** 由文字與 PDF、MD、DOCX 附件啟動案件；附件只在記憶體解析，不保存原檔。 */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> startWithFiles(@RequestParam(defaultValue = "") String caseText,
                                            @RequestParam(defaultValue = "en") String locale,
                                            @RequestParam(required = false) List<String> documents,
                                            @RequestParam(defaultValue = "") String motionRequest,
                                            @RequestParam(defaultValue = "case") String mode,
                                            @RequestParam(defaultValue = "unknown") String party,
                                            @RequestParam(required = false) List<String> scopes,
                                            @RequestParam List<MultipartFile> files,
                                            HttpServletRequest http) {
        if ((caseText == null || caseText.isBlank()) && (files == null || files.stream().allMatch(MultipartFile::isEmpty))) {
            return ResponseEntity.badRequest().body(ApiExceptionHandler.error("INVALID_INPUT", "caseText or at least one file is required"));
        }
        ResponseEntity<?> gate = budgetGate(locale);
        if (gate != null) return gate;
        if (!limiter.tryAcquire(clientIp(http))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ApiExceptionHandler.error("RATE_LIMITED", "max cases per hour reached"));
        }
        var identity = identities.resolve(http);
        ResponseEntity<?> quotaGate = quotaGate(identity, locale);
        if (quotaGate != null) return quotaGate;
        String composed = fileExtractor.composeCaseText(caseText, fileExtractor.extract(files));
        Locale loc = Locale.fromCode(locale);
        List<String> docs = documents == null ? List.of() : documents;
        String model = modelOverride(http);
        var context = new CaseStartContext(identity.kind(), identity.hash(), model);
        CaseStatus created = CaseMode.CONTRACT.equals(CaseMode.normalize(mode))
                ? service.startContract(new ContractInput(composed, loc, party, scopes, docs, model), context)
                : service.start(composed, loc, docs, motionRequest, context);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /** 取得指定案件狀態。 */
    @GetMapping("/{id}")
    public CaseStatus status(@PathVariable String id) { return service.status(id); }

    /** 提交指定案件的人工答案；預算用盡時同樣拒絕，因為續跑仍會呼叫 LLM。 */
    @PostMapping("/{id}/answers")
    public ResponseEntity<?> answers(@PathVariable String id, @RequestBody AnswersRequest request) {
        CaseStatus current = service.status(id);
        ResponseEntity<?> gate = budgetGate(current == null ? null : current.locale());
        if (gate != null) return gate;
        return ResponseEntity.ok(service.answer(id, request.answers() == null ? List.of() : request.answers()));
    }

    /** Cloudflare 後優先採用 CF-Connecting-IP；其餘代理靠 server.forward-headers-strategy 還原 X-Forwarded-For。 */
    public static String clientIp(HttpServletRequest http) {
        String cloudflareIp = http.getHeader("CF-Connecting-IP");
        return cloudflareIp != null ? cloudflareIp : http.getRemoteAddr();
    }

    /** 案件 API 共用的限流 Bean。 */
    @Configuration
    static class ApiConfig {
        /** 依設定建立每小時限流器。 */
        @Bean RateLimiter rateLimiter(@Value("${lawgraph.rate-limit-per-hour:10}") int perHour) {
            return new RateLimiter(perHour, Clock.systemUTC());
        }

        /** 統計端點 /api/stats 專用限流器（與案件 API 分開計數）。 */
        @Bean RateLimiter statsRateLimiter(@Value("${lawgraph.stats-rate-limit-per-hour:120}") int perHour) {
            return new RateLimiter(perHour, Clock.systemUTC());
        }

        /** 每人每日案件配額計數器；上限依身分由 QuotaIdentityResolver 決定。 */
        @Bean DailyCaseQuota dailyCaseQuota(tw.lawgraph.usage.UsageEventStore events) {
            return new DailyCaseQuota(Clock.systemUTC(), events);
        }
    }
}
