# M3：使用統計落資料庫＋會員資料＋個資告知 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每件案件、每日 tokens、每次 LLM 呼叫與登入會員都落 PostgreSQL；配額改以資料庫計數；提供 `GET /api/stats` 與 `#/stats` 統計頁；首次登入顯示一次個資告知，並提供帳號刪除與保存期限排程。

**Architecture:** 新增 `usage.UsageEventStore`（case_event 表）與 `auth.MemberStore`（member 表），各有 jdbc／memory 實作，由 `LawGraphDatabase.optional()` 決定；`DailyCaseQuota` 改以 store 計數；`CaseController` 於啟動成功後寫 case_event；`TokenUsageListener` 依 process 累加 tokens；`CaseService.status()` 首次觀測到終態時寫 finished。登入成功以 `AuthenticationSuccessHandler` upsert 會員。統計頁純 CSS 長條。

**Tech Stack:** Spring JDBC（JdbcTemplate）、H2 PostgreSQL 模式測試、Spring Security OAuth2 success handler、`@Scheduled`；前端同前。

**Spec:** `docs/superpowers/specs/2026-09-05-contract-review-branch-design.md` §4.6、§5.5

## Global Constraints

同 M1／M2。另：
- DDL 用標準 SQL（`CREATE TABLE IF NOT EXISTS`、`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`），H2 以 `MODE=PostgreSQL` 驗證。
- 統計 API 不得含 IP、email、案情；會員只出總數。
- 統計寫入失敗只 WARN；配額計數失敗回 503 `QUOTA_STORE_UNAVAILABLE`。
- 時區一律台北（`Asia/Taipei`）日曆日。
- 設定鍵：`lawgraph.member.retention-days`＝`${LAWGRAPH_MEMBER_RETENTION_DAYS:365}`。

---

## File Structure

**後端新增**
- `usage/CaseEvent.java`、`usage/UsageEventStore.java`、`usage/JdbcUsageEventStore.java`、`usage/InMemoryUsageEventStore.java`、`usage/DailyStats.java`、`usage/StatsController.java`
- `auth/Member.java`、`auth/MemberStore.java`、`auth/JdbcMemberStore.java`、`auth/InMemoryMemberStore.java`、`auth/MemberLoginHandler.java`、`auth/MemberRetentionJob.java`
- `usage/IdentityHash.java`（SHA-256）

**後端修改**
- `usage/UsageStore.java`（DailyUsage +llmCalls／cachedTokens／reasoningTokens）、`usage/JdbcUsageStore.java`、`usage/FileUsageStore.java`、`usage/DailyTokenBudget.java`（+`addLlmCall`、`observeProcessUsage` 回傳增量）、`usage/TokenUsageListener.java`、`usage/UsageConfig.java`
- `llm/LlmUsageStats.java`（累計同步進 budget）
- `api/DailyCaseQuota.java`、`api/QuotaIdentityResolver.java`（Identity +kind／hash）、`api/CaseController.java`、`api/CaseService.java`
- `auth/SecurityConfig.java`、`auth/MeController.java`
- `application.yml`

**前端**
- 新增 `static/js/views/stats.js`；修改 `state.js`（STATS）、`router.js`（`#/stats`）、`app.js`、`caseClient.js`、`login.js`（首登告知卡）、`i18n.js`、`webmcp.js`（getUsageStats 接上）、`index.html`（頂欄統計連結）、`app.css`

---

### Task 1: usage_daily 擴欄與 LLM 呼叫統計落地

**Files:**
- Modify: `usage/UsageStore.java`、`usage/JdbcUsageStore.java`、`usage/FileUsageStore.java`、`usage/DailyTokenBudget.java`、`llm/LlmUsageStats.java`
- Test: `usage/JdbcUsageStoreTest.java`（+1）、`usage/DailyTokenBudgetTest.java`（+1）、`llm/LlmUsageStatsTest.java`（+1）

**Interfaces:**
- `UsageStore.DailyUsage(LocalDate day, long promptTokens, long completionTokens, long llmCalls, long cachedTokens, long reasoningTokens)`；保留 3 參數建構子（後三者 0）
- `DailyTokenBudget.addLlmCall(long cached, long reasoning)`；`Snapshot` 尾端 +`llmCalls, cachedTokens, reasoningTokens`
- `DailyTokenBudget.observeProcessUsage(...)` 回傳 `long[]{deltaPrompt, deltaCompletion}`
- `LlmUsageStats(ObjectProvider<DailyTokenBudget>)`：`record()` 成功後呼叫 `budget.addLlmCall(cached, reasoning)`

