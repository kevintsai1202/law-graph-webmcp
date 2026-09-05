import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
// 用途：UI 視覺／無障礙回歸——以假狀態走過六個畫面，在 375／768／1440 三種寬度截圖到 docs/ui-review/<w>/，
//       並斷言 ui-ux-pro-max 檢查表項目：可見標籤、送出鈕達標才啟用、aria-current 步驟、tablist 語意、
//       44px 觸控面積、無水平捲動、焦點環可見。不需 LLM，可用 e2e/stub-server.mjs 或真後端。
//       執行：node e2e/stub-server.mjs & ; $env:BASE_URL='http://localhost:8090'; npx playwright test -c e2e/playwright.config.mjs e2e/visual.spec.mjs

/** 假的 COMPLETED 狀態（含三種 met 的要件，驗證涵攝表三色徽章）。 */
const completed = {
  caseId: 'vis-1', status: 'COMPLETED', step: 'GRAPH', locale: 'zh-TW',
  result: {
    brainstorm: { facts: ['甲駕車進入市區十字路口後，與乙車發生碰撞。', '乙主張甲闖紅燈。'], relations: ['乙對甲可能主張民法侵權行為損害賠償。'], issues: ['甲是否違反號誌？'], evidenceNeeds: ['行車紀錄器影像'], questions: [] },
    research: { laws: [{ ref: '民法第184條', title: '民法第184條', articleText: '', source: 'law.moj.gov.tw' }], judgments: [{ citation: '最高法院108年度台上字第2345號' }], notes: ['removed edge: x->y (unverified)'] },
    analysis: {
      elements: [
        { law: '民法第184條第1項', element: '故意或過失', met: 'unknown', basis: '號誌時序仍有爭議，需行車紀錄器影像佐證。' },
        { law: '民法第184條第1項', element: '損害', met: 'yes', basis: '乙有手腕骨折診斷證明及六週無法工作之損失。' },
        { law: '民法第184條第2項', element: '故意以背於善良風俗之方法', met: 'no', basis: '無事實顯示甲有故意背於善良風俗之行為。' }],
      strategy: '先取得行車紀錄器影像與警方現場圖，確認號誌時序後再決定是否主張與有過失。', evidenceGaps: ['行車紀錄器影像', '警方現場圖'], disclaimer: '僅供分析輔助，非法律意見。'
    },
    graph: {
      nodes: [
        { id: 'f1', group: 'fact', label: '十字路口碰撞', description: '甲闖紅燈撞擊乙車' },
        { id: 'l1', group: 'law', label: '民法第184條', ref: '民法第184條' },
        { id: 'i1', group: 'issue', label: '過失' }, { id: 'e1', group: 'element', label: '因果關係', met: 'unknown' },
        { id: 'j1', group: 'judgment', label: '最高法院108年度台上字第2345號', status: 'good' }],
      edges: [{ from: 'f1', to: 'l1', label: '適用' }, { from: 'l1', to: 'e1', label: '要件' }, { from: 'f1', to: 'e1', label: '該當' }, { from: 'j1', to: 'l1', label: '法條關聯' }]
    }
  }
};
/** 假的進行中狀態（RESEARCH 進行中、頭腦風暴成果已出）。 */
const running = { caseId: 'vis-2', status: 'RUNNING', step: 'RESEARCH', locale: 'zh-TW', result: { brainstorm: completed.result.brainstorm } };
/** 假的等待回答狀態。 */
const waiting = { caseId: 'vis-3', status: 'WAITING', step: 'QUESTIONS', locale: 'zh-TW',
  questions: [{ id: 'q1', text: '事故發生的日期與時間？', why: '判斷請求權時效' }, { id: 'q2', text: '是否有行車紀錄器或監視器影像？', why: '證明號誌時序與因果關係' }],
  result: { brainstorm: completed.result.brainstorm } };
