# 用途：線上 M3 驗證——以合約示範案啟動一件、輪詢到終態、比對 /api/stats 前後差值（可重跑）
import json, time, urllib.request
BASE='https://law-graph-webmcp.zeabur.app'
H={'Content-Type':'application/json','X-LawGraph-Model':'gpt-5.4-nano'}
def get(p): return json.load(urllib.request.urlopen(urllib.request.Request(BASE+p,headers=H),timeout=60))
def post(p,b): return json.load(urllib.request.urlopen(urllib.request.Request(BASE+p,data=json.dumps(b).encode(),headers=H,method='POST'),timeout=60))
before=get('/api/stats?days=1')['today']
text=[s for s in get('/api/samples?locale=zh-TW&mode=contract') if s['id']=='labor-contract'][0]['text']
s=post('/api/cases',{'caseText':text,'locale':'zh-TW','mode':'contract','party':'partyB','scopes':['labor'],'documents':['revised']})
cid=s['caseId']; print('caseId',cid,'mode',s.get('mode')); t0=time.time()
while time.time()-t0<900:
    time.sleep(6); st=get(f'/api/cases/{cid}')
    if st['status']=='WAITING':
        post(f'/api/cases/{cid}/answers',{'answers':[{'questionId':q['id'],'answer':'不清楚'} for q in st['questions']]}); continue
    if st['status'] in ('COMPLETED','FAILED'): break
after=get('/api/stats?days=1')['today']
r=st.get('result') or {}
out={'status':st['status'],'step':st.get('step'),'elapsed':int(time.time()-t0),'error':st.get('error'),
 'laws':len((r.get('research') or {}).get('laws',[])),'findings':len(((r.get('compliance') or {}).get('findings',[]))),
 'clauseNodesWithRisk':sum(1 for n in ((r.get('graph') or {}).get('nodes',[])) if n.get('group')=='clause' and n.get('risk')),
 'revised':len(((r.get('revised') or {}).get('items',[]))),'statsBefore':before,'statsAfter':after,'quota':get('/api/quota')}
json.dump(st,open('artifacts/m3-live-online-case.json','w',encoding='utf-8'),ensure_ascii=False)
print(json.dumps(out,ensure_ascii=False,indent=1))