- [ ] **Step 1: 測試**
```java
// JdbcUsageStoreTest +
    @Test void persistsLlmCallColumnsAndMigratesOldTable() {
        var ds = h2("usage_llm");
        new org.springframework.jdbc.core.JdbcTemplate(ds).execute("CREATE TABLE usage_daily (usage_day VARCHAR(10) PRIMARY KEY, prompt_tokens BIGINT NOT NULL, completion_tokens BIGINT NOT NULL, updated_at TIMESTAMP NOT NULL)");
        var store = new JdbcUsageStore(ds); // 舊表存在也要能 ALTER 補欄
        var day = LocalDate.of(2026, 9, 5);
        store.save(new UsageStore.DailyUsage(day, 10, 5, 3, 4, 2));
        var loaded = store.load(day).orElseThrow();
        assertEquals(3, loaded.llmCalls()); assertEquals(4, loaded.cachedTokens()); assertEquals(2, loaded.reasoningTokens());
    }
// DailyTokenBudgetTest +
    @Test void addLlmCallAccumulatesAndObserveReturnsDelta() {
        var budget = new DailyTokenBudget(0, false, UsageStore.inMemory(), Clock.systemUTC());
        budget.addLlmCall(100, 20); budget.addLlmCall(50, 0);
        assertEquals(2, budget.snapshot().llmCalls()); assertEquals(150, budget.snapshot().cachedTokens()); assertEquals(20, budget.snapshot().reasoningTokens());
        assertArrayEquals(new long[]{30, 10}, budget.observeProcessUsage("p", 30, 10));
        assertArrayEquals(new long[]{5, 0}, budget.observeProcessUsage("p", 35, 10));
    }
// LlmUsageStatsTest +
    @Test void recordForwardsToBudget() {
        var budget = new DailyTokenBudget(0, false, UsageStore.inMemory(), Clock.systemUTC());
        var stats = new LlmUsageStats(() -> budget);
        stats.record("{\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":4,\"prompt_tokens_details\":{\"cached_tokens\":6},\"completion_tokens_details\":{\"reasoning_tokens\":1}}}");
        assertEquals(1, budget.snapshot().llmCalls()); assertEquals(6, budget.snapshot().cachedTokens());
    }
```
（`LlmUsageStats` 建構子接 `ObjectProvider<DailyTokenBudget>`；測試以 lambda 實作 `ObjectProvider.getIfAvailable`—若 ObjectProvider 非 functional interface，改成接 `java.util.function.Supplier<DailyTokenBudget>` 並在 Spring 端以 `@Lazy DailyTokenBudget` 注入後 `() -> budget` 包裝。）

- [ ] **Step 2: 跑** — 編譜錯誤
- [ ] **Step 3: 實作**
  - `DailyUsage` 加三欄＋相容建構子。
  - `JdbcUsageStore` 建構子：CREATE TABLE 後執行三句 `ALTER TABLE usage_daily ADD COLUMN IF NOT EXISTS llm_calls BIGINT DEFAULT 0 NOT NULL`（cached_tokens、reasoning_tokens 同）；load／save 讀寫六欄。
  - `FileUsageStore`：JSON 多三個欄位，舊檔缺欄視為 0。
  - `DailyTokenBudget`：欄位 `llmCalls／cachedTokens／reasoningTokens`；`addLlmCall` 同步 save；`load()`／`rolloverIfNeeded()` 涵蓋新欄；`observeProcessUsage` 回傳 `new long[]{deltaPrompt, deltaCompletion}`；Snapshot 加三欄（相容建構子給既有 8 參數呼叫）。
  - `LlmUsageStats`：建構子注入 `Supplier<DailyTokenBudget>`（Spring：`public LlmUsageStats(@Lazy DailyTokenBudget budget) { this(() -> budget); }`）；`record()` 末尾 `try { var b = budget.get(); if (b != null) b.addLlmCall(cachedTokens, reasoningTokens); } catch (RuntimeException e) { LOGGER.warn(...) }`。
- [ ] **Step 4: 跑** — `-Dtest='JdbcUsageStoreTest,DailyTokenBudgetTest,LlmUsageStatsTest,TokenUsageListenerTest,UsageControllerTest*'` PASS
- [ ] **Step 5: Commit** — `feat(usage): usage_daily 加 LLM 呼叫／快取／推理欄位並落地`

---

### Task 2: case_event 儲存（UsageEventStore jdbc／memory）

**Files:**
- Create: `usage/CaseEvent.java`、`usage/DailyStats.java`、`usage/UsageEventStore.java`、`usage/JdbcUsageEventStore.java`、`usage/InMemoryUsageEventStore.java`、`usage/IdentityHash.java`
- Test: `usage/UsageEventStoreTest.java`（同一組測試對 jdbc 與 memory 各跑一次）