/** 假的失敗狀態。 */
const failed = { caseId: 'vis-4', status: 'FAILED', step: 'RESEARCH', locale: 'zh-TW', error: { code: 'MCP_TIMEOUT', step: 'RESEARCH', message: 'legal-mcp did not respond within 60s' } };
/** 假的完成狀態（含起訴狀與爭點整理兩份書狀，驗證公文書狀版面）。 */
const completedDocs = {
  ...completed, caseId: 'vis-5',
  result: {
    ...completed.result,
    documents: [
      { type: 'complaint', title: '民事起訴狀', court: '臺灣臺北地方法院',
        parties: [{ role: '原告', name: '乙' }, { role: '被告', name: '甲' }],
        paragraphs: ['一、緣被告甲於民國○年○月○日駕車行經市區十字路口，未依號誌指示貿然前行，致與原告所駕車輛發生碰撞，原告因此受有右腕骨折之傷害。', '二、按民法第184條第1項前段規定，因故意或過失不法侵害他人之權利者，負損害賠償責任。爰依上開規定請求被告賠償醫療費用及不能工作之損失。'],
        attachments: ['證一：診斷證明書一件', '證二：行車紀錄器影像光碟一件'], date: '中華民國115年9月1日' },
      { type: 'issues', title: '爭點整理狀', court: '臺灣臺北地方法院', parties: [],
        paragraphs: ['一、兩造不爭執事項：兩車於系爭路口發生碰撞、原告受有右腕骨折傷害。', '二、本件爭點：被告有無違反號誌之過失？原告得請求之損害範圍為何？'],
        attachments: [], date: '' }
    ]
  }
};

const WIDTHS = [375, 768, 1440];

