/** 雙語 UI 字典與語系選擇。 */
export const dictionaries={en:{title:'Taiwan Legal Graph',start:'Analyse case',waiting:'Your answers are required',run:'Run tool'},'zh-TW':{title:'台灣法律關係圖',start:'開始分析',waiting:'需要你的回答',run:'執行工具'}};
/** 未知鍵直接回鍵名，避免畫面空白。 */
export function t(key,locale='en'){return dictionaries[locale]?.[key]??dictionaries.en[key]??key;}
/** 將瀏覽器語系正規化為支援值。 */
export function normalizeLocale(value){return value?.toLowerCase().startsWith('zh')?'zh-TW':'en';}