**Interfaces:**
```java
public record CaseEvent(String caseId, LocalDate day, String mode, String identityKind, String identityHash, String model,
                        String status, long promptTokens, long completionTokens, Instant startedAt, Instant finishedAt) {}
public record DailyStats(LocalDate day, long total, long caseMode, long contractMode, long anonymous, long member,
                         long completed, long failed, long promptTokens, long completionTokens) { public long totalTokens() {...} }
public interface UsageEventStore {
    void recordStart(CaseEvent event);
    void recordTokens(String caseId, long deltaPrompt, long deltaCompletion);   // 累加
    void recordFinish(String caseId, String status, Instant finishedAt);
    int countToday(String identityHash, LocalDate day);
    List<DailyStats> dailyStats(LocalDate from, LocalDate to);                // 含無資料日（補 0）
    void anonymize(String identityHash);                                        // identity_hash 置空
    String name();
}
public final class IdentityHash { public static String of(String key) /* SHA-256 hex */ }
```
DDL：
```sql
CREATE TABLE IF NOT EXISTS case_event (
  case_id VARCHAR(64) PRIMARY KEY, usage_day VARCHAR(10) NOT NULL, mode VARCHAR(16) NOT NULL,
  identity_kind VARCHAR(16) NOT NULL, identity_hash VARCHAR(64), model VARCHAR(64),
  status VARCHAR(16) NOT NULL, prompt_tokens BIGINT NOT NULL DEFAULT 0, completion_tokens BIGINT NOT NULL DEFAULT 0,
  started_at TIMESTAMP NOT NULL, finished_at TIMESTAMP NULL);
CREATE INDEX IF NOT EXISTS case_event_day ON case_event(usage_day);
CREATE INDEX IF NOT EXISTS case_event_identity ON case_event(identity_hash, usage_day);
```

- [ ] **Step 1: 測試**
```java
package tw.lawgraph.usage;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.time.*;
import java.util.List;
import java.util.stream.Stream;
import static org.junit.jupiter.api.Assertions.*;
class UsageEventStoreTest {
    static Stream<UsageEventStore> stores() {
        return Stream.of(new InMemoryUsageEventStore(),
                new JdbcUsageEventStore(new DriverManagerDataSource("jdbc:h2:mem:events" + System.nanoTime() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "")));
    }
    private static CaseEvent start(String id, LocalDate day, String mode, String kind, String hash) {
        return new CaseEvent(id, day, mode, kind, hash, "nano", "RUNNING", 0, 0, Instant.parse("2026-09-05T01:00:00Z"), null);
    }
    @ParameterizedTest @MethodSource("stores")
    void countsTokensFinishAndDailyStats(UsageEventStore store) {
        var d = LocalDate.of(2026, 9, 5);
        store.recordStart(start("c1", d, "case", "anonymous", "h1"));
        store.recordStart(start("c2", d, "contract", "member", "sub-1"));
        store.recordStart(start("c3", d.minusDays(1), "case", "anonymous", "h1"));
        store.recordTokens("c1", 100, 20); store.recordTokens("c1", 50, 5); store.recordTokens("missing", 1, 1);
        store.recordFinish("c1", "COMPLETED", Instant.parse("2026-09-05T01:05:00Z"));
        store.recordFinish("c2", "FAILED", Instant.parse("2026-09-05T01:06:00Z"));
        assertEquals(1, store.countToday("h1", d)); assertEquals(0, store.countToday("nobody", d));
        var stats = store.dailyStats(d.minusDays(2), d);
        assertEquals(3, stats.size());
        assertEquals(0, stats.get(0).total());
        var today = stats.get(2);
        assertEquals(2, today.total()); assertEquals(1, today.caseMode()); assertEquals(1, today.contractMode());
        assertEquals(1, today.anonymous()); assertEquals(1, today.member());
        assertEquals(1, today.completed()); assertEquals(1, today.failed());
        assertEquals(150, today.promptTokens()); assertEquals(25, today.completionTokens()); assertEquals(175, today.totalTokens());
        store.anonymize("sub-1");
        assertEquals(0, store.countToday("sub-1", d));
    }
    @ParameterizedTest @MethodSource("stores")
    void startIsIdempotent(UsageEventStore store) {
        var d = LocalDate.of(2026, 9, 5);
        store.recordStart(start("c1", d, "case", "anonymous", "h")); store.recordStart(start("c1", d, "case", "anonymous", "h"));
        assertEquals(1, store.countToday("h", d));
    }
    @org.junit.jupiter.api.Test void identityHashIsStableSha256() {
        assertEquals(IdentityHash.of("ip:1.2.3.4"), IdentityHash.of("ip:1.2.3.4"));
        assertEquals(64, IdentityHash.of("x").length());
    }
}
```
- [ ] **Step 2: 跑** — 編譯錯誤
- [ ] **Step 3: 實作**
  - `JdbcUsageEventStore`：建構子執行 DDL；`recordStart` 先 `UPDATE ... WHERE case_id=?` 為 0 才 INSERT；`recordTokens`：`UPDATE case_event SET prompt_tokens = prompt_tokens + ?, completion_tokens = completion_tokens + ? WHERE case_id = ?`；`recordFinish`：`UPDATE ... SET status=?, finished_at=? WHERE case_id=?`；`countToday`：`SELECT COUNT(*) ... WHERE identity_hash=? AND usage_day=?`；`dailyStats`：`SELECT usage_day, COUNT(*), SUM(CASE WHEN mode='case' THEN 1 ELSE 0 END), ... GROUP BY usage_day` 後在 Java 以 `from..to` 逐日補 0；`anonymize`：`UPDATE case_event SET identity_hash = NULL WHERE identity_hash = ?`。
  - `InMemoryUsageEventStore`：`ConcurrentHashMap<String, CaseEvent>`，同語意。
  - `IdentityHash.of`：`MessageDigest.getInstance("SHA-256")` → hex。
  - `DailyStats.totalTokens()` = prompt + completion。
