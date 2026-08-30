package tw.lawgraph.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** 支援的輸出語系；未知或空值一律回英文。 */
public enum Locale {
    EN("en"), ZH_TW("zh-TW");

    private final String code;

    Locale(String code) {
        this.code = code;
    }

    /** 回傳 API 使用的語系代碼。 */
    @JsonValue
    public String code() {
        return code;
    }

    /** 將 API 語系代碼轉成列舉，未知值回英文。 */
    @JsonCreator
    public static Locale fromCode(String code) {
        for (var locale : values()) {
            if (locale.code.equalsIgnoreCase(code)) {
                return locale;
            }
        }
        return EN;
    }
}
