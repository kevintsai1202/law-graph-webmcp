package tw.lawgraph.domain;

import java.util.List;

/** 法律涵攝分析結果、策略、證據缺口與免責聲明。 */
public record AnalysisResult(List<ElementFinding> elements, String strategy,
                             List<String> evidenceGaps, String disclaimer) {}
