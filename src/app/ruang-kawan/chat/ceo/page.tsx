'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiExternalLink, FiLoader, FiSend, FiZap } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';
import { supabasePublishableKey, supabaseUrl } from '@/lib/supabase/config';

type Source={label:string;url:string};
type Message={id:string;role:'user'|'assistant'|'system';message_kind:'chat'|'morning_briefing';content:string;sources:Source[];created_at:string;briefing_date?:string|null};
const prompts=['Hari ini aku harus ngerjain apa?','Ada deadline yang kelewat?','Besok ada meeting apa?','Apa yang butuh approval aku?','Tolong buatkan prioritas kerja hari ini.'];

export default function KawanAiCeoPage(){
 const [items,setItems]=useState<Message[]>([]);
 const [prompt,setPrompt]=useState('');
 const [loading,setLoading]=useState(true);
 const [sending,setSending]=useState(false);
 const [error,setError]=useState('');

 async function load(){
  setLoading(true);setError('');
  const result=await createClient().rpc('kawan_ai_ceo_history');
  if(result.error){setError(result.error.code==='42501'?'Kawan AI Asisten CEO belum tersedia untuk akun ini.':result.error.message);setLoading(false);return;}
  setItems((result.data??[]) as Message[]);setLoading(false);
 }
 async function ask(question:string,mode:'chat'|'morning_briefing'='chat'){
  const value=question.trim();if((!value&&mode==='chat')||sending)return;
  setSending(true);setError('');
  const client=createClient();const {data:{session}}=await client.auth.getSession();
  if(!session){setError('Sesi login berakhir.');setSending(false);return;}
  const response=await fetch(`${supabaseUrl}/functions/v1/kawan-ai-ceo`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:supabasePublishableKey,'Content-Type':'application/json'},body:JSON.stringify({prompt:value,mode})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){setError(payload.error??'Kawan AI belum dapat menjawab.');setSending(false);return;}
  if(mode==='chat')setItems(current=>[...current,{id:`local-${Date.now()}`,role:'user',message_kind:'chat',content:value,sources:[],created_at:new Date().toISOString()}]);
  setItems(current=>current.some(item=>item.id===payload.message?.id)?current:[...current,payload.message]);
  setSending(false);
 }
 useEffect(()=>{void load();},[]);
 useEffect(()=>{
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'});
  const today=formatter.format(new Date());
  if(loading||items.some(item=>item.message_kind==='morning_briefing'&&item.briefing_date===today))return;
  const hour=Number(new Intl.DateTimeFormat('en-US',{hour:'2-digit',hour12:false,timeZone:'Asia/Jakarta'}).format(new Date()));
  if(hour>=7)void ask('', 'morning_briefing');
 },[loading,items.length]);
 function submit(event:FormEvent){event.preventDefault();const value=prompt;setPrompt('');void ask(value);}
 return <main className="rk-chat-foundation"><section className="rk-chat-shell" data-sidebar><aside className="rk-chat-sidebar"><header><div><FiZap/><span><small>Ruang Kawan</small><strong>Kawan AI</strong></span></div></header><Link className="rk-chat-new" href="/ruang-kawan/chat/"><FiArrowLeft/> Kembali ke Kawan Chat</Link><div className="rk-chat-group"><header><strong>Asisten permanen</strong></header><Link className="rk-chat-ceo-link" href="/ruang-kawan/chat/ceo/"><FiZap/><span><strong>Kawan AI — Asisten CEO</strong><small>Prioritas, deadline, approval</small></span></Link></div></aside><section className="rk-chat-main"><header className="rk-chat-conversation-head"><span className="rk-chat-avatar"><i>KA</i></span><div><h1>Kawan AI — Asisten CEO</h1><span>Read-only · Asia/Jakarta · sumber terverifikasi</span></div></header><section className="rk-chat-timeline">{loading?<div className="rk-chat-empty"><FiLoader/><strong>Memuat briefing CEO...</strong></div>:null}{items.map(item=><article className="rk-chat-message" data-ai-role={item.role} key={item.id}><div><header><strong>{item.role==='assistant'?'Kawan AI': 'Fauzan'}</strong><time>{new Date(item.created_at).toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'})}</time></header><p style={{whiteSpace:'pre-wrap'}}>{item.content}</p>{item.sources?.length?<footer>{item.sources.map(source=><Link key={source.url} href={source.url}><FiExternalLink/> {source.label}</Link>)}</footer>:null}</div></article>)}{sending?<article className="rk-chat-message" data-ai-role="assistant"><div><p><FiLoader/> Kawan AI sedang menyusun jawaban...</p></div></article>:null}</section>{error?<p className="rk-chat-alert">{error}</p>:null}<section className="rk-chat-compose-wrap"><div className="rk-ai-ceo-prompts">{prompts.map(value=><button type="button" key={value} onClick={()=>void ask(value)} disabled={sending}>{value}</button>)}</div><form className="rk-chat-composer" onSubmit={submit}><input value={prompt} onChange={event=>setPrompt(event.target.value)} placeholder="Tanyakan tugas, deadline, meeting, follow-up, atau prioritas..." maxLength={2000}/><button type="submit" disabled={!prompt.trim()||sending} aria-label="Kirim ke Kawan AI">{sending?<FiLoader/>:<FiSend/>}</button></form></section></section></section></main>;
}