- [ ] **Step 4: 跑** — PASS
- [ ] **Step 5: Commit** — `feat(usage): case_event 事件儲存（jdbc／memory）與每日聚合`

---

### Task 3: 配額改用資料庫計數；啟動時寫 case_event；tokens 與終態回寫

**Files:**
- Modify: `api/QuotaIdentityResolver.java`（`Identity(String key, int limit, boolean member)` +方法 `kind()`＝member／anonymous、`hash()`＝member 取 sub 原值、匿名 `IdentityHash.of(key)`）
- Modify: `api/DailyCaseQuota.java`（建構子 `(Clock, UsageEventStore)`；`tryAcquire(hash, limit)` → `store.countToday(hash, today) < limit`；`snapshot` 同；store 例外 → 拋 `QuotaStoreUnavailableException`）
- Create: `api/QuotaStoreUnavailableException.java`；`ApiExceptionHandler` 對應 503 `QUOTA_STORE_UNAVAILABLE`
- Modify: `api/CaseController.java`（quotaGate 用 `identity.hash()`；啟動成功後 `events.recordStart(new CaseEvent(created.caseId(), today, created.mode(), identity.kind(), identity.hash(), model.isBlank() ? "default" : model, "RUNNING", 0, 0, Instant.now(), null))`，包 try/catch WARN）
- Modify: `usage/TokenUsageListener.java`（建構子 +`UsageEventStore`；`long[] d = budget.observeProcessUsage(...); if (d[0]+d[1] > 0) events.recordTokens(process.getId(), d[0], d[1]);`）
- Modify: `api/CaseService.java`（建構子 +`UsageEventStore`（`@Autowired` 版）；`status()` 中若 code ∈ {COMPLETED, FAILED, TERMINATED, KILLED, STUCK} 且 `finished.add(caseId)` 首次 → `events.recordFinish(caseId, mapped.status(), clock.instant())`；sweep kill 亦同）
- Modify: `usage/UsageConfig.java`（bean `usageEventStore(LawGraphDatabase db)`：有 DataSource → Jdbc，否則 InMemory＋WARN「統計與配額只存記憶體」；`tokenUsageListener(budget, events)`）；`CaseController.ApiConfig.dailyCaseQuota(UsageEventStore)`
- Test: `api/DailyCaseQuotaTest.java`（改用 InMemoryUsageEventStore）、`api/DailyCaseQuotaControllerTest.java`（驗 recordStart 被呼叫且 hash 非原 IP）、`usage/TokenUsageListenerTest.java`（驗 recordTokens 增量）、`api/CaseServiceTest.java`（+終態回寫一次）

- [ ] **Step 1: 測試**（重點斷言）
```java
// DailyCaseQuotaTest：以 InMemoryUsageEventStore 預塞 3 筆同 hash 今日事件 → tryAcquire(hash, 3) false；limit 0 永遠 true；store 丟 RuntimeException → QuotaStoreUnavailableException
// DailyCaseQuotaControllerTest：@MockitoBean UsageEventStore events; 啟動後 verify(events).recordStart(argThat(e -> "anonymous".equals(e.identityKind()) && !e.identityHash().contains(".") && "case".equals(e.mode())))
//   when(events.countToday(any(), any())).thenThrow(new RuntimeException()) → POST 回 503 QUOTA_STORE_UNAVAILABLE
// TokenUsageListenerTest：budget 先 observe 100/10，事件回 130/15 → verify(events).recordTokens("p1", 30, 5)
// CaseServiceTest：status COMPLETED 查兩次 → verify(events, times(1)).recordFinish(eq("p1"), eq("COMPLETED"), any())
```
- [ ] **Step 2: 跑** — FAIL／編譜錯誤
- [ ] **Step 3: 實作**（如 Files 描述；`CaseService` 保留舊建構子用 `new InMemoryUsageEventStore()`；`QuotaIdentityResolver.Identity` 加 `kind()`／`hash()` 兩個方法，`key` 保留供 log）
- [ ] **Step 4: 跑** — `mvn -q test` 全套（Spring 上下文 SmokeTest 需通過 bean 接線）
- [ ] **Step 5: Commit** — `feat(usage): 配額以資料庫計數；案件啟動／tokens／終態寫入 case_event`

---

### Task 4: 會員資料表與登入 upsert、首登告知、刪除、保存期限

