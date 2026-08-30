package tw.lawgraph.domain;

import java.util.List;

/** 法律頭腦風暴結果，包含事實、關係、爭點、證據需求與問題。 */
public record BrainstormResult(List<String> facts, List<String> relations, List<String> issues,
                               List<String> evidenceNeeds, List<Question> questions) {}
