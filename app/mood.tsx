'use client';
import { useEffect, useState } from 'react';
import './mood.css';
import { useMoods } from './use-moods';
const moods = [['☀️','開心'],['🌿','平靜'],['💗','想你'],['🌙','疲倦'],['🌧️','低落'],['🌀','煩躁']];
function timestamp(at:number, now:number) {
 const date=new Date(at), yesterday=new Date(now); yesterday.setDate(yesterday.getDate()-1);
 const day=date.toDateString()===new Date(now).toDateString()?'今天':date.toDateString()===yesterday.toDateString()?'昨天':date.toLocaleDateString('zh-TW');
 return `${day} ${date.toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false})}`;
}
export default function MoodCorner({role,demo=false}:{role:'owner'|'reader';demo?:boolean}){
 const person=role==='owner'?0:1;
 const {feelings,ready,busy,error,message,refresh,change}=useMoods(role,demo);
 const mood=feelings[person]?.mood??null,need=feelings[person]?.need||'';
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 function update(nextMood:number|null,nextNeed:string){if(nextMood!==null)void change('save-mood',{mood:nextMood,need:nextNeed});}
 return <section className="mood-corner" aria-labelledby="mood-title">
  <header className="mood-heading"><div><span className="mood-eyebrow">♡ OUR LITTLE MOMENT</span><h2 id="mood-title">今天的你，還好嗎？</h2></div><span className="mood-trial">{demo?'試玩版':'兩人的心情'}</span></header>
  <div className="mood-cards">{[person,1-person].map((id,index)=>{const own=index===0,feeling=feelings[id];return <article className={`mood-card ${own?'mood-own':'mood-partner'}`} key={id}>
   <div className="mood-card-top"><h3>{own?'我的心情':'伴侶的心情'}</h3><span>{own?'留一點此刻':'把你放在心上'}</span></div>
   <span className="mood-emoji" aria-hidden="true">{feeling?moods[feeling.mood][0]:'☁️'}</span><h4>{feeling?moods[feeling.mood][1]:'今天還沒分享'}</h4>
   {feeling?.need&&<span className="mood-need">{feeling.need}</span>}{feeling&&<time dateTime={new Date(feeling.at).toISOString()}>{timestamp(feeling.at,now)} 更新</time>}
   {feeling?.reaction&&<p className="mood-received">♡ {own?'伴侶回應':'你回應了'}：{feeling.reaction}</p>}
   {!own&&<div className="mood-reactions">{['抱抱你','我在'].map(reaction=><button key={reaction} disabled={!ready||busy||!feeling} aria-pressed={feeling?.reaction===reaction} onClick={()=>void change('react-mood',{reaction})}>♡ {reaction}</button>)}</div>}
  </article>;})}</div>
  <div className="mood-editor">
   <fieldset disabled={!ready||busy}><legend>現在的心情</legend><div className="mood-options">{moods.map(([emoji,label],i)=><button type="button" key={label} aria-pressed={mood===i} onClick={()=>update(i,need)}>{emoji} {label}</button>)}</div></fieldset>
   <fieldset disabled={!ready||busy||mood===null}><legend>希望怎麼被陪伴（選填）</legend><div className="mood-options">{['想抱抱','想聊聊','想靜靜'].map(value=><button type="button" key={value} aria-pressed={need===value} onClick={()=>update(mood,need===value?'':value)}>{value}</button>)}</div></fieldset>
  </div>
  <p className="mood-status" role="status">{message||(!ready&&!error?'正在讀取兩人的心情…':'')}</p>{error&&<p role="alert">{error} <button disabled={busy} onClick={()=>void refresh()}>重新載入心情</button></p>}
 </section>;
}
