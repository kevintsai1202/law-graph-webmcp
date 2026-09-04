package tw.lawgraph.research;

import java.util.List;

/** tw-legal-rag 的 domain port，語意 MCP 僅負責提供可驗證候選。 */
public interface TwLegalRagPort {

    /** 依計畫取得含 citation allowlist 的語意判決候選。 */
    SemanticResearch retrieve(ResearchPlan plan);

    /** 回報 semantic MCP 是否需要由瀏覽器重新完成 OAuth。 */
    default boolean authorizationRequired() {
        return false;
    }

    /** 語意 MCP 一次檢索的純 domain 結果。 */
    record SemanticResearch(List<JudgmentCandidate> semanticCandidates) {
        /** 保證 adapter 結果集合不可變。 */
        public SemanticResearch {
            semanticCandidates = semanticCandidates == null ? List.of() : List.copyOf(semanticCandidates);
        }
    }
}
