package tw.lawgraph.llm;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 內建 LLM 轉送端點：把 OpenAI 相容的 chat/completions 請求加上 reasoning_effort 後轉給上游，
 * 帳號金鑰由呼叫端 Authorization 帶入原樣轉送；只允許本機（loopback）呼叫。
 */
@WebMvcTest(controllers = LlmProxyController.class, properties = "lawgraph.llm.reasoning-effort=low")
@org.springframework.context.annotation.Import(tw.lawgraph.auth.SecurityConfig.class)
class LlmProxyControllerTest {
    @Autowired MockMvcTester mvc;

    /** 假上游：記下收到的 body 與 Authorization，回固定 JSON。 */
    private static HttpServer upstream;
    private static final AtomicReference<String> receivedBody = new AtomicReference<>();
    private static final AtomicReference<String> receivedAuth = new AtomicReference<>();
    private static final AtomicReference<String> receivedPath = new AtomicReference<>();

    @BeforeAll static void startUpstream() throws Exception {
        upstream = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        upstream.createContext("/", exchange -> {
            receivedPath.set(exchange.getRequestURI().getPath());
            receivedAuth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            receivedBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] reply = "{\"id\":\"chatcmpl-1\",\"choices\":[]}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, reply.length);
            exchange.getResponseBody().write(reply);
            exchange.close();
        });
        upstream.start();
    }

    @AfterAll static void stopUpstream() { upstream.stop(0); }

    /** 上游位址在伺服器啟動後才知道，動態注入。 */
    @DynamicPropertySource static void upstreamUrl(DynamicPropertyRegistry registry) {
        registry.add("lawgraph.llm.upstream-base-url", () -> "http://127.0.0.1:" + upstream.getAddress().getPort() + "/v1");
    }

    /** 轉送到上游的 /v1/chat/completions，body 加上 reasoning_effort，Authorization 原樣帶過去，回傳上游回應。 */
    @Test void forwardsWithReasoningEffortAndAuthorization() {
        var result = mvc.post().uri("/internal/llm/v1/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer secret-key")
                .content("{\"model\":\"muse-spark-1.3-contributor\",\"messages\":[]}")
                .exchange();
        assertThat(result).hasStatusOk();
        assertThat(result).bodyJson().extractingPath("$.id").isEqualTo("chatcmpl-1");
        assertThat(receivedPath.get()).isEqualTo("/v1/chat/completions");
        assertThat(receivedAuth.get()).isEqualTo("Bearer secret-key");
        assertThat(receivedBody.get()).contains("\"reasoning_effort\":\"low\"");
    }

    /** 非本機來源一律 403，避免公開網址被拿來當 LLM 跳板。 */
    @Test void rejectsNonLoopbackCallers() {
        var result = mvc.post().uri("/internal/llm/v1/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Forwarded-For", "203.0.113.9")
                .with(request -> { request.setRemoteAddr("203.0.113.9"); return request; })
                .content("{\"model\":\"m\"}")
                .exchange();
        assertThat(result).hasStatus(403);
    }
}
