package tw.lawgraph.research;

/** 雙 MCP 檢索的軌道狀態與合併統計，會隨 ResearchResult 一起提供給 AI。 */
public record ResearchCoverage(ResearchTrackStatus keywordStatus,
                               ResearchTrackStatus semanticStatus,
                               int keywordCandidateCount,
                               int semanticCandidateCount,
                               int mergedCount,
                               int droppedCount,
                               int truncatedCount,
                               boolean authorizationRequired) {

    /** 維持既有七參數呼叫端；新增授權旗標預設為 false。 */
    public ResearchCoverage(ResearchTrackStatus keywordStatus,
                            ResearchTrackStatus semanticStatus,
                            int keywordCandidateCount,
                            int semanticCandidateCount,
                            int mergedCount,
                            int droppedCount,
                            int truncatedCount) {
        this(keywordStatus, semanticStatus, keywordCandidateCount, semanticCandidateCount,
                mergedCount, droppedCount, truncatedCount, false);
    }

    /** 將空狀態與負數統計收斂成可序列化且安全的值。 */
    public ResearchCoverage {
        keywordStatus = keywordStatus == null ? ResearchTrackStatus.UNAVAILABLE : keywordStatus;
        semanticStatus = semanticStatus == null ? ResearchTrackStatus.UNAVAILABLE : semanticStatus;
        keywordCandidateCount = nonNegative(keywordCandidateCount);
        semanticCandidateCount = nonNegative(semanticCandidateCount);
        mergedCount = nonNegative(mergedCount);
        droppedCount = nonNegative(droppedCount);
        truncatedCount = nonNegative(truncatedCount);
    }

    /** 建立尚未執行檢索時的初始 coverage。 */
    public static ResearchCoverage empty() {
        return new ResearchCoverage(ResearchTrackStatus.UNAVAILABLE, ResearchTrackStatus.UNAVAILABLE,
                0, 0, 0, 0, 0, false);
    }

    /** 確保統計不會因錯誤輸入出現負數。 */
    private static int nonNegative(int value) {
        return Math.max(0, value);
    }
}
