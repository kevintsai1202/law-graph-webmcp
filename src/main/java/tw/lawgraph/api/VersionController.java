package tw.lawgraph.api;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.info.BuildProperties;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * GET /api/version：回報目前執行中的建置版本，讓前端比對後在網站重佈時提示「重新載入」。
 * 版本字串取自 Maven build-info 的建置時間（每次 Zeabur 重建都不同）；本機沒有 build-info 時退回程序啟動時間。
 * 回應帶 no-store，避免代理或瀏覽器快取舊版本號讓比對永遠相同。
 */
@RestController
public class VersionController {
    /** 本次執行的版本識別字串，程序生命週期內固定。 */
    private final String version;

    @Autowired
    public VersionController(ObjectProvider<BuildProperties> build) {
        this(build.getIfAvailable(), Instant.now());
    }

    /** 測試用建構子：可注入 build-info（可為 null）與啟動時間。 */
    VersionController(BuildProperties build, Instant startedAt) {
        Instant buildTime = build == null ? null : build.getTime();
        this.version = (buildTime != null ? buildTime : startedAt).toString();
    }

    /** 目前版本字串（測試與其他元件可直接讀）。 */
    public String version() {
        return version;
    }

    @GetMapping("/api/version")
    public ResponseEntity<Map<String, String>> get() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("version", version));
    }
}
