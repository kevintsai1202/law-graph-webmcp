package tw.lawgraph.mcp;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.images.builder.ImageFromDockerfile;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tw.lawgraph.api.CitationVerifier;

import java.nio.file.Path;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** 啟動真實 sidecar，驗證 Spring AI MCP client 與台灣法規查詢。 */
@Testcontainers
@SpringBootTest(properties = "OPENAI_API_KEY=test-key")
class LegalMcpIT {
    static { assumeTrue(DockerClientFactory.instance().isDockerAvailable(), "需要 Docker"); }

    @Container
    static GenericContainer<?> legalMcp = new GenericContainer<>(
            new ImageFromDockerfile().withFileFromPath(".", Path.of("docker/legal-mcp")))
            .withExposedPorts(8000).waitingFor(Wait.forListeningPort())
            .withStartupTimeout(Duration.ofMinutes(5));

    /** 將動態容器位址交給 Spring AI MCP client。 */
    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.ai.mcp.client.streamable-http.connections.legal-mcp.url",
                () -> "http://" + legalMcp.getHost() + ":" + legalMcp.getMappedPort(8000));
    }

    @Autowired CitationVerifier verifier;

    /** 民法第 184 條應可由官方法規資料來源查得。 */
    @Test
    void verifiesCivilCodeArticle184() {
        var verification = verifier.verify("民法第184條");
        assertTrue(verification.exists(), "snippet=" + verification.snippet());
        assertEquals("law.moj.gov.tw", verification.source());
    }
}
