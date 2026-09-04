package tw.lawgraph.api;

/** 將無文字層的 PDF 單頁圖片轉錄為文字。 */
public interface PdfPageVisionReader {
    /**
     * 忠實轉錄指定頁面；無法辨識的內容應明確標示，不得推測補全。
     *
     * @param filename 安全化後的附件檔名
     * @param pageNumber 從 1 開始的頁碼
     * @param pngBytes 頁面渲染後的 PNG bytes
     * @return 頁面轉錄文字
     */
    String transcribe(String filename, int pageNumber, byte[] pngBytes);
}
