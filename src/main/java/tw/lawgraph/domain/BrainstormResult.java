package tw.lawgraph.domain;

import java.util.List;

/**
 * 法律頭腦風暴結果，包含事實、關係、爭點、證據需求與問題。
 * 模型不需提問時常直接省略 questions 欄位（反序列化為 null），各清單一律正規化為空集合，
 * 避免 askUser 等下游 Action 以 isEmpty() 觸發 NPE 而讓案件卡在 QUESTIONS。
 */
public record BrainstormResult(List<String> facts, List<String> relations, List<String> issues,
                               List<String> evidenceNeeds, List<Question> questions) {
    public BrainstormResult {
        facts = safe(facts);
        relations = safe(relations);
        issues = safe(issues);
        evidenceNeeds = safe(evidenceNeeds);
        questions = questions == null ? List.of() : questions.stream().filter(java.util.Objects::nonNull).toList();
    }

    /** null 轉空清單並去除 null 元素。 */
    private static List<String> safe(List<String> values) {
        return values == null ? List.of() : values.stream().filter(java.util.Objects::nonNull).toList();
    }
}
