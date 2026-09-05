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
@WebMvcTest(controllers = CaseController.class, properties = {"lawgraph.rate-limit-per-hour=2", "lawgraph.daily-cases-per-user=0"})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@org.springframework.context.annotation.Import({tw.lawgraph.auth.SecurityConfig.class, QuotaIdentityResolver.class, tw.lawgraph.auth.AccessPolicy.class})
class CaseControllerTest {
    @Autowired MockMvcTester mvc;
    @Autowired MockMvc mockMvc;
    @MockitoBean CaseService service;
    @MockitoBean CaseFileExtractor fileExtractor;
    @MockitoBean tw.lawgraph.usage.DailyTokenBudget budget;
    /** 配額計數與案件事件記錄的儲存（預設 countToday 回 0，不擋任何請求）。 */
    @MockitoBean tw.lawgraph.usage.UsageEventStore events;

    /** 每日 token 預算用盡時，啟動案件與提交答案都回 503 DAILY_TOKEN_LIMIT，且不進入服務層。 */
    @Test void dailyTokenLimitBlocksNewCasesAndAnswers() {
        when(budget.exhausted()).thenReturn(true);
        when(budget.snapshot()).thenReturn(new tw.lawgraph.usage.DailyTokenBudget.Snapshot(
                "2026-09-04", 1_500_000, 600_000, 2_100_000, 2_000_000, false, true, "file"));
        when(service.status("p1")).thenReturn(new CaseStatus("p1", "WAITING", "QUESTIONS", "zh-TW", null, null, null));

        assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON)
                .content("{\"caseText\":\"A hit B\",\"locale\":\"zh-TW\"}"))
                .hasStatus(503).bodyJson().extractingPath("$.error").isEqualTo("DAILY_TOKEN_LIMIT");
        assertThat(mvc.post().uri("/api/cases/p1/answers").contentType(MediaType.APPLICATION_JSON)
                .content("{\"answers\":[]}"))
                .hasStatus(503).bodyJson().extractingPath("$.message").asString().contains("今日 AI 額度");
        org.mockito.Mockito.verify(service, org.mockito.Mockito.never()).start(anyString(), any(), anyList(), anyString(), anyString());
        org.mockito.Mockito.verify(service, org.mockito.Mockito.never()).answer(anyString(), anyList());
    }

    /** 建立 RUNNING 測試狀態。 */
    private CaseStatus running() {
        return new CaseStatus("p1", "RUNNING", "BRAINSTORM", "en", null, null, null);
    }

    /** POST /api/cases 成功回 201；未帶 documents 視為未勾選。 */
    @Test void postCasesReturns201WithStatus() {
        when(service.start(eq("A hit B"), eq(Locale.EN), eq(java.util.List.of()), eq(""), any(CaseStartContext.class))).thenReturn(running());
        assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON)
                .content("{\"caseText\":\"A hit B\",\"locale\":\"en\"}"))
                .hasStatus(201).bodyJson().extractingPath("$.caseId").isEqualTo("p1");
    }

    /** 聲請事項需與 documents 一併轉交服務層（JSON 與 multipart）。 */
    @Test void postCasesForwardsMotionRequest() throws Exception {
        when(service.start(eq("A hit B"), eq(Locale.ZH_TW), eq(java.util.List.of("motion")), eq("聲請調查證據"), any(CaseStartContext.class))).thenReturn(running());
        assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON)
                .content("{\"caseText\":\"A hit B\",\"locale\":\"zh-TW\",\"documents\":[\"motion\"],\"motionRequest\":\"聲請調查證據\"}"))
                .hasStatus(201);
        var upload = new MockMultipartFile("files", "facts.md", "text/markdown", "# Facts".getBytes());
        var extracted = java.util.List.of(new CaseFileExtractor.ExtractedFile("facts.md", "# Facts"));
        when(fileExtractor.extract(anyList())).thenReturn(extracted);
        when(fileExtractor.composeCaseText("x", extracted)).thenReturn("composed");
        when(service.start(eq("composed"), eq(Locale.ZH_TW), eq(java.util.List.of("motion")), eq("聲請假扣押"), any(CaseStartContext.class))).thenReturn(running());
        mockMvc.perform(multipart("/api/cases").file(upload).param("caseText", "x").param("locale", "zh-TW")
                        .param("documents", "motion").param("motionRequest", "聲請假扣押"))
                .andExpect(status().isCreated());
    }

    /** documents 勾選清單需原樣轉交服務層。 */
    @Test void postCasesForwardsDocuments() {
        when(service.start(eq("A hit B"), eq(Locale.EN), eq(java.util.List.of("complaint", "issues")), eq(""), any(CaseStartContext.class))).thenReturn(running());
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
        when(service.start(eq("composed case"), eq(Locale.ZH_TW), eq(java.util.List.of("complaint")), eq(""), any(CaseStartContext.class))).thenReturn(running());

        mockMvc.perform(multipart("/api/cases").file(upload)
                        .param("caseText", "事故說明").param("locale", "zh-TW").param("documents", "complaint"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.caseId").value("p1"));
    }

    /** 同 IP 第三次建立案件回 429。 */
    @Test void thirdPostFromSameIpIs429() {
        when(service.start(anyString(), any(), anyList(), anyString(), any(CaseStartContext.class))).thenReturn(running());
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

    /** 測試專用便宜模型：帶 X-LawGraph-Model 且值等於允許的測試模型時才轉交服務層，其他值一律忽略用預設模型。 */
    @Test void testModelHeaderOnlyAcceptsAllowedModel() {
        when(service.start(anyString(), any(), anyList(), anyString(), any(CaseStartContext.class))).thenReturn(running());

        assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON)
                .header("X-LawGraph-Model", "gpt-5.4-nano")
                .content("{\"caseText\":\"A hit B\",\"locale\":\"en\"}")).hasStatus(201);
        org.mockito.Mockito.verify(service).start(eq("A hit B"), eq(Locale.EN), eq(java.util.List.of()), eq(""),
                org.mockito.ArgumentMatchers.<CaseStartContext>argThat(c -> "gpt-5.4-nano".equals(c.model())));

        assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON)
                .header("X-LawGraph-Model", "gpt-5.4-pro")
                .content("{\"caseText\":\"A hit B\",\"locale\":\"en\"}")).hasStatus(201);
        org.mockito.Mockito.verify(service).start(eq("A hit B"), eq(Locale.EN), eq(java.util.List.of()), eq(""),
                org.mockito.ArgumentMatchers.<CaseStartContext>argThat(c -> c.model().isEmpty()));
    }
}
