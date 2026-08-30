package tw.lawgraph.api;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** 條號與字號解析決定要呼叫的 MCP 工具。 */
class CitationVerifierTest {
    /** 解析含項次的法條。 */
    @Test void parsesStatuteWithArticleAndParagraph() {
        var target = CitationVerifier.parse("民法第184條第1項");
        assertEquals(CitationVerifier.Kind.LAW, target.kind());
        assertEquals("民法", target.lawName()); assertEquals("184", target.articleNo());
    }

    /** 雙語標籤以括號內中文作為檢索鍵。 */
    @Test void parsesBilingualFormUsingChinesePart() {
        var target = CitationVerifier.parse("Civil Code Art. 217（民法第217條）");
        assertEquals("民法", target.lawName()); assertEquals("217", target.articleNo());
    }

    /** 解析法院、年度、字別與案號。 */
    @Test void parsesJudgmentCitation() {
        var target = CitationVerifier.parse("最高法院108年度台上字第2345號");
        assertEquals(CitationVerifier.Kind.JUDGMENT, target.kind());
        assertEquals("最高法院 108 台上 2345", target.judgmentKeyword());
    }

    /** 無法辨識的字串回 UNKNOWN。 */
    @Test void unknownWhenNothingMatches() {
        assertEquals(CitationVerifier.Kind.UNKNOWN, CitationVerifier.parse("hello").kind());
    }
}
