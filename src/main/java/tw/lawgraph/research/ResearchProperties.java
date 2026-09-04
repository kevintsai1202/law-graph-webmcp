package tw.lawgraph.research;

import java.time.Duration;

/** 雙 MCP 研究的 timeout、上限與語意功能開關。 */
public record ResearchProperties(Duration keywordTimeout,
                                 Duration semanticTimeout,
                                 Duration overallTimeout,
                                 int maxJudgments,
                                 boolean semanticEnabled) {

    /** 將空 timeout、負數上限與過短設定收斂成安全執行值。 */
    public ResearchProperties {
        keywordTimeout = safeDuration(keywordTimeout, Duration.ofSeconds(30));
        semanticTimeout = safeDuration(semanticTimeout, Duration.ofSeconds(20));
        overallTimeout = safeDuration(overallTimeout, Duration.ofSeconds(45));
        maxJudgments = Math.max(0, maxJudgments);
    }

    /** 建立本機與測試共用的預設設定。 */
    public static ResearchProperties defaults() {
        return new ResearchProperties(Duration.ofSeconds(30), Duration.ofSeconds(20),
                Duration.ofSeconds(45), 10, false);
    }

    /** 將 null 或非正 timeout 改成 fallback。 */
    private static Duration safeDuration(Duration value, Duration fallback) {
        return value == null || value.isZero() || value.isNegative() ? fallback : value;
    }
}
