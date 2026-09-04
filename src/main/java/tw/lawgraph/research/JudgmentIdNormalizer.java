package tw.lawgraph.research;

import java.text.Normalizer;
import java.util.Optional;

/** 將不同 MCP 軌道的 JID 表示法轉為只供比較使用的 canonical key。 */
public final class JudgmentIdNormalizer {
    private JudgmentIdNormalizer() {}

    /** 執行 NFKC、全半形整理、ASCII 小寫與分隔符旁空白收斂。 */
    public static String canonicalize(String rawId) {
        if (rawId == null || rawId.isBlank()) return "";
        String normalized = Normalizer.normalize(rawId, Normalizer.Form.NFKC).trim();
        normalized = normalized.replaceAll("\\s+", " ");
        normalized = normalized.replaceAll("\\s*([,;:/])\\s*", "$1");
        return normalized.toLowerCase(java.util.Locale.ROOT);
    }

    /** 回傳可用 canonical key；空白 JID 以 empty 表示，不以 citation 代替。 */
    public static Optional<String> key(String rawId) {
        String canonical = canonicalize(rawId);
        return canonical.isBlank() ? Optional.empty() : Optional.of(canonical);
    }
}