**Files:**
- Create: `auth/Member.java`、`auth/MemberStore.java`、`auth/JdbcMemberStore.java`、`auth/InMemoryMemberStore.java`、`auth/MemberLoginHandler.java`、`auth/MemberRetentionJob.java`、`auth/MemberConfig.java`
- Modify: `auth/SecurityConfig.java`（`oauth2Login(o -> o.successHandler(handler))`；handler 完成後導向 `/`）、`auth/MeController.java`（`Me` +`firstLogin`；`POST /api/me/notice-ack`；`DELETE /api/me`）、`api/AccessPolicy` 命中時 `memberStore.block(sub, reason)`（在 MeController.me 內判定時順手寫）
- Modify: `application.yml`（`lawgraph.member.retention-days`）
- Test: `auth/MemberStoreTest.java`（jdbc／memory 參數化）、`auth/MemberLoginHandlerTest.java`、`auth/MeControllerMemberTest.java`、`auth/MemberRetentionJobTest.java`

**Interfaces:**
```java
public record Member(String googleSub, String email, String displayName, String pictureUrl, Instant firstLoginAt, Instant lastLoginAt,
                     int loginCount, boolean blocked, String blockedReason, Instant noticeAcknowledgedAt) {}
public interface MemberStore {
    /** upsert：回傳更新後的 Member 與是否為新建。 */ record LoginResult(Member member, boolean created) {}
    LoginResult recordLogin(String sub, String email, String name, String picture, Instant now);
    Optional<Member> find(String sub);
    void acknowledgeNotice(String sub, Instant now);
    void block(String sub, String reason);
    boolean delete(String sub);
    int deleteInactiveBefore(Instant cutoff);
    long count(); long countActiveOn(LocalDate day);   // last_login_at 落在該日（台北）
    String name();
}
```
DDL：
```sql
CREATE TABLE IF NOT EXISTS member (
  google_sub VARCHAR(64) PRIMARY KEY, email VARCHAR(255), display_name VARCHAR(255), picture_url VARCHAR(1024),
  first_login_at TIMESTAMP NOT NULL, last_login_at TIMESTAMP NOT NULL, login_count INT NOT NULL DEFAULT 1,
  blocked BOOLEAN NOT NULL DEFAULT FALSE, blocked_reason VARCHAR(255), notice_acknowledged_at TIMESTAMP NULL);
```
- `MemberLoginHandler implements AuthenticationSuccessHandler`：從 `OAuth2User` 取 sub／email／name／picture → `store.recordLogin`；若 `accessPolicy.isBlocked(email)` → `store.block(sub, "LICENSE_EXCLUDED")`；redirect `/`。
- `MeController.me`：登入者 `member = store.find(sub)`；`firstLogin = member.isPresent() && member.get().noticeAcknowledgedAt() == null`。
- `POST /api/me/notice-ack` → 204；`DELETE /api/me` → `store.delete(sub)`＋`events.anonymize(sub)`＋`request.getSession().invalidate()`＋`SecurityContextHolder.clearContext()` → 204；未登入 401。
- `MemberRetentionJob`：`@Scheduled(cron = "0 30 3 * * *", zone = "Asia/Taipei")` → `store.deleteInactiveBefore(now - retentionDays)`；刪除前先對每位 `events.anonymize(sub)`（需 `List<String> inactiveSubs(Instant cutoff)`；加進介面）。

- [ ] **Step 1: 測試**（重點）
```java
// MemberStoreTest（參數化 jdbc／memory）：recordLogin 兩次 → created true 再 false、loginCount 2；acknowledgeNotice 後 noticeAcknowledgedAt 非 null；block 後 blocked true；deleteInactiveBefore(cutoff) 只刪 lastLogin < cutoff；count／countActiveOn。
// MemberLoginHandlerTest：假 Authentication(OAuth2User attrs) → verify store.recordLogin(sub,...); email 命中 AccessPolicy → verify store.block; response.sendRedirect("/")
// MeControllerMemberTest（WebMvcTest + oauth2Login() post processor）：新會員 /api/me firstLogin=true；POST notice-ack 後 firstLogin=false；DELETE /api/me → 204 且 store.find 為空、events.anonymize 被呼叫；匿名 DELETE → 401
// MemberRetentionJobTest：Clock 固定；兩會員一新一舊 → run() 後只剩新、events.anonymize(舊 sub) 被呼叫
```
- [ ] **Step 2: 跑** — FAIL
- [ ] **Step 3: 實作**（如上；`MemberConfig` 建 `memberStore(LawGraphDatabase)` jdbc／memory、`memberLoginHandler`、`memberRetentionJob`；`SecurityConfig.securityFilterChain` 多注入 `ObjectProvider<MemberLoginHandler>`，有 registration 時 `oauth.successHandler(handler)`）
- [ ] **Step 4: 跑** — `mvn -q test` 全套 PASS
- [ ] **Step 5: Commit** — `feat(auth): 會員資料表、登入 upsert、首登告知確認、帳號刪除與保存期限排程`

