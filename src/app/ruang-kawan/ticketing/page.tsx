'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiBriefcase, FiCalendar, FiCheckCircle, FiDollarSign, FiExternalLink, FiFilter, FiMessageCircle, FiPlus, FiRefreshCw, FiSearch, FiSend, FiUsers, FiX } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';

type Member={id:string;name:string;position:string|null};
type PipelineOption={id:string;lead_code:string;client_name:string;stage:string;proposal_value:number|null;won_value:number|null};
type Pic={membership_id:string;role:'account_manager'|'operations'|'sales'|'marketing'|'hr'|'other'};
type Ticket={id:string;ticket_code:string;pipeline_lead_id:string|null;client_name:string;service_name:string;requirements:string;target_proposal_date:string;project_plan:string;rru_status:'first_time'|'repeat_order';creator_name:string;chat_message_id:string|null;created_at:string;lead_code:string|null;pipeline_stage:string|null;proposal_value:number|null;won_value:number|null;is_won:boolean;pics:Array<{membership_id:string;name:string;role:string}>};
type Workspace={tickets:Ticket[];members:Member[];pipeline_options:PipelineOption[];conversation_id:string;can_create:boolean};
type Form={client_name:string;service_name:string;requirements:string;target_proposal_date:string;project_plan:string;rru_status:'first_time'|'repeat_order';pipeline_lead_id:string};
const services=['Event Experience Management','Digital System','Coreva','Stripmate','Program Development','Media & Creative Production'];
const roleLabels:Record<Pic['role'],string>={account_manager:'AM',operations:'Ops',sales:'Sales',marketing:'Marketing',hr:'HR PIC',other:'PIC'};
const emptyForm=():Form=>({client_name:'',service_name:'',requirements:'',target_proposal_date:'',project_plan:'',rru_status:'first_time',pipeline_lead_id:''});
const money=(value:number|null)=>value===null?'Belum dicatat':new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0,notation:value>=1_000_000_000?'compact':'standard'}).format(value);
const dateLabel=(value:string)=>new Date(`${value}T12:00:00+07:00`).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'});

