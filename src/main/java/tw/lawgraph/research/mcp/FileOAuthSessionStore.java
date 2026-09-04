package tw.lawgraph.research.mcp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.AclEntry;
import java.nio.file.attribute.AclEntryPermission;
import java.nio.file.attribute.AclEntryType;
import java.nio.file.attribute.AclFileAttributeView;
import java.nio.file.attribute.PosixFileAttributeView;
import java.nio.file.attribute.PosixFilePermission;
import java.time.Instant;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * 以本機 JSON 檔保存 OAuth refresh token（本機開發預設）；檔案限制為擁有者可讀寫，寫入採原子替換。
 * 容器重佈會連同檔案消失，正式環境改用 {@link JdbcOAuthSessionStore}。
 */
public final class FileOAuthSessionStore implements OAuthSessionStore {
    private static final Logger LOGGER = LoggerFactory.getLogger(FileOAuthSessionStore.class);
    private static final JsonMapper JSON = JsonMapper.builder().build();
    /** 正規化後的絕對路徑，讓讀、寫、刪除指向同一個檔案。 */
    private final Path path;

    /** 以設定路徑建立；路徑空白時一律不保存（load 為空、save 無作用）。 */
    public FileOAuthSessionStore(String sessionPath) {
        this.path = sessionPath == null || sessionPath.isBlank()
                ? null : Paths.get(sessionPath).toAbsolutePath().normalize();
    }

    /** 讀檔失敗（格式錯誤、缺欄位）時視為無憑證並清掉壞檔；暫時性 IO 錯誤保留檔案。 */
    @Override
    @SuppressWarnings("unchecked")
    public Optional<SavedSession> load() {
        if (path == null || !Files.isRegularFile(path)) return Optional.empty();
        Map<String, Object> map;
        try {
            Object value = JSON.readValue(Files.readString(path, StandardCharsets.UTF_8), Object.class);
            if (!(value instanceof Map<?, ?> raw)) throw new IllegalArgumentException("not object");
            map = (Map<String, Object>) raw;
        } catch (IOException exception) {
            return Optional.empty();
        } catch (RuntimeException exception) {
            clear();
            return Optional.empty();
        }
        String clientId = text(map.get("client_id"));
        String refreshToken = text(map.get("refresh_token"));
        if (clientId == null || refreshToken == null) {
            clear();
            return Optional.empty();
        }
        return Optional.of(new SavedSession(clientId, refreshToken));
    }

    /** 寫入僅擁有者可讀寫的暫存檔，再原子替換，避免半寫入內容。 */
    @Override
    public void save(SavedSession session) {
        if (path == null || session == null || session.refreshToken() == null || session.refreshToken().isBlank()) return;
        Path temporary = null;
        try {
            Path parent = path.getParent();
            if (parent != null) Files.createDirectories(parent);
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("client_id", session.clientId());
            data.put("refresh_token", session.refreshToken());
            data.put("saved_at", Instant.now().toString());
            temporary = Files.createTempFile(parent, path.getFileName().toString() + ".", ".tmp");
            restrictToOwner(temporary);
            Files.writeString(temporary, JSON.writeValueAsString(data), StandardCharsets.UTF_8,
                    StandardOpenOption.TRUNCATE_EXISTING);
            try {
                Files.move(temporary, path, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException exception) {
                Files.move(temporary, path, StandardCopyOption.REPLACE_EXISTING);
            }
            temporary = null;
            restrictToOwner(path);
        } catch (Exception exception) {
            LOGGER.warn("無法保存 OAuth session 檔；目前授權仍可在此程序內使用。錯誤類型={}",
                    exception.getClass().getSimpleName());
        } finally {
            if (temporary != null) {
                try {
                    Files.deleteIfExists(temporary);
                } catch (Exception ignored) {
                    // 暫存檔已套用 owner-only 權限；清理失敗不覆蓋原始錯誤。
                }
            }
        }
    }

    @Override
    public void clear() {
        if (path == null) return;
        try {
            Files.deleteIfExists(path);
        } catch (Exception ignored) {
        }
    }

    @Override
    public String name() {
        return "file";
    }

    /** 將 session 檔案限制為目前擁有者可存取；支援 POSIX 權限與 Windows ACL。 */
    private static void restrictToOwner(Path path) throws IOException {
        PosixFileAttributeView posix = Files.getFileAttributeView(path, PosixFileAttributeView.class);
        if (posix != null) {
            Set<PosixFilePermission> permissions = EnumSet.of(
                    PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE);
            Files.setPosixFilePermissions(path, permissions);
            return;
        }
        AclFileAttributeView acl = Files.getFileAttributeView(path, AclFileAttributeView.class);
        if (acl == null) throw new IOException("filesystem does not support owner-only permissions");
        AclEntry ownerEntry = AclEntry.newBuilder()
                .setType(AclEntryType.ALLOW)
                .setPrincipal(Files.getOwner(path))
                .setPermissions(EnumSet.allOf(AclEntryPermission.class))
                .build();
        acl.setAcl(List.of(ownerEntry));
    }

    /** 空白視為缺欄位。 */
    private static String text(Object value) {
        return value == null || String.valueOf(value).isBlank() ? null : String.valueOf(value).trim();
    }
}
