// Replace the ENTIRE Code.gs of the diary project with this file.
// Never add this alongside the old Code.gs; do not change the confession game.
// All helpers end in _ so google.script.run cannot invoke them directly.
const PAGES_ORIGIN = 'https://yuyimemory.github.io';
const PAGES_TABS = {diaries:'日記小屋_日記',comments:'日記小屋_留言',hearts:'日記小屋_愛心'};

// Run manually once after setting the three properties described in README.
function setupCottage_() {
  const p=PropertiesService.getScriptProperties();
  const reader=p.getProperty('COTTAGE_READER_PASSWORD'), owner=p.getProperty('COTTAGE_OWNER_PASSWORD');
  if(!reader||!owner||reader.length<4||owner.length<4||reader.length>256||owner.length>256||reader===owner) throw new Error('請設定兩組不同、各 4–256 字元的密碼。');
  const book=SpreadsheetApp.openById(p.getProperty('COTTAGE_SHEET_ID'));
  Object.keys(PAGES_TABS).forEach(k=>{if(!book.getSheetByName(PAGES_TABS[k]))throw new Error('找不到分頁：'+PAGES_TABS[k]);});
  if(!p.getProperty('COTTAGE_BRIDGE_SECRET'))p.setProperty('COTTAGE_BRIDGE_SECRET',Utilities.getUuid()+Utilities.getUuid());
  if(!p.getProperty('COTTAGE_OWNER_ID')) {
    const sheet=book.getSheetByName(PAGES_TABS.diaries);
    p.setProperty('COTTAGE_OWNER_ID',sheet.getLastRow()>1?String(sheet.getRange(2,2).getValue()):'cottage-owner');
  }
}

// No diary data, tokens, passwords, or signing keys are rendered into this page.
function doGet(e) {
  const channel=e&&e.parameter&&e.parameter.channel;
  if(typeof channel!=='string'||!/^[a-zA-Z0-9-]{20,80}$/.test(channel))return ContentService.createTextOutput('Password-protected diary service');
  const html='<!doctype html><html><head><meta charset="utf-8"></head><body><script>'+ 
    'const channel='+JSON.stringify(channel)+';const origin='+JSON.stringify(PAGES_ORIGIN)+';'+
    'window.addEventListener("message",function(e){'+
    'if(e.source!==window.top||e.origin!==origin||!e.data||e.data.channel!==channel||e.data.type!=="cottage-request")return;'+
    'const id=e.data.id;if(typeof id!=="string"||id.length>80)return;'+
    'google.script.run.withSuccessHandler(function(result){window.top.postMessage({type:"cottage-result",channel:channel,id:id,result:result},origin);})'+
    '.withFailureHandler(function(){window.top.postMessage({type:"cottage-result",channel:channel,id:id,result:{status:503,data:{error:"Google 服務暫時無法使用，請稍後再試。"}}},origin);})'+
    '.cottageRequest(e.data.input);});'+
    'window.top.postMessage({type:"cottage-ready",channel:channel},origin);'+
    '</script></body></html>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function doPost(e) {
  let result;
  try {const raw=e&&e.postData&&e.postData.contents;if(!raw||raw.length>2000000)fail_('請求過長。',400);result=cottageRequest(JSON.parse(raw));}
  catch(error){result={status:400,data:{error:'請求格式不正確。'}};}
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
function fail_(message,status){const e=new Error(message);e.status=status;throw e;}
function reply_(data){return {status:200,data:data};}
function mac_(text,key){return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text,key));}
function same_(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function config_(){
  const p=PropertiesService.getScriptProperties();
  const reader=p.getProperty('COTTAGE_READER_PASSWORD'),owner=p.getProperty('COTTAGE_OWNER_PASSWORD'),secret=p.getProperty('COTTAGE_BRIDGE_SECRET');
  if(!reader||!owner||reader.length<4||owner.length<4||reader.length>256||owner.length>256||reader===owner||!secret||!p.getProperty('COTTAGE_OWNER_ID'))fail_('主人尚未完成 Google 端密碼設定。',503);
  return {p:p,reader:reader,owner:owner,key:mac_(JSON.stringify([reader,owner]),secret),sheet:p.getProperty('COTTAGE_SHEET_ID'),ownerId:p.getProperty('COTTAGE_OWNER_ID')};
}
function authenticate_(token,c){
  if(typeof token!=='string'||token.length>2000)fail_('請先輸入密碼。',401);
  const parts=token.split('.');if(parts.length!==2||!same_(mac_(parts[0],c.key),parts[1]))fail_('請重新輸入密碼。',401);
  let session;try{session=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());}catch(e){fail_('請重新輸入密碼。',401);}
  if(!session||!['reader','owner'].includes(session.role)||typeof session.exp!=='number'||session.exp<=Date.now())fail_('密語已到期，請重新輸入。',401);
  return session;
}
function login_(input,c){
  const role=input.role==='owner'?'owner':'reader';
  // Shared persistent counter, guarded by the script lock. Fail closed after 10 failures/5 min.
  const key='COTTAGE_LOGIN_LIMIT_'+role,now=Date.now();
  let limit=JSON.parse(c.p.getProperty(key)||'null');
  if(!limit||now-limit.start>=300000)limit={start:now,failures:0};
  if(limit.failures>=10)fail_('嘗試次數過多，請在五分鐘後再試。',429);
  const password=input.password;
  if(typeof password!=='string'||password.length>256||!same_(mac_(password,c.key),mac_(c[role],c.key))){limit.failures++;c.p.setProperty(key,JSON.stringify(limit));fail_('密碼不正確。',401);}
  const exp=now+30*24*60*60*1000;
  const payload=Utilities.base64EncodeWebSafe(JSON.stringify({role:role,exp:exp,nonce:Utilities.getUuid()}));
  return reply_({token:payload+'.'+mac_(payload,c.key),role:role,expiresAt:exp});
}
function rows_(sheet,width){return sheet.getLastRow()<2?[]:sheet.getRange(2,1,sheet.getLastRow()-1,width).getValues().map(r=>r.map(v=>v instanceof Date?v.toISOString():v));}
function cellUpdate_(sheet,index,row){return {updateCells:{start:{sheetId:sheet.getSheetId(),rowIndex:index+1,columnIndex:0},rows:[{values:row.map(v=>({userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:String(v==null?'':v)}}))}],fields:'userEnteredValue'}};}
function commit_(sheetId,requests){
  if(!requests.length)return;
  const response=UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/'+sheetId+':batchUpdate',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:JSON.stringify({requests:requests}),muteHttpExceptions:true});
  if(response.getResponseCode()!==200)fail_('試算表寫入失敗，請保留草稿後重試。',503);
}
function entry_(row){const e={id:String(row[0]),iso:String(row[2]),date:row[3],day:row[4],body:row[5],note:row[6],version:Number(row[9])};if(row[7])e.document=JSON.parse(row[7]);return e;}
function text_(v,max){return typeof v==='string'&&v.length<=max;}

