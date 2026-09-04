package tw.lawgraph.usage;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 揭露今日 token 用量與是否已停用，供前端與維運查看。 */
@RestController
public class UsageController {
    private final DailyTokenBudget budget;

    public UsageController(DailyTokenBudget budget) {
        this.budget = budget;
    }

    /** GET /api/usage：今日 prompt／completion／合計、上限、暫停與是否已停用。 */
    @GetMapping("/api/usage")
    public DailyTokenBudget.Snapshot usage() {
        return budget.snapshot();
    }
}
