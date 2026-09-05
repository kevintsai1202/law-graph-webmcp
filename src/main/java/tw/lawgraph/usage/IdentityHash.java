package tw.lawgraph.usage;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** 將識別用的原始字串（如 IP、會員 ID）以 SHA-256 雜湊為固定長度十六進位字串，避免原文外洩至資料庫。 */
public final class IdentityHash {
    private IdentityHash() {
    }

    /** 計算輸入字串的 SHA-256 雜湊，回傳小寫十六進位字串（長度固定 64）。 */
    public static String of(String key) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(key.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }
}