---

### Task 5: StatsController

**Files:**
- Create: `usage/StatsController.java`
- Test: `usage/StatsControllerTest.java`

**Interfaces:**
- `GET /api/stats?days=30`（1–90，超出夾住）→
```json
{ "from": "2026-08-07", "to": "2026-09-05", "days": [ { "day": "...", "total": 3, "byMode": {"case": 2, "contract": 1}, "byIdentity": {"anonymous": 2, "member": 1}, "completed": 2, "failed": 1, "promptTokens": 1000, "completionTokens": 200, "totalTokens": 1200 } ],
  "today": { 同一列 }, "members": { "total": 12, "activeToday": 3 }, "store": "jdbc" }
```
- 速率：沿用 `RateLimiter`？不需要（唯讀、便宜）；加 `Cache-Control: max-age=60`。

- [ ] **Step 1: 測試**（WebMvcTest，`@MockitoBean UsageEventStore events, MemberStore members`）：`days=3` 回 3 列、`today` 等於最後一列、`members.total`；`days=500` 夾成 90；回應不含 `identityHash`／`email` 字串。
- [ ] **Step 2: 跑** — FAIL
- [ ] **Step 3: 實作**：`LocalDate today = LocalDate.now(ZoneId.of("Asia/Taipei"))`；`from = today.minusDays(days-1)`；`events.dailyStats(from, today)` 映射為 `DayView` record；`members.count()`／`countActiveOn(today)`。
- [ ] **Step 4: 跑** — PASS
- [ ] **Step 5: Commit** — `feat(api): GET /api/stats 每日次數與 tokens 統計`

---

### Task 6: 前端統計頁、路由、頂欄連結、getUsageStats

**Files:**
- Create: `static/js/views/stats.js`
- Modify: `static/js/state.js`（`States.STATS`；事件 `SHOW_STATS`→STATS）、`router.js`（`#/stats`→`{view:'STATS', mode:null}`；`hashFor` STATS→`#/stats`）、`app.js`（render STATS：呼叫 `client.stats(30)` 後 `renderStats`；`showStats()`；hashchange 支援 stats）、`caseClient.js`（`stats(days)`＝`entry('/api/stats?days=' + days)`）、`webmcp.js`（`getUsageStats` → `app.getStats(days)`）、`index.html`（topbar-right 加 `<a id="stats-link" class="nav-link" href="#/stats" data-i18n="nav.stats">`）、`i18n.js`、`app.css`
- Test: `frontend-tests/stats.test.mjs`、`router.test.mjs`、`state.test.mjs`、`app.test.mjs`、`webmcp.test.mjs`

**Interfaces:**
- `renderStats(data, locale)`：`data` 為 `/api/stats` 回應或 `null`（載入中）／`{ error }`；輸出 `.stats` 含 `#stats-today .stat-tile`×2（今日次數：案件 n／合約 m；今日 tokens：prompt／completion／合計）、`table.stats-table tbody tr`（近 N 日，倒序）、兩個 `.bars`（`.bar[style*="width"]` 每列 `aria-label` 帶數值）
- i18n 新鍵（中英）：`nav.stats`、`stats.title`、`stats.lead`、`stats.todayCases`、`stats.todayTokens`、`stats.col.day/total/case/contract/completed/failed/prompt/completion/tokens`、`stats.chart.cases`、`stats.chart.tokens`、`stats.members`、`stats.loading`、`stats.error`、`stats.anonymous`、`stats.member`

