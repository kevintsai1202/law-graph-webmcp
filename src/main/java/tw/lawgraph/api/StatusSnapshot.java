package tw.lawgraph.api;

import com.embabel.agent.core.AgentProcessStatusCode;
import tw.lawgraph.domain.AnalysisResult;
import tw.lawgraph.domain.BrainstormResult;
import tw.lawgraph.domain.GraphOutcome;
import tw.lawgraph.domain.Locale;
import tw.lawgraph.domain.Question;
import tw.lawgraph.domain.ResearchResult;
import tw.lawgraph.domain.UserAnswers;

import java.util.List;

/** 從 AgentProcess blackboard 擷取的純資料快照。 */
public record StatusSnapshot(String caseId, Locale locale, AgentProcessStatusCode code,
                             BrainstormResult brainstorm, List<Question> pendingQuestions, UserAnswers answers,
                             ResearchResult research, AnalysisResult analysis, GraphOutcome outcome, String failure) {}
