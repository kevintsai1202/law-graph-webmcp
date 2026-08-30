/** 將 CaseStatus 映射為畫面狀態。 */
export function viewFor(status){if(!status)return'INPUT';if(status.status==='WAITING')return'QUESTIONS';if(status.status==='COMPLETED')return'RESULT';if(status.status==='FAILED')return'FAILED';return'RUNNING';}