- [ ] **Step 1: 測試**
```js
// stats.test.mjs
import { renderStats } from '../src/main/resources/static/js/views/stats.js';
const data = { from: '2026-09-03', to: '2026-09-05', store: 'jdbc', members: { total: 12, activeToday: 3 },
  today: { day: '2026-09-05', total: 3, byMode: { case: 2, contract: 1 }, byIdentity: { anonymous: 2, member: 1 }, completed: 2, failed: 1, promptTokens: 1000, completionTokens: 200, totalTokens: 1200 },
  days: [ { day: '2026-09-03', total: 0, byMode: { case: 0, contract: 0 }, byIdentity: { anonymous: 0, member: 0 }, completed: 0, failed: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          { day: '2026-09-04', total: 6, byMode: { case: 6, contract: 0 }, byIdentity: { anonymous: 6, member: 0 }, completed: 6, failed: 0, promptTokens: 4000, completionTokens: 800, totalTokens: 4800 },
          { day: '2026-09-05', total: 3, byMode: { case: 2, contract: 1 }, byIdentity: { anonymous: 2, member: 1 }, completed: 2, failed: 1, promptTokens: 1000, completionTokens: 200, totalTokens: 1200 } ] };
test('統計頁：今日卡、表格倒序、長條寬度依最大值', () => {
  const html = renderStats(data, 'zh-TW');
  assert.match(html, /id="stats-today"/); assert.match(html, /1,200|1200/);
  const rows = [...html.matchAll(/<tr data-day="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(rows, ['2026-09-05', '2026-09-04', '2026-09-03']);
  assert.match(html, /class="bar" style="width:100%"[^>]*aria-label="2026-09-04[^"]*6/);
  assert.match(html, /12/); assert.doesNotMatch(html, /identityHash|@/);
  assert.match(renderStats(null, 'zh-TW'), /載入中/); assert.match(renderStats({ error: 'x' }, 'en'), /could not be loaded/i);
});
// router.test.mjs +：parseHash('#/stats') → { view: 'STATS', mode: null }；hashFor({view:'STATS'}) → '#/stats'
// state.test.mjs +：reduce(initialState, { type: 'SHOW_STATS' }).view === 'STATS'
// app.test.mjs +：mount 時 hash '#/stats' → client.stats 被呼叫、view STATS；app.getStats(7) 回傳 client.stats 結果
// webmcp.test.mjs：getUsageStats 改為 ok 路徑（app.getStats 假回 data → 結果含 days）
```
- [ ] **Step 2: 跑** — FAIL
- [ ] **Step 3: 實作**（stats.js 重點）
```js
/** 純 CSS 長條：寬度＝值／最大值；每條帶 aria-label 數值。 */
function bars(rows, pick, labelKey, locale) {
  const max = Math.max(1, ...rows.map(pick));
  return `<div class="bars" role="img" aria-label="${esc(t(labelKey, locale))}">${rows.map((r) => `<div class="bar-row"><span class="bar-day">${esc(r.day.slice(5))}</span><span class="bar" style="width:${Math.round(pick(r) / max * 100)}%" aria-label="${esc(r.day)} ${pick(r).toLocaleString(locale)}"></span><span class="bar-value">${pick(r).toLocaleString(locale)}</span></div>`).join('')}</div>`;
}
export function renderStats(data, locale) {
  if (!data) return `<section class="stats card"><p role="status">${esc(t('stats.loading', locale))}</p></section>`;
  if (data.error) return `<section class="stats card" role="alert"><p>${esc(t('stats.error', locale))}</p></section>`;
  const asc = [...(data.days || [])].sort((a, b) => a.day.localeCompare(b.day)), desc = [...asc].reverse(), today = data.today || desc[0] || {};
  const n = (v) => Number(v || 0).toLocaleString(locale);
  const tile = (title, big, sub) => `<div class="stat-tile"><span class="stat-title">${esc(title)}</span><strong class="stat-big">${esc(big)}</strong><span class="stat-sub">${esc(sub)}</span></div>`;
  const head = ['day', 'total', 'case', 'contract', 'completed', 'failed', 'prompt', 'completion', 'tokens'].map((k) => `<th scope="col">${esc(t('stats.col.' + k, locale))}</th>`).join('');
  const rows = desc.map((r) => `<tr data-day="${esc(r.day)}"><td>${esc(r.day)}</td><td>${n(r.total)}</td><td>${n(r.byMode?.case)}</td><td>${n(r.byMode?.contract)}</td><td>${n(r.completed)}</td><td>${n(r.failed)}</td><td>${n(r.promptTokens)}</td><td>${n(r.completionTokens)}</td><td>${n(r.totalTokens)}</td></tr>`).join('');
  return `<section class="stats"><h2>${esc(t('stats.title', locale))}</h2><p class="home-lead">${esc(t('stats.lead', locale))}</p>
    <div id="stats-today" class="stat-tiles">
      ${tile(t('stats.todayCases', locale), n(today.total), `${t('home.case.title', locale)} ${n(today.byMode?.case)} · ${t('home.contract.title', locale)} ${n(today.byMode?.contract)} · ${t('stats.member', locale)} ${n(today.byIdentity?.member)}`)}
      ${tile(t('stats.todayTokens', locale), n(today.totalTokens), `prompt ${n(today.promptTokens)} · completion ${n(today.completionTokens)}`)}
      ${tile(t('stats.members', locale), n(data.members?.total), `${t('stats.activeToday', locale)} ${n(data.members?.activeToday)}`)}
    </div>
    <div class="card"><h3>${esc(t('stats.chart.cases', locale))}</h3>${bars(asc, (r) => Number(r.total || 0), 'stats.chart.cases', locale)}</div>
    <div class="card"><h3>${esc(t('stats.chart.tokens', locale))}</h3>${bars(asc, (r) => Number(r.totalTokens || 0), 'stats.chart.tokens', locale)}</div>
    <div class="card table-wrap"><table class="assess-table stats-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
