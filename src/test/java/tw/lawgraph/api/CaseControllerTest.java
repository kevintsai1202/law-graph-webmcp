package tw.lawgraph.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import tw.lawgraph.domain.Locale;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** REST 契約：狀態碼、JSON 形狀與限流。 */
@WebMvcTest(controllers = CaseController.class, properties = "lawgraph.rate-limit-per-hour=2")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class CaseControllerTest {
    @Autowired MockMvcTester mvc;
    @Autowired MockMvc mockMvc;
    @MockitoBean CaseService service;
    @MockitoBean CaseFileExtractor fileExtractor;

    /** 建立 RUNNING 測試狀態。 */
    private CaseStatus running() {
        return new CaseStatus("p1", "RUNNING", "BRAINSTORM", "en", null, null, null);
    }

    /** POST /api/cases 成功回 201；未帶 documents 視為未勾選。 */
    @Test void postCasesReturns201WithStatus() {
        when(service.start("A hit B", Locale.EN, java.util.List.of())).thenReturn(running());
        assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON)
                .content("{\"caseText\":\"A hit B\",\"locale\":\"en\"}"))
                .hasStatus(201).bodyJson().extractingPath("$.caseId").isEqualTo("p1");
    }

    /** documents 勾選清單需原樣轉交服務層。 */
    @Test void postCasesForwardsDocuments() {
        when(service.start("A hit B", Locale.EN, java.util.List.of("complaint", "issues"))).thenReturn(running());
        assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON)
                .content("{\"caseText\":\"A hit B\",\"locale\":\"en\",\"documents\":[\"complaint\",\"issues\"]}"))
                .hasStatus(201).bodyJson().extractingPath("$.caseId").isEqualTo("p1");
    }

    /** multipart 附件解析後需以有來源邊界的文字啟動同一案件流程。 */
    @Test void multipartCaseStartsFromExtractedDocument() throws Exception {
        var upload = new MockMultipartFile("files", "facts.md", "text/markdown", "# Facts".getBytes());
        var extracted = java.util.List.of(new CaseFileExtractor.ExtractedFile("facts.md", "# Facts"));
        when(fileExtractor.extract(anyList())).thenReturn(extracted);
        when(fileExtractor.composeCaseText("事故說明", extracted)).thenReturn("composed case");
        when(service.start("composed case", Locale.ZH_TW, java.util.List.of("complaint"))).thenReturn(running());

        mockMvc.perform(multipart("/api/cases").file(upload)
                        .param("caseText", "事故說明").param("locale", "zh-TW").param("documents", "complaint"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.caseId").value("p1"));
    }

    /** 同 IP 第三次建立案件回 429。 */
    @Test void thirdPostFromSameIpIs429() {
        when(service.start(anyString(), any(), anyList())).thenReturn(running());
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