export default function TicketingPage(){
 const [workspace,setWorkspace]=useState<Workspace|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[query,setQuery]=useState(''),[filter,setFilter]=useState<'all'|'won'>('all');
 const [showForm,setShowForm]=useState(false),[form,setForm]=useState<Form>(emptyForm()),[pics,setPics]=useState<Pic[]>([]);
 const [picMember,setPicMember]=useState(''),[picRole,setPicRole]=useState<Pic['role']>('account_manager');
 async function load(){
  setError('');const db=createClient();const {data:{session}}=await db.auth.getSession();
  if(!session){window.location.replace('/ruang-kawan/');return}
  const result=await db.rpc('ticketing_workspace');
  if(result.error){setError(result.error.message);setLoading(false);return}
  setWorkspace(result.data as Workspace);setLoading(false);
 }
 useEffect(()=>{void load()},[]);
 const tickets=workspace?.tickets??[];
 const visible=useMemo(()=>{const term=query.trim().toLowerCase();return tickets.filter(ticket=>(filter==='all'||ticket.is_won)&&(!term||`${ticket.ticket_code} ${ticket.client_name} ${ticket.service_name} ${ticket.lead_code??''} ${ticket.creator_name}`.toLowerCase().includes(term)))},[tickets,filter,query]);
 const won=tickets.filter(ticket=>ticket.is_won);
 const proposalTotal=won.reduce((sum,ticket)=>sum+(ticket.proposal_value??0),0);
 const dealTotal=won.reduce((sum,ticket)=>sum+(ticket.won_value??0),0);
 function addPic(){if(!picMember||pics.some(pic=>pic.membership_id===picMember&&pic.role===picRole))return;setPics(items=>[...items,{membership_id:picMember,role:picRole}]);setPicMember('')}
 async function createTicket(event:FormEvent){
  event.preventDefault();if(!pics.length){setError('Tambahkan minimal satu PIC agar orang terkait ikut disebut di grup.');return}
  setSaving(true);setError('');setNotice('');
  const result=await createClient().rpc('create_commercial_ticket_record',{payload:{...form,pipeline_lead_id:form.pipeline_lead_id||null,pics}});
  setSaving(false);
  if(result.error){setError(result.error.message);return}
  const created=result.data as {ticket_code:string;conversation_id:string;message_id:string};
  setShowForm(false);setForm(emptyForm());setPics([]);setNotice(`Ticket ${created.ticket_code} diterbitkan dan pesannya sudah dikirim ke grup Commercial & Handover.`);
  await load();
 }
 if(loading)return <main className="rk-work-foundation"><section className="rk-access-denied"><p>Menyiapkan ticket...</p></section></main>;
 return <main className="rk-work-foundation"><section className="rk-work-shell">
  <nav className="rk-work-nav"><Link href="/ruang-kawan/marketing/"><FiArrowLeft/> Marketing</Link><span>Commercial & Handover</span><button onClick={()=>void load()}><FiRefreshCw/> Muat ulang</button></nav>
  <header className="rk-work-heading"><div><small>Marketing · Commercial operations</small><h1>Ticket</h1><p>Ticket diterbitkan manual oleh BD/CEO. Setelah diterbitkan, ringkasannya otomatis dikirim ke grup chat; diskusi dan progres berjalan di thread grup.</p></div><div><Link href={workspace?.conversation_id?'/ruang-kawan/chat/?conversation='+workspace.conversation_id:'/ruang-kawan/chat/'}><FiMessageCircle/> Buka grup Commercial & Handover</Link>{workspace?.can_create?<button data-primary onClick={()=>{setError('');setShowForm(true)}}><FiPlus/> Buat ticket</button>:null}</div></header>
  <section className="rk-assignment-stats rk-ticket-stat-grid">
   <article data-kind="active"><FiBriefcase/><span><strong>{tickets.length}</strong><small>Ticket diterbitkan</small></span></article>
   <article data-kind="approved"><FiCheckCircle/><span><strong>{won.length}</strong><small>Project Won terhubung</small></span></article>
   <article data-kind="review"><FiDollarSign/><span><strong>{money(proposalTotal)}</strong><small>Penawaran awal · Won</small></span></article>
   <article data-kind="approved"><FiDollarSign/><span><strong>{money(dealTotal)}</strong><small>Nilai deal · Won</small></span></article>
  </section>
  {notice?<p className="rk-work-alert">{notice}</p>:null}{error&&!showForm?<p className="rk-work-alert" data-error>{error}</p>:null}
  <div className="rk-ticket-tools"><label><FiSearch/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Cari ticket, client, service, atau lead..."/></label><label><FiFilter/><select value={filter} onChange={event=>setFilter(event.target.value as typeof filter)}><option value="all">Semua ticket</option><option value="won">Arsip Project Won</option></select></label></div>
  <section className="rk-ticket-list">{visible.map(ticket=><article key={ticket.id}><div className="rk-ticket-card">
   <header><small>{ticket.ticket_code}{ticket.lead_code?` · ${ticket.lead_code}`:''}</small><span data-risk={ticket.is_won?'track':'overdue'}>{ticket.is_won?'Project Won':'Ticket diterbitkan'}</span></header>
   <h2>{ticket.client_name}</h2><p>{ticket.service_name} · {ticket.rru_status==='repeat_order'?'Repeat Order':'First Time Client'}</p>
   <p><strong>Target proposal:</strong> {dateLabel(ticket.target_proposal_date)}</p>
   <p>{ticket.requirements}</p>
   {ticket.pipeline_lead_id?<dl><div><dt>Penawaran</dt><dd>{money(ticket.proposal_value)}</dd></div><div><dt>Deal</dt><dd>{ticket.is_won?money(ticket.won_value):'—'}</dd></div></dl>:null}
   <div className="rk-ticket-phase"><span>PIC</span><strong>{ticket.pics.length?ticket.pics.map(pic=>`${roleLabels[pic.role as Pic['role']]??pic.role}: ${pic.name}`).join(' · '):'Belum ditentukan'}</strong></div>
   <footer><span>Dibuat {dateLabel(ticket.created_at.slice(0,10))} · {ticket.creator_name}</span>{ticket.chat_message_id&&workspace?.conversation_id?<Link href={`/ruang-kawan/chat/?conversation=${workspace.conversation_id}&thread=${ticket.chat_message_id}`}><FiMessageCircle/> Buka thread</Link>:null}</footer>
  </div></article>)}{!visible.length?<div className="rk-work-empty"><FiBriefcase/><strong>{tickets.length?'Tidak ada ticket yang cocok':'Belum ada ticket diterbitkan'}</strong><p>Lead di Pipeline tidak otomatis menjadi ticket. BD/CEO menerbitkan ticket dari form ini saat sudah siap dikoordinasikan.</p>{workspace?.can_create?<button onClick={()=>setShowForm(true)}><FiPlus/> Buat ticket</button>:null}</div>:null}</section>
 </section>
 {showForm?<div className="rk-work-modal" role="dialog" aria-modal="true"><form className="rk-ticket-detail" onSubmit={event=>void createTicket(event)}>
  <header><div><small>Commercial & Handover</small><h2>Buat ticket baru</h2><p>Ticket ID dibuat otomatis dan ringkasannya langsung dikirim ke grup chat.</p></div><button type="button" onClick={()=>setShowForm(false)} aria-label="Tutup"><FiX/></button></header>
  {error?<p className="rk-work-alert" data-error>{error}</p>:null}
  <div className="rk-ticket-fields">
   <label>Client<input required value={form.client_name} onChange={event=>setForm({...form,client_name:event.target.value})} placeholder="Nama client"/></label>
   <label>Service<select required value={form.service_name} onChange={event=>setForm({...form,service_name:event.target.value})}><option value="">Pilih service</option>{services.map(service=><option key={service}>{service}</option>)}</select></label>
   <label className="wide">Deskripsi & kebutuhan detail<textarea required value={form.requirements} onChange={event=>setForm({...form,requirements:event.target.value})} placeholder="Kebutuhan client, ruang lingkup, konteks, atau catatan penting"/></label>
   <label>Target proposal<input required type="date" value={form.target_proposal_date} onChange={event=>setForm({...form,target_proposal_date:event.target.value})}/></label>
   <label>Status RRU<select value={form.rru_status} onChange={event=>setForm({...form,rru_status:event.target.value as Form['rru_status']})}><option value="first_time">First Time Client</option><option value="repeat_order">Repeat Order</option></select></label>
   <label className="wide">Rencana project<textarea required value={form.project_plan} onChange={event=>setForm({...form,project_plan:event.target.value})} placeholder="Rencana, tahapan utama, atau target pelaksanaan"/></label>
   <label className="wide">Hubungkan ke lead Pipeline <select value={form.pipeline_lead_id} onChange={event=>setForm({...form,pipeline_lead_id:event.target.value})}><option value="">Tidak dihubungkan</option>{workspace?.pipeline_options.map(lead=><option value={lead.id} key={lead.id}>{lead.lead_code} · {lead.client_name} · {lead.stage}</option>)}</select><small>Opsional dan manual; membuat atau mengubah lead tidak otomatis menerbitkan ticket.</small></label>
  </div>
  <section className="rk-ticket-members"><h3><FiUsers/> PIC yang akan ditag</h3><div><select value={picMember} onChange={event=>setPicMember(event.target.value)}><option value="">Pilih staf</option>{workspace?.members.filter(member=>!pics.some(pic=>pic.membership_id===member.id&&pic.role===picRole)).map(member=><option key={member.id} value={member.id}>{member.name}{member.position?` · ${member.position}`:''}</option>)}</select><select value={picRole} onChange={event=>setPicRole(event.target.value as Pic['role'])}>{Object.entries(roleLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button type="button" onClick={addPic} disabled={!picMember}><FiPlus/> Tambah PIC</button></div>{pics.map((pic,index)=>{const member=workspace?.members.find(item=>item.id===pic.membership_id);return <span key={`${pic.membership_id}-${pic.role}`}>{roleLabels[pic.role]} · {member?.name}<button type="button" aria-label="Hapus PIC" onClick={()=>setPics(items=>items.filter((_,i)=>i!==index))}><FiX/></button></span>})}<small>Pilih minimal satu orang agar ikut disebut di pesan ticket pada grup.</small></section>
  <footer><button type="button" onClick={()=>setShowForm(false)}>Batal</button><button type="submit" data-primary disabled={saving}>{saving?<FiSend/>:'Terbitkan ticket'}</button></footer>
 </form></div>:null}
 </main>
}
