package tw.lawgraph;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

/** 建置煙霧測試：確認主類別可載入。 */
class SmokeTest {

    /** 確認應用程式主類別可由測試執行環境載入。 */
    @Test
    void mainClassLoads() {
        assertNotNull(LawGraphApplication.class);
    }
}
