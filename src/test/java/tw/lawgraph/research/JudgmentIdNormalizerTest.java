package tw.lawgraph.research;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 驗證司法院 JID 的安全正規化，不以 citation 猜測案件編號。 */
class JudgmentIdNormalizerTest {

    /** 應只整理 Unicode、大小寫、分隔符空白，不破壞中文字號內容。 */
    @Test
    void canonicalizesFormattingWithoutChangingRawId() {
        assertEquals("tpsv,108,台上,2345", JudgmentIdNormalizer.canonicalize("  ＴＰＳＶ，１０８，台上，２３４５  "));
        assertEquals("tpsv,108,台上,2345", JudgmentIdNormalizer.canonicalize("TPSV, 108, 台上, 2345"));
        assertEquals("最高法院 108 年度台上字第 2345 號", JudgmentIdNormalizer.canonicalize(
                "最高法院　108　年度台上字第　2345　號"));
    }

    /** 空白或 null JID 必須被拒絕，不能以 citation 當替代鍵。 */
    @Test
    void rejectsMissingIds() {
        assertTrue(JudgmentIdNormalizer.canonicalize(null).isEmpty());
        assertTrue(JudgmentIdNormalizer.canonicalize(" \t").isEmpty());
    }
}
