package tw.lawgraph.usage;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tw.lawgraph.llm.LlmUsageStats;

/** 揭露今日 token 用量與是否已停用，供前端與維運查看。 */
@RestController
public class UsageController {
    private final DailyTokenBudget budget;
    /** 經轉送端點的 LLM 呼叫 usage 累計（prompt／cached／completion／reasoning）。 */
    private final LlmUsageStats llmStats;

    public UsageController(DailyTokenBudget budget, LlmUsageStats llmStats) {
        this.budget = budget;
        this.llmStats = llmStats;
    }

    /** GET /api/usage：今日 prompt／completion／合計、上限、暫停與是否已停用。 */
    @GetMapping("/api/usage")
    public DailyTokenBudget.Snapshot usage() {
        return budget.snapshot();
    }

    /** GET /api/usage/llm：經轉送端點的 LLM 呼叫累計（prompt／cached／completion／reasoning 與快取命中率）。 */
    @GetMapping("/api/usage/llm")
    public LlmUsageStats.Snapshot llm() {
        return llmStats.snapshot();
    }
}
