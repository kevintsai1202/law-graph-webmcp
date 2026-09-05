package tw.lawgraph.api;

import com.embabel.agent.core.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tw.lawgraph.agent.ContractReviewAgent;
import tw.lawgraph.agent.LegalGraphAgent;
import tw.lawgraph.domain.*;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** CaseService 依 mode 挑 agent，狀態帶 mode 與合約產物。 */
class CaseServiceContractTest {
    private final AgentPlatform platform = mock(AgentPlatform.class);
    private final Agent caseAgent = mock(Agent.class), contractAgent = mock(Agent.class);
    private final AgentProcess process = mock(AgentProcess.class);
    private final Blackboard blackboard = mock(Blackboard.class);
    private CaseService service;

    @BeforeEach void setUp() {
        when(caseAgent.getName()).thenReturn(LegalGraphAgent.AGENT_NAME);
        when(contractAgent.getName()).thenReturn(ContractReviewAgent.AGENT_NAME);
        when(platform.agents()).thenReturn(List.of(caseAgent, contractAgent));
        when(platform.createAgentProcessFrom(any(Agent.class), any(ProcessOptions.class), any())).thenReturn(process);
        when(platform.getAgentProcess("p1")).thenReturn(process);
        when(platform.start(process)).thenReturn(CompletableFuture.completedFuture(process));
        when(process.getId()).thenReturn("p1");
        when(process.getBlackboard()).thenReturn(blackboard);
        when(process.getStatus()).thenReturn(AgentProcessStatusCode.RUNNING);
        service = new CaseService(platform);
    }

    @Test void startContractUsesContractAgentAndReportsMode() {
        var input = new ContractInput("合約全文", Locale.ZH_TW, "partyA", List.of("labor"), List.of(), "");
        var status = service.startContract(input);
        verify(platform).createAgentProcessFrom(eq(contractAgent), any(ProcessOptions.class), eq(input));
        assertEquals(CaseMode.CONTRACT, status.mode());
        assertEquals("LOAD", status.step());
    }

    @Test void contractStatusReadsContractArtifacts() {
        service.startContract(new ContractInput("x", Locale.EN, "unknown", List.of(), List.of(), ""));
        var brainstorm = new ContractBrainstorm("NDA", List.of(), List.of(), List.of(), List.of(), "");
        when(blackboard.last(ContractBrainstorm.class)).thenReturn(brainstorm);
        var status = service.status("p1");
        assertEquals("QUESTIONS", status.step());
        assertEquals(brainstorm, status.result().contract());
    }

    @Test void legacyStartStillUsesCaseAgent() {
        service.start("A hit B", Locale.EN, List.of());
        verify(platform).createAgentProcessFrom(eq(caseAgent), any(ProcessOptions.class), any(CaseInput.class));
        assertEquals(CaseMode.CASE, service.status("p1").mode());
    }
}
