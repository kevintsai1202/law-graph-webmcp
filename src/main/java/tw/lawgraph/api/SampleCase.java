package tw.lawgraph.api;

/** 一鍵帶入的虛構示範；mode 為 case（預設）或 contract。 */
public record SampleCase(String id, String title, String summary, String text, String mode) {
    /** 緊湊建構子：mode 為 null 或未知值一律正規化為 case。 */
    public SampleCase {
        mode = CaseMode.normalize(mode);
    }
}
