package tw.lawgraph.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 四個示範案例在兩種語系使用一致 ID。 */
@WebMvcTest(controllers = SamplesController.class)
class SamplesControllerTest {
    @Autowired MockMvcTester mvc;

    /** 各語系回四筆，未知語系回英文。 */
    @Test void returnsFourSamplesPerLocaleWithStableIds() {
        assertThat(mvc.get().uri("/api/samples?locale=zh-TW")).hasStatusOk()
                .bodyJson().extractingPath("$.length()").isEqualTo(6);
        assertThat(mvc.get().uri("/api/samples?locale=en")).hasStatusOk()
                .bodyJson().extractingPath("$[0].id").isEqualTo("family-house-sale");
        assertThat(mvc.get().uri("/api/samples?locale=xx")).hasStatusOk()
                .bodyJson().extractingPath("$[0].id").isEqualTo("family-house-sale");
    }

    /** mode=contract 回兩個合約示範；未帶 mode 維持六個案件示範。 */
    @Test void samplesFilteredByMode() throws Exception {
        var controller = new SamplesController();
        assertEquals(6, controller.samples("zh-TW", null).size());
        var contracts = controller.samples("zh-TW", "contract");
        assertEquals(2, contracts.size());
        assertEquals(List.of("labor-contract", "software-dev-contract"), contracts.stream().map(SampleCase::id).toList());
        assertTrue(contracts.stream().allMatch(s -> "contract".equals(s.mode())));
        assertEquals(2, controller.samples("en", "contract").size());
    }
}
