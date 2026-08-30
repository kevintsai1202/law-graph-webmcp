import { defineConfig } from '@playwright/test';

/** E2E 設定：smoke 不需 LLM；journey 只有 E2E_LIVE=1 才會打真 LLM。截圖進 e2e/screenshots。 */
export default defineConfig({
  testDir: '.',
  timeout: 8 * 60_000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    screenshot: 'only-on-failure',
    video: 'off',
    // headless Chromium 預設關 GPU；開 SwiftShader 讓 WebGL 可用，3D 圖才會真的畫出 canvas
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }
  },
  outputDir: 'screenshots'
});
