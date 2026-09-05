package tw.lawgraph.agent;

import com.embabel.agent.core.Agent;
import com.embabel.agent.core.AgentPlatform;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 兩個 agent 必須同時掛上 AgentPlatform，且各自至少有一個 goal，否則 GOAP 無法規劃該流程。
 * 註：不可套用 "test" profile —— Embabel 的 DelegatingAgentScanningBeanPostProcessor 標了 @Profile("!test")，
 * 在 test profile 下完全不做 @Agent 掃描部署；因此改為直接以 property 關閉 MCP client。
 */
@SpringBootTest(properties = {
        "spring.ai.mcp.client.enabled=false",
        "lawgraph.skills-dir=skills/law-powers/skills",
        "OPENAI_API_KEY=test",
        "lawgraph.usage.store=file",
        "lawgraph.usage.path=target/test-usage.json"
})
class AgentsDeployTest {

    @Autowired
    private AgentPlatform platform;

    /** 案件與合約兩個 agent 同時部署，且皆具備可達成的 goal。 */
    @Test
    void bothAgentsAreDeployedWithGoals() {
        List<Agent> agents = platform.agents();
        List<String> names = agents.stream().map(Agent::getName).toList();
        assertTrue(names.contains(LegalGraphAgent.AGENT_NAME), "缺少案件 agent：" + names);
        assertTrue(names.contains(ContractReviewAgent.AGENT_NAME), "缺少合約 agent：" + names);
        for (Agent agent : agents) {
            assertFalse(agent.getGoals().isEmpty(), agent.getName() + " 沒有任何 goal");
        }
        // goal description 直接來自 @AchievesGoal 文字，錯了代表 GOAP 規劃目標被改動
        assertTrue(goalDescriptions(agents, LegalGraphAgent.AGENT_NAME).stream().anyMatch(d -> d.contains("relationship graph")),
                "案件 agent 缺少關係圖 goal：" + goalDescriptions(agents, LegalGraphAgent.AGENT_NAME));
        assertTrue(goalDescriptions(agents, ContractReviewAgent.AGENT_NAME).stream().anyMatch(d -> d.contains("obligation graph")),
                "合約 agent 缺少義務圖 goal：" + goalDescriptions(agents, ContractReviewAgent.AGENT_NAME));
    }

    /** 取出指定 agent 的所有 goal description。 */
    private static List<String> goalDescriptions(List<Agent> agents, String agentName) {
        return agents.stream().filter(a -> agentName.equals(a.getName()))
                .flatMap(a -> a.getGoals().stream()).map(com.embabel.agent.core.Goal::getDescription).toList();
    }
}
