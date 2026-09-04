package tw.lawgraph.llm;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * 內建 LLM 轉送端點：Embabel 把 OPENAI_BASE_URL 指到本機的 /internal/llm/v1，
 * 這裡把 chat/completions 請求加上 reasoning_effort 後轉給真正的上游（lawgraph.llm.upstream-base-url）。
 * 金鑰由呼叫端的 Authorization 原樣帶過去，本端點不持有金鑰；只允許 loopback 來源呼叫。
 */
@RestController
public class LlmProxyController {
    private static final Logger LOGGER = LoggerFactory.getLogger(LlmProxyController.class);

    /** 真正的 OpenAI 相容上游（含 /v1）。 */
    private final String upstreamBaseUrl;
    /** 要注入的 reasoning_effort；空字串代表不注入、原樣轉送。 */
    private final String reasoningEffort;
    private final HttpClient http;
    /** 單次轉送逾時：reasoning 模型一次呼叫可能超過一分鐘，這裡放得比 Embabel 的逾時更長。 */
    private final Duration requestTimeout;
    /** 成功回應時累計 usage（prompt／cached／completion／reasoning tokens）。 */
    private final LlmUsageStats stats;

    /** 由設定建立轉送端點。 */
    public LlmProxyController(@Value("${lawgraph.llm.upstream-base-url:https://api.meta.ai/v1}") String upstreamBaseUrl,
                              @Value("${lawgraph.llm.reasoning-effort:}") String reasoningEffort,
                              @Value("${lawgraph.llm.proxy-timeout:300s}") Duration requestTimeout,
                              LlmUsageStats stats) {
        this.upstreamBaseUrl = upstreamBaseUrl.replaceAll("/+$", "");
        this.reasoningEffort = reasoningEffort == null ? "" : reasoningEffort.trim();
        this.requestTimeout = requestTimeout;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();
        this.stats = stats;
    }

    /** POST /internal/llm/v1/chat/completions：注入 reasoning_effort 後轉送，回傳上游的狀態碼與 body。 */
    @PostMapping(value = "/internal/llm/v1/chat/completions", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> chatCompletions(@RequestBody String body,
                                                  @RequestHeader(value = "Authorization", required = false) String authorization,
                                                  HttpServletRequest request) throws IOException, InterruptedException {
        if (!isLoopback(request.getRemoteAddr())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\":\"FORBIDDEN\",\"message\":\"internal endpoint\"}");
        }
        String forwarded = ReasoningEffortInjector.inject(body, reasoningEffort);
        HttpRequest.Builder upstream = HttpRequest.newBuilder(URI.create(upstreamBaseUrl + "/chat/completions"))
                .timeout(requestTimeout)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(forwarded, StandardCharsets.UTF_8));
        if (authorization != null) upstream.header("Authorization", authorization);
        HttpResponse<String> response = http.send(upstream.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() >= 400) {
            LOGGER.warn("LLM 上游回 {}：{}", response.statusCode(), abbreviate(response.body()));
        } else {
            LlmUsageStats.Snapshot callUsage = stats.record(response.body());
            if (callUsage != null) {
                LOGGER.info("LLM usage prompt={} cached={} completion={} reasoning={}",
                        callUsage.promptTokens(), callUsage.cachedTokens(), callUsage.completionTokens(), callUsage.reasoningTokens());
            }
        }
        String contentType = response.headers().firstValue("Content-Type").orElse(MediaType.APPLICATION_JSON_VALUE);
        return ResponseEntity.status(response.statusCode()).header("Content-Type", contentType).body(response.body());
    }

    /** 只接受本機呼叫（IPv4／IPv6 loopback）。 */
    static boolean isLoopback(String remoteAddr) {
        if (remoteAddr == null || remoteAddr.isBlank()) return false;
        try {
            return InetAddress.getByName(remoteAddr).isLoopbackAddress();
        } catch (IOException | IllegalArgumentException invalid) {
            return false;
        }
    }

    /** log 只留前 300 字，避免把整段回應塞進 log。 */
    private static String abbreviate(String text) {
        return text == null ? "" : text.length() > 300 ? text.substring(0, 300) + "…" : text;
    }
}
