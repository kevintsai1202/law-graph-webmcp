package tw.lawgraph.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import tw.lawgraph.domain.Locale;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/** REST 契約：狀態碼、JSON 形狀與限流。 */
@WebMvcTest(controllers = CaseController.class, properties = "lawgraph.rate-limit-per-hour=2")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class CaseControllerTest {
    @Autowired MockMvcTester mvc;
    @MockitoBean CaseService service;

    /** 建立 RUNNING 測試狀態。 */
    private CaseStatus running() {
        return new CaseStatus("p1", "RUNNING", "BRAINSTORM", "en", null, null, null);
    }

    /** POST /api/cases 成功回 201。 */
    @Test void postCasesReturns201WithStatus() {
        when(service.start("A hit B", Locale.EN)).thenReturn(running());
        assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON)
                .content("{\"caseText\":\"A hit B\",\"locale\":\"en\"}"))
                .hasStatus(201).bodyJson().extractingPath("$.caseId").isEqualTo("p1");
    }

    /** 同 IP 第三次建立案件回 429。 */
    @Test void thirdPostFromSameIpIs429() {
        when(service.start(anyString(), any())).thenReturn(running());
        String body = "{\"caseText\":\"x\",\"locale\":\"en\"}";
        mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON).content(body).exchange();
        mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON).content(body).exchange();
        assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON).content(body)).hasStatus(429);
    }

    /** 未知案件回 404 與錯誤代碼。 */
    @Test void unknownCaseIs404() {
        when(service.status("nope")).thenThrow(new CaseNotFoundException("nope"));
        assertThat(mvc.get().uri("/api/cases/nope")).hasStatus(404)
                .bodyJson().extractingPath("$.error").isEqualTo("CASE_NOT_FOUND");
    }

    /** 非 WAITING 提交答案回 409。 */
    @Test void answersWhenNotWaitingIs409() {
        when(service.answer(eq("p1"), anyList())).thenThrow(new CaseNotWaitingException("p1"));
        assertThat(mvc.post().uri("/api/cases/p1/answers").contentType(MediaType.APPLICATION_JSON)
                .content("{\"answers\":[{\"questionId\":\"q1\",\"answer\":\"yes\"}]}"))
                .hasStatus(409);
    }

    /** 空白案情回 400。 */
    @Test void blankCaseTextIs400() {
        assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON)
                .content("{\"caseText\":\"  \",\"locale\":\"en\"}")).hasStatus(400);
    }
}
