package tw.lawgraph.api;

/** 流程不在 WAITING 卻收到回答。 */
public class CaseNotWaitingException extends RuntimeException {
    /** 建立案件不接受回答的例外。 */
    public CaseNotWaitingException(String id) { super("case is not waiting for answers: " + id); }
}
