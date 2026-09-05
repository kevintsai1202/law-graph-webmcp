package tw.lawgraph.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 靜態資源快取策略：/vendor/** 是固定版本的第三方套件（1.2 MB），可長期快取；
 * 其餘靜態檔沿用 application.yml 的 no-cache，重佈後使用者重新載入才拿得到新 bundle。
 */
@WebMvcTest(controllers = tw.lawgraph.api.VersionController.class)
@Import({tw.lawgraph.auth.SecurityConfig.class, StaticCacheConfig.class})
class StaticCacheConfigTest {
    @Autowired MockMvcTester mvc;

    @Test void vendor套件回長效immutable快取() {
        assertThat(mvc.get().uri("/vendor/three-spritetext.min.js"))
                .hasStatusOk()
                .headers().satisfies(h -> assertThat(h.getCacheControl()).contains("max-age=31536000").contains("immutable"));
    }

    @Test void 其餘靜態檔維持no_cache() {
        assertThat(mvc.get().uri("/js/main.js"))
                .hasStatusOk()
                .headers().satisfies(h -> assertThat(h.getCacheControl()).isEqualTo("no-cache"));
    }
}
