package tw.lawgraph.usage;

import com.fasterxml.jackson.databind.json.JsonMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * 以 JSON 檔保存每日累計（原子替換寫入）。
 * 只能撐過同一容器的重啟；容器沒有持久卷時重佈會歸零，正式環境請改用 JdbcUsageStore。
 */
public final class FileUsageStore implements UsageStore {
    private static final Logger LOGGER = LoggerFactory.getLogger(FileUsageStore.class);
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private final Path path;

    public FileUsageStore(String path) {
        if (path == null || path.isBlank()) throw new IllegalArgumentException("usage file path is required");
        this.path = Path.of(path);
    }

    @Override
    public Optional<DailyUsage> load(LocalDate day) {
        if (!Files.isRegularFile(path)) return Optional.empty();
        try {
            Map<?, ?> map = JSON.readValue(Files.readString(path, StandardCharsets.UTF_8), Map.class);
            if (!day.toString().equals(String.valueOf(map.get("date")))) return Optional.empty();
            // 舊檔沒有這三個欄位時 toLong(null) 回 0，向下相容。
            return Optional.of(new DailyUsage(day, toLong(map.get("promptTokens")), toLong(map.get("completionTokens")),
                    toLong(map.get("llmCalls")), toLong(map.get("cachedTokens")), toLong(map.get("reasoningTokens"))));
        } catch (Exception exception) {
            LOGGER.warn("無法載入 token 用量檔，改以 0 起算。錯誤類型={}", exception.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    @Override
    public void save(DailyUsage usage) {
        try {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("date", usage.day().toString());
            data.put("promptTokens", usage.promptTokens());
            data.put("completionTokens", usage.completionTokens());
            data.put("llmCalls", usage.llmCalls());
            data.put("cachedTokens", usage.cachedTokens());
            data.put("reasoningTokens", usage.reasoningTokens());
            if (path.getParent() != null) Files.createDirectories(path.getParent());
            Path temp = path.resolveSibling(path.getFileName() + ".tmp");
            Files.writeString(temp, JSON.writeValueAsString(data), StandardCharsets.UTF_8);
            Files.move(temp, path, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException | RuntimeException exception) {
            LOGGER.warn("無法保存 token 用量檔。錯誤類型={}", exception.getClass().getSimpleName());
        }
    }

    @Override
    public String name() {
        return "file";
    }

    private static long toLong(Object value) {
        if (value instanceof Number number) return number.longValue();
        try {
            return value == null ? 0 : Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }
}
