package tw.lawgraph.research.mcp;

import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.spec.McpSchema;
import tw.lawgraph.domain.LawRef;
import tw.lawgraph.research.JudgmentCandidate;
import tw.lawgraph.research.JudgmentIdNormalizer;
import tw.lawgraph.research.ResearchPlan;
import tw.lawgraph.research.ResearchSource;
import tw.lawgraph.research.TaiwanLegalDbPort;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 將 taiwan-legal-db MCP 的法規／關鍵字判決回應轉成 domain 候選。 */
public final class McpTaiwanLegalDbAdapter implements TaiwanLegalDbPort {
    /** 法規引用格式：法規名＋第N條（支援「第34條之1」與「第34-1條」）＋選填第N項第N款。 */
    private static final Pattern ARTICLE = Pattern.compile("^(.+?)第(\\d+)(?:-(\\d+))?條(?:之(\\d+))?(?:第(\\d+)項)?(?:第(\\d+)款)?$");

    /** 研究結果可攜帶的法條上限；超過會撐爆分析／建圖 LLM 的上下文而反覆重試。 */
    public static final int MAX_LAWS = 40;

    private final McpSyncClient client;

    /** 注入具名 registry 選出的 legal-mcp client。 */
    public McpTaiwanLegalDbAdapter(McpSyncClient client) {
        if (client == null) throw new IllegalArgumentException("legal-mcp client is required");
        this.client = client;
    }

    /** 執行法規與關鍵字判決查詢；空白計畫不發出 MCP 請求。 */
    @Override
    public LegalDbResearch retrieve(ResearchPlan plan) {
        List<LawRef> laws = new ArrayList<>();
        List<JudgmentCandidate> judgments = new ArrayList<>();
        for (String query : plan.regulationQueries()) {
            // 沒有條號的整部法規查詢會回上千條（民法 1225 條，實測 laws=3683 造成 ANALYSIS 反覆重試），一律跳過
            if (!ARTICLE.matcher(query.trim()).matches()) continue;
            if (laws.size() >= MAX_LAWS) break;
            for (LawRef law : readLaws(call("query_regulation", regulationArguments(query)), query)) {
                if (laws.size() >= MAX_LAWS) break;
                laws.add(law);
            }
        }
        for (ResearchPlan.JudgmentKeywordQuery query : plan.judgmentKeywordQueries()) {
            if (!query.keyword().isBlank()) {
                judgments.addAll(readJudgments(call("search_judgments", judgmentArguments(query))));
            }
        }
        return new LegalDbResearch(laws, judgments);
    }

    /** 呼叫已選定的 legal-mcp 工具並分類 SDK 例外。 */
    private McpSchema.CallToolResult call(String tool, Map<String, Object> arguments) {
        try {
            return client.callTool(new McpSchema.CallToolRequest(tool, arguments));
        } catch (McpResearchException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw McpResearchException.classify(tool, exception);
        }
    }

    /** 將法規查詢映射到既有 legal-mcp 的 law_name／article_no schema。 */
    static Map<String, Object> regulationArguments(String query) {
        Matcher matcher = ARTICLE.matcher(query.trim());
        if (matcher.matches()) {
            return Map.of("law_name", matcher.group(1), "article_no", articleNumber(matcher));
        }
        return Map.of("law_name", query.trim(), "article_no", "");
    }

    /** 由已匹配的引用取出 MCP 用的條號：「34條之1」與「34-1條」都回 34-1；項、款不進條號。 */
    private static String articleNumber(Matcher matcher) {
        String suffix = matcher.group(3) != null ? matcher.group(3) : matcher.group(4);
        return suffix == null ? matcher.group(2) : matcher.group(2) + "-" + suffix;
    }

    /** 將關鍵字查詢的選填條件映射為 snake_case MCP arguments。 */
    static Map<String, Object> judgmentArguments(ResearchPlan.JudgmentKeywordQuery query) {
        Map<String, Object> arguments = new LinkedHashMap<>();
        arguments.put("keyword", query.keyword());
        putIfNotBlank(arguments, "case_type", query.caseType());
        putIfNotBlank(arguments, "court", query.court());
        putIfNotBlank(arguments, "from_date", query.fromDate());
        putIfNotBlank(arguments, "to_date", query.toDate());
        putIfNotBlank(arguments, "main_text", query.mainText());
        if (query.maxResults() != null) arguments.put("max_results", query.maxResults());
        return Map.copyOf(arguments);
    }

