'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiAlertCircle, FiArrowLeft, FiCalendar, FiCheckCircle, FiChevronRight, FiClock, FiExternalLink, FiFileText, FiLoader, FiPaperclip, FiSend, FiShield, FiZap } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';
import { supabasePublishableKey, supabaseUrl } from '@/lib/supabase/config';

type Source={label:string;url:string};
type Message={id:string;role:'user'|'assistant'|'system';message_kind:'chat'|'morning_briefing';content:string;sources:Source[];created_at:string;briefing_date?:string|null};
type WorkItem={title?:string;activity_date?:string;priority?:string;module_route?:string;action_url?:string;status?:string};
type CeoContext={today?:string;today_tasks?:WorkItem[];overdue_tasks?:WorkItem[];upcoming_deadlines?:WorkItem[];today_meetings?:WorkItem[];ceo_approvals?:WorkItem[];pipeline_followups?:WorkItem[];project_risks?:WorkItem[]};
const prompts=['Hari ini aku harus ngerjain apa?','Ada deadline yang kelewat?','Apa yang butuh approval aku?','Tolong buatkan prioritas kerja hari ini.'];

function sourceUrl(item:WorkItem){return item.module_route||item.action_url||'/ruang-kawan/activity/';}
function itemLabel(item:WorkItem){return item.title||'Aktivitas tanpa judul';}
function shortDate(value?:string){if(!value)return 'Tanpa tanggal';const date=new Date(value);return Number.isNaN(date.getTime())?value:date.toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short'});}

export default function KawanAiCeoPage(){
 const [items,setItems]=useState<Message[]>([]);
 const [context,setContext]=useState<CeoContext>({});
 const [prompt,setPrompt]=useState('');
 const [loading,setLoading]=useState(true);
 const [sending,setSending]=useState(false);
 const [error,setError]=useState('');
 const [available,setAvailable]=useState<boolean|null>(null);

 async function load(){
  setLoading(true);setError('');
  const client=createClient();
  const access=await client.rpc('kawan_ai_ceo_access');
  if(access.error||!access.data){setAvailable(false);setLoading(false);return;}
  setAvailable(true);
  const [history,contextResult]=await Promise.all([client.rpc('kawan_ai_ceo_history'),client.rpc('kawan_ai_ceo_context')]);
  if(history.error){setError('Riwayat Asisten CEO belum dapat dimuat. Coba muat ulang.');setLoading(false);return;}
  if(contextResult.error){setError('Data ringkasan CEO belum dapat dimuat. Coba muat ulang.');}
  setItems((history.data??[]) as Message[]);
  setContext((contextResult.data??{}) as CeoContext);
  setLoading(false);
 }
 async function ask(question:string,mode:'chat'|'morning_briefing'='chat'){
  const value=question.trim();if((!value&&mode==='chat')||sending||available!==true)return;
  setSending(true);setError('');
  const client=createClient();const {data:{session}}=await client.auth.getSession();
  if(!session){setError('Sesi login berakhir. Silakan masuk kembali.');setSending(false);return;}
  try{
   const response=await fetch(`${supabaseUrl}/functions/v1/kawan-ai-ceo`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:supabasePublishableKey,'Content-Type':'application/json'},body:JSON.stringify({prompt:value,mode})});
   const payload=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(payload.error||'Kawan AI belum dapat menjawab.');
   if(mode==='chat')setItems(current=>[...current,{id:`local-${Date.now()}`,role:'user',message_kind:'chat',content:value,sources:[],created_at:new Date().toISOString()}]);
   setItems(current=>current.some(item=>item.id===payload.message?.id)?current:[...current,payload.message]);
  }catch(cause){setError(cause instanceof Error?cause.message:'Kawan AI belum dapat menjawab.');}
  finally{setSending(false);}
 }
 useEffect(()=>{void load();},[]);
 useEffect(()=>{
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(available===true&&!loading&&!error&&!items.some(item=>item.message_kind==='morning_briefing'&&item.briefing_date===today))void ask('', 'morning_briefing');
 },[available,loading,items.length,error]);
 function submit(event:FormEvent){event.preventDefault();const value=prompt;setPrompt('');void ask(value);}
 const priority=useMemo(()=>[...(context.overdue_tasks??[]),...(context.today_tasks??[])].slice(0,3),[context]);
 const meetings=(context.today_meetings??[]).slice(0,3);
 if(available===false)return <main className="rk-ceo-foundation"><section className="rk-ceo-restricted"><FiShield/><h1>Asisten CEO hanya tersedia untuk akun CEO</h1><p>Fitur ini sedang dibatasi untuk akun M. Fauzan Ramdani. Kawan AI kontekstual tetap dapat digunakan dari halaman Ruang Kawan.</p><Link href="/ruang-kawan/chat/"><FiArrowLeft/> Kembali ke Kawan Chat</Link></section></main>;
 return <main className="rk-ceo-foundation"><section className="rk-ceo-shell">
  <aside className="rk-ceo-sidebar">
   <div className="rk-ceo-brand"><span><FiZap/></span><div><small>RUANG KAWAN</small><strong>Kawan Chat</strong></div></div>
   <Link className="rk-ceo-new" href="/ruang-kawan/chat/"><FiArrowLeft/> Kembali ke Kawan Chat</Link>
   <small className="rk-ceo-label">ASISTEN</small>
   <Link className="rk-ceo-assistant" href="/ruang-kawan/chat/ceo/"><FiZap/><span><strong>Kawan AI — Asisten CEO</strong><small>Prioritas, deadline &amp; approval</small></span></Link>
   <div className="rk-ceo-side-note"><FiShield/><span><strong>Khusus CEO</strong><small>Read-only · data terverifikasi</small></span></div>
  </aside>
  <section className="rk-ceo-main">
   <header className="rk-ceo-header"><span className="rk-ceo-avatar">KA</span><div><h1>Kawan AI — Asisten CEO</h1><p>Read-only <i>•</i> Asia/Jakarta <i>•</i> Sumber terverifikasi</p></div></header>
   <section className="rk-ceo-content">
    <article className="rk-ceo-briefing"><div><span className="rk-ceo-kicker"><FiZap/> BRIEFING CEO</span><h2>Selamat datang, Fauzan 👋</h2><p>Berikut ringkasan yang perlu Anda perhatikan hari ini.</p></div><div className="rk-ceo-metrics">
     <Metric icon={<FiFileText/>} value={context.today_tasks?.length??0} label="Deadline hari ini" tone="blue"/>
     <Metric icon={<FiAlertCircle/>} value={context.overdue_tasks?.length??0} label="Terlambat" tone="coral"/>
     <Metric icon={<FiCalendar/>} value={context.today_meetings?.length??0} label="Meeting" tone="green"/>
     <Metric icon={<FiCheckCircle/>} value={context.ceo_approvals?.length??0} label="Butuh keputusan" tone="gold"/>
    </div></article>
    <section className="rk-ceo-grid">
      <article className="rk-ceo-panel"><header><div><FiAlertCircle/><h2>Kerjakan sekarang</h2></div><span>Prioritas</span></header>{priority.length?priority.map((item,index)=><Link href={sourceUrl(item)} key={`${itemLabel(item)}-${index}`} className="rk-ceo-work-item"><b>{index+1}</b><span><strong>{itemLabel(item)}</strong><small><FiClock/> {shortDate(item.activity_date)}</small></span><em data-tone={index===0?'overdue':'today'}>{index===0?'Terlambat':'Hari ini'}</em><FiChevronRight/></Link>):<Empty text="Belum ada deadline atau pekerjaan terlambat."/>}</article>
      <article className="rk-ceo-panel"><header><div><FiCalendar/><h2>Agenda hari ini</h2></div><span>Asia/Jakarta</span></header>{meetings.length?meetings.map((item,index)=><Link href={sourceUrl(item)} key={`${itemLabel(item)}-${index}`} className="rk-ceo-meeting"><span><small>{shortDate(item.activity_date)}</small><strong>{itemLabel(item)}</strong></span><FiChevronRight/></Link>):<Empty text="Belum ada meeting yang tercatat hari ini."/ >}<div className="rk-ceo-approval"><FiCheckCircle/><span><strong>Butuh approval CEO</strong><small>{context.ceo_approvals?.length??0} item menunggu keputusan Anda.</small></span><button type="button" onClick={()=>void ask('Apa saja yang butuh approval aku?')} disabled={sending}>Lihat</button></div></article>
    </section>
    <section className="rk-ceo-suggestions"><strong><FiZap/> Coba tanyakan ini:</strong><div>{prompts.map(value=><button type="button" key={value} onClick={()=>void ask(value)} disabled={sending}>{value}</button>)}</div></section>
    <section className="rk-ceo-history" aria-live="polite">{loading?<div className="rk-ceo-loading"><FiLoader/> Memuat briefing CEO...</div>:items.map(item=><article key={item.id} data-role={item.role}><header><strong>{item.role==='assistant'?'Kawan AI':'Fauzan'}</strong><time>{new Date(item.created_at).toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'})}</time></header><p>{item.content}</p>{item.sources?.length?<footer>{item.sources.map(source=><Link key={source.url} href={source.url}><FiExternalLink/> {source.label}</Link>)}</footer>:null}</article>)}{sending?<div className="rk-ceo-loading"><FiLoader/> Kawan AI sedang menyusun jawaban...</div>:null}</section>
   </section>
   {error?<p className="rk-ceo-alert"><FiAlertCircle/>{error}</p>:null}
   <form className="rk-ceo-composer" onSubmit={submit}><button type="button" aria-label="Lampiran belum tersedia" disabled><FiPaperclip/></button><input value={prompt} onChange={event=>setPrompt(event.target.value)} placeholder="Tanyakan tugas, proyek, meeting, atau follow-up…" maxLength={2000} disabled={available!==true}/><button type="submit" disabled={!prompt.trim()||sending||available!==true}>{sending?<FiLoader/>:<><FiSend/> Kirim</>}</button></form>
  </section>
 </section></main>;
}
function Metric({icon,value,label,tone}:{icon:ReactNode;value:number;label:string;tone:string}){return <div className="rk-ceo-metric" data-tone={tone}><span>{icon}</span><strong>{value}</strong><small>{label}</small></div>;}
function Empty({text}:{text:string}){return <p className="rk-ceo-empty">{text}</p>;}
