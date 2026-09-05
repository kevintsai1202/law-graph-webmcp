package tw.lawgraph.agent;

import tools.jackson.databind.json.JsonMapper;
import tw.lawgraph.domain.*;
import java.util.List;

/** 合約審查各 Action 的 prompt；純函式。system prompt 沿用 LegalPrompts.system()。 */
public final class ContractPrompts {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private ContractPrompts() {}

    /** 我方立場代碼 → 中文。 */
    public static String partyLabel(String party) {
        return switch (party) { case "partyA" -> "甲方"; case "partyB" -> "乙方"; default -> "未指定"; };
    }

    /** 使用者勾選的範疇中文清單；未勾選時說明由模型判定。 */
    private static String scopesText(ContractInput input) {
        return input.scopes().isEmpty() ? "not specified — decide from the contract"
                : String.join("、", input.scopes().stream().map(ContractScopes::chineseTitle).toList());
    }

    /** 步驤一：載入契約，判定類型、範疇，切分條款，抽當事人，列待問問題。 */
    public static String load(ContractInput input) {
        return """
                Activate skill "compliance-verification" and follow its step 1 (資料載入與範疇定性). Output only a ContractBrainstorm object.
                Our side (我方立場): %s. Review scopes requested by the user: %s (codes: commercial|labor|privacy|corporate).
                <contract>%s</contract>
                Fill: contractType (中文契約類型, e.g. 勞動契約, 軟體開發委託契約; for a described business activity write 商業行為：<one line>), scopes[] (the codes that apply; keep the user's codes and add missing ones), parties[] ({name, role} e.g. {"甲方（雇主）"}), clauses[] — split the contract into individual clauses in document order, each {clauseNo (exactly as written, e.g. 第3條, 3.2; if the text has no numbering use 段落1, 段落2…), text (verbatim clause text)}; never merge or paraphrase clauses. If the input describes a business activity instead of a contract, create one clause per described step. summary: one paragraph (≤200 characters) of what the contract does.
                Add 1–5 questions (id q1..q5, text, why) only when a missing fact changes the compliance outcome (e.g. whether the counterparty is a consumer, number of employees, whether personal data leaves Taiwan). questions in plain language with the professional term in parentheses.
                Respond in %s.
                """.formatted(partyLabel(input.party()), scopesText(input), input.text(), input.locale().code());
    }

    /** 第二／三輪完整度檢查。 */
    public static String clarify(ContractInput input, ContractBrainstorm brainstorm, List<?> priorAnswers, List<?> priorQuestions, int round) {
        String idPrefix = round == 2 ? "r2q" : "r3q";
        return """
                Review whether the contract review now has enough user-supplied facts to start the statutory comparison. Output only a ClarificationAssessment object.
                <contract>%s</contract>
                <brainstorm>%s</brainstorm>
                <prior_questions>%s</prior_questions>
                <prior_answers>%s</prior_answers>
                This is clarification round %d of 3.
                Rules: sufficient=true and questions=[] when remaining uncertainty can be stated as an assumption in the report; otherwise ask 1–5 NEW questions that change a clause's risk rating. Never repeat a prior question. Treat unknown/不知道/不清楚/無法取得 as final and put the consequence in evidenceGaps. Use ids %s1 through %s5. Plain language, professional term in parentheses.
                """.formatted(input.text(), toJson(brainstorm), toJson(priorQuestions), toJson(priorAnswers), round, idPrefix, idPrefix);
    }

    /** 檢索計畫：必查民法 71、247-1 與各範疇核心條文。 */
    public static String research(ContractInput input, ContractBrainstorm brainstorm, ClarifiedAnswers answers) {
        return """
                Activate skill "legal-research" and follow its steps 1–4 for contract compliance. Output only a ResearchPlan object; do not claim that any law or judgment has already been found.
                <contract>%s</contract>
                <brainstorm>%s</brainstorm>
                <user_answers>%s</user_answers>
                Build `regulationQueries` (at most 15) naming one specific article each. Always include 民法第71條 and 民法第247條之1. Then by scope: commercial → the 民法 debt-chapter articles governing the contract type (e.g. 民法第490條, 民法第227條, 民法第252條); labor → 勞動基準法第24條, 勞動基準法第9條之1, 勞動基準法第15條之1, 勞動基準法第21條 and any article the clauses touch; privacy → 個人資料保護法第8條, 個人資料保護法第19條, 個人資料保護法第20條; corporate → the 公司法 articles the clauses touch. Add every article a clause explicitly cites.
                Build `judgmentKeywordQueries` (at most 5): keyword = the clause topic plus 契約 (e.g. 加班費 放棄 約定 無效), caseType 民事, maxResults 5. mainText: optionally "被告應給付" (defendant lost) or "原告之訴駁回" (plaintiff lost) to fetch judgments where such a clause was actually held void.
                Write a ≤400-character summary of the contract, our side and the risky clauses into `semanticCaseText`.
                """.formatted(input.text(), toJson(brainstorm), toJson(answers));
    }

