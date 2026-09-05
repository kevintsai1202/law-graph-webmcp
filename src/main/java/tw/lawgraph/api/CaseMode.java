package tw.lawgraph.api;

import tw.lawgraph.agent.ContractReviewAgent;
import tw.lawgraph.agent.LegalGraphAgent;

/** 兩條流程的模式代碼與對應 Agent 名稱。 */
public final class CaseMode {
    /** 案件分析（民刑事訴訟）流程代碼。 */
    public static final String CASE = "case";
    /** 合約審查流程代碼。 */
    public static final String CONTRACT = "contract";
    private CaseMode() {}

    /** 未知或空白一律視為案件分析。 */
    public static String normalize(String mode) {
        return CONTRACT.equalsIgnoreCase(mode == null ? "" : mode.trim()) ? CONTRACT : CASE;
    }

    /** 模式 → Embabel agent 名稱。 */
    public static String agentName(String mode) {
        return CONTRACT.equals(normalize(mode)) ? ContractReviewAgent.AGENT_NAME : LegalGraphAgent.AGENT_NAME;
    }
}