// This is the ONLY callable data operation. Every operation except login requires a signed session.
function cottageRequest(input){
  let lock;
  try {
    if(!input||typeof input!=='object'||JSON.stringify(input).length>2000000)fail_('請求格式不正確。',400);
    const c=config_();
    // Reject forged/expired credentials before reading any spreadsheet.
    const session=input.action==='login'?null:authenticate_(input.token,c);
    lock=LockService.getScriptLock();if(!lock.tryLock(10000))fail_('同步忙碌中，請稍後再試。',503);
    if(input.action==='login')return login_(input,c);
    const isOwner=session.role==='owner';
    if(input.action==='save-diaries'&&!isOwner)fail_('只有主人可以修改日記。',403);
    const book=SpreadsheetApp.openById(c.sheet),diarySheet=book.getSheetByName(PAGES_TABS.diaries),diaries=rows_(diarySheet,12);
    if(input.action==='read-diaries')return reply_({entries:diaries.filter(r=>r[8]==='public'||(isOwner&&r[1]===c.ownerId)).map(entry_).sort((a,b)=>b.iso.localeCompare(a.iso)),canWrite:isOwner});
    if(input.action==='save-diaries'){
      if(!Array.isArray(input.entries)||input.entries.length>500)fail_('日記格式不正確。',400);
      const now=new Date().toISOString(),requests=[],seen=Object.create(null);
      input.entries.forEach(e=>{
        if(!e||!text_(e.id,80)||!e.id||seen[e.id]||!text_(e.iso,10)||!/^\d{4}-\d{2}-\d{2}$/.test(e.iso)||!text_(e.date,40)||!text_(e.day,40)||!text_(e.body,45000)||!text_(e.note,2000))fail_('日記格式或長度超過限制。',400);
        seen[e.id]=true;const doc=e.document?JSON.stringify(e.document):'';if(doc.length>45000)fail_('日記格式過長，請拆成兩篇。',400);
        let index=diaries.findIndex(r=>String(r[0])===e.id);const old=index<0?null:diaries[index];
        if(old&&old[1]!==c.ownerId)fail_('作者不符。',403);
        if(old&&old[2]===e.iso&&old[3]===e.date&&old[4]===e.day&&old[5]===e.body&&old[6]===e.note&&old[7]===doc)return;
        if(old&&Number(e.version)!==Number(old[9]))fail_('另一個裝置已更新這篇日記。請下載草稿，再重新載入比對。',409);
        const row=[e.id,c.ownerId,e.iso,e.date,e.day,e.body,e.note,doc,old?old[8]:'public',old?Number(old[9])+1:1,old?old[10]:now,now];
        if(index<0){index=diaries.length;diaries.push(row);}else diaries[index]=row;
        if(index+2>diarySheet.getMaxRows())fail_('日記分頁列數不足，請先新增列。',400);
        requests.push(cellUpdate_(diarySheet,index,row));
      });
      commit_(c.sheet,requests);const versions=Object.create(null);diaries.forEach(r=>{versions[String(r[0])]=Number(r[9]);});
      return reply_({saved:input.entries.length,versions:versions});
    }
    const visitor=input.visitorId;if(!text_(visitor,80)||!/^[a-zA-Z0-9-]{8,80}$/.test(visitor))fail_('缺少訪客識別。',400);
    const ids=new Set(diaries.filter(r=>r[8]==='public').map(r=>String(r[0])));
    const hs=book.getSheetByName(PAGES_TABS.hearts),cs=book.getSheetByName(PAGES_TABS.comments),hearts=rows_(hs,4),comments=rows_(cs,6);
    if(input.action==='read-community'){
      const out=Object.create(null);comments.filter(r=>r[4]==='visible'&&ids.has(String(r[1]))).forEach(r=>{const id=String(r[1]);if(!out[id])out[id]=[];out[id].push({text:r[3],date:String(r[5])});});
      return reply_({likes:hearts.filter(r=>r[1]===visitor&&r[2]==='heart'&&ids.has(String(r[0]))).map(r=>String(r[0])),comments:out});
    }
    if(!ids.has(input.entryId))fail_('找不到日記。',404);
    const now=new Date().toISOString();
    if(input.action==='set-like'){
      if(typeof input.liked!=='boolean')fail_('愛心格式不正確。',400);
      const index=hearts.findIndex(r=>String(r[0])===input.entryId&&r[1]===visitor&&r[2]==='heart');
      if(index>=0&&!input.liked)commit_(c.sheet,[{deleteDimension:{range:{sheetId:hs.getSheetId(),dimension:'ROWS',startIndex:index+1,endIndex:index+2}}}]);
      if(index<0&&input.liked){if(hearts.length+2>hs.getMaxRows())fail_('愛心分頁列數不足。',400);commit_(c.sheet,[cellUpdate_(hs,hearts.length,[input.entryId,visitor,'heart',now])]);}
      return reply_({liked:input.liked});
    }
    if(input.action==='comment'){
      if(!text_(input.requestId,80)||!/^[a-zA-Z0-9-]{8,80}$/.test(input.requestId))fail_('缺少留言識別。',400);
      const old=comments.find(r=>r[0]===input.requestId&&r[1]===input.entryId&&r[2]===visitor);
      if(old)return reply_({comment:{text:old[3],date:String(old[5])}});
      const body=typeof input.text==='string'?input.text.trim():'';if(!body||body.length>2000)fail_('留言需為 1–2000 字。',400);
      if(comments.some(r=>r[2]===visitor&&Date.now()-Date.parse(r[5])<10000))fail_('請稍候 10 秒再留言。',429);
      if(comments.length+2>cs.getMaxRows())fail_('留言分頁列數不足。',400);
      commit_(c.sheet,[cellUpdate_(cs,comments.length,[input.requestId,input.entryId,visitor,body,'visible',now])]);
      return reply_({comment:{text:body,date:now}});
    }
    fail_('不支援的操作。',400);
  }catch(error){return {status:error.status||503,data:{error:error.status?error.message:'Google 服務暫時無法使用，請稍後再試。'}};}
  finally{if(lock&&lock.hasLock())lock.releaseLock();}
}
