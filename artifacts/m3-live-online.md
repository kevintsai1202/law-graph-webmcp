# M3 線上驗證（2026-09-05，部署 6a9bf82a6f9895514dfd00a3）

```
   "contract": 0
  },
  "byIdentity": {
   "anonymous": 0,
   "member": 0
  },
  "completed": 0,
  "failed": 0,
  "promptTokens": 0,
  "completionTokens": 0,
  "totalTokens": 0
 },
 "statsAfter": {
  "day": "2026-09-05",
  "total": 1,
  "byMode": {
   "case": 0,
   "contract": 1
  },
  "byIdentity": {
   "anonymous": 1,
   "member": 0
  },
  "completed": 1,
  "failed": 0,
  "promptTokens": 103576,
  "completionTokens": 14394,
  "totalTokens": 117970
 },
 "quota": {
  "date": "2026-09-05",
  "used": 1,
  "limit": 1,
  "remaining": 0,
  "exhausted": true,
  "loggedIn": false,
  "memberLimit": 5,
  "loginPath": "/oauth2/authorization/google"
 }
}

```

- /api/stats store=jdbc；案件前 total 0 → 後 total 1、contract 1、completed 1、tokens 117,970；/api/quota used 1/1。
- 未驗：Google 登入首登告知（需本人瀏覧器）、重佈後不歸零（下次部署時檢查）。
