package tw.lawgraph.api;

import jakarta.servlet.http.HttpServletRequest;
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
import tw.lawgraph.domain.Locale;

import java.time.Clock;
import java.util.List;

/** 案件流程 REST 端點。 */
@RestController
@RequestMapping("/api/cases")
public class CaseController {
    /** 啟動案件請求；documents 為勾選的書狀代碼（可省略）。 */
    public record StartRequest(String caseText, String locale, List<String> documents) {}
    /** 提交人工答案請求。 */
    public record AnswersRequest(List<Answer> answers) {}

    private final CaseService service;
    private final RateLimiter limiter;
    private final CaseFileExtractor fileExtractor;

    /** 注入案件服務與 IP 限流器。 */
    public CaseController(CaseService service, RateLimiter limiter, CaseFileExtractor fileExtractor) {
        this.service = service; this.limiter = limiter; this.fileExtractor = fileExtractor;
    }

    /** 啟動新案件，成功回 201。 */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> start(@RequestBody StartRequest request, HttpServletRequest http) {
        if (request.caseText() == null || request.caseText().isBlank()) {
            return ResponseEntity.badRequest().body(ApiExceptionHandler.error("INVALID_INPUT", "caseText must not be blank"));
        }
        if (!limiter.tryAcquire(clientIp(http))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ApiExceptionHandler.error("RATE_LIMITED", "max cases per hour reached"));
        }
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.start(request.caseText().trim(), Locale.fromCode(request.locale()),
                        request.documents() == null ? List.of() : request.documents()));
    }

    /** 由文字與 PDF、MD、DOCX 附件啟動案件；附件只在記憶體解析，不保存原檔。 */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> startWithFiles(@RequestParam(defaultValue = "") String caseText,
                                            @RequestParam(defaultValue = "en") String locale,
                                            @RequestParam(required = false) List<String> documents,
                                            @RequestParam List<MultipartFile> files,
                                            HttpServletRequest http) {
        if ((caseText == null || caseText.isBlank()) && (files == null || files.stream().allMatch(MultipartFile::isEmpty))) {
            return ResponseEntity.badRequest().body(ApiExceptionHandler.error("INVALID_INPUT", "caseText or at least one file is required"));
        }
        if (!limiter.tryAcquire(clientIp(http))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ApiExceptionHandler.error("RATE_LIMITED", "max cases per hour reached"));
        }
        String composed = fileExtractor.composeCaseText(caseText, fileExtractor.extract(files));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.start(composed, Locale.fromCode(locale), documents == null ? List.of() : documents));
    }

    /** 取得指定案件狀態。 */
    @GetMapping("/{id}")
    public CaseStatus status(@PathVariable String id) { return service.status(id); }

    /** 提交指定案件的人工答案。 */
    @PostMapping("/{id}/answers")
    public CaseStatus answers(@PathVariable String id, @RequestBody AnswersRequest request) {
        return service.answer(id, request.answers() == null ? List.of() : request.answers());
    }

    /** Cloudflare 後優先採用 CF-Connecting-IP。 */
    private static String clientIp(HttpServletRequest http) {
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
    }
}
