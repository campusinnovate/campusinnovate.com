'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiBell, FiCheck, FiExternalLink, FiRefreshCw, FiX } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';

type Notification={id:string;notification_type:string;title:string;message:string|null;action_url:string|null;priority:'low'|'normal'|'high'|'urgent';read_at:string|null;created_at:string};
type Workspace={unread:number;urgent:number;items:Notification[]};
export default function NotificationCenter(){
 const[state,setState]=useState<'loading'|'ready'|'denied'>('loading');const[data,setData]=useState<Workspace>({unread:0,urgent:0,items:[]});const[filter,setFilter]=useState<'all'|'unread'|'urgent'>('all');const[error,setError]=useState('');
 async function load(){setError('');const s=createClient();const{data:{session}}=await s.auth.getSession();if(!session){location.replace('/ruang-kawan/');return}const r=await s.rpc('notification_center_workspace');if(r.error){if(r.error.code==='42501')setState('denied');else{setError(r.error.message);setState('ready')}return}setData(r.data as Workspace);setState('ready')}
 useEffect(()=>{void load()},[]);
 const visible=useMemo(()=>data.items.filter(n=>filter==='all'||filter==='unread'&&!n.read_at||filter==='urgent'&&n.priority==='urgent'),[data.items,filter]);
 async function mark(id:string,dismiss=false){const r=await createClient().rpc('mark_notification_read',{target:id,dismiss});if(r.error){setError(r.error.message);return}await load()}
 if(state==='loading')return <main className="rk-dashboard-foundation"><section className="rk-access-denied">Menyiapkan notifikasi...</section></main>;
 if(state==='denied')return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><h1>Notifikasi belum tersedia</h1><Link href="/ruang-kawan/dashboard/">Kembali</Link></section></main>;
 return <main className="rk-notification-foundation"><section className="rk-notification-shell"><nav><Link href="/ruang-kawan/dashboard/"><FiArrowLeft/> Dashboard</Link><button onClick={()=>void load()}><FiRefreshCw/> Muat ulang</button></nav><header><div><small>Notification Center</small><h1>Pemberitahuan pekerjaan</h1><p>Assignment, review, pipeline, proposal, KPI, dokumen, dan action item dalam satu tempat.</p></div><FiBell/></header><section className="rk-notification-stats"><button data-active={filter==='all'} onClick={()=>setFilter('all')}><b>{data.items.length}</b><span>Semua</span></button><button data-active={filter==='unread'} onClick={()=>setFilter('unread')}><b>{data.unread}</b><span>Belum dibaca</span></button><button data-active={filter==='urgent'} onClick={()=>setFilter('urgent')}><b>{data.urgent}</b><span>Mendesak</span></button></section>{error?<p className="rk-notification-alert">{error}</p>:null}<section className="rk-notification-list">{visible.map(n=><article key={n.id} data-read={!!n.read_at} data-priority={n.priority}><i/><div><small>{n.notification_type.replaceAll('.',' ')} · {new Date(n.created_at).toLocaleString('id-ID')}</small><strong>{n.title}</strong>{n.message?<p>{n.message}</p>:null}</div><footer>{n.action_url?<Link href={n.action_url} onClick={()=>void mark(n.id)}><FiExternalLink/> Buka</Link>:null}{!n.read_at?<button onClick={()=>void mark(n.id)} title="Tandai dibaca"><FiCheck/></button>:null}<button onClick={()=>void mark(n.id,true)} title="Tutup"><FiX/></button></footer></article>)}{!visible.length?<div className="rk-notification-empty"><FiBell/><strong>Tidak ada notifikasi pada filter ini</strong><p>Pemberitahuan baru akan muncul otomatis saat pekerjaan membutuhkan perhatianmu.</p></div>:null}</section></section></main>
}
