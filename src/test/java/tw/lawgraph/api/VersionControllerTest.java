package tw.lawgraph.api;

import org.junit.jupiter.api.Test;
import org.springframework.boot.info.BuildProperties;

import java.time.Instant;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

/** /api/version：有 build-info 用建置時間；沒有時退回啟動時間；回應不可被快取。 */
class VersionControllerTest {

    @Test
    void 有建置資訊時以建置時間為版本() {
        Properties p = new Properties();
        p.setProperty("time", "2026-09-05T10:00:00Z");
        VersionController c = new VersionController(new BuildProperties(p), Instant.parse("2026-09-05T12:00:00Z"));
        assertThat(c.version()).isEqualTo("2026-09-05T10:00:00Z");
        assertThat(c.get().getBody()).containsEntry("version", "2026-09-05T10:00:00Z");
    }

    @Test
    void 沒有建置資訊時退回啟動時間且回應帶_no_store() {
        VersionController c = new VersionController(null, Instant.parse("2026-09-05T12:00:00Z"));
        assertThat(c.version()).isEqualTo("2026-09-05T12:00:00Z");
        assertThat(c.get().getHeaders().getCacheControl()).contains("no-store");
    }
}
