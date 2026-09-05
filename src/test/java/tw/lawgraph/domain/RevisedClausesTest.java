package tw.lawgraph.domain;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
class RevisedClausesTest {
    @Test void nullsBecomeEmpty() {
        assertEquals(List.of(), new RevisedClauses(null).items());
        var item = new RevisedClauses.RevisedClause(null, null, null, null);
        assertEquals("", item.clauseNo()); assertEquals("", item.revised());
        assertTrue(RevisedClauses.EMPTY.items().isEmpty());
    }
}