```
（i18n 補 `stats.activeToday`。）`app.js`：`let stats = null; async function showStats() { dispatch({ type: 'SHOW_STATS' }); stats = null; render(); try { stats = await client.stats(30); } catch (e) { stats = { error: e.message }; } render(); }`；render STATS → `mountHtml(el, renderStats(stats, locale))`；`getStats = (days = 30) => client.stats(days)`。CSS：`.stat-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-3)} .stat-big{font-size:2rem} .bar-row{display:grid;grid-template-columns:3.5rem 1fr 4rem;align-items:center;gap:.5rem} .bar{display:block;height:14px;background:var(--color-primary,#1e3a8a);border-radius:7px;min-width:2px}`。
- [ ] **Step 4: 跑** — `npm test`；`npm run bundle`
- [ ] **Step 5: Commit** — `feat(web): 統計頁（#/stats）、頂欄連結、getUsageStats 工具`

---

### Task 7: 首登個資告知卡與帳號刪除入口

**Files:**
- Modify: `static/js/login.js`（`renderPrivacyNotice(me, locale)`：`me.firstLogin` 時輸出 `.privacy-notice[role=note]`＋按鈕 `#privacy-ack`；登入後選單加「刪除帳號」`#delete-account`）、`static/js/main.js`（`refreshMe` 後把告知卡插到 `header.topbar` 之後 `#privacy-slot`；綁 ack → `client.ackNotice()` 後移除；綁 delete → `confirm(t('privacy.deleteConfirm'))` → `client.deleteMe()` → reload）、`caseClient.js`（`ackNotice: () => call('/api/me/notice-ack', { method: 'POST' })`、`deleteMe: () => call('/api/me', { method: 'DELETE' })`）、`index.html`（`<div id="privacy-slot"></div>` 於 topbar 後）、`i18n.js`（`privacy.notice.title/purpose/fields/retention/delete/ack`、`nav.deleteAccount`、`privacy.deleteConfirm`）
- Modify: `e2e/stub-server.mjs`（entry 模式 `/api/me` 首次登入回 `firstLogin: true`，`POST /api/me/notice-ack` 後改 false）
- Test: `frontend-tests/login.test.mjs`（firstLogin 才出現告知；ack 後不出現）、`caseClient.test.mjs`（兩個新方法路徑／方法）、smoke（entry 模式：登入→看到告知→按我知道了→消失→重載仍不出現）

- [ ] **Step 1: 測試** → **Step 2: 跑 FAIL** → **Step 3: 實作** → **Step 4: `npm test`＋bundle＋smoke（`node e2e/stub-server.mjs 8090 --entry`）** → **Step 5: Commit** `feat(web): 首次登入個資告知（一次）與帳號刪除`

告知文案（zh-TW）：
- title「個資告知（個人資料保護法第 8 條）」
- purpose「收集目的：辨識登入身分與計算每日分析配額。」
- fields「收集欄位：Google 帳號的 email、顯示名稱與頭像網址；不收集案情或合約內容。」
- retention「保存期限：最後登入起 12 個月未使用即自動刪除。」
- delete「你可隨時在右上角選單刪除帳號，或寄信至站方信箱申請。」
- ack「我知道了」

---

### Task 8: M3 收尾

- [ ] application.yml：`lawgraph.member.retention-days: ${LAWGRAPH_MEMBER_RETENTION_DAYS:365}`；README 加「統計與會員資料」章節（資料表、API、個資告知、刪除、保存期限、無 DB 時退回記憶體）；CLAUDE.md 加資料表清單與「配額以 case_event 計數，重佈不歸零」。
- [ ] `mvn -q test | tee artifacts/m3-backend.log`、`npm test | tee artifacts/m3-frontend.log`、`npm run bundle`、smoke（一般＋`--entry`）全綠。
- [ ] Zeabur 部署後驗證：`curl -s https://law-graph-webmcp.zeabur.app/api/stats?days=3`（store=jdbc、今日列存在）；跑一件 nano 案後 `total` +1、tokens 增加；重佈後數字不歸零；用 Google 登入一次看到告知卡，按確認後重載不再出現；`DELETE /api/me` 後 `member.total` −1。結果寫進 `artifacts/m3-live-check.md`。
- [ ] Commit：`docs: M3 統計與會員完成`。

## Self-Review

- §5.5 資料表（Task 2、4）、配額 DB（3）、TokenUsageListener（3）、LlmUsageStats 落地（1）、StatsController（5）、無 DB 退回（3、4 的 Config）；§4.6 統計頁（6）；會員／告知／刪除／保存期限（4、7）；WebMCP getUsageStats（6）。
- 型別一致：`CaseEvent` 11 欄在 Task 2／3 一致；`UsageEventStore` 方法名在 2／3／4／5 一致（`anonymize`、`countToday`、`dailyStats`）；`MemberStore.recordLogin` 回 `LoginResult` 在 4 一致；`/api/stats` JSON 形狀在 5／6 一致。
- 佔位檢查：Task 3／4／7 的測試以「重點斷言」描述，執行者須依 M1 同類測試（DailyCaseQuotaControllerTest、CaseServiceTest 既有寫法）展開為完整程式碼；其餘任務皆有完整程式碼。
