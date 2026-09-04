import { createWebMcpBoot } from './webmcpBoot.js';

/**
 * WebMCP 獨立入口（打包為 js/webmcp-bundle.js，於 index.html <head> 同步載入）：
 * 頁面一開始就把工具註冊給 Agent host；應用層（app-bundle.js）載入後透過 window.__webmcpBoot.bind() 接上。
 */
const boot = createWebMcpBoot({ runtime: globalThis });
window.__webmcpBoot = boot;
window.__webmcp = boot.webmcp;
