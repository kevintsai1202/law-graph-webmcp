package tw.lawgraph.agent;

import tools.jackson.databind.json.JsonMapper;
import tw.lawgraph.domain.AnalysisResult;
import tw.lawgraph.domain.BrainstormResult;
import tw.lawgraph.domain.CaseInput;
import tw.lawgraph.domain.Locale;
import tw.lawgraph.domain.ResearchResult;
import tw.lawgraph.domain.UserAnswers;

/** 各 Action 的 prompt 文字；純函式，方便測試與快取。 */
public final class LegalPrompts {
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private LegalPrompts() {}

    /** 建立所有 Action 共用的 system prompt。 */
    public static String system(Locale locale) {
        return """
                You are running the law-powers Taiwan legal skills inside a web service.
                1. Tool names: the skills refer to tools as `taiwan-legal-db:<tool>` (e.g. taiwan-legal-db:search_judgments). In this environment call the bare tool name `<tool>` (e.g. search_judgments).
                2. The `dr-lawbot` semantic search is NOT available. Follow the skills' degradation rule: use search_judgments keyword search only, and record "semantic search unavailable" in notes.
                3. Whenever a skill tells you to ask the user something, do NOT ask. Write each question into the `questions[]` output field instead (id, text, why). The human will answer on the web page.
                4. Respond in %s. Statute and judgment identifiers must always be written twice: an English label followed by the original Chinese in full-width parentheses, e.g. "Civil Code Art. 184 ¶1（民法第184條第1項）", "Supreme Court 108-Tai-Shang-2345（最高法院108年度台上字第2345號）". The Chinese part must be copied verbatim from tool results.
                5. Output is analysis support, not legal advice. Never invent statutes or case numbers.
                """.formatted(locale.code());
    }

    /** 建立頭腦風暴步驟一至四的 prompt。 */
    public static String brainstorm(CaseInput input) {
        return """
                Activate skill "legal-brainstorming" and follow its steps 1–4. Output only the requested object.
                Case description (locale %s):
                <case>%s</case>
                Fill facts, relations, issues, evidenceNeeds. Put every fact you still need from the user into questions[] (max 5, each with id q1..q5, text, why). Leave questions empty if the case is already sufficient.
                """.formatted(input.locale().code(), input.text());
    }

    /** 建立法律研究步驟一至四的 prompt。 */
    public static String research(CaseInput input, BrainstormResult brainstorm, UserAnswers answers) {
        return """
                Activate skill "legal-research" and follow its steps 1–4. Output only the requested object.
                Skip step 0 (environment check). Use the available tools; do not use dr-lawbot.
                <case>%s</case>
                <brainstorm>%s</brainstorm>
                <user_answers>%s</user_answers>
                For every law put the exact Chinese article reference you verified with query_regulation into `ref` (e.g. 民法第184條第1項) and the English label into `title`. For every judgment put the exact JID returned by search_judgments/get_judgment into `jid` and the full Chinese citation into `citation`. Anything you could not verify goes into notes, not into laws/judgments.
                """.formatted(input.text(), toJson(brainstorm), toJson(answers));
    }

    /** 建立逐要件涵攝分析 prompt。 */
    public static String analyze(ResearchResult research, BrainstormResult brainstorm, Locale locale) {
        return """
                Activate skill "legal-element-analysis" and follow its steps 1–4. Output only the requested object.
                <research>%s</research>
                <brainstorm>%s</brainstorm>
                For each element: law (Chinese article ref copied from research), element name, met (yes|no|unknown), basis, fact. Respond in %s.
                """.formatted(toJson(research), toJson(brainstorm), locale.code());
    }

    /** 建立建圖步驟一至三的 prompt，要求識別碼逐字複製。 */
    public static String buildGraph(CaseInput input, BrainstormResult brainstorm, ResearchResult research,
                                    AnalysisResult analysis) {
        return """
                Activate skill "legal-graph" and follow its steps 1–3. Output only the requested object (nodes, edges).
                <case>%s</case>
                <brainstorm>%s</brainstorm>
                <research>%s</research>
                <analysis>%s</analysis>
                Rules for this environment:
                - Every law node must carry "ref" copied verbatim from research.laws[].ref; every judgment node must carry "jid" copied verbatim from research.judgments[].jid. Nodes without a matching ref/jid will be deleted.
                - Element nodes: label must equal analysis.elements[].element exactly; do not set "met" (the server fills it from the analysis).
                - Edge "label" must be one of the skill's Chinese labels (適用, 引用, 上訴, 當事人, 證據, 要件, 該當, 抗辯/阻斷, 法條關聯, ...). Use "from"/"to" for endpoints.
                - Write node labels/descriptions in %s; identifiers keep the bilingual form.
                """.formatted(input.text(), toJson(brainstorm), toJson(research), toJson(analysis), input.locale().code());
    }

    /** 將領域物件轉成穩定 JSON 供 prompt 引用。 */
    private static String toJson(Object value) {
        return JSON.writeValueAsString(value);
    }
}