    /** 逐批條款審查：只能引用檢索白名單。 */
    public static String review(ContractInput input, ContractBrainstorm brainstorm, List<ContractBrainstorm.Clause> batch,
                                int batchNo, int batchCount, ResearchResult research, ClarifiedAnswers answers) {
        return """
                Activate skill "compliance-verification" and follow its step 2 (法規對照與合規性分析) and step 3 (風險評級). Output only a ClauseFindings object for the clauses in this batch (batch %d of %d); one finding per clause, in order, never skip a clause.
                Our side: %s. Contract type: %s. Scopes: %s.
                <clauses>%s</clauses>
                <research>%s</research>
                <answers>%s</answers>
                For each clause: clauseNo (copy), clauseText (copy verbatim), risk (high = violates a mandatory/prohibitive rule so the clause is void under 民法第71條, or exposes our side to major liability; medium = ambiguous wording, unclear allocation of liability, missing cap or deadline, likely dispute; low = lawful but a better drafting exists), lawRefs[] (copied verbatim from research.laws[].ref — never invent, never cite anything not listed), riskPoint (one or two sentences: which rule and why, in the professional Taiwan legal register), suggestion (concrete replacement wording or addition; for low risk an optimisation), judgmentCitations[] (copied verbatim from research.judgments[].citation, only when a judgment in research supports the risk; otherwise empty).
                Assess risk from our side's perspective: a clause that favours the counterparty unfairly is a risk to us; a clause that favours us but is void is also a risk (unenforceable). Taiwan legal terms only. Respond in %s.
                """.formatted(batchNo, batchCount, partyLabel(input.party()), brainstorm.contractType(), scopesText(input),
                toJson(batch), toJson(research), toJson(answers), input.locale().code());
    }

    /** 合規摘要：整體風險、優先修改順序、免責聲明。 */
    public static String summarize(ContractInput input, ContractBrainstorm brainstorm, ClauseFindings findings) {
        return """
                Activate skill "compliance-verification" step 3 (輸出風險評估報告) — write the overview section. Output only a ComplianceReport object.
                Our side: %s. Contract type: %s.
                <brainstorm>%s</brainstorm>
                <findings>%s</findings>
                Fill: contractType (copy), scopes (codes from brainstorm.scopes), overallRisk (the highest risk among findings), findings (copy the input findings unchanged), priorities[] (3–7 lines, ordered: the clauses to fix first with a short reason, high risk before medium; plain language for the client with the professional term in parentheses), disclaimer (one sentence: automated review, not legal advice, verify with a licensed attorney).
                Respond in %s.
                """.formatted(partyLabel(input.party()), brainstorm.contractType(), toJson(brainstorm), toJson(findings), input.locale().code());
    }

    /** 修訂版條款：只針對 high／medium，保留原條號，理由引用白名單法規。 */
    public static String revise(ContractInput input, ContractBrainstorm brainstorm, ComplianceReport report) {
        return """
                Activate skill "compliance-verification" step 3 (修改建議) and produce replacement wording. Output only a RevisedClauses object.
                Our side: %s. Contract type: %s.
                <findings>%s</findings>
                For every finding with risk high or medium (skip low): items[] {clauseNo (copy), original (copy clauseText verbatim), revised (complete replacement clause text in formal Taiwan contract drafting register, ready to paste; keep the clause numbering style), rationale (one sentence citing the lawRefs of that finding verbatim; never cite anything else)}.
                Revised wording must protect our side while staying enforceable under Taiwan law; if the clause is void as a whole, replace it with a lawful clause that achieves the legitimate purpose. Taiwan legal terms only. Respond in %s.
                """.formatted(partyLabel(input.party()), brainstorm.contractType(), toJson(report), input.locale().code());
    }

    /** 契約義務關係圖：contract→clause→obligation 三層、當事人、法條；clause.risk 由伺服器覆寫。 */
    public static String graph(ContractInput input, ContractBrainstorm brainstorm, ResearchResult research, ComplianceReport report) {
        return """
                Activate skill "legal-graph" and build the contract obligation graph (契約→條款→義務三層模型). Output only the requested object (nodes, edges).
                <brainstorm>%s</brainstorm>
                <research>%s</research>
                <report>%s</report>
                Rules for this environment:
                - Node groups (lower-case, exactly one of): contract, clause, obligation, party, law, judgment. One contract node (label = contractType). One clause node per finding, label = clauseNo + short title, and set "family" to the contract label. One obligation node per duty a clause imposes ({duty: main|collateral|incidental}). One party node per brainstorm.parties entry with "role".
                - Do NOT set "risk" or "description" on clause nodes; the server fills them from the report.
                - Every law node must carry "ref" copied verbatim from research.laws[].ref; every judgment node "jid" from research.judgments[].jid. Unlisted ones are deleted.
                - Edge labels (Chinese, exact): 包含 (contract→clause), 課予 (clause→obligation), 負擔 (party→obligation, debtor), 得請求 (obligation→party, creditor), 對價 (obligation↔obligation), 違約效果 (clause→obligation), 適用 (contract/clause→law), 引用 (clause→judgment), 當事人 (party→contract). Use "from"/"to".
                - Write labels in %s; identifiers keep their original form.
                """.formatted(toJson(brainstorm), toJson(research), toJson(report), input.locale().code());
    }

    private static String toJson(Object value) { return JSON.writeValueAsString(value); }
}
