package tw.lawgraph.research;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.lawgraph.research.mcp.McpResearchException;
import tw.lawgraph.domain.ResearchResult;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/** 受控並行執行 keyword／semantic MCP，完成 timeout、降級與統一結果組裝。 */
public final class DualMcpResearchService {
    private static final Logger LOGGER = LoggerFactory.getLogger(DualMcpResearchService.class);
    private final TaiwanLegalDbPort keywordPort;
    private final TwLegalRagPort semanticPort;
    private final ResearchOutcomeAssembler assembler;
    private final ResearchProperties properties;
    private final Executor executor;

    /** 使用 virtual-thread executor 執行短生命週期 MCP 工作，不依賴共用 common pool。 */
    public DualMcpResearchService(TaiwanLegalDbPort keywordPort,
                                  TwLegalRagPort semanticPort,
                                  JudgmentMergeService mergeService,
                                  ResearchProperties properties) {
        this(keywordPort, semanticPort, mergeService, properties,
                Executors.newVirtualThreadPerTaskExecutor());
    }

    /** 提供可替換 executor，供整合測試與受控部署調整並行資源。 */
    public DualMcpResearchService(TaiwanLegalDbPort keywordPort,
                                  TwLegalRagPort semanticPort,
                                  JudgmentMergeService mergeService,
                                  ResearchProperties properties,
                                  Executor executor) {
        if (keywordPort == null) throw new IllegalArgumentException("keyword port is required");
        if (semanticPort == null) throw new IllegalArgumentException("semantic port is required");
        this.keywordPort = keywordPort;
        this.semanticPort = semanticPort;
        this.assembler = new ResearchOutcomeAssembler(mergeService == null ? new JudgmentMergeService() : mergeService);
        this.properties = properties == null ? ResearchProperties.defaults() : properties;
        this.executor = executor == null ? Executors.newVirtualThreadPerTaskExecutor() : executor;
    }

    /** 以固定順序收斂兩軌結果，確保 future 完成先後不影響輸出。 */
    public ResearchResult research(ResearchPlan plan) {
        if (plan == null) throw new IllegalArgumentException("research plan is required");
        CompletableFuture<TrackResult<TaiwanLegalDbPort.LegalDbResearch>> keywordFuture = invoke(
                () -> keywordPort.retrieve(plan), boundedTimeout(properties.keywordTimeout()), "keyword");
        CompletableFuture<TrackResult<TwLegalRagPort.SemanticResearch>> semanticFuture = properties.semanticEnabled()
                && plan.hasSemanticQuery()
                ? invoke(() -> semanticPort.retrieve(plan), boundedTimeout(properties.semanticTimeout()), "semantic")
                : CompletableFuture.completedFuture(TrackResult.disabled());

        awaitOverall(keywordFuture, semanticFuture, properties.overallTimeout());
        TrackResult<TaiwanLegalDbPort.LegalDbResearch> keyword = keywordFuture.join();
        TrackResult<TwLegalRagPort.SemanticResearch> semantic = semanticFuture.join();
        List<String> notes = List.of(keyword.note(), semantic.note()).stream()
                .filter(note -> note != null && !note.isBlank()).toList();
        return assembler.assemble(keyword.value(), semantic.value(), keyword.status(), semantic.status(), notes,
                properties.maxJudgments(), properties.semanticEnabled() && semanticPort.authorizationRequired());
    }

    /** 將單軌 timeout 限制在全局 deadline 內，避免 overall timeout 後仍阻塞 join。 */
    private Duration boundedTimeout(Duration trackTimeout) {
        return trackTimeout.compareTo(properties.overallTimeout()) <= 0
                ? trackTimeout : properties.overallTimeout();
    }

    /** 建立單軌 timeout future；例外只轉安全的 track status 與 metadata。 */
    private <T> CompletableFuture<TrackResult<T>> invoke(Supplier<T> supplier, Duration timeout, String track) {
        long timeoutMillis = Math.max(1, timeout.toMillis());
        return CompletableFuture.supplyAsync(supplier, executor)
                .orTimeout(timeoutMillis, TimeUnit.MILLISECONDS)
                .handle((value, error) -> error == null && value != null
                        ? TrackResult.success(value)
                        : TrackResult.failure(track, unwrap(error)));
    }

    /** 等待雙軌到達共同 deadline；單軌結果已由各自 timeout future 安全收斂。 */
    private static void awaitOverall(CompletableFuture<?> keyword,
                                     CompletableFuture<?> semantic,
                                     Duration timeout) {
        try {
            CompletableFuture.allOf(keyword, semantic)
                    .orTimeout(Math.max(1, timeout.toMillis()), TimeUnit.MILLISECONDS).join();
        } catch (CompletionException ignored) {
            // 單軌 timeout／錯誤已經轉為 TrackResult；此處只避免另一軌無限等待。
        }
    }

    /** 取出 CompletionException 內的原始分類例外。 */
    private static Throwable unwrap(Throwable error) {
        if (error instanceof CompletionException completion && completion.getCause() != null) {
            return completion.getCause();
        }
        return error;
    }

    /** 單軌執行結果；值為 null 時仍會被視為失敗。 */
    private record TrackResult<T>(T value, ResearchTrackStatus status, String note) {
        /** 建立成功軌道。 */
        static <T> TrackResult<T> success(T value) {
            return new TrackResult<>(value, ResearchTrackStatus.SUCCESS, "");
        }

        /** 建立停用軌道。 */
        static <T> TrackResult<T> disabled() {
            return new TrackResult<>(null, ResearchTrackStatus.DISABLED, "semantic track disabled");
        }

        /** 將錯誤轉成不含原始 payload 的狀態。 */
        static <T> TrackResult<T> failure(String track, Throwable error) {
            ResearchTrackStatus status = statusOf(error);
            String kind = error instanceof McpResearchException exception ? exception.kind().name() : "INTERNAL";
            String detail = error instanceof McpResearchException exception ? exception.causeTypes() : "";
            // 只記錄例外類別鏈供除錯，不輸出訊息內容以免洩漏 payload／token。
            LOGGER.warn("{} track {} kind={} causes={} origin={}", track, status, kind, causeChain(error),
                    detail.isBlank() ? "n/a" : detail);
            String note = track + " track " + (status == ResearchTrackStatus.UNAVAILABLE ? "unavailable" : "failed")
                    + " (" + kind + ")";
            return new TrackResult<>(null, status, note);
        }

        /** 以「外層 > 內層」列出例外類別名稱，作為不含敏感內容的除錯線索。 */
        private static String causeChain(Throwable error) {
            StringBuilder chain = new StringBuilder();
            for (Throwable current = error; current != null && chain.length() < 400; current = current.getCause()) {
                if (chain.length() > 0) chain.append(" > ");
                chain.append(current.getClass().getSimpleName());
                if (current.getCause() == current) break;
            }
            return chain.isEmpty() ? "none" : chain.toString();
        }

        /** 將 MCP 錯誤分類為 coverage 狀態。 */
        private static ResearchTrackStatus statusOf(Throwable error) {
            if (error instanceof McpResearchException exception) {
                return switch (exception.kind()) {
                    case AUTH -> ResearchTrackStatus.UNAVAILABLE;
                    case TIMEOUT -> ResearchTrackStatus.TIMEOUT;
                    default -> ResearchTrackStatus.FAILED;
                };
            }
            return error instanceof java.util.concurrent.TimeoutException
                    ? ResearchTrackStatus.TIMEOUT : ResearchTrackStatus.FAILED;
        }
    }
}