    /**
     * 將法規候選欄位轉成既有 LawRef。
     * production legal-mcp（taiwan-legal-db）的 query_regulation 回傳 {law:{name,pcode,status}, articles:[{number,content}], source_url}，
     * 只到條層級；ref 以查詢原文（含項／款）為準，讓 LLM 依 research.laws[].ref 建的節點能通過 GraphRules 比對。
     * 仍相容早期扁平格式（law_name／article_no／article_text）。
     */
    private static List<LawRef> readLaws(McpSchema.CallToolResult result, String query) {
        Object payload = McpPayloadSupport.payload(result, "query_regulation");
        List<LawRef> fromArticles = readArticles(payload, query);
        if (!fromArticles.isEmpty()) return fromArticles;
        return McpPayloadSupport.records(payload, "laws", "regulations", "results", "matches", "data", "items").stream()
                .map(McpTaiwanLegalDbAdapter::toLaw)
                .filter(law -> law.ref() != null && !law.ref().isBlank()).toList();
    }

    /** 解析 production 格式的 law／articles；查不到法規或無條文時回空清單，不產生假法條。 */
    private static List<LawRef> readArticles(Object payload, String query) {
        if (!(payload instanceof Map<?, ?> raw)) return List.of();
        Object lawValue = raw.get("law");
        Object articlesValue = raw.get("articles");
        if (!(lawValue instanceof Map<?, ?> law) || !(articlesValue instanceof List<?> articles) || articles.isEmpty()) {
            return List.of();
        }
        String lawName = McpPayloadSupport.text(castMap(law), "name", "law_name", "title");
        if (lawName == null) return List.of();
        String source = raw.get("source_url") == null ? "law.moj.gov.tw" : String.valueOf(raw.get("source_url"));
        Matcher matcher = ARTICLE.matcher(query.trim());
        String queriedArticle = matcher.matches() ? articleNumber(matcher) : null;
        List<LawRef> laws = new ArrayList<>();
        for (Object item : articles) {
            if (!(item instanceof Map<?, ?> article)) continue;
            String number = McpPayloadSupport.text(castMap(article), "number", "article_no", "article");
            if (number == null) continue;
            // 查詢的是同一條時保留原文（含第X項第X款）；查條號範圍或全文時以「法規名第N條」表示
            String ref = queriedArticle != null && queriedArticle.equals(number) ? query.trim() : lawName + "第" + number + "條";
            laws.add(new LawRef(ref, lawName, McpPayloadSupport.text(castMap(article), "content", "article_text", "text"), source));
        }
        return laws;
    }

    /** 將任意 map 安全轉成字串 object map。 */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Map<?, ?> value) {
        return (Map<String, Object>) value;
    }

    /** 將判決候選欄位轉成帶 keyword provenance 的內部候選。 */
    private static List<JudgmentCandidate> readJudgments(McpSchema.CallToolResult result) {
        Object payload = McpPayloadSupport.payload(result, "search_judgments");
        return McpPayloadSupport.records(payload, "judgments", "results", "matches", "items", "data").stream()
                .map(McpTaiwanLegalDbAdapter::toJudgment).toList();
    }

    /** 將 MCP 法規欄位整理為可引用官方法條。 */
    private static LawRef toLaw(Map<String, Object> map) {
        String lawName = McpPayloadSupport.text(map, "law_name", "name", "title");
        String article = McpPayloadSupport.text(map, "article_no", "article", "article_number");
        String ref = McpPayloadSupport.text(map, "ref", "reference", "article_ref");
        if (ref == null && lawName != null && article != null) ref = lawName + "第" + article + "條";
        return new LawRef(ref, McpPayloadSupport.text(map, "title", "law_name", "name"),
                McpPayloadSupport.text(map, "article_text", "text", "content"),
                McpPayloadSupport.text(map, "source", "url") == null ? "law.moj.gov.tw"
                        : McpPayloadSupport.text(map, "source", "url"));
    }

    /** 將 MCP 判決欄位整理為可由 JID 去重的候選。 */
    private static JudgmentCandidate toJudgment(Map<String, Object> map) {
        String rawId = McpPayloadSupport.text(map, "jid", "doc_id", "case_id", "id");
        String fullText = McpPayloadSupport.text(map, "full_text", "fullText", "content", "text");
        return new JudgmentCandidate(rawId, JudgmentIdNormalizer.canonicalize(rawId),
                McpPayloadSupport.text(map, "citation", "case_no", "title", "case_id"),
                McpPayloadSupport.text(map, "court"),
                McpPayloadSupport.text(map, "date", "decision_date"),
                McpPayloadSupport.text(map, "summary", "snippet", "abstract"), fullText,
                McpPayloadSupport.text(map, "url", "link"), Set.of(ResearchSource.KEYWORD),
                McpPayloadSupport.integer(map, "rank", "keyword_rank", "position"), null, null, true,
                McpPayloadSupport.bool(map, "full_text_verified") || fullText != null);
    }

    /** 只有非空選填值才放入 MCP request。 */
    private static void putIfNotBlank(Map<String, Object> values, String key, String value) {
        if (value != null && !value.isBlank()) values.put(key, value);
    }
}
