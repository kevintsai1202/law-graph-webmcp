# 前端

- 規格與操作方式以專案根目錄 README.md、CLAUDE.md 為準。
- `js/*.js` 為來源；修改後在根目錄執行 `npm test`、`npm run bundle`，部署使用產出的 `app-bundle.js`／`webmcp-bundle.js`。
- 首頁須保持匿名可用；Google 登入只提高每日配額，身分查詢不可依賴 3D 套件載入。
- `graphAssets.js` 在顯示結果圖時才依序載入 vendor；入口 GET 有逾時，分析提交不可沿用入口逾時。
- 函式與重要狀態使用中文註解。入口回歸 fixture 與故障情境見 README 的 Entry-flow regression checks。