for (const w of WIDTHS) {
  test.describe(`viewport ${w}`, () => {
    test.use({ viewport: { width: w, height: w < 768 ? 812 : 900 } });
    const dir = `docs/ui-review/${w}`;
    const shot = (page, name) => page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
    /** 頁面不得水平捲動（ui-ux-pro-max Layout 規則）。 */
    const noHScroll = async (page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    const dispatch = (page, s) => page.evaluate((st) => window.__lawGraphApp.dispatch({ type: 'STATUS', status: st }), s);

    test.beforeEach(async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      await page.goto('/');
      await page.evaluate((l) => window.__lawGraphApp.setLocale(l), 'zh-TW'); // 頁首已無語系選單，改由 app API 切換
      await expect(page.locator('.sample')).toHaveCount(6); // 2026-09-05 新增兩個熱議案例
    });

    test('input：可見標籤、字數回饋、達標才啟用送出、觸控面積 ≥ 44px', async ({ page }) => {
      await expect(page.locator('label[for="case-text"]')).toBeVisible();
      await expect(page.locator('#case-submit')).toBeDisabled();
      await page.fill('#case-text', '甲乙於路口發生車禍');
      await expect(page.locator('#case-submit')).toBeDisabled();
      await page.fill('#case-text', '甲駕車進入市區十字路口後，與乙車發生碰撞，乙主張甲闖紅燈並請求醫療費與薪資損失。');
      await expect(page.locator('#case-submit')).toBeEnabled();
      await expect(page.locator('#case-count')).toHaveClass(/ok/);
      for (const sel of ['#case-submit', '.sample', '#auth-slot']) {
        const box = await page.locator(sel).first().boundingBox();
        expect(box.height, `${sel} 高度`).toBeGreaterThanOrEqual(44);
      }
      await noHScroll(page);
      await shot(page, '01-input');
      // 鍵盤焦點環：Tab 到送出鈕後 outline 不得為 none
      await page.locator('#case-text').focus(); await page.keyboard.press('Tab');
      const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
      expect(outline).not.toBe('none');
    });

    test('running：aria-current 步驟、進行中旋轉環、中間成果', async ({ page }) => {
      await dispatch(page, running);
      await expect(page.locator('.step[aria-current="step"]')).toHaveAttribute('data-step', 'RESEARCH');
      await expect(page.locator('.step[aria-current="step"]')).toHaveAttribute('data-busy', '');
      await expect(page.locator('.step.done')).toHaveCount(2);
      await expect(page.locator('.partials')).toBeVisible();
      await noHScroll(page);
      await shot(page, '02-running');
    });

    test('questions：題號、說明、送出；等待時不顯示旋轉環', async ({ page }) => {
      await dispatch(page, waiting);
      await expect(page.locator('.q')).toHaveCount(2);
      await expect(page.locator('.step[aria-current="step"]')).not.toHaveAttribute('data-busy', '');
      await expect(page.locator('#cancel-case')).toBeVisible();
      await noHScroll(page);
      await shot(page, '03-questions');
    });

    test('result：tablist 語意、方向鍵切換、涵攝表三色徽章', async ({ page }) => {
      await dispatch(page, completed);
      await expect(page.locator('[role="tablist"] [role="tab"]')).toHaveCount(4);
      await expect(page.locator('#tab-graph')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#network-canvas')).toBeVisible();
      await page.waitForTimeout(1500);
      await shot(page, '04-result-graph');
      await page.locator('#tab-graph').focus(); await page.keyboard.press('ArrowRight');
      await expect(page.locator('#tab-analysis')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('[data-panel="analysis"]')).toBeVisible();
      await expect(page.locator('.el-yes')).toHaveCount(1);
      await expect(page.locator('.el-no')).toHaveCount(1);
      await expect(page.locator('.el-unknown')).toHaveCount(1);
      await noHScroll(page);
      await shot(page, '05-result-analysis');
      await page.click('#tab-research');
      await shot(page, '06-result-research');
    });

    test('outputs：全不勾停用送出；勾選書狀後結果頁出現公文書狀分頁', async ({ page }) => {
      await page.fill('#case-text', '甲駕車進入市區十字路口後，與乙車發生碰撞，乙主張甲闖紅燈並請求醫療費與薪資損失。');
      await expect(page.locator('#case-submit')).toBeEnabled();
      // 取消唯一勾選的關聯圖後不得送出
      await page.uncheck('input[name="outputs"][value="graph"]');
      await expect(page.locator('#case-submit')).toBeDisabled();
      await page.check('input[name="outputs"][value="graph"]');
      await page.check('input[name="outputs"][value="complaint"]');
      await page.check('input[name="outputs"][value="issues"]');
      // 以 route mock 走真實送出流程，讓勾選輸出實際帶入結果頁分頁
      await page.route('**/api/cases', (route) => route.request().method() === 'POST'
        ? route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ caseId: 'vis-5', status: 'RUNNING', step: 'BRAINSTORM' }) })
        : route.continue());
      await page.route('**/api/cases/vis-5', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(completedDocs) }));
      await page.click('#case-submit');
      // graph＋起訴狀＋爭點整理＋三個輔助分頁
      await expect(page.locator('[role="tablist"] [role="tab"]')).toHaveCount(6);
      await page.click('[data-tab="doc-complaint"]');
      await expect(page.locator('[data-panel="doc-complaint"] .doc-title')).toHaveText('民事起訴狀');
      await expect(page.locator('[data-panel="doc-complaint"] .doc-attachments li')).toHaveCount(2);
      await noHScroll(page);
      await shot(page, '09-result-document');
      await page.click('[data-tab="doc-issues"]');
      await expect(page.locator('[data-panel="doc-issues"]')).toBeVisible();
      await expect(page.locator('[data-panel="doc-issues"] .doc-title')).toHaveText('爭點整理狀');
    });

    test('failed：alert 語意與重試', async ({ page }) => {
      await dispatch(page, failed);
      await expect(page.locator('.failed[role="alert"]')).toBeVisible();
      await expect(page.locator('#retry')).toBeVisible();
      await shot(page, '07-failed');
      await page.click('#retry');
      await expect(page.locator('#case-submit')).toBeVisible();
    });

    test('WebMCP host 晚注入時仍會接上：徽章轉可用並補註冊 INPUT 工具', async ({ page }) => {
      await expect(page.locator('#agent-badge')).toContainText('不可用');
      // 模擬 Agent host（如 ChatGPT Site tools）在頁面腳本執行後才注入 modelContext
      await page.evaluate(() => {
        const tools = new Map();
        document.modelContext = {
          registerTool: async (tool, opts) => { tools.set(tool.name, tool); opts?.signal?.addEventListener('abort', () => tools.delete(tool.name)); },
          getTools: async () => [...tools.values()]
        };
      });
      await expect(page.locator('#agent-badge')).toContainText('可用');
      await expect.poll(() => page.evaluate(() => document.modelContext.getTools().then((tools) => tools.map((tool) => tool.name).sort())))
        .toEqual(['getInputForm', 'getOutputOptions', 'listSampleCases', 'setOutputSelection', 'startCase', 'verifyCitation']);
    });

    test('inspector：aria-expanded 同步折疊狀態', async ({ page }) => {
      await expect(page.locator('#insp-toggle')).toHaveAttribute('aria-expanded', 'false');
      await page.click('#insp-toggle');
      await expect(page.locator('#insp-toggle')).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#insp-body')).toBeVisible();
      await shot(page, '08-inspector-open');
    });
  });
}
