package tw.lawgraph.api;

/** 找不到指定 caseId。 */
public class CaseNotFoundException extends RuntimeException {
    /** 建立找不到案件的例外。 */
    public CaseNotFoundException(String id) { super("case not found: " + id); }
}
