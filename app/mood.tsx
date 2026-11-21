'use client';
import { useEffect, useState } from 'react';
import './mood.css';
const moods = [['☀️','開心'],['🌿','平靜'],['💗','想你'],['🌙','疲倦'],['🌧️','低落'],['🌀','煩躁']];
type Feeling = { mood:number; need:string; at:number; reaction?:string };
function timestamp(at:number, now:number) {
 const date=new Date(at), yesterday=new Date(now); yesterday.setDate(yesterday.getDate()-1);
 const day=date.toDateString()===new Date(now).toDateString()?'今天':date.toDateString()===yesterday.toDateString()?'昨天':date.toLocaleDateString('zh-TW');
 return `${day} ${date.toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false})}`;
}
export default function MoodCorner({role}:{role:'owner'|'reader'}){
 const person=role==='owner'?0:1;
 const [feelings,setFeelings]=useState<(Feeling|null)[]>([null,null]);
 const [mood,setMood]=useState<number|null>(null),[need,setNeed]=useState('');
 const [message,setMessage]=useState(''),[now,setNow]=useState(Date.now);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 function update(nextMood:number|null,nextNeed:string){setMood(nextMood);setNeed(nextNeed);if(nextMood===null)return;const at=Date.now();setFeelings(all=>all.map((f,i)=>i===person?{mood:nextMood,need:nextNeed,at}:f));setNow(at);setMessage('心情已暫存在此頁，尚未同步給伴侶。');}
 return <section className="mood-corner" aria-labelledby="mood-title">
  <header className="mood-heading"><div><span className="mood-eyebrow">♡ OUR LITTLE MOMENT</span><h2 id="mood-title">今天的你，還好嗎？</h2><p>一點心情，留給最在乎的那個人。</p></div><span className="mood-trial">試玩版</span></header>
  <div className="mood-perspective"><span>{role==='owner'?'主人視角':'讀者視角'} · 留下自己的心情，看看對方的近況</span></div>
  <div className="mood-cards">{[person,1-person].map((id,index)=>{const own=index===0,feeling=feelings[id];return <article className={`mood-card ${own?'mood-own':'mood-partner'}`} key={id}>
   <div className="mood-card-top"><h3>{own?'我的心情':'伴侶的心情'}</h3><span>{own?'留一點此刻':'把你放在心上'}</span></div>
   <span className="mood-emoji" aria-hidden="true">{feeling?moods[feeling.mood][0]:'☁️'}</span><h4>{feeling?moods[feeling.mood][1]:'今天還沒分享'}</h4>
   <p className="mood-note">{(feeling?'不用說很多，也能懂你。':own?'想說的時候，我就在這裡。':'等你想說的時候，再靠近一點。')}</p>
   {feeling?.need&&<span className="mood-need">{feeling.need}</span>}{feeling&&<time dateTime={new Date(feeling.at).toISOString()}>{timestamp(feeling.at,now)} 更新</time>}
   {feeling?.reaction&&<p className="mood-received">♡ {own?'伴侶回應':'你回應了'}：{feeling.reaction}</p>}
   {!own&&<div className="mood-reactions">{['抱抱你','我在'].map(reaction=><button key={reaction} disabled={!feeling} aria-pressed={feeling?.reaction===reaction} onClick={()=>{setFeelings(all=>all.map((f,i)=>i===id&&f?{...f,reaction}:f));setMessage(`已在試玩中回應「${reaction}」`);}}>♡ {reaction}</button>)}</div>}
  </article>;})}</div>
  <div className="mood-editor">
   <fieldset><legend>現在的心情</legend><div className="mood-options">{moods.map(([emoji,label],i)=><button type="button" key={label} aria-pressed={mood===i} onClick={()=>update(i,need)}>{emoji} {label}</button>)}</div></fieldset>
   <fieldset><legend>希望怎麼被陪伴（選填）</legend><div className="mood-options">{['想抱抱','想聊聊','想靜靜'].map(value=><button type="button" key={value} aria-pressed={need===value} onClick={()=>update(mood,need===value?'':value)}>{value}</button>)}</div></fieldset>
  </div>
  <p className="mood-status" role="status">{message}</p><p className="mood-disclaimer">目前為試作，心情只留在此頁，登出或重新整理會清除，尚未同步給伴侶。</p>
 </section>;
}
