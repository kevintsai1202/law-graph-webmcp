/** 建立 REST client，fetch 可注入測試。 */
export function createCaseClient(fetcher=fetch){const json=async(r)=>{if(!r.ok)throw new Error((await r.json()).message||r.statusText);return r.json();};return{
samples:(locale)=>fetcher(`/api/samples?locale=${encodeURIComponent(locale)}`).then(json),
start:(caseText,locale)=>fetcher('/api/cases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({caseText,locale})}).then(json),
status:(id)=>fetcher(`/api/cases/${id}`).then(json),
answer:(id,answers)=>fetcher(`/api/cases/${id}/answers`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answers})}).then(json),
verify:(ref)=>fetcher(`/api/laws/verify?ref=${encodeURIComponent(ref)}`).then(json)};}
