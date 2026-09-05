package tw.lawgraph.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import tw.lawgraph.domain.ContractInput;
import tw.lawgraph.domain.Locale;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** mode=contract 時建立 ContractInput 並交給 startContract；documents 即輸出勾選。 */
@WebMvcTest(controllers = CaseController.class, properties = {"lawgraph.rate-limit-per-hour=20", "lawgraph.daily-cases-per-user=0"})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@org.springframework.context.annotation.Import({tw.lawgraph.auth.SecurityConfig.class, QuotaIdentityResolver.class, tw.lawgraph.auth.AccessPolicy.class})
class CaseControllerContractTest {
    @Autowired MockMvcTester mvc;
    @Autowired MockMvc mockMvc;
    @MockitoBean CaseService service;
    @MockitoBean CaseFileExtractor fileExtractor;
    @MockitoBean tw.lawgraph.usage.DailyTokenBudget budget;
    /** 配額計數與案件事件記錄的儲存（預設 countToday 回 0，不擋任何請求）。 */
    @MockitoBean tw.lawgraph.usage.UsageEventStore events;

    private static CaseStatus running() {
        return new CaseStatus("p1", "RUNNING", "LOAD", "zh-TW", null, null, null, CaseMode.CONTRACT);
    }

    @Test void jsonContractStart() {
        var expected = new ContractInput("合約全文", Locale.ZH_TW, "partyB", List.of("labor", "privacy"), List.of("revised"), "");
        when(service.startContract(eq(expected), any(CaseStartContext.class))).thenReturn(running());
        assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON)
                .content("{\"caseText\":\"合約全文\",\"locale\":\"zh-TW\",\"mode\":\"contract\",\"party\":\"partyB\",\"scopes\":[\"privacy\",\"labor\"],\"documents\":[\"revised\"]}"))
                .hasStatus(201).bodyJson().extractingPath("$.mode").isEqualTo("contract");
        verify(service, never()).start(anyString(), any(), anyList(), anyString(), any(CaseStartContext.class));
    }

    @Test void multipartContractStartComposesFiles() throws Exception {
        var upload = new MockMultipartFile("files", "contract.md", "text/markdown", "# 合約".getBytes());
        var extracted = List.of(new CaseFileExtractor.ExtractedFile("contract.md", "# 合約"));
        when(fileExtractor.extract(anyList())).thenReturn(extracted);
        when(fileExtractor.composeCaseText("", extracted)).thenReturn("composed");
        when(service.startContract(eq(new ContractInput("composed", Locale.ZH_TW, "partyA", List.of("commercial"), List.of(), "")), any(CaseStartContext.class))).thenReturn(running());
        mockMvc.perform(multipart("/api/cases").file(upload).param("locale", "zh-TW").param("mode", "contract")
                        .param("party", "partyA").param("scopes", "commercial"))
                .andExpect(status().isCreated());
    }

    @Test void unknownModeFallsBackToCase() {
        when(service.start(eq("A hit B"), eq(Locale.EN), eq(List.of()), eq(""), any(CaseStartContext.class))).thenReturn(new CaseStatus("p1", "RUNNING", "BRAINSTORM", "en", null, null, null));
        assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON)
                .content("{\"caseText\":\"A hit B\",\"locale\":\"en\",\"mode\":\"weird\"}"))
                .hasStatus(201).bodyJson().extractingPath("$.mode").isEqualTo("case");
    }
}
