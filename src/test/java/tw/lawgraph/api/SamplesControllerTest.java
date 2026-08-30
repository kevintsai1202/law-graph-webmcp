package tw.lawgraph.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

import static org.assertj.core.api.Assertions.assertThat;

/** 四個示範案例在兩種語系使用一致 ID。 */
@WebMvcTest(controllers = SamplesController.class)
class SamplesControllerTest {
    @Autowired MockMvcTester mvc;

    /** 各語系回四筆，未知語系回英文。 */
    @Test void returnsFourSamplesPerLocaleWithStableIds() {
        assertThat(mvc.get().uri("/api/samples?locale=zh-TW")).hasStatusOk()
                .bodyJson().extractingPath("$.length()").isEqualTo(4);
        assertThat(mvc.get().uri("/api/samples?locale=en")).hasStatusOk()
                .bodyJson().extractingPath("$[0].id").isEqualTo("settop-box");
        assertThat(mvc.get().uri("/api/samples?locale=xx")).hasStatusOk()
                .bodyJson().extractingPath("$[0].id").isEqualTo("settop-box");
    }
}
