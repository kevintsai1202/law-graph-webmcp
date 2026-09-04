package tw.lawgraph.research;

import tw.lawgraph.domain.LawRef;

import java.util.List;

/** taiwan-legal-db 的 domain port，隔離 MCP SDK 與研究 orchestration。 */
public interface TaiwanLegalDbPort {

    /** 依計畫取得已驗證法規與關鍵字判決候選。 */
    LegalDbResearch retrieve(ResearchPlan plan);

    /** legal-mcp 一次檢索的純 domain 結果。 */
    record LegalDbResearch(List<LawRef> laws, List<JudgmentCandidate> keywordCandidates) {
        /** 保證 adapter 結果集合不可變。 */
        public LegalDbResearch {
            laws = laws == null ? List.of() : List.copyOf(laws);
            keywordCandidates = keywordCandidates == null ? List.of() : List.copyOf(keywordCandidates);
        }
    }
}
