import { Fragment, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/react';
export type DiaryEntry = { id:string; iso:string; date:string; day:string; body:string; note:string; document?:JSONContent; version?:number };
export const diaryKey='cottage-writing-v1';
export function dateLabels(iso:string){const d=new Date(`${iso}T12:00:00`);return {date:`${d.getMonth()+1} 月 ${d.getDate()} 日`,day:new Intl.DateTimeFormat('zh-TW',{weekday:'long'}).format(d)};}
export function localToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function plainDocument(body:string):JSONContent{return {type:'doc',content:body.split('\n').map(text=>({type:'paragraph',content:text?[{type:'text',text}]:[]}))};}
export function safeLink(value:string){try{const u=new URL(value);return ['https:','http:','mailto:'].includes(u.protocol)?value:null;}catch{return null;}}
export function readDiaries(raw:string):DiaryEntry[]{const parsed:unknown=JSON.parse(raw);if(!Array.isArray(parsed)||!parsed.every(e=>e&&typeof e.id==='string'&&typeof e.iso==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(e.iso)&&typeof e.body==='string'&&typeof e.date==='string'&&typeof e.day==='string'&&typeof e.note==='string'))throw new Error('Invalid diary data');return parsed;}
export function RichText({document}:{document:JSONContent}){
 function node(n:JSONContent,key:number):ReactNode{
  if(n.type==='text'){let text:ReactNode=String(n.text||'');for(const mark of n.marks||[]){if(mark.type==='bold')text=<strong>{text}</strong>;if(mark.type==='italic')text=<em>{text}</em>;if(mark.type==='strike')text=<s>{text}</s>;if(mark.type==='underline')text=<u>{text}</u>;if(mark.type==='link'){const href=safeLink(String(mark.attrs?.href||''));if(href)text=<a href={href} target="_blank" rel="noopener noreferrer">{text}</a>;}}return <Fragment key={key}>{text}</Fragment>;}
  const children=n.content?.map(node);switch(n.type){case 'paragraph':return <p key={key}>{children||<br/>}</p>;case 'heading':return n.attrs?.level===3?<h3 key={key}>{children}</h3>:<h2 key={key}>{children}</h2>;case 'bulletList':return <ul key={key}>{children}</ul>;case 'orderedList':return <ol key={key}>{children}</ol>;case 'listItem':return <li key={key}>{children}</li>;case 'blockquote':return <blockquote key={key}>{children}</blockquote>;case 'hardBreak':return <br key={key}/>;case 'horizontalRule':return <hr key={key}/>;case 'codeBlock':return <pre key={key}>{children}</pre>;default:return <Fragment key={key}>{children}</Fragment>;}
 }return <>{node(document,0)}</>;
}
