'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiActivity, FiArrowUpRight, FiBarChart2, FiBell, FiBookOpen, FiBriefcase, FiCalendar, FiCheckCircle, FiDollarSign, FiFileText, FiSettings, FiTarget, FiTrendingUp, FiUser } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';

type AccessSummary={membership_status:string;full_name:string|null;position_name:string|null;department_name:string|null;engagement_type:string|null;roles:string[];permissions:string[]};
type DashboardWorkspace={mood:{score:number}|null;notifications:{id:string;title:string;message:string|null;action_url:string|null;read_at:string|null}[];work:{overdue:number;due_today:number;reviews:number;open_actions:number};kpi:{score:number|null;status:string|null;period:string}|null};
type DashboardState={status:'loading'}|{status:'denied'}|{status:'ready';access:AccessSummary;email:string;workspace:DashboardWorkspace|null};
const moodOptions=[{score:2,emoji:'😮‍💨',label:'Kewalahan'},{score:4,emoji:'😔',label:'Lelah'},{score:6,emoji:'😌',label:'Cukup baik'},{score:8,emoji:'😊',label:'Semangat'},{score:10,emoji:'🚀',label:'Luar biasa'}];

export default function RuangKawanDashboardPage(){
 const[state,setState]=useState<DashboardState>({status:'loading'});const[moodBusy,setMoodBusy]=useState(false);
 useEffect(()=>{const supabase=createClient();async function load(){const{data:{session}}=await supabase.auth.getSession();if(!session){window.location.replace('/ruang-kawan/');return}const[accessResult,workspaceResult]=await Promise.all([supabase.rpc('get_my_access'),supabase.rpc('dashboard_workspace')]);const access=(Array.isArray(accessResult.data)?accessResult.data[0]:accessResult.data)as AccessSummary|null;if(accessResult.error||!access||access.membership_status!=='active'){setState({status:'denied'});return}setState({status:'ready',access,email:session.user.email??'',workspace:workspaceResult.error?null:workspaceResult.data as DashboardWorkspace})}void load()},[]);
 async function signOut(){await createClient().auth.signOut();window.location.replace('/ruang-kawan/')}
 async function saveMood(score:number){setMoodBusy(true);const{error}=await createClient().rpc('save_mood_checkin',{score_value:score,note_value:null});setMoodBusy(false);if(!error&&state.status==='ready')setState({...state,workspace:state.workspace?{...state.workspace,mood:{score}}:state.workspace})}
 const todayLabel=useMemo(()=>new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date()),[]);
 const greeting=useMemo(()=>{const hour=Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hour12:false,timeZone:'Asia/Jakarta'}).format(new Date()));return hour<11?'Selamat pagi':hour<15?'Selamat siang':hour<18?'Selamat sore':'Selamat malam'},[]);
 if(state.status==='loading')return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><p>Menyiapkan ruang kerjamu...</p></section></main>;
 if(state.status==='denied')return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><h1>Akses belum tersedia</h1><p>Email ini belum memiliki keanggotaan aktif di Ruang Kawan.</p><button onClick={signOut}>Keluar</button></section></main>;
 const{access,workspace}=state;const name=access.full_name?.trim()||state.email.split('@')[0];const firstName=name.split(' ')[0];const unread=workspace?.notifications.filter(item=>!item.read_at).length??0;
 const focusItems=[{label:'Jatuh tempo hari ini',value:workspace?.work.due_today??0,icon:FiCalendar,tone:'blue'},{label:'Terlambat',value:workspace?.work.overdue??0,icon:FiTarget,tone:'peach'},{label:'Perlu review',value:workspace?.work.reviews??0,icon:FiCheckCircle,tone:'yellow'},{label:'Action item terbuka',value:workspace?.work.open_actions??0,icon:FiActivity,tone:'cream'}];
 const modules=[
  {show:access.permissions.includes('activity.view_self'),href:'/ruang-kawan/activity/',icon:FiActivity,title:'My Activity',text:'Feed kerja, assignment, catatan, dan kalender.'},
  {show:['marketing.view','content_plan.view','pipeline.view'].some(p=>access.permissions.includes(p)),href:'/ruang-kawan/marketing/',icon:FiTrendingUp,title:'Marketing',text:'Content plan dan pipeline bisnis dalam satu ruang.'},
  {show:access.permissions.includes('projects.view'),href:'/ruang-kawan/projects/',icon:FiBriefcase,title:'Project',text:'Milestone, task, tim, dokumen, dan progres proyek.'},
  {show:access.permissions.includes('kpi.view_self'),href:'/ruang-kawan/kpi/',icon:FiBarChart2,title:'KPI',text:'Target, evidence, pembaruan mingguan, dan review.'},
  {show:access.permissions.includes('documents.view'),href:'/ruang-kawan/documents/',icon:FiBookOpen,title:'Documents',text:'Cari dan buka dokumen kerja yang tersedia.'},
  {show:access.permissions.includes('reports.view_self'),href:'/ruang-kawan/reports/',icon:FiFileText,title:'Reports',text:'Ringkasan progress, problem, plan, dan priority.'},
  {show:access.permissions.includes('finance.view'),href:'/ruang-kawan/finance/',icon:FiDollarSign,title:'Finance',text:'Transaksi, dokumen, piutang, budget, dan aset.'},
 ].filter(item=>item.show);
 return <main className="rk-dashboard-foundation"><section className="rk-dashboard-shell rk-glossy-shell">
  <header className="rk-dashboard-hero rk-glossy-hero"><div className="rk-hero-ring" aria-hidden="true"/><div className="rk-hero-square" aria-hidden="true"/><div><small>RUANG KAWAN · {todayLabel}</small><h1>{greeting}, {firstName}!</h1><p>Satu tempat untuk melihat fokus, pekerjaan, dan kabar penting hari ini.</p></div><Link href="/ruang-kawan/activity/">Buka aktivitas <FiArrowUpRight/></Link></header>
  <section className="rk-dashboard-section-head"><div><small>FOKUS HARI INI</small><h2>Yang perlu kamu perhatikan</h2></div><Link href="/ruang-kawan/activity/">Lihat semuanya <FiArrowUpRight/></Link></section>
  <section className="rk-dashboard-focus">{focusItems.map(({label,value,icon:Icon,tone})=><article key={label} data-tone={tone}><span><Icon/></span><div><strong>{value}</strong><small>{label}</small></div></article>)}</section>
  <section className="rk-dashboard-columns">
   <article className="rk-dashboard-mood rk-glossy-card"><header><div><small>MOOD BUDDIES</small><h2>Apa kabar hari ini?</h2></div><span>{workspace?.mood?`${workspace.mood.score}/10`:'Opsional'}</span></header><div>{moodOptions.map(option=><button key={option.score} disabled={moodBusy} data-selected={workspace?.mood?.score===option.score} onClick={()=>void saveMood(option.score)} aria-label={option.label}><b>{option.emoji}</b><small>{option.label}</small></button>)}</div><p>Check-in bersifat pribadi dan tidak memengaruhi KPI.</p></article>
   <article className="rk-dashboard-kpi rk-glossy-card"><small>RINGKASAN KINERJA</small><div><span><FiBarChart2/></span><strong>{workspace?.kpi?.score==null?'—':`${workspace.kpi.score.toFixed(1)}%`}</strong></div><h2>{workspace?.kpi?.period??'Belum ada periode KPI aktif'}</h2><p>{workspace?.kpi?.status?`Status: ${workspace.kpi.status}`:'Ringkasan akan muncul dari assignment KPI yang tersedia.'}</p>{access.permissions.includes('kpi.view_self')?<Link href="/ruang-kawan/kpi/">Buka KPI <FiArrowUpRight/></Link>:null}</article>
   <article className="rk-dashboard-notifications rk-glossy-card"><header><div><small>NOTIFIKASI</small><h2>{unread} belum dibaca</h2></div><FiBell/></header><div>{workspace?.notifications.slice(0,3).map(item=>item.action_url?<Link key={item.id} href={item.action_url}><strong>{item.title}</strong><small>{item.message||'Buka detail notifikasi'}</small></Link>:<div key={item.id}><strong>{item.title}</strong><small>{item.message||'Pemberitahuan baru'}</small></div>)}{!workspace?.notifications.length?<p>Belum ada notifikasi baru.</p>:null}</div><Link href="/ruang-kawan/notifications/">Semua notifikasi <FiArrowUpRight/></Link></article>
  </section>
  <section className="rk-dashboard-section-head"><div><small>QUICK ACCESS</small><h2>Ruang kerja kamu</h2></div></section>
  <section className="rk-dashboard-module-grid">{modules.map(({href,icon:Icon,title,text})=><Link key={href} href={href} className="rk-glossy-card"><span><Icon/></span><div><strong>{title}</strong><small>{text}</small></div><FiArrowUpRight/></Link>)}</section>
  <section className="rk-dashboard-account rk-glossy-card"><div><span><FiUser/></span><div><small>AKUN & PROFIL</small><h2>{name}</h2><p>{access.position_name||'Posisi belum ditetapkan'} · {access.department_name||'Departemen belum ditetapkan'}</p></div></div><Link href="/ruang-kawan/profile/">Lihat profil <FiArrowUpRight/></Link></section>
  {access.permissions.includes('access.manage')?<Link className="rk-dashboard-admin" href="/ruang-kawan/admin/"><FiSettings/><span><strong>Pengaturan Admin</strong><small>Kelola anggota dan hak akses.</small></span><FiArrowUpRight/></Link>:null}
 </section></main>
}
