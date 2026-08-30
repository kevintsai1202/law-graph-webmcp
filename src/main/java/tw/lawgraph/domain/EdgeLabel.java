package tw.lawgraph.domain;

import java.util.Arrays;

/** legal-graph 技能定義的連線標籤白名單；渲染器依這些字串分流樣式。 */
public enum EdgeLabel {
    APPLY("適用"), CITE("引用"), CIVIL_ATTACHED("刑事附帶民事 (民附)"), APPEAL("上訴"),
    JOINT("連帶責任/保證"), DEFENSE("抗辯/阻斷"), PRESERVE("保全/假扣押"), LAW_REL("法條關聯"),
    PARTY("當事人"), EVIDENCE("證據"), INCLUDE("包含"), IMPOSE("課予"), BEAR("負擔"),
    CLAIM("得請求"), CONSIDERATION("對價"), BREACH("違約效果"), ELEMENT("要件"), MEETS("該當"),
    ELEMENT_FINDING("要件認定");

    private final String label;

    EdgeLabel(String label) {
        this.label = label;
    }

    /** 回傳序列化與渲染使用的中文標籤。 */
    public String label() {
        return label;
    }

    /** 判斷輸入是否完全符合合法標籤。 */
    public static boolean isValid(String label) {
        return label != null && Arrays.stream(values()).anyMatch(edgeLabel -> edgeLabel.label.equals(label));
    }
}
