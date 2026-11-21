import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../pages/bridge';

export type Feeling = { mood:number; need:string; at:number; version:number; reaction?:string };
type Snapshot = { feelings: (Feeling|null)[] };
export function useMoods(role:'owner'|'reader', demo:boolean) {
 const person=role==='owner'?0:1;
 const [feelings,setFeelings]=useState<(Feeling|null)[]>([null,null]);
 const [ready,setReady]=useState(demo),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const lock=useRef(false),mounted=useRef(false),current=useRef(feelings),epoch=useRef(0);
 function accept(snapshot:Snapshot){current.current=snapshot.feelings;setFeelings(snapshot.feelings);setReady(true);}
 async function refresh(){
  if(demo||lock.current)return;
  lock.current=true;setBusy(true); const generation=epoch.current;
  try{const result=await api<Snapshot>('read-moods');if(mounted.current&&generation===epoch.current){accept(result);setError('');}}
  catch(err){if(mounted.current&&generation===epoch.current)setError(err instanceof ApiError&&err.status===400?'心情同步服務尚未更新，請稍後重試。':err instanceof Error?err.message:'心情讀取失敗。');}
  finally{lock.current=false;if(mounted.current&&generation===epoch.current)setBusy(false);}
 }
 useEffect(()=>{
  mounted.current=true;epoch.current++;
  if(!demo)void refresh();
  const poll=()=>{if(document.visibilityState==='visible')void refresh();};
  const timer=demo?undefined:setInterval(poll,30000);
  window.addEventListener('focus',poll);document.addEventListener('visibilitychange',poll);
  return()=>{mounted.current=false;epoch.current++;clearInterval(timer);window.removeEventListener('focus',poll);document.removeEventListener('visibilitychange',poll);};
 },[demo,role]);
 async function change(action:'save-mood'|'react-mood',fields:Record<string,unknown>){
  if(lock.current||!ready)return;
  lock.current=true;setBusy(true);setError('');setMessage(demo?'':'正在同步…');
  const generation=epoch.current;
  try{
   const target=action==='save-mood'?person:1-person;
   const previous=current.current[target];
   let result:Snapshot;
   if(demo){const next=[...current.current];next[target]=action==='save-mood'?{mood:fields.mood as number,need:fields.need as string,at:Date.now(),version:(previous?.version||0)+1}:previous?{...previous,reaction:fields.reaction as string}:null;result={feelings:next};}
   else result=await api<Snapshot>(action,{...fields,version:previous?.version||0,requestId:crypto.randomUUID()});
   if(mounted.current&&generation===epoch.current){accept(result);setMessage(demo?'已更新試玩心情。':'已同步，對方重新整理或稍候就能看到。');}
  }catch(err){
   if(mounted.current&&generation===epoch.current){
    setMessage('');setError(err instanceof Error?err.message:'同步失敗，請重新載入確認。');
    // A timeout may have committed. Read the authoritative state before allowing another write.
    setReady(false);
    try{const result=await api<Snapshot>('read-moods');if(mounted.current&&generation===epoch.current)accept(result);}catch{}
   }
  }finally{lock.current=false;if(mounted.current&&generation===epoch.current)setBusy(false);}
 }
 return {feelings,ready,busy,error,message,refresh,change};
}
