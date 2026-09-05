package tw.lawgraph.auth;

import java.time.Instant;

/**
 * 會員（以 Google 登入建立）：只保存顯示與配額所需的最小個資，
 * 並記錄首登／末登時間以支援首登告知與個資保存期限（逾期由 MemberRetentionJob 刪除）。
 *
 * @param googleSub            Google 帳號的穩定識別碼（主鍵）
 * @param email                Google email（判定使用授權排除名單用）
 * @param displayName          顯示名稱
 * @param pictureUrl           頭像網址
 * @param firstLoginAt         首次登入時間
 * @param lastLoginAt          最後登入時間（保存期限與活躍統計的依據）
 * @param loginCount           累計登入次數
 * @param blocked              是否為使用授權排除方
 * @param blockedReason        封鎖原因代碼（例如 LICENSE_EXCLUDED）
 * @param noticeAcknowledgedAt 首登告知的確認時間；null 代表尚未確認
 */
public record Member(String googleSub, String email, String displayName, String pictureUrl, Instant firstLoginAt,
                     Instant lastLoginAt, int loginCount, boolean blocked, String blockedReason,
                     Instant noticeAcknowledgedAt) {}
