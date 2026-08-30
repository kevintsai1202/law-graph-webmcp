import{defineConfig}from'@playwright/test';
/** 真實 LLM E2E 設定；需 E2E_LIVE=1。 */
export default defineConfig({testDir:'.',timeout:8*60_000,retries:0,use:{baseURL:process.env.BASE_URL||'http://localhost:8080',screenshot:'only-on-failure'},outputDir:'screenshots'});
