package tw.lawgraph.domain;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 可勾選書狀類型的唯一定義：代碼、固定順序與中文狀別名稱。 */
public final class DocumentTypes {
    /** 代碼 → 中文狀別名稱；LinkedHashMap 保序，即為輸出時的固定順序。 */
    private static final Map<String, String> TITLES = new LinkedHashMap<>();
    static {
        TITLES.put("complaint", "起訴狀");
        TITLES.put("reasons", "理由狀");
        TITLES.put("report", "陳報狀");
        TITLES.put("preparatory", "準備狀");
        TITLES.put("defense", "答辯狀");
        TITLES.put("issues", "爭點整理");
        TITLES.put("appeal", "上訴狀");
        TITLES.put("motion", "聲請狀");
    }

    /** 八種書狀代碼的固定順序清單。 */
    public static final List<String> CODES = List.copyOf(TITLES.keySet());

    private DocumentTypes() {}

    /** 過濾未知代碼、去重並依 CODES 固定順序輸出；null 視為空。 */
    public static List<String> normalize(List<String> requested) {
        if (requested == null) return List.of();
        return CODES.stream().filter(requested::contains).toList();
    }

    /** 取代碼的中文狀別名稱；未知代碼回空字串。 */
    public static String chineseTitle(String code) {
        return TITLES.getOrDefault(code, "");
    }
}
