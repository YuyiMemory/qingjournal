const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const source=fs.readFileSync(__dirname+'/Pages.gs','utf8');
const ast=require('acorn').parse(source,{ecmaVersion:2017});
assert.deepEqual(ast.body.filter(n=>n.type==='FunctionDeclaration'&&!n.id.name.endsWith('_')).map(n=>n.id.name).sort(),['cottageRequest','doGet','doPost']);
const props={COTTAGE_READER_PASSWORD:'r7Q!',COTTAGE_OWNER_PASSWORD:'o9Z?',COTTAGE_BRIDGE_SECRET:'test-signing-key',COTTAGE_SHEET_ID:'test-sheet',COTTAGE_OWNER_ID:'test-owner'};
const tables={diaries:[['one','test-owner','2026-09-12','9 月 12 日','星期六','private test body','','','public',1,'2026-09-12T00:00:00Z','2026-09-12T00:00:00Z']],comments:[],hearts:[],logs:[]};
const tabs={'日記小屋_日記':'diaries','日記小屋_留言':'comments','日記小屋_愛心':'hearts','日記小屋_紀錄':'logs'};
let sheetReads=0,writes=[],logTabMissing=false,logHeading='筆數',logWriteFails=false;
const context=vm.createContext({
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=v;}})},
 Utilities:{getUuid:()=>crypto.randomUUID(),base64EncodeWebSafe:v=>Buffer.from(v).toString('base64url'),base64DecodeWebSafe:v=>Buffer.from(v,'base64url'),newBlob:v=>({getDataAsString:()=>Buffer.from(v).toString()}),computeHmacSha256Signature:(v,k)=>crypto.createHmac('sha256',k).update(v).digest()},
 LockService:{getScriptLock:()=>({tryLock:()=>true,hasLock:()=>true,releaseLock:()=>{}})},
 SpreadsheetApp:{openById:()=>{sheetReads++;return {getSheetByName:name=>{const kind=tabs[name];if(!kind||(kind==='logs'&&logTabMissing))return null;return {getSheetId:()=>Object.keys(tables).indexOf(kind),getLastRow:()=>tables[kind].length+1,getMaxRows:()=>1000,getRange:()=>({getValues:()=>tables[kind].map(r=>r.slice()),getValue:()=>logHeading,setValue:v=>{logHeading=v;}}),appendRow:row=>{if(logWriteFails)throw new Error('sheet full');tables[kind].push(Array.from(row));}};}};}},
 UrlFetchApp:{fetch:(url,options)=>{writes.push(JSON.parse(options.payload));return {getResponseCode:()=>200};}},
 ScriptApp:{getOAuthToken:()=> 'fake-oauth'},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:v=>({text:v,setMimeType:()=>v})},
 HtmlService:{XFrameOptionsMode:{ALLOWALL:'allow'},createHtmlOutput:v=>({setXFrameOptionsMode:()=>v})}
});
vm.runInContext(source,context);
const call=input=>JSON.parse(JSON.stringify(context.cottageRequest(input)));
for(const action of ['read-diaries','view-diary','read-community','save-diaries','comment','set-like','health'])assert.equal(call({action}).status,401);
assert.equal(sheetReads,0,'unauthenticated requests must never read the sheet');
assert.equal(call({action:'read-diaries',secret:'test-signing-key',userId:'test-owner'}).status,401,'old bridge secret cannot bypass password login');
assert.equal(call({action:'login',role:'reader',password:'wrong'}).status,401);
const reader=call({action:'login',role:'reader',password:props.COTTAGE_READER_PASSWORD});assert.equal(reader.status,200);
assert.equal(call({action:'read-diaries',token:reader.data.token,visitorId:'visitor-abc123'}).data.entries[0].body,'private test body');
assert.equal(tables.logs.length,0,'loading the diary list does not imply viewing every entry');
assert.equal(call({action:'view-diary',token:reader.data.token,visitorId:'visitor-abc123',entryId:'one'}).status,200);
assert.deepEqual(tables.logs[0].slice(1),['view-diary','reader','visitor-abc123','日記：2026-09-12 / ID：one'],'views identify the displayed diary');
assert.equal(logHeading,'日記（日期／ID）','the old count heading is migrated');
assert.match(tables.logs[0][0],/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,'log rows start with a plain wall-clock timestamp');
assert.ok(Math.abs(Date.parse(tables.logs[0][0].replace(' ','T')+'Z')-(Date.now()+8*3600*1000))<60000,'the timestamp is UTC+8, not UTC');
assert.equal(call({action:'view-diary',token:reader.data.token,visitorId:'=IMPORTXML("https://invalid.example","x")',entryId:'one'}).status,400);
assert.equal(call({action:'view-diary',token:reader.data.token,visitorId:'visitor-abc123',entryId:'missing'}).status,404);
tables.diaries.push(['hidden','test-owner','2026-09-11','','','','','','private',1]);
assert.equal(call({action:'view-diary',token:reader.data.token,visitorId:'visitor-abc123',entryId:'hidden'}).status,404,'readers cannot log inaccessible diaries');
tables.diaries.pop();
assert.equal(call({action:'save-diaries',token:reader.data.token,userId:'test-owner',entries:[]}).status,403);
assert.equal(tables.logs.length,1,'rejected requests are not logged');
const parts=reader.data.token.split('.');const payload=JSON.parse(Buffer.from(parts[0],'base64url'));payload.role='owner';
assert.equal(call({action:'save-diaries',token:Buffer.from(JSON.stringify(payload)).toString('base64url')+'.'+parts[1],entries:[]}).status,401);
const owner=call({action:'login',role:'owner',password:props.COTTAGE_OWNER_PASSWORD});assert.equal(owner.status,200);
assert.equal(call({action:'view-diary',token:owner.data.token,visitorId:'visitor-abc123',entryId:'one'}).status,200);
tables.diaries.push(['hidden','other-owner','2026-09-11','','','','','','private',1]);
assert.equal(call({action:'view-diary',token:owner.data.token,visitorId:'visitor-abc123',entryId:'hidden'}).status,404,'owners cannot log another author’s private diary');
tables.diaries.pop();
const entry=call({action:'read-diaries',token:owner.data.token}).data.entries[0];entry.body='=IMPORTXML("https://invalid.example","x")';
assert.equal(call({action:'save-diaries',token:owner.data.token,entries:[{...entry,version:0}]}).status,409);
assert.equal(writes.length,0);
assert.equal(call({action:'save-diaries',token:owner.data.token,entries:[entry,{...entry,id:'two',body:'x'.repeat(45001)}]}).status,400);
assert.equal(writes.length,0,'invalid batch must not partially save');
assert.equal(call({action:'save-diaries',token:owner.data.token,entries:[entry]}).data.versions.one,2);
assert.equal(writes[0].requests[0].updateCells.rows[0].values[5].userEnteredValue.stringValue,entry.body);
assert.equal(tables.logs.length,2,'only displayed entries are logged; saves and list loads are not');
assert.equal(tables.logs[1][2],'owner','the owner view is logged under the owner role');
assert.equal(call({action:'read-community',token:owner.data.token,visitorId:'visitor-abc123'}).status,200);
assert.equal(tables.logs.length,2,'community reads are not logged');
logTabMissing=true;
assert.equal(call({action:'read-diaries',token:owner.data.token,visitorId:'visitor-abc123'}).status,200,'a missing log tab must never block reading');
assert.equal(call({action:'view-diary',token:owner.data.token,visitorId:'visitor-abc123',entryId:'one'}).status,200);
assert.equal(tables.logs.length,2,'nothing is logged while the log tab is missing');
logTabMissing=false;
logWriteFails=true;
assert.equal(call({action:'view-diary',token:owner.data.token,visitorId:'visitor-abc123',entryId:'one'}).status,200,'logging failure does not interrupt reading');
logWriteFails=false;
tables.diaries.push(['=1+1','test-owner','2026-09-10','','','','','','public',1]);
assert.equal(call({action:'view-diary',token:reader.data.token,visitorId:'visitor-abc123',entryId:'=1+1'}).status,200);
assert.equal(tables.logs[2][4],'日記：2026-09-10 / ID：=1+1','legacy IDs are prefixed with literal text');
tables.diaries.pop();
const c=context.config_();payload.role='reader';payload.exp=Date.now()-1;const expired=Buffer.from(JSON.stringify(payload)).toString('base64url');
assert.equal(call({action:'read-diaries',token:expired+'.'+context.mac_(expired,c.key)}).status,401);
props.COTTAGE_READER_PASSWORD='changed-reader-password';
assert.equal(call({action:'read-diaries',token:owner.data.token}).status,401,'password rotation revokes existing tokens');
for(let i=0;i<9;i++)assert.equal(call({action:'login',role:'reader',password:'wrong'}).status,401);
assert.equal(call({action:'login',role:'reader',password:props.COTTAGE_READER_PASSWORD}).status,429);
const html=context.doGet({parameter:{channel:'test-channel-1234567890'}});
assert.ok(!html.includes('private test body')&&!html.includes(props.COTTAGE_OWNER_PASSWORD));
assert.ok(html.includes('e.source!==window.top')&&html.includes('e.origin!==origin'));
require('acorn').parse(html.match(/<script>([\s\S]*)<\/script>/)[1],{ecmaVersion:2017});
console.log('PASS: private RPC helpers, all-operation auth, role separation, forged/expired tokens, password rotation, brute-force limits, atomic validation, literal writes, secret-free bridge, best-effort read log.');
