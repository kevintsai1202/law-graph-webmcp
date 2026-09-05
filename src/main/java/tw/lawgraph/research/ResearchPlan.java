package tw.lawgraph.research;

import java.util.Collection;
import java.util.List;
import java.util.Objects;

/** LLM 產生的檢索計畫；只保存查詢意圖，不保存任何 MCP 回應。 */
public record ResearchPlan(List<String> regulationQueries,
                           List<JudgmentKeywordQuery> judgmentKeywordQueries,
                           String semanticCaseText) {

    /** 將查詢去除空白、去重並複製成不可變集合，避免空白請求流入 MCP。 */
    public ResearchPlan {
        regulationQueries = immutableQueries(regulationQueries);
        judgmentKeywordQueries = judgmentKeywordQueries == null
                ? List.of()
                : judgmentKeywordQueries.stream()
                .filter(Objects::nonNull)
                .filter(query -> !query.keyword().isBlank())
                .toList();
        semanticCaseText = normalize(semanticCaseText);
    }

    /** 以新的語意案情文字複製計畫，其餘查詢不變（供摘要 Action 後續使用）。 */
    public ResearchPlan withSemanticCaseText(String text) {
        return new ResearchPlan(regulationQueries, judgmentKeywordQueries, text);
    }

    /** 回傳是否有足以送入語意 MCP 的案情文字。 */
    public boolean hasSemanticQuery() {
        return !semanticCaseText.isBlank();
    }

    /** 將單一查詢欄位正規化為空字串，讓 JSON 與 adapter 映射保持穩定。 */
    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    /** 將查詢集合轉成去重後的不可變清單。 */
    private static List<String> immutableQueries(Collection<String> queries) {
        if (queries == null) return List.of();
        return queries.stream().filter(Objects::nonNull).map(String::trim)
                .filter(value -> !value.isBlank()).distinct().toList();
    }

    /** 關鍵字軌的一次查詢與可選結構化條件。 */
    public record JudgmentKeywordQuery(String keyword, String caseType, String court,
                                       String fromDate, String toDate, Integer maxResults,
                                       String mainText) {
        /** 正規化選填條件；負數上限視為未設定。 */
        public JudgmentKeywordQuery {
            keyword = normalize(keyword);
            caseType = normalize(caseType);
            court = normalize(court);
            fromDate = normalize(fromDate);
            toDate = normalize(toDate);
            maxResults = maxResults != null && maxResults >= 0 ? maxResults : null;
            mainText = normalize(mainText);
        }

        /** 相容舊版 6 參數建構子（無 mainText）。 */
        public JudgmentKeywordQuery(String keyword, String caseType, String court,
                                     String fromDate, String toDate, Integer maxResults) {
            this(keyword, caseType, court, fromDate, toDate, maxResults, "");
        }
    }
}
