package tw.lawgraph.research;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 驗證雙 MCP 受控並行、語意降級與 feature flag 行為。 */
class DualMcpResearchServiceTest {
    private final ExecutorService executor = Executors.newFixedThreadPool(2);

    /** 確認一般研究計畫會在同一回合排程兩個來源，而非交給 LLM 自行決定。 */
    @Test
    void schedulesBothTracksConcurrently() throws Exception {
        var started = new CountDownLatch(2);
        var release = new CountDownLatch(1);
        var keywordCalls = new AtomicInteger();
        var semanticCalls = new AtomicInteger();
        TaiwanLegalDbPort keyword = plan -> {
            keywordCalls.incrementAndGet();
            started.countDown();
            await(release);
            return new TaiwanLegalDbPort.LegalDbResearch(List.of(), List.of(candidate("J1", ResearchSource.KEYWORD)));
        };
        TwLegalRagPort semantic = plan -> {
            semanticCalls.incrementAndGet();
            started.countDown();
            await(release);
            return new TwLegalRagPort.SemanticResearch(List.of(candidate("J1", ResearchSource.SEMANTIC)));
        };

        var service = new DualMcpResearchService(keyword, semantic, new JudgmentMergeService(), properties(true), executor);
        var future = java.util.concurrent.CompletableFuture.supplyAsync(
                () -> service.research(new ResearchPlan(List.of(), List.of(), "案情")));

        assertTrue(started.await(2, TimeUnit.SECONDS), "兩軌都應開始執行");
        release.countDown();
        var result = future.get(2, TimeUnit.SECONDS);

        assertEquals(1, keywordCalls.get());
        assertEquals(1, semanticCalls.get());
        assertEquals(Set.of(ResearchSource.KEYWORD, ResearchSource.SEMANTIC),
                result.evidence().getFirst().sources());
        assertEquals(ResearchTrackStatus.SUCCESS, result.coverage().semanticStatus());
    }

    /** semantic 401 時維持 keyword 結果，並只公開安全降級 metadata。 */
    @Test
    void fallsBackToKeywordWhenSemanticFailsAuthorization() {
        var keyword = (TaiwanLegalDbPort) plan -> new TaiwanLegalDbPort.LegalDbResearch(List.of(),
                List.of(candidate("J1", ResearchSource.KEYWORD)));
        var semantic = new TwLegalRagPort() {
            @Override
            public SemanticResearch retrieve(ResearchPlan plan) {
                throw new tw.lawgraph.research.mcp.McpResearchException(
                        tw.lawgraph.research.mcp.McpResearchException.Kind.AUTH, "search_bundle");
            }

            /** 模擬 runtime OAuth client 已失去授權，供前端導向 start endpoint。 */
            @Override
            public boolean authorizationRequired() {
                return true;
            }
        };

        var result = new DualMcpResearchService(keyword, semantic, new JudgmentMergeService(), properties(true), executor)
                .research(new ResearchPlan(List.of(), List.of(), "案情"));

        assertEquals(1, result.judgments().size());
        assertEquals(ResearchTrackStatus.UNAVAILABLE, result.coverage().semanticStatus());
        assertTrue(result.coverage().authorizationRequired());
        assertTrue(result.notes().stream().anyMatch(note -> note.contains("semantic") && note.contains("AUTH")));
        assertTrue(result.notes().stream().noneMatch(note -> note.contains("token")));
    }

    /** 關閉 feature flag 時不得呼叫語意 port，且 coverage 明確標示 disabled。 */
    @Test
    void disabledSemanticTrackDoesNotCallPort() {
        var semanticCalls = new AtomicInteger();
        var keyword = (TaiwanLegalDbPort) plan -> new TaiwanLegalDbPort.LegalDbResearch(List.of(), List.of());
        var semantic = (TwLegalRagPort) plan -> {
            semanticCalls.incrementAndGet();
            return new TwLegalRagPort.SemanticResearch(List.of());
        };

        var result = new DualMcpResearchService(keyword, semantic, new JudgmentMergeService(), properties(false), executor)
                .research(new ResearchPlan(List.of(), List.of(), "案情"));

        assertEquals(0, semanticCalls.get());
        assertEquals(ResearchTrackStatus.DISABLED, result.coverage().semanticStatus());
    }

    /** 建立測試用的短 timeout 與雙軌啟用設定。 */
    private ResearchProperties properties(boolean semanticEnabled) {
        return new ResearchProperties(Duration.ofSeconds(1), Duration.ofSeconds(1), Duration.ofSeconds(2),
                10, semanticEnabled);
    }

    /** 建立最小可合併候選。 */
    private static JudgmentCandidate candidate(String jid, ResearchSource source) {
        return new JudgmentCandidate(jid, null, "citation " + jid, "court", "2024-01-01", "summary",
                "", "https://example.invalid/" + jid, Set.of(source), 1,
                source == ResearchSource.SEMANTIC ? .9 : null, "C1", true, false);
    }

    /** 等待雙軌測試閘門，不把 interrupted exception 轉成不安全訊息。 */
    private static void await(CountDownLatch latch) {
        try {
            latch.await(2, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("test interrupted");
        }
    }

    /** 每個測試結束後回收 executor，避免殘留 non-daemon thread。 */
    @AfterEach
    void shutdownExecutor() throws InterruptedException {
        executor.shutdownNow();
        executor.awaitTermination(2, TimeUnit.SECONDS);
    }
}
