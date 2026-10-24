'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiBriefcase, FiCalendar, FiCheckCircle, FiChevronDown, FiClock, FiDollarSign, FiEdit3, FiExternalLink, FiFilter, FiGrid, FiList, FiMessageCircle, FiPlus, FiRefreshCw, FiSearch, FiSend, FiTag, FiTrash2, FiUsers, FiX } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';
import styles from './ticketing.module.css';

type Member={id:string;name:string;position:string|null};
type PipelineOption={id:string;lead_code:string;client_name:string;stage:string;proposal_value:number|null;won_value:number|null};
type Rru='ready'|'response'|'unreachable';
type ClientType='new_client'|'repeat_order';
type PicRole='account_manager'|'operations'|'sales'|'marketing'|'social_media_specialist'|'coo'|'cto'|'hr'|'other';
type Pic={membership_id:string;role:PicRole};
type Ticket={id:string;ticket_code:string;pipeline_lead_id:string|null;client_name:string;client_type:ClientType;service_name:string;requirements:string;target_proposal_date:string;project_plan:string;rru_status:Rru;creator_name:string;chat_message_id:string|null;discussion_conversation_id:string|null;created_at:string;lead_code:string|null;pipeline_stage:string|null;proposal_value:number|null;won_value:number|null;is_won:boolean;pics:Array<{membership_id:string;name:string;role:PicRole}>};
type WonProject={id:string;lead_code:string;client_name:string;service_name:string;stage:string;won_date:string;proposal_value:number|null;won_value:number|null};
type Workspace={tickets:Ticket[];members:Member[];pipeline_options:PipelineOption[];won_projects:WonProject[];conversation_id:string;can_create:boolean};
type Form={client_name:string;client_type:ClientType;service_name:string;requirements:string;target_proposal_date:string;project_plan:string;rru_status:Rru;pipeline_lead_id:string};
type Period='all'|'month'|'quarter'|'year';
const services=['Event Experience Management','Digital System','Coreva','Stripmate','Program Development','Media & Creative Production'];
const roleLabels:Record<PicRole,string>={account_manager:'AM',operations:'Ops',sales:'Sales',marketing:'Marketing',social_media_specialist:'Sosmed Specialist',coo:'COO',cto:'CTO',hr:'HR PIC',other:'PIC'};
const rruOptions:Array<{value:Rru;label:string;short:string;description:string}>=[
 {value:'ready',label:'Ready',short:'Siap ditindaklanjuti',description:'Data prospek valid dan siap masuk antrean follow-up tim sales.'},
 {value:'response',label:'Response',short:'Sudah merespons',description:'Terjadi komunikasi dua arah; prospek bisa tertarik, meminta materi, atau menolak dengan halus.'},
 {value:'unreachable',label:'Unreachable',short:'Belum dapat dijangkau',description:'Setelah beberapa upaya, kontak tetap tidak tersambung—misalnya nomor salah/tidak aktif atau pesan tidak dijawab.'},
];
const rruLabel:Record<Rru,string>={ready:'Ready',response:'Response',unreachable:'Unreachable'};
const emptyForm=():Form=>({client_name:'',client_type:'new_client',service_name:'',requirements:'',target_proposal_date:'',project_plan:'',rru_status:'ready',pipeline_lead_id:''});
const money=(value:number|null)=>value===null?'Belum dicatat':new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0,notation:value>=1_000_000_000?'compact':'standard'}).format(value);
const dateLabel=(value:string)=>new Date(`${value}T12:00:00+07:00`).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'});
const localDateKey=(value:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const todayKey=()=>localDateKey(new Date().toISOString());
const yearOf=(key:string)=>Number(key.slice(0,4));
const monthOf=(key:string)=>Number(key.slice(5,7));
const getBounds=(period:Period,year:string,month:string,quarter:string):[string,string]|null=>{
 if(period==='all')return null;
 const y=period==='month'?Number(month.slice(0,4)):Number(year);
 const m=period==='month'?Number(month.slice(5,7)):period==='quarter'?(Number(quarter)-1)*3+1:1;
 const start=`${y}-${String(m).padStart(2,'0')}-01`;
 const nextMonth=m+(period==='month'?1:period==='quarter'?3:12);
 const endYear=y+Math.floor((nextMonth-1)/12),endMonth=(nextMonth-1)%12+1;
 return[start,`${endYear}-${String(endMonth).padStart(2,'0')}-01`];
};

export default function TicketingPage(){
 const [workspace,setWorkspace]=useState<Workspace|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[query,setQuery]=useState('');
 const [period,setPeriod]=useState<Period>('all'),[periodMonth,setPeriodMonth]=useState(todayKey().slice(0,7)),[periodYear,setPeriodYear]=useState(todayKey().slice(0,4)),[periodQuarter,setPeriodQuarter]=useState('1');
 const [view,setView]=useState<'tickets'|'won'>('tickets'),[layout,setLayout]=useState<'card'|'list'>('card');
 const [showForm,setShowForm]=useState(false),[form,setForm]=useState<Form>(emptyForm()),[pics,setPics]=useState<Pic[]>([]),[editingTicket,setEditingTicket]=useState<Ticket|null>(null);
 const [picMember,setPicMember]=useState(''),[picRole,setPicRole]=useState<PicRole>('account_manager');
 async function load(){
  setError('');const db=createClient();const {data:{session}}=await db.auth.getSession();
  if(!session){window.location.replace('/ruang-kawan/');return}
  const result=await db.rpc('ticketing_workspace');
  if(result.error){setError(result.error.message);setLoading(false);return}
  setWorkspace(result.data as Workspace);setLoading(false);
 }
 useEffect(()=>{void load()},[]);
 const tickets=workspace?.tickets??[],wonProjects=workspace?.won_projects??[];
 const bounds=getBounds(period,periodYear,periodMonth,periodQuarter);
 const inPeriod=(key:string)=>!bounds||(key>=bounds[0]&&key<bounds[1]);
 const scopedTickets=useMemo(()=>tickets.filter(ticket=>inPeriod(localDateKey(ticket.created_at))),[tickets,period,periodYear,periodMonth,periodQuarter]);
 const scopedWon=useMemo(()=>wonProjects.filter(project=>inPeriod(project.won_date)),[wonProjects,period,periodYear,periodMonth,periodQuarter]);
 const term=query.trim().toLowerCase();
 const visibleTickets=scopedTickets.filter(ticket=>!term||`${ticket.ticket_code} ${ticket.client_name} ${ticket.service_name} ${ticket.lead_code??''} ${ticket.creator_name}`.toLowerCase().includes(term));
 const visibleWon=scopedWon.filter(project=>!term||`${project.lead_code} ${project.client_name} ${project.service_name}`.toLowerCase().includes(term));
 const proposalTotal=scopedWon.reduce((sum,project)=>sum+(project.proposal_value??0),0);
 const dealTotal=scopedWon.reduce((sum,project)=>sum+(project.won_value??0),0);
 const years=Array.from(new Set([todayKey().slice(0,4),...wonProjects.map(p=>p.won_date.slice(0,4)),periodYear])).sort().reverse();
 const periodText=period==='all'?'Semua waktu':period==='month'?new Date(`${periodMonth}-01T00:00:00`).toLocaleDateString('id-ID',{month:'long',year:'numeric'}):period==='quarter'?`Kuartal ${periodQuarter} · ${periodYear}`:periodYear;
 function addPic(){if(!picMember||pics.some(pic=>pic.membership_id===picMember&&pic.role===picRole))return;setPics(items=>[...items,{membership_id:picMember,role:picRole}]);setPicMember('')}
 async function createTicket(event:FormEvent){
  event.preventDefault();if(!pics.length){setError('Tambahkan minimal satu PIC agar ikut ditag.');return}
  setSaving(true);setError('');setNotice('');
  const payload={...form,pipeline_lead_id:form.pipeline_lead_id||null,pics};
  const result=editingTicket
   ? await createClient().rpc('update_commercial_ticket_record',{target_ticket_id:editingTicket.id,payload})
   : await createClient().rpc('create_commercial_ticket_record',{payload});
  setSaving(false);
  if(result.error){setError(result.error.message);return}
  const code=editingTicket?.ticket_code??(result.data as {ticket_code:string}).ticket_code;
  setShowForm(false);setForm(emptyForm());setPics([]);setNotice(editingTicket?`Ticket ${code} diperbarui.`:`Ticket ${code} diterbitkan; pengumuman rapi sudah masuk ke grup.`);setEditingTicket(null);
  await load();
 }
 function openEdit(ticket:Ticket){setEditingTicket(ticket);setForm({client_name:ticket.client_name,client_type:ticket.client_type,service_name:ticket.service_name,requirements:ticket.requirements,target_proposal_date:ticket.target_proposal_date,project_plan:ticket.project_plan,rru_status:ticket.rru_status,pipeline_lead_id:ticket.pipeline_lead_id??''});setPics(ticket.pics.map(pic=>({membership_id:pic.membership_id,role:pic.role})));setError('');setEditingTicket(null);setForm(emptyForm());setPics([]);setShowForm(true)}
 async function deleteTicket(ticket:Ticket){if(!window.confirm(`Hapus ${ticket.ticket_code} dari daftar ticket? Riwayat chat dan handover tetap disimpan.`))return;const result=await createClient().rpc('delete_commercial_ticket_record',{target_ticket_id:ticket.id});if(result.error){setError(result.error.message);return}setNotice(`${ticket.ticket_code} dihapus dari daftar ticket. Riwayat chat tetap tersimpan.`);await load()}

 if(loading)return <main className={`rk-work-foundation ${styles.ticketPage}`}><section className="rk-access-denied"><p>Menyiapkan ticket...</p></section></main>;
 return <main className={`rk-work-foundation ${styles.ticketPage}`}><section className="rk-work-shell">
  <nav className="rk-work-nav"><Link href="/ruang-kawan/marketing/"><FiArrowLeft/> Marketing</Link><span>Commercial & Handover</span><button onClick={()=>void load()}><FiRefreshCw/> Muat ulang</button></nav>
  <header className={styles.hero}><div className={styles.heroCopy}><small>MARKETING · COMMERCIAL OPERATIONS</small><h1>Ticket & Won Archive</h1><p>Koordinasi tiket tetap ringkas, sementara semua project Won terkumpul dan bisa ditinjau berdasarkan periode.</p><div className={styles.heroNote}><FiCheckCircle/><span>Pipeline tetap menjadi sumber data lead dan nilai deal.</span></div></div><div className={styles.heroActions}><Link href={workspace?.conversation_id?'/ruang-kawan/chat/?conversation='+workspace.conversation_id:'/ruang-kawan/chat/'}><FiMessageCircle/> Grup Commercial & Handover</Link>{workspace?.can_create?<button data-primary onClick={()=>{setError('');setShowForm(true)}}><FiPlus/> Buat ticket</button>:null}</div></header>

  <section className={styles.stats}>
   <article className={styles.statCard}><span className={styles.statIcon}><FiBriefcase/></span><div><small>Ticket diterbitkan</small><strong>{scopedTickets.length}</strong><em>{periodText}</em></div></article>
   <article className={styles.statCard}><span className={styles.statIcon}><FiCheckCircle/></span><div><small>Project Won terarsip</small><strong>{scopedWon.length}</strong><em>{periodText}</em></div></article>
   <article className={styles.statCard}><span className={styles.statIcon}><FiTag/></span><div><small>Nilai penawaran · Won</small><strong>{money(proposalTotal)}</strong><em>Ditautkan dari Pipeline</em></div></article>
   <article className={styles.statCard}><span className={styles.statIcon}><FiDollarSign/></span><div><small>Total nilai deal · Won</small><strong>{money(dealTotal)}</strong><em>Ditautkan dari Pipeline</em></div></article>
  </section>
  {notice?<p className="rk-work-alert">{notice}</p>:null}{error&&!showForm?<p className="rk-work-alert" data-error>{error}</p>:null}

  <section className={styles.archivePanel}>
   <div className={styles.archiveHeading}><div><small>ARSIP & PEMANTAUAN</small><h2>Semua tiket dan deal Won</h2><p>Deal Won ikut masuk otomatis sebagai arsip data dari Pipeline. Entri Won tidak membuat pesan ticket di grup.</p></div><span className={styles.archiveIcon}><FiBriefcase/></span></div>
   <div className={styles.toolbar}>
    <div className={styles.switcher}><button data-active={view==='tickets'} onClick={()=>setView('tickets')}>Ticket <span>{scopedTickets.length}</span></button><button data-active={view==='won'} onClick={()=>setView('won')}>Arsip Won <span>{scopedWon.length}</span></button></div>
    <label className={styles.search}><FiSearch/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Cari client, service, Ticket ID, atau lead..."/></label>
    <div className={styles.periodControl}><FiCalendar/><select aria-label="Filter periode Ticket dan Won" value={period} onChange={event=>setPeriod(event.target.value as Period)}><option value="all">Semua waktu</option><option value="month">Bulanan</option><option value="quarter">Kuartalan</option><option value="year">Tahunan</option></select>{period==='month'?<input aria-label="Pilih bulan" type="month" value={periodMonth} onChange={event=>setPeriodMonth(event.target.value)}/>:null}{period==='quarter'?<><select aria-label="Pilih kuartal" value={periodQuarter} onChange={event=>setPeriodQuarter(event.target.value)}><option value="1">Q1 · Jan–Mar</option><option value="2">Q2 · Apr–Jun</option><option value="3">Q3 · Jul–Sep</option><option value="4">Q4 · Okt–Des</option></select><select aria-label="Pilih tahun" value={periodYear} onChange={event=>setPeriodYear(event.target.value)}>{years.map(year=><option key={year}>{year}</option>)}</select></>:null}{period==='year'?<select aria-label="Pilih tahun" value={periodYear} onChange={event=>setPeriodYear(event.target.value)}>{years.map(year=><option key={year}>{year}</option>)}</select>:null}</div>
    <div className={styles.layoutSwitch} aria-label="Tampilan"><button data-active={layout==='card'} onClick={()=>setLayout('card')} aria-label="Tampilan kartu" title="Tampilan kartu"><FiGrid/></button><button data-active={layout==='list'} onClick={()=>setLayout('list')} aria-label="Tampilan daftar" title="Tampilan daftar"><FiList/></button></div>
   </div>
   <div className={styles.resultCaption}><span>{view==='tickets'?'Ticket diterbitkan':'Project Won dari Pipeline'}</span><span><FiFilter/> {periodText} · {view==='tickets'?visibleTickets.length:visibleWon.length} item</span></div>

   {view==='tickets'?<section className={styles.recordGrid} data-layout={layout}>{visibleTickets.map(ticket=><article className={styles.ticketCard} key={ticket.id}>
    <header className={styles.cardTop}><span className={styles.ticketCode}>{ticket.ticket_code}{ticket.lead_code?<small> · {ticket.lead_code}</small>:null}</span><span className={styles.statusPill} data-rru={ticket.rru_status}>{rruLabel[ticket.rru_status]}</span></header>
    <h3>{ticket.client_name}</h3><p className={styles.service}>{ticket.service_name}</p>
    <div className={styles.metaGrid}><span><FiUsers/> {ticket.client_type==='repeat_order'?'Repeat Order':'Client Baru'}</span><span><FiCalendar/> Proposal · {dateLabel(ticket.target_proposal_date)}</span></div>
    <div className={styles.detailBlock}><small>KEBUTUHAN</small><p>{ticket.requirements}</p></div>
    <div className={styles.detailBlock}><small>RENCANA PROJECT</small><p>{ticket.project_plan}</p></div>
    <div className={styles.pics}><small><FiUsers/> PIC TERTAG</small><p>{ticket.pics.length?ticket.pics.map(pic=>`${roleLabels[pic.role]??pic.role}: ${pic.name}`).join(' · '):'Belum ditentukan'}</p></div>
    {ticket.pipeline_lead_id?<div className={styles.valueRow}><span>Penawaran <strong>{money(ticket.proposal_value)}</strong></span><span>Deal <strong>{ticket.is_won?money(ticket.won_value):'Belum Won'}</strong></span></div>:null}
    <footer className={styles.cardFooter}><span>Dibuat {dateLabel(localDateKey(ticket.created_at))} · {ticket.creator_name}</span><div>{workspace?.can_create?<><button type="button" onClick={()=>openEdit(ticket)}><FiEdit3/> Edit</button><button type="button" data-danger onClick={()=>void deleteTicket(ticket)}><FiTrash2/> Hapus</button></>:null}{ticket.discussion_conversation_id?<Link href={`/ruang-kawan/chat/?conversation=${ticket.discussion_conversation_id}`}><FiMessageCircle/> Ruang diskusi</Link>:null}{ticket.chat_message_id&&workspace?.conversation_id?<Link href={`/ruang-kawan/chat/?conversation=${workspace.conversation_id}&thread=${ticket.chat_message_id}`}><FiExternalLink/> Pengumuman</Link>:null}</div></footer>
   </article>)}{!visibleTickets.length?<div className={styles.empty}><span><FiBriefcase/></span><strong>{tickets.length?'Tidak ada ticket yang cocok':'Belum ada ticket diterbitkan'}</strong><p>Lead di Pipeline tidak otomatis menjadi ticket. BD/CEO menerbitkan ticket secara manual dari form ini.</p>{workspace?.can_create?<button onClick={()=>setShowForm(true)}><FiPlus/> Buat ticket</button>:null}</div>:null}</section>:<section className={styles.recordGrid} data-layout={layout}>{visibleWon.map(project=><article className={styles.wonCard} key={project.id}>
    <header className={styles.cardTop}><span className={styles.ticketCode}>{project.lead_code}</span><span className={styles.wonPill}><FiCheckCircle/> WON</span></header>
    <h3>{project.client_name}</h3><p className={styles.service}>{project.service_name||'Service belum dicatat'}</p>
    <div className={styles.metaGrid}><span><FiCalendar/> Deal · {dateLabel(project.won_date)}</span><span><FiBriefcase/> {project.stage}</span></div>
    <div className={styles.valueRow}><span>Penawaran <strong>{money(project.proposal_value)}</strong></span><span>Nilai deal <strong>{money(project.won_value)}</strong></span></div>
    <footer className={styles.cardFooter}><span>Arsip otomatis · sumber Pipeline</span><Link href={`/ruang-kawan/pipeline/?lead=${project.id}`}><FiExternalLink/> Buka Pipeline</Link></footer>
   </article>)}{!visibleWon.length?<div className={styles.empty}><span><FiCheckCircle/></span><strong>{wonProjects.length?'Tidak ada project Won di periode ini':'Belum ada project Won'}</strong><p>Project yang stage-nya Won akan tampil di arsip ini tanpa membuat pengumuman atau ruang diskusi tiket.</p></div>:null}</section>}
  </section>
 </section>
 {showForm?<div className={`rk-work-modal ${styles.modal}`} role="dialog" aria-modal="true"><form className={styles.ticketForm} onSubmit={event=>void createTicket(event)}>
  <header className={styles.formHeader}><div><small>COMMERCIAL & HANDOVER</small><h2>{editingTicket?'Edit ticket':'Buat ticket baru'}</h2><p>Ticket ID dibuat otomatis; ringkasan tampil sebagai kartu khusus di grup utama.</p></div><button type="button" onClick={()=>{setShowForm(false);setEditingTicket(null);setError('')}} aria-label="Tutup"><FiX/></button></header>
  {error?<p className="rk-work-alert" data-error>{error}</p>:null}
  <div className={styles.fields}>
   <label>Client<input required value={form.client_name} onChange={event=>setForm({...form,client_name:event.target.value})} placeholder="Nama client"/></label>
   <label>Service<select required value={form.service_name} onChange={event=>setForm({...form,service_name:event.target.value})}><option value="">Pilih service</option>{services.map(service=><option key={service}>{service}</option>)}</select></label>
   <fieldset className={styles.clientType}><legend>Tipe client</legend><label><input type="radio" name="client-type" checked={form.client_type==='new_client'} onChange={()=>setForm({...form,client_type:'new_client'})}/><span>Client baru</span></label><label><input type="radio" name="client-type" checked={form.client_type==='repeat_order'} onChange={()=>setForm({...form,client_type:'repeat_order'})}/><span>Repeat order</span></label></fieldset>
   <label className={styles.wide}>Deskripsi & kebutuhan detail<textarea required value={form.requirements} onChange={event=>setForm({...form,requirements:event.target.value})} placeholder="Kebutuhan client, ruang lingkup, konteks, dan catatan penting"/></label>
   <label>Target proposal<input required type="date" value={form.target_proposal_date} onChange={event=>setForm({...form,target_proposal_date:event.target.value})}/></label>
   <label className={styles.wide}>Rencana project<textarea required value={form.project_plan} onChange={event=>setForm({...form,project_plan:event.target.value})} placeholder="Tahapan utama, target pelaksanaan, atau rencana delivery"/></label>
   <fieldset className={`${styles.wide} ${styles.rruField}`}><legend>Status RRU</legend><p>Pilih kondisi terbaru prospek untuk membantu tim menentukan tindak lanjut.</p><div>{rruOptions.map(option=><label key={option.value} data-selected={form.rru_status===option.value}><input type="radio" name="rru-status" checked={form.rru_status===option.value} onChange={()=>setForm({...form,rru_status:option.value})}/><strong>{option.label}</strong><small>{option.short}</small><span>{option.description}</span></label>)}</div></fieldset>
   <label className={styles.wide}>Hubungkan ke lead Pipeline <select value={form.pipeline_lead_id} onChange={event=>setForm({...form,pipeline_lead_id:event.target.value})}><option value="">Tidak dihubungkan</option>{workspace?.pipeline_options.map(lead=><option value={lead.id} key={lead.id}>{lead.lead_code} · {lead.client_name} · {lead.stage}</option>)}</select><small>Opsional dan manual; stage Pipeline tidak otomatis menerbitkan ticket.</small></label>
  </div>
  <section className={styles.picPicker}><h3><FiUsers/> PIC yang akan ditag</h3><div><select value={picMember} onChange={event=>setPicMember(event.target.value)}><option value="">Pilih staf</option>{workspace?.members.filter(member=>!pics.some(pic=>pic.membership_id===member.id&&pic.role===picRole)).map(member=><option key={member.id} value={member.id}>{member.name}{member.position?` · ${member.position}`:''}</option>)}</select><select value={picRole} onChange={event=>setPicRole(event.target.value as PicRole)}>{Object.entries(roleLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button type="button" onClick={addPic} disabled={!picMember}><FiPlus/> Tambah PIC</button></div>{pics.map((pic,index)=>{const member=workspace?.members.find(item=>item.id===pic.membership_id);return <span className={styles.picChip} key={`${pic.membership_id}-${pic.role}-${index}`}>{roleLabels[pic.role]} · {member?.name}<button type="button" aria-label="Hapus PIC" onClick={()=>setPics(items=>items.filter((_,i)=>i!==index))}><FiX/></button></span>})}<small>PIC akan di-mention pada pengumuman dan ditambahkan ke ruang koordinasi saat diskusi dimulai.</small></section>
  <footer className={styles.formFooter}><button type="button" onClick={()=>{setShowForm(false);setEditingTicket(null);setError('')}}>Batal</button><button type="submit" data-primary disabled={saving}>{saving?<FiSend/>:editingTicket?'Simpan perubahan':'Terbitkan ticket'}</button></footer>
 </form></div>:null}
 </main>
}
