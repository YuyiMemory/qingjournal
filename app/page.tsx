'use client';
import { useEffect, useRef, useState } from 'react';
import Writer from './writer';
import { dateLabels, localToday, RichText, type DiaryEntry } from './diary';
import { api } from '../pages/bridge';

const seasons = ['春天','夏天','秋天','冬天'];
const times = ['清晨','中午','下午','晚上'];
type Data = { likes: string[]; comments: Record<string, { text:string; date:string }[]> };
const initial:Data={likes:[],comments:{}};
// Private data and unfinished drafts stay in memory, never in browser disk caches.
const pendingDrafts = new Map<string,DiaryEntry>();
export default function Home({canWrite=false,onLock=()=>{}}:{canWrite?:boolean;onLock?:()=>void}){
 const [entries,setEntries]=useState<DiaryEntry[]>([]);
 const [mode,setMode]=useState<'read'|'write'>('read'),[editId,setEditId]=useState('10'),[saveState,setSaveState]=useState(''),[writingReady,setWritingReady]=useState(false);
 const [writeDate,setWriteDate]=useState('2026-09-10'),[month,setMonth]=useState('2026-09');
 const [data,setData]=useState<Data>(initial),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
 const [drafts,setDrafts]=useState<Record<string,string>>({}),[open,setOpen]=useState<string|null>(null);
 const [pet,setPet]=useState(''),[petVisible,setPetVisible]=useState(true),[settings,setSettings]=useState(false);
 const syncTimer=useRef<ReturnType<typeof setTimeout>|null>(null),visitorId=useRef(''),journalRef=useRef<HTMLElement|null>(null);
 const current=useRef<DiaryEntry[]>([]),alive=useRef(true),saving=useRef(false),paused=useRef(false);
 const [hasDrafts,setHasDrafts]=useState(canWrite&&pendingDrafts.size>0),[saveFailed,setSaveFailed]=useState(false),[reload,setReload]=useState(0);
 const [communityBusy,setCommunityBusy]=useState(false);
 const interactionBusy=useRef(false);
 useEffect(()=>{alive.current=true;let cancelled=false;void (async()=>{
  setWriteDate(localToday());setMonth(localToday().slice(0,7));setWritingReady(false);setLoaded(false);
  try{
   const cloud=await api<{entries:DiaryEntry[];canWrite:boolean}>('read-diaries');if(cancelled)return;
   const display=canWrite?cloud.entries.map(e=>pendingDrafts.get(e.id)||e):cloud.entries;
   if(canWrite)for(const draft of pendingDrafts.values())if(!display.some(e=>e.id===draft.id))display.push(draft);
   current.current=display;setEntries(display);setEditId(display[0]?.id||'');setSelected(value=>display.some(e=>e.id===value)?value:(display[0]?.id||''));
   setWritingReady(canWrite&&cloud.canWrite);setSaveState('✓ 已載入 Google 試算表');setError('');
   if(canWrite&&pendingDrafts.size){paused.current=true;setSaveFailed(true);setError('有尚未同步的草稿。請先下載備份，再決定重試或重新載入。');}
  }catch(err){if(!cancelled){setError(err instanceof Error?err.message:'日記暫時無法載入。');setSaveState('讀取失敗');}}
  try{let id='';try{id=localStorage.getItem('cottage-visitor-v1')||'';if(!id){id=crypto.randomUUID();localStorage.setItem('cottage-visitor-v1',id);}}catch{id=crypto.randomUUID();}visitorId.current=id;
   const community=await api<Data>('read-community',{visitorId:id});if(!cancelled){setData(community);setLoaded(true);}
  }catch{if(!cancelled)setError('日記或互動紀錄尚未成功載入，請重試。');}
 })();return()=>{cancelled=true;alive.current=false;if(syncTimer.current)clearTimeout(syncTimer.current);};},[canWrite,reload]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(canWrite&&pendingDrafts.size){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[canWrite]);
 async function flush(){
  if(!canWrite||!alive.current||saving.current||paused.current||!pendingDrafts.size)return;
  saving.current=true;const batch=Array.from(pendingDrafts.values());setSaveState('正在存入 Google 試算表…');
  try{
   const result=await api<{versions:Record<string,number>}>('save-diaries',{entries:batch});
   for(const sent of batch){const latest=pendingDrafts.get(sent.id);if(latest===sent)pendingDrafts.delete(sent.id);else if(latest)pendingDrafts.set(sent.id,{...latest,version:result.versions[sent.id]});}
   if(!alive.current)return;
   current.current=current.current.map(e=>result.versions[e.id]===undefined?e:{...e,version:result.versions[e.id]});setEntries(current.current);
   setHasDrafts(pendingDrafts.size>0);setSaveFailed(false);setError('');setSaveState('✓ 已存入 Google 試算表');
  }catch(err){paused.current=true;if(alive.current){setSaveFailed(true);setSaveState('尚未確認儲存成功 · 請勿關閉分頁');setError(err instanceof Error?err.message:'儲存失敗');}}
  finally{saving.current=false;if(alive.current&&!paused.current&&pendingDrafts.size)void flush();}
 }
 function saveEntries(next:DiaryEntry[]){if(!writingReady)return;for(const entry of next){if(entry!==current.current.find(e=>e.id===entry.id))pendingDrafts.set(entry.id,entry);}current.current=next;setEntries(next);setHasDrafts(true);setSaveState('草稿暫存在此分頁 · 等待同步');
  if(syncTimer.current)clearTimeout(syncTimer.current);syncTimer.current=setTimeout(()=>void flush(),1200);
 }
 function exportDrafts(){const url=URL.createObjectURL(new Blob([JSON.stringify(Array.from(pendingDrafts.values()),null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='日記小屋-未同步草稿.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function lockCottage(){if(pendingDrafts.size&&canWrite&&!confirm('尚有未同步草稿。確定放棄草稿並鎖上小屋？可先取消並下載草稿。'))return;pendingDrafts.clear();onLock();}
 function startWriting(){if(!writeDate||!/^\d{4}-\d{2}-\d{2}$/.test(writeDate))return;const existing=entries.find(e=>e.iso===writeDate);if(existing)setEditId(existing.id);else{const next={id:crypto.randomUUID(),iso:writeDate,...dateLabels(writeDate),body:'',note:''};saveEntries([next,...entries].sort((a,b)=>b.iso.localeCompare(a.iso)));setEditId(next.id);}setMode('write');setMonth(writeDate.slice(0,7));setQuery('');}
 const editing=entries.find(e=>e.id===editId);
 const [year,monthNumber]=month.split('-').map(Number);
 const firstWeekday=new Date(year,monthNumber-1,1).getDay(),daysInMonth=new Date(year,monthNumber,0).getDate();
 const [season,setSeason]=useState(2),[time,setTime]=useState(3),[auto,setAuto]=useState(true);
 const [query,setQuery]=useState(''),[selected,setSelected]=useState(''),[font,setFont]=useState(19);
 useEffect(()=>{if(!auto)return;const sync=()=>{const d=new Date(),h=d.getHours(),m=d.getMonth();setSeason(m>=2&&m<=4?0:m>=5&&m<=7?1:m>=8&&m<=10?2:3);setTime(h>=5&&h<11?0:h>=11&&h<14?1:h>=14&&h<18?2:3);};sync();const t=setInterval(sync,60000);return()=>clearInterval(t);},[auto]);
 useEffect(()=>{if(!pet)return;const t=setTimeout(()=>setPet(''),2200);return()=>clearTimeout(t);},[pet]);
 useEffect(()=>{
  const context=(document as Document & {modelContext?:{registerTool:(tool:object,options:object)=>void|Promise<void>}}).modelContext;
  if(!context)return;const lifecycle=new AbortController();
  Promise.resolve(context.registerTool({name:'set_cottage_scene',description:'Set the diary demo season and time of day, disabling automatic time selection.',inputSchema:{type:'object',properties:{season:{type:'integer',minimum:0,maximum:3},time:{type:'integer',minimum:0,maximum:3}},required:['season','time'],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input:unknown)=>{const v=input as {season:number;time:number};if(!v||!Number.isInteger(v.season)||!Number.isInteger(v.time)||v.season<0||v.season>3||v.time<0||v.time>3)throw new Error('Season and time must be integers from 0 to 3.');setAuto(false);setSeason(v.season);setTime(v.time);return {season:seasons[v.season],time:times[v.time]};}},{signal:lifecycle.signal})).catch(()=>{});
  return()=>lifecycle.abort();
 },[]);
 function like(id:string){if(!loaded||interactionBusy.current)return;interactionBusy.current=true;setCommunityBusy(true);void (async()=>{try{const result=await api<{liked:boolean}>('set-like',{visitorId:visitorId.current,entryId:id,liked:!data.likes.includes(id)});if(alive.current){setData(d=>({...d,likes:result.liked?[...d.likes.filter(x=>x!==id),id]:d.likes.filter(x=>x!==id)}));setError('');}}catch{if(alive.current)setError('愛心結果未確認，請重新載入後確認。');}finally{interactionBusy.current=false;if(alive.current)setCommunityBusy(false);}})();}
 function comment(id:string){const text=(drafts[id]||'').trim();if(!text||!loaded||interactionBusy.current)return;interactionBusy.current=true;setCommunityBusy(true);void (async()=>{try{const result=await api<{comment:{text:string;date:string}}>('comment',{visitorId:visitorId.current,entryId:id,text,requestId:crypto.randomUUID()});if(alive.current){setData(d=>({...d,comments:{...d.comments,[id]:[...(d.comments[id]||[]),result.comment]}}));setDrafts(d=>({...d,[id]:''}));setError('');}}catch(err){if(alive.current)setError(err instanceof Error?err.message:'留言結果未確認，請重新載入後確認。');}finally{interactionBusy.current=false;if(alive.current)setCommunityBusy(false);}})();}
 const matching=entries.filter(e=>!query||`${e.body}${e.date}`.includes(query));
 const shown=matching.find(e=>e.id===selected)||matching[0];
 const visible=shown?[shown]:[];
 const shownIndex=shown?matching.findIndex(e=>e.id===shown.id):-1;
 const newer=shownIndex>0?matching[shownIndex-1]:null,older=shownIndex>=0&&shownIndex<matching.length-1?matching[shownIndex+1]:null;
 function choose(entry:DiaryEntry){setSelected(entry.id);setEditId(entry.id);setMonth(entry.iso.slice(0,7));setOpen(null);requestAnimationFrame(()=>journalRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));}
 return <main className={`cottage season-${season} time-${time}`}>
  <div className={`scenery ${pet?'stir':''}`} aria-hidden="true"/><div className="lightwash" aria-hidden="true"/>
  <div className="weather" aria-hidden="true">{Array.from({length:16},(_,i)=><i key={i} style={{left:`${i*6.2}%`,animationDelay:`${i*.7}s`,animationDuration:`${12+i%5}s`}}>{season===0?'❀':season===1?'·':season===2?'❧':'❅'}</i>)}</div>
  <header className="mobile-brand">⌂ 日記小屋 <span>留一盞燈，等你來。</span></header>
  <aside className="sidebar">
   <button className="brand" onClick={()=>{setQuery('');if(entries[0])choose(entries[0]);}}><span>⌂</span>日記小屋</button><p className="subtitle">把日子寫給你看</p>
   <label className="search"><span aria-hidden="true">⌕</span><input aria-label="搜尋日記" placeholder="尋找一段回憶…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button onClick={()=>setQuery('')} aria-label="清除搜尋">×</button>}</label>
   <div className="month"><label>回顧月份<input aria-label="回顧月份" type="month" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value);}}/></label></div>
   <div className="calendar" aria-label={`${year}年${monthNumber}月日曆`}>{'日一二三四五六'.split('').map(d=><span className="weekday" key={d}>{d}</span>)}{Array.from({length:firstWeekday},(_,i)=><span key={`blank${i}`}/>)}{Array.from({length:daysInMonth},(_,i)=>{const entry=entries.find(e=>e.iso===`${month}-${String(i+1).padStart(2,'0')}`);return <button key={i} disabled={!entry} className={`${entry?'has-entry':''} ${entry?.id===(mode==='read'?shown?.id:editId)?'chosen':''}`} onClick={()=>{if(entry)choose(entry);}} aria-label={`${monthNumber}月${i+1}日${entry?'，有日記':''}`}>{i+1}</button>;})}</div>
   <nav aria-label="日記日期"><button className={!query&&shown?.id===entries[0]?.id?'active':''} onClick={()=>{setQuery('');setMode('read');if(entries[0])choose(entries[0]);}}>☷ <span>最新日記</span><small>{entries.length}</small></button>{entries.filter(e=>e.iso.startsWith(month)).map(e=><button key={e.id} className={(mode==='write'?editId:shown?.id)===e.id?'active':''} onClick={()=>choose(e)}>♧ <span>{e.date}</span><small>{data.likes.includes(e.id)?'♥':''}</small></button>)}</nav>
   <div className="sidebar-bottom"><span className="tiny-star">✧</span><p>小小的日常，<br/>也是閃閃發光的。</p><span className="demo-label">{canWrite?'主人書房':'密語閱讀'}</span></div>
  </aside>
  <section ref={journalRef} className="journal" aria-label="日記內容" style={{'--reading-size':`${font}px`} as React.CSSProperties}>
   <header className="journal-toolbar"><div className="mode-switch"><button aria-pressed={mode==='read'} onClick={()=>{setMode('read');setQuery('');if(!shown&&entries[0])setSelected(entries[0].id);}}>閱讀</button>{canWrite&&<button disabled={!writingReady} aria-pressed={mode==='write'} onClick={()=>{if(editing)setMode('write');else startWriting();}}>書寫</button>}</div><div><button aria-label="縮小字體" disabled={font<=16} onClick={()=>setFont(v=>v-1)}>A−</button><button aria-label="放大字體" disabled={font>=26} onClick={()=>setFont(v=>v+1)}>A＋</button><button className="lock-button" onClick={lockCottage}>鎖上小屋</button></div></header>
   {canWrite&&hasDrafts&&<section className="draft-warning" aria-label="未同步草稿"><p>{saveState}。草稿未存到硬碟，關閉或重新整理會遺失。</p><button onClick={exportDrafts}>下載草稿備份</button>{saveFailed&&<><button onClick={()=>{paused.current=false;void flush();}}>重試同步</button><button onClick={()=>{if(confirm('確定放棄未同步草稿並讀取試算表最新版？請先下載草稿備份。')){pendingDrafts.clear();setHasDrafts(false);setSaveFailed(false);paused.current=false;setMode('read');setReload(v=>v+1);}}}>放棄草稿，讀取最新版</button></>}</section>}
   {mode==='write'?<><form className="date-create" onSubmit={e=>{e.preventDefault();startWriting();}}><label>選一天寫寫<input type="date" required aria-label="日記日期" value={writeDate} onChange={e=>setWriteDate(e.target.value)}/></label><button disabled={!writingReady}>新增／接著寫</button></form>{editing&&<Writer key={editing.id} entry={editing} status={saveState} onChange={updated=>saveEntries(entries.map(e=>e.id===updated.id?updated:e))}/>}</>:<div className="entries">{visible.map(e=><article className="entry" key={e.id}>
    <header><h1>{e.date}</h1><span>{e.iso.slice(0,4)} · {e.day}</span></header>{e.document?<div className="entry-body rich-text"><RichText document={e.document}/></div>:<p className="entry-body">{e.body}</p>}<p className="entry-note">{e.note}</p>
    <div className="entry-actions"><button className={data.likes.includes(e.id)?'liked':''} aria-pressed={data.likes.includes(e.id)} disabled={!loaded||communityBusy} onClick={()=>like(e.id)}>{data.likes.includes(e.id)?'♥':'♡'} <span>{data.likes.includes(e.id)?'已留下喜歡':'留一顆心'}</span></button><button aria-expanded={open===e.id} onClick={()=>setOpen(open===e.id?null:e.id)}>↳ <span>留句話{data.comments[e.id]?.length?` · ${data.comments[e.id].length}`:''}</span></button></div>
    {open===e.id&&<section className="comments" aria-label="匿名回覆"><p className="local-note">匿名回覆 · 將安全保存於雲端</p>{(data.comments[e.id]||[]).map((c,i)=><div className="comment" key={i}><span>來訪者 <time>{c.date}</time></span><p>{c.text}</p></div>)}<form onSubmit={ev=>{ev.preventDefault();comment(e.id);}}><textarea aria-label="回覆內容" maxLength={2000} placeholder="留一句想說的話…" value={drafts[e.id]||''} onChange={ev=>setDrafts(d=>({...d,[e.id]:ev.target.value}))}/><button disabled={!loaded||!(drafts[e.id]||'').trim()}>送出回覆 ↗</button></form></section>}
    <nav className="entry-pager" aria-label="切換日記"><button disabled={!newer} onClick={()=>{if(newer)choose(newer);}}>← 較新一篇</button><span>{shownIndex+1}／{matching.length}</span><button disabled={!older} onClick={()=>{if(older)choose(older);}}>較早一篇 →</button></nav>
    <div className="divider"><span>❧</span></div>
   </article>)}{!visible.length&&<div className="empty"><h2>還沒找到這段回憶</h2><p>換個關鍵字試試吧。</p><button onClick={()=>{setQuery('');if(entries[0])setSelected(entries[0].id);}}>回到最新日記</button></div>}</div>}
   <footer className="journal-footer">日記、愛心與回覆存於 Google 試算表<br/>{saveState}{error&&<><p role="alert">{error}</p><button disabled={hasDrafts} onClick={()=>setReload(v=>v+1)}>重新載入</button></>}</footer>
  </section>
  <aside className="room" aria-label="陪伴小屋"><div className="room-caption"><span>{['花開的時候','微風來作客','收藏一片秋天','等一場溫柔的雪'][season]}</span><p>{['晨光輕輕落下','把陽光留給你','晚霞也慢了下來','今晚也有一盞燈'][time]}</p></div>
   {petVisible&&<div className="pet-area"><output className={`pet-message ${pet?'show':''}`}>{pet==='pig'?'呼嚕～大豬豬蹭蹭你 ♡':pet==='panda'?'小熊貓開心地晃了晃 ♡':''}</output><button className="pet-hit pig" aria-label="摸摸大豬豬" onClick={()=>setPet('pig')}/><button className="pet-hit panda" aria-label="摸摸小熊貓" onClick={()=>setPet('panda')}/><div className="pet-label">點點我們，陪你待一會兒 ♡</div></div>}
   <div className="scene-control"><button className="scene-toggle" onClick={()=>setSettings(!settings)} aria-expanded={settings}><span>✧ {seasons[season]} · {times[time]}</span><span>調整光景 {settings?'−':'＋'}</span></button>{settings&&<div className="settings"><label>季節<select aria-label="季節" value={season} onChange={e=>{setAuto(false);setSeason(+e.target.value);}}>{seasons.map((s,i)=><option key={s} value={i}>{s}</option>)}</select></label><label>時段<select aria-label="時段" value={time} onChange={e=>{setAuto(false);setTime(+e.target.value);}}>{times.map((s,i)=><option key={s} value={i}>{s}</option>)}</select></label><label className="check"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/>跟隨現在的季節與時間</label><label className="check"><input type="checkbox" checked={petVisible} onChange={e=>setPetVisible(e.target.checked)}/>開啟寵物點擊互動</label><p>光景為童話效果，不代表即時天氣。</p></div>}</div>
  </aside>
 </main>;
}
