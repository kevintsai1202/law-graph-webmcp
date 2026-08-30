/** 中英字典；鍵集合必須一致（有測試守著）。 */
export const DICT = {
  en: {
    'app.title': 'Law Graph', 'app.subtitle': 'Taiwan legal relationship graph, built with your agent',
    'agent.available': 'Agent tools: ready', 'agent.unavailable': 'Agent tools: unavailable',
    'input.placeholder': 'Describe the dispute: who, what happened, when, what you want.',
    'input.samples': 'Or start from a sample case', 'input.submit': 'Analyse',
    'progress.BRAINSTORM': 'Brainstorming facts & issues', 'progress.QUESTIONS': 'Waiting for your answers',
    'progress.RESEARCH': 'Searching statutes & judgments', 'progress.ANALYSIS': 'Element-by-element analysis',
    'progress.GRAPH': 'Building the graph', 'progress.cancel': 'Cancel and start over',
    'questions.title': 'A few facts only you know', 'questions.why': 'Why we ask', 'questions.submit': 'Continue',
    'result.tab.graph': 'Graph', 'result.tab.analysis': 'Analysis', 'result.tab.research': 'Research', 'result.tab.brainstorm': 'Brainstorm',
    'result.generatedIn': 'Generated in', 'result.notes': 'Verification notes', 'result.newCase': 'New case',
    'result.elements': 'Elements', 'result.strategy': 'Strategy', 'result.evidenceGaps': 'Evidence gaps',
    'result.statutes': 'Statutes', 'result.judgments': 'Judgments',
    'result.facts': 'Facts', 'result.relations': 'Relations', 'result.issues': 'Issues', 'result.evidenceNeeds': 'Evidence needs',
    'graph.filter': 'Filter', 'graph.family': 'Family', 'graph.search': 'Search a node and press Enter',
    'failed.title': 'Analysis failed', 'failed.retry': 'Try again',
    'disclaimer': 'Analysis support only — not legal advice. Sample cases are fictional. Do not paste real personal data.',
    'inspector.title': 'Tool Inspector', 'inspector.run': 'Run'
  },
  'zh-TW': {
    'app.title': '法律關係圖', 'app.subtitle': '與你的 Agent 一起建構的台灣法律關係圖',
    'agent.available': 'Agent 工具：可用', 'agent.unavailable': 'Agent 工具：不可用',
    'input.placeholder': '描述爭議：當事人、發生了什麼、時間、你想達成什麼。',
    'input.samples': '或從示範案例開始', 'input.submit': '開始分析',
    'progress.BRAINSTORM': '整理事實與爭點', 'progress.QUESTIONS': '等待你的回答',
    'progress.RESEARCH': '檢索法條與判決', 'progress.ANALYSIS': '逐要件涵攝',
    'progress.GRAPH': '建立關係圖', 'progress.cancel': '放棄此案，重新開始',
    'questions.title': '幾個只有你知道的事實', 'questions.why': '為何要問', 'questions.submit': '繼續',
    'result.tab.graph': '關係圖', 'result.tab.analysis': '分析', 'result.tab.research': '檢索', 'result.tab.brainstorm': '頭腦風暴',
    'result.generatedIn': '產生語系', 'result.notes': '驗證紀錄', 'result.newCase': '新案件',
    'result.elements': '構成要件', 'result.strategy': '策略', 'result.evidenceGaps': '證據缺口',
    'result.statutes': '法條', 'result.judgments': '判決',
    'result.facts': '事實', 'result.relations': '法律關係', 'result.issues': '爭點', 'result.evidenceNeeds': '待補證據',
    'graph.filter': '節點篩選', 'graph.family': '案件家族', 'graph.search': '搜尋節點後按 Enter',
    'failed.title': '分析失敗', 'failed.retry': '重試',
    'disclaimer': '僅供分析輔助，非法律意見。示範案例皆為虛構。請勿貼入真實個資。',
    'inspector.title': '工具檢視器', 'inspector.run': '執行'
  }
};

/** 取字；缺 key 回 key 方便抓漏。 */
export function t(key, locale) {
  return (DICT[locale] && DICT[locale][key]) || DICT.en[key] || key;
}

/** 決定語系：使用者選過的優先，其次瀏覽器 zh*，否則 en。 */
export function detectLocale(navigatorLanguage, stored) {
  if (stored === 'en' || stored === 'zh-TW') return stored;
  return String(navigatorLanguage || '').toLowerCase().startsWith('zh') ? 'zh-TW' : 'en';
}
