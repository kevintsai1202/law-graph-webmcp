package tw.lawgraph.auth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 使用授權排除名單：整個網域（含子網域）與個別信箱，不分大小寫；沒設定就不排除任何人。 */
class AccessPolicyTest {

    /** 網域比對含子網域與大小寫。 */
    @Test void blocksDomainAndSubdomains() {
        var policy = new AccessPolicy("Example-Law.com.tw, @other.tw", "");
        assertTrue(policy.isBlocked("someone@example-law.com.tw"));
        assertTrue(policy.isBlocked("A@Mail.Example-Law.com.tw"));
        assertTrue(policy.isBlocked("x@other.tw"));
        assertFalse(policy.isBlocked("x@notexample-law.com.tw"));
        assertFalse(policy.isBlocked("x@gmail.com"));
    }

    /** 個別信箱比對。 */
    @Test void blocksExactEmails() {
        var policy = new AccessPolicy("", "boss@gmail.com");
        assertTrue(policy.isBlocked("Boss@Gmail.com"));
        assertFalse(policy.isBlocked("other@gmail.com"));
    }

    /** 未設定或空 email 一律不排除。 */
    @Test void emptyConfigBlocksNobody() {
        var policy = new AccessPolicy("", "");
        assertFalse(policy.isBlocked("anyone@anywhere.tw"));
        assertFalse(policy.isBlocked(null));
    }
}
