// 用途：從 law-powers 的單檔渲染器（skills/legal-graph/renderer/index.html）抽出三個內嵌 lib
//       與應用層渲染腳本；lib 寫到 static/vendor/，應用層寫到 js/_renderer-source.txt 供人工併入
//       graphView.js（不直接覆蓋）。可重跑：submodule 更新後再執行即可比對差異。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = readFileSync(new URL('../skills/law-powers/skills/legal-graph/renderer/index.html', import.meta.url), 'utf8');
const scripts = [...src.matchAll(/<script(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/script>/g)].map((m) => m.groups.body);
const out = new URL('../src/main/resources/static/vendor/', import.meta.url);
mkdirSync(out, { recursive: true });

/** 以標記字串找出對應 <script> 內容；找不到直接失敗，避免寫出空檔。 */
const pick = (marker) => {
  const hit = scripts.find((s) => s.includes(marker));
  if (!hit) throw new Error(`找不到包含「${marker}」的 <script> 區塊`);
  return hit;
};

writeFileSync(new URL('three.min.js', out), pick('inlined: three.min.js'));
writeFileSync(new URL('three-spritetext.min.js', out), pick('inlined: three-spritetext.min.js'));
writeFileSync(new URL('3d-force-graph.min.js', out), pick('inlined: 3d-force-graph.min.js'));
writeFileSync(new URL('../js/_renderer-source.txt', out), pick('function renderNetwork'));
console.log('vendor libs written; application script saved to js/_renderer-source.txt for manual merge');
