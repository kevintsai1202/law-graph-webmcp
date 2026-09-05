package tw.lawgraph.domain;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 合約審查範疇的唯一定義：代碼、固定順序與中文名稱（對應 compliance-verification 步驟一的四類）。 */
public final class ContractScopes {
    /** 代碼 → 中文名稱；LinkedHashMap 保序。 */
    private static final Map<String, String> TITLES = new LinkedHashMap<>();
    static {
        TITLES.put("commercial", "一般商務契約（民法債編）");
        TITLES.put("labor", "勞動契約（勞動基準法）");
        TITLES.put("privacy", "行銷與個資（個人資料保護法）");
        TITLES.put("corporate", "公司治理（公司法）");
    }
    /** 四個範疇代碼的固定順序。 */
    public static final List<String> CODES = List.copyOf(TITLES.keySet());

    private ContractScopes() {}

    /** 過濾未知代碼、去重並依固定順序輸出；null 視為空。 */
    public static List<String> normalize(List<String> requested) {
        if (requested == null) return List.of();
        return CODES.stream().filter(requested::contains).toList();
    }

    /** 取中文名稱；未知回空字串。 */
    public static String chineseTitle(String code) { return TITLES.getOrDefault(code, ""); }
}
