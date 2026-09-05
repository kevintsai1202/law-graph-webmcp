# 後端

- 規格、Zeabur 服務與部署方式以專案根目錄 README.md、CLAUDE.md 為準。
- 使用 Java 21。`tw.lawgraph.auth.SecurityConfig` 維持匿名可用；Google 登入成功與表單 POST 登出均返回首頁。
- `/api/me` 提供身分；`/api/quota` 決定匿名／會員配額；禁止以測試假身分取代正式驗證。
- 身分／配額／授權排除回歸：`mvn -Dtest=DailyCaseQuotaControllerTest,AccessPolicyTest test`。
- 函式與重要狀態使用中文註解；不因前端載入問題改動正式 OAuth 權限或案件流程。
