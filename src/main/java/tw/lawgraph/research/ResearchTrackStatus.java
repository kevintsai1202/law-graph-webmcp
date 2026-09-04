package tw.lawgraph.research;

/** 單一 MCP 研究軌道的可觀測狀態。 */
public enum ResearchTrackStatus {
    /** MCP 呼叫成功並完成解析。 */
    SUCCESS,
    /** MCP 尚未啟用或未完成授權。 */
    UNAVAILABLE,
    /** MCP 呼叫成功但只取得部分結果。 */
    PARTIAL,
    /** MCP 呼叫失敗。 */
    FAILED,
    /** MCP 呼叫超過該軌道的 timeout。 */
    TIMEOUT,
    /** 該軌道由 feature flag 明確關閉。 */
    DISABLED
}
