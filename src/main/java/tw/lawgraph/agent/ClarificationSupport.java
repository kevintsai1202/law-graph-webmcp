package tw.lawgraph.agent;

import tw.lawgraph.domain.ClarificationAssessment;
import tw.lawgraph.domain.Question;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/** 多輪澄清的共用防禦：模型回 null 清單、sufficient=true 強制不追問、辨識「不知道」類終止答案。兩個 Agent 共用。 */
final class ClarificationSupport {
    private ClarificationSupport() {}

    /** 防禦模型回傳 null questions，且 sufficient=true 時強制不再追問；最多 5 題。 */
    static List<Question> safeQuestions(ClarificationAssessment assessment) {
        return assessment == null || assessment.sufficient() || assessment.questions() == null
                ? List.of() : assessment.questions().stream().filter(Objects::nonNull).limit(5).toList();
    }

    /** 防禦模型回傳 null evidenceGaps；去空白、去重。 */
    static List<String> safeGaps(ClarificationAssessment assessment) {
        return assessment == null || assessment.evidenceGaps() == null
                ? List.of() : assessment.evidenceGaps().stream().filter(v -> v != null && !v.isBlank()).distinct().toList();
    }

    /** 判斷回答是否明確表示未知／無法取得；這類答案是終止資訊而不是下一輪重問理由。 */
    static boolean isUnavailable(String answer) {
        if (answer == null || answer.isBlank()) return true;
        String value = answer.trim().toLowerCase(Locale.ROOT);
        return List.of("unknown", "not sure", "unavailable", "不知道", "不清楚", "沒有資料", "無資料", "無法取得")
                .stream().anyMatch(value::contains);
    }
}
