'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiArchive, FiCalendar, FiCheck, FiChevronDown, FiDownload, FiEdit2, FiExternalLink, FiFilter, FiMail, FiMapPin, FiMessageCircle, FiPlus, FiRefreshCw, FiSearch, FiSend, FiUsers, FiX } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';
import styles from './client-database.module.css';

type SourceRef = { kind: 'pipeline'|'prospect'|'whatsapp_crm'|'manual'; id: string };
type Contact = {
  identity_key: string; company_name: string; pic_name: string|null; pic_role: string|null;
  email: string|null; whatsapp: string|null; phone: string|null; address: string|null; city: string|null; website: string|null;
  service_interest: string|null; source_label: string|null; lifecycle_status: string|null; owner_name: string|null; owner_membership_id: string|null;
  source_refs: SourceRef[]; updated_at: string|null; last_contact_at: string|null; last_contact_channel: string|null; last_contact_topic: string|null; last_contact_stage: 'TOFU'|'MOFU'|'BOFU'|null;
  internal_chat_at: string|null; internal_chat_topic: string|null; internal_chat_sender: string|null;
  email_consented: boolean; whatsapp_consented: boolean; archived: boolean;
};
type Member = { id: string; name: string };
type Draft = { id: string; company_name: string; pic_name: string; pic_role: string; email: string; whatsapp: string; phone: string; address: string; city: string; website: string; service_interest: string; owner_membership_id: string };
type TouchDraft = { channel: string; funnel_stage: string; topic: string; occurred_at: string };
type ConsentDraft = { channel: 'email'|'whatsapp'; consented: boolean; evidence: string };
const emptyDraft = (): Draft => ({ id:'',company_name:'',pic_name:'',pic_role:'',email:'',whatsapp:'',phone:'',address:'',city:'',website:'',service_interest:'',owner_membership_id:'' });
const emptyTouch = (): TouchDraft => ({channel:'LinkedIn',funnel_stage:'TOFU',topic:'',occurred_at:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'})+'T12:00'});
const emptyConsent = (): ConsentDraft => ({channel:'email',consented:false,evidence:''});
const labelDate = (value:string|null) => value ? new Date(value).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',year:'numeric'}) : 'Belum tercatat';
const dateKey = (value:string|null) => value ? new Date(value).toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'}) : '';
const channels = ['Email','WhatsApp','Telepon','LinkedIn','Threads','Meeting','Lainnya'];
const stageNames: Record<string,string> = {TOFU:'TOFU · Awareness',MOFU:'MOFU · Consideration',BOFU:'BOFU · Decision'};

function sourceHref(ref: SourceRef) {
  if (ref.kind === 'pipeline') return '/ruang-kawan/pipeline/?lead=' + encodeURIComponent(ref.id);
  if (ref.kind === 'prospect') return '/ruang-kawan/prospect-inbox/';
  return '';
}
function downloadCsv(rows:Contact[]) {
  const columns = ['Perusahaan','PIC','Jabatan','Email','WhatsApp','Telepon','Alamat','Kota','Layanan','Sumber','Status','Terakhir kontak','Platform','Funnel','Topik terakhir','PIC internal'];
  const quote = (value:unknown) => '"' + String(value ?? '').replaceAll('"','""') + '"';
  const data = [columns,...rows.map(r=>[r.company_name,r.pic_name,r.pic_role,r.email,r.whatsapp,r.phone,[r.address,r.city].filter(Boolean).join(', '),r.city,r.service_interest,r.source_label,r.lifecycle_status,r.last_contact_at?labelDate(r.last_contact_at):'',r.last_contact_channel,r.last_contact_stage,r.last_contact_topic,r.owner_name])].map(row=>row.map(quote).join(',')).join('\r\n');
  const file = new Blob(['\ufeff'+data],{type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(file), a = document.createElement('a'); a.href=url; a.download='database-client.csv'; a.click(); URL.revokeObjectURL(url);
}
export default function ClientDatabasePage() {
  const [rows,setRows] = useState<Contact[]>([]);
  const [members,setMembers] = useState<Member[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [query,setQuery] = useState('');
  const [sourceFilter,setSourceFilter] = useState('all');
  const [channelFilter,setChannelFilter] = useState('all');
  const [stageFilter,setStageFilter] = useState('all');
  const [serviceFilter,setServiceFilter] = useState('all');
  const [ownerFilter,setOwnerFilter] = useState('all');
  const [statusFilter,setStatusFilter] = useState('all');
  const [consentFilter,setConsentFilter] = useState('all');
  const [fromDate,setFromDate] = useState('');
  const [toDate,setToDate] = useState('');
  const [archiveMode,setArchiveMode] = useState(false);
  const [modal,setModal] = useState<'contact'|'touch'|'consent'|null>(null);
  const [draft,setDraft] = useState<Draft>(emptyDraft());
  const [touchDraft,setTouchDraft] = useState<TouchDraft>(emptyTouch());
  const [consentDraft,setConsentDraft] = useState<ConsentDraft>(emptyConsent());
  const [active,setActive] = useState<Contact|null>(null);
  const [busy,setBusy] = useState(false);

  const load = useCallback(async (quiet=false) => {
    if(!quiet) setLoading(true);
    setError('');
    const sb=createClient(), {data:{session}}=await sb.auth.getSession();
    if(!session){window.location.replace('/ruang-kawan/');return}
    const [workspace,access]=await Promise.all([sb.rpc('client_database_workspace'),sb.rpc('list_pipeline_members')]);
    if(workspace.error){setError(workspace.error.message||'Database Client belum dapat dimuat.');setLoading(false);return}
    const payload=(workspace.data??{}) as {records?:Contact[]};
    setRows(payload.records??[]);
    setMembers((access.data??[]) as Member[]);
    setLoading(false);
  },[]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(true),45000);const onFocus=()=>{if(document.visibilityState==='visible')void load(true)};document.addEventListener('visibilitychange',onFocus);return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',onFocus)}},[load]);

  const activeRows=useMemo(()=>rows.filter(r=>r.archived===archiveMode),[rows,archiveMode]);
  const services=useMemo(()=>Array.from(new Set(activeRows.map(r=>r.service_interest).filter((v):v is string=>!!v))).sort(),[activeRows]);
  const owners=useMemo(()=>Array.from(new Set(activeRows.map(r=>r.owner_name).filter((v):v is string=>!!v))).sort(),[activeRows]);
  const filtered=useMemo(()=>{
    const needle=query.trim().toLowerCase();
    return activeRows.filter(r=>{
      const searchable=[r.company_name,r.pic_name,r.pic_role,r.email,r.whatsapp,r.phone,r.address,r.city,r.service_interest,r.source_label,r.lifecycle_status,r.last_contact_topic,r.internal_chat_topic].join(' ').toLowerCase();
      return (!needle||searchable.includes(needle))
        &&(sourceFilter==='all'||r.source_refs.some(ref=>ref.kind===sourceFilter)||r.source_label===sourceFilter)
        &&(channelFilter==='all'||r.last_contact_channel===channelFilter)
        &&(stageFilter==='all'||r.last_contact_stage===stageFilter)
        &&(serviceFilter==='all'||r.service_interest===serviceFilter)
        &&(ownerFilter==='all'||r.owner_name===ownerFilter)
        &&(statusFilter==='all'||r.lifecycle_status===statusFilter)
        &&(consentFilter==='all'||(consentFilter==='email'&&r.email_consented)||(consentFilter==='whatsapp'&&r.whatsapp_consented)||(consentFilter==='missing'&&(!r.email_consented||!r.whatsapp_consented)))
        &&(!fromDate||(!!r.last_contact_at&&dateKey(r.last_contact_at)>=fromDate))
        &&(!toDate||(!!r.last_contact_at&&dateKey(r.last_contact_at)<=toDate));
    });
  },[activeRows,query,sourceFilter,channelFilter,stageFilter,serviceFilter,ownerFilter,statusFilter,consentFilter,fromDate,toDate]);
  const touched=filtered.filter(r=>r.last_contact_at);
  const recentCount=filtered.filter(r=>dateKey(r.last_contact_at)>=new Date(Date.now()-30*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'})).length;
  const noEmail=filtered.filter(r=>!r.email).length;
  const stages=['TOFU','MOFU','BOFU'].map(stage=>({stage,count:filtered.filter(r=>r.last_contact_stage===stage).length}));
  const stageMax=Math.max(1,...stages.map(x=>x.count));

  function openNew(){setActive(null);setDraft(emptyDraft());setError('');setModal('contact')}
  function openEdit(row:Contact){
    const manual=row.source_refs?.find(ref=>ref.kind==='manual');
    if(!manual){setNotice('Data sumber diubah dari Prospect Inbox atau Pipeline agar sinkronnya tetap terjaga.');return}
    setActive(row);
    setDraft({id:manual.id,company_name:row.company_name,pic_name:row.pic_name??'',pic_role:row.pic_role??'',email:row.email??'',whatsapp:row.whatsapp??'',phone:row.phone??'',address:row.address??'',city:row.city??'',website:row.website??'',service_interest:row.service_interest??'',owner_membership_id:row.owner_membership_id??''});
    setError('');setModal('contact');
  }
  async function saveContact(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');
    const payload={company_name:draft.company_name,pic_name:draft.pic_name,pic_role:draft.pic_role,email:draft.email,whatsapp:draft.whatsapp,phone:draft.phone,address:draft.address,city:draft.city,website:draft.website,service_interest:draft.service_interest,owner_membership_id:draft.owner_membership_id};
    const r=await createClient().rpc('save_marketing_client_manual_contact',{target_id:draft.id||null,payload});
    setBusy(false);if(r.error){setError(r.error.message);return}
    setModal(null);setNotice(draft.id?'Kontak manual diperbarui.':'Kontak ditambahkan.');await load(true);
  }
  async function remove(row:Contact){
    const manual=row.source_refs?.find(ref=>ref.kind==='manual');
    const isSoleManual=manual&&row.source_refs.length===1;
    const question=isSoleManual?'Hapus kontak manual '+row.company_name+'?':'Sembunyikan '+row.company_name+' dari Database Client? Data sumber Prospect/Pipeline tetap tersimpan.';
    if(!window.confirm(question))return;
    const sb=createClient();
    const r=isSoleManual?await sb.rpc('delete_marketing_client_manual_contact',{target_id:manual.id}):await sb.rpc('archive_marketing_client_contact',{target_identity_key:row.identity_key});
    if(r.error){setError(r.error.message);return}
    setNotice(isSoleManual?'Kontak manual dihapus.':'Kontak disembunyikan dari daftar.');await load(true);
  }
  async function restore(row:Contact){const r=await createClient().rpc('restore_marketing_client_contact',{target_identity_key:row.identity_key});if(r.error){setError(r.error.message);return}setNotice('Kontak ditampilkan kembali.');await load(true)}
  async function saveConsent(e:FormEvent){
    e.preventDefault();if(!active)return;setBusy(true);setError('');
    const r=await createClient().rpc('set_marketing_client_consent',{target_identity_key:active.identity_key,target_channel:consentDraft.channel,target_consented:consentDraft.consented,consent_evidence:consentDraft.evidence});
    setBusy(false);if(r.error){setError(r.error.message);return}
    setModal(null);setNotice('Status izin '+(consentDraft.channel==='email'?'email':'WhatsApp')+' diperbarui.');await load(true);
  }
  async function saveTouch(e:FormEvent){
    e.preventDefault();if(!active)return;setBusy(true);setError('');
    const r=await createClient().rpc('log_marketing_client_touchpoint',{target_identity_key:active.identity_key,target_channel:touchDraft.channel,target_stage:touchDraft.funnel_stage,target_topic:touchDraft.topic,target_at:new Date(touchDraft.occurred_at).toISOString()});
    setBusy(false);if(r.error){setError(r.error.message);return}
    setModal(null);setNotice('Aktivitas kontak tercatat.');await load(true);
  }

  const titleStats=[
    {label:'Kontak terdata',value:activeRows.length,sub:'Gabungan sumber aktif'},
    {label:'Dihubungi 30 hari',value:recentCount,sub:'Dari daftar terfilter'},
    {label:'Email tersedia',value:filtered.filter(r=>!!r.email).length,sub:'Consent dicatat terpisah'},
    {label:'Belum pernah tercatat',value:filtered.filter(r=>!r.last_contact_at).length,sub:'Perlu logging kontak'},
  ];
  const sourceOptions=[['all','Semua sumber'],['prospect','Prospect Inbox'],['pipeline','Pipeline'],['manual','Manual'],['whatsapp_crm','WhatsApp CRM']] as const;

  return <main className={styles.page}>
    <nav className={styles.back}><Link href="/ruang-kawan/marketing/"><FiArrowLeft/> Marketing</Link><button type="button" onClick={()=>void load()}><FiRefreshCw/> Sinkronkan</button></nav>
    <header className={styles.hero}><div className={styles.heroCopy}><span className={styles.eyebrow}>MARKETING · CRM SHARED</span><h1>Database Client</h1><p>Kontak, riwayat sentuhan, dan konteks terakhir dalam satu daftar bersama BD.</p><small><i/> Sinkronisasi sumber otomatis setiap 45 detik · terakhir dimuat {new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'})}</small></div><div className={styles.heroActions}><button type="button" className={styles.primary} onClick={openNew}><FiPlus/> Tambah kontak</button><button type="button" className={styles.ghost} onClick={()=>downloadCsv(filtered)}><FiDownload/> Ekspor CSV</button></div><div className={styles.orb}/></header>

    <section className={styles.stats}>{titleStats.map((item,index)=><article key={item.label}><span className={styles.statIcon}>{[<FiUsers/>,<FiCalendar/>,<FiMail/>,<FiMessageCircle/>][index]}</span><div><small>{item.label}</small><strong>{item.value.toLocaleString('id-ID')}</strong><span>{item.sub}</span></div></article>)}</section>
    <section className={styles.insights}><div className={styles.insightHead}><div><span className={styles.eyebrow}>RINGKASAN KONTAK</span><h2>Jejak interaksi</h2></div><p>Funnel dibaca dari interaksi yang tercatat; klasifikasi otomatis hanya perkiraan dari topik.</p></div><div className={styles.funnel}>{stages.map(item=><div key={item.stage}><span>{stageNames[item.stage]}</span><b>{item.count}</b><i><em style={{width:(item.count/stageMax*100)+'%'}}/></i></div>)}</div><div className={styles.consents}><span><FiCheck/> Email consent <b>{filtered.filter(r=>r.email_consented).length}</b></span><span><FiCheck/> WhatsApp consent <b>{filtered.filter(r=>r.whatsapp_consented).length}</b></span><small>Kontak tanpa bukti izin tidak dihitung sebagai penerima kampanye.</small></div></section>

    <section className={styles.listPanel}>
      <header className={styles.listHeader}><div><span className={styles.eyebrow}>DIRECTORY</span><h2>Kontak perusahaan</h2><p>{filtered.length.toLocaleString('id-ID')} baris cocok dengan filter</p></div><div className={styles.mode}><button data-active={!archiveMode} onClick={()=>setArchiveMode(false)}>Aktif <b>{rows.filter(r=>!r.archived).length}</b></button><button data-active={archiveMode} onClick={()=>setArchiveMode(true)}>Diarsipkan <b>{rows.filter(r=>r.archived).length}</b></button></div></header>
      <div className={styles.filters}>
        <label className={styles.search}><FiSearch/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari perusahaan, PIC, email, topik…"/></label>
        <label><span>Sumber</span><select value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)}>{sourceOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Platform terakhir</span><select value={channelFilter} onChange={e=>setChannelFilter(e.target.value)}><option value="all">Semua platform</option>{channels.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
        <label><span>Funnel</span><select value={stageFilter} onChange={e=>setStageFilter(e.target.value)}><option value="all">Semua tahap</option>{['TOFU','MOFU','BOFU'].map(s=><option key={s} value={s}>{stageNames[s]}</option>)}</select></label>
        <label><span>Layanan</span><select value={serviceFilter} onChange={e=>setServiceFilter(e.target.value)}><option value="all">Semua layanan</option>{services.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
        <label><span>PIC internal</span><select value={ownerFilter} onChange={e=>setOwnerFilter(e.target.value)}><option value="all">Semua PIC</option>{owners.map(o=><option key={o} value={o}>{o}</option>)}</select></label>
        <label><span>Status sumber</span><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Semua status</option>{Array.from(new Set(activeRows.map(r=>r.lifecycle_status).filter(Boolean))).sort().map(s=><option key={s} value={s!}>{s}</option>)}</select></label>
        <label><span>Consent</span><select value={consentFilter} onChange={e=>setConsentFilter(e.target.value)}><option value="all">Semua</option><option value="email">Email diizinkan</option><option value="whatsapp">WhatsApp diizinkan</option><option value="missing">Izin belum lengkap</option></select></label>
        <label><span>Kontak sejak</span><input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></label>
        <label><span>Sampai</span><input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/></label>
        <button type="button" className={styles.reset} onClick={()=>{setQuery('');setSourceFilter('all');setChannelFilter('all');setStageFilter('all');setServiceFilter('all');setOwnerFilter('all');setStatusFilter('all');setConsentFilter('all');setFromDate('');setToDate('')}}><FiFilter/> Reset</button>
      </div>
      {error?<p className={styles.alert} role="alert">{error}</p>:null}{notice?<p className={styles.notice} role="status">{notice}<button onClick={()=>setNotice('')}><FiX/></button></p>:null}
      <div className={styles.tableWrap}>{loading?<div className={styles.empty}>Memuat database kontak…</div>:filtered.length?<table><thead><tr><th>Perusahaan & PIC</th><th>Kontak</th><th>Sentuhan terakhir</th><th>Sumber & PIC internal</th><th>Consent</th><th>Aksi</th></tr></thead><tbody>{filtered.map((row,index)=>{
        const manual=row.source_refs?.find(ref=>ref.kind==='manual');
        const sourceRef=row.source_refs?.find(ref=>ref.kind==='pipeline'||ref.kind==='prospect');
        return <tr key={row.identity_key}><td><div className={styles.companyCell}><span className={styles.rowIndex}>{String(index+1).padStart(2,'0')}</span><div><strong>{row.company_name}</strong><span>{row.pic_name||'PIC belum dicatat'}{row.pic_role?' · '+row.pic_role:''}</span>{row.service_interest?<small>{row.service_interest}</small>:null}{row.address||row.city?<small className={styles.location}><FiMapPin/>{[row.address,row.city].filter(Boolean).join(', ')}</small>:null}</div></div></td>
          <td><div className={styles.contactCell}>{row.email?<a href={'mailto:'+row.email}><FiMail/>{row.email}</a>:<span className={styles.muted}>Email belum ada</span>}{row.whatsapp?<a target="_blank" rel="noreferrer" href={'https://wa.me/'+row.whatsapp.replace(/[^0-9]/g,'')}><FiMessageCircle/>{row.whatsapp}</a>:null}{row.phone&&row.phone!==row.whatsapp?<a href={'tel:'+row.phone}>{row.phone}</a>:null}</div></td>
          <td><div className={styles.touchCell}>{row.last_contact_at?<><strong>{labelDate(row.last_contact_at)}</strong><span>{row.last_contact_channel||'Channel belum dicatat'}{row.last_contact_stage?' · '+stageNames[row.last_contact_stage]:''}</span><p>{row.last_contact_topic||'Topik kontak belum dicatat'}</p></>:<span className={styles.muted}>Belum ada log kontak</span>}{row.internal_chat_at?<details><summary>Chat internal terkait <FiChevronDown/></summary><p>{row.internal_chat_topic}</p><small>{row.internal_chat_sender||'Tim'} · {labelDate(row.internal_chat_at)}</small></details>:null}</div></td>
          <td><div className={styles.sourceCell}><span>{row.source_label||'Sumber tidak diketahui'}</span>{row.lifecycle_status?<small>Status: {row.lifecycle_status}</small>:null}{row.owner_name?<small>PIC: {row.owner_name}</small>:null}</div></td>
          <td><div className={styles.consentCell}><span data-ok={row.email_consented}>Email {row.email_consented?'OK':'—'}</span><span data-ok={row.whatsapp_consented}>WhatsApp {row.whatsapp_consented?'OK':'—'}</span></div></td>
          <td><div className={styles.actions}>{archiveMode?<button type="button" title="Pulihkan" onClick={()=>void restore(row)}><FiRefreshCw/></button>:<><button type="button" title="Catat kontak" onClick={()=>{setActive(row);setTouchDraft(emptyTouch());setModal('touch')}}><FiSend/></button><button type="button" title="Kelola izin email/WhatsApp" onClick={()=>{setActive(row);setConsentDraft({channel:'email',consented:row.email_consented,evidence:''});setModal('consent')}}><FiCheck/></button>{manual?<button type="button" title="Edit kontak manual" onClick={()=>openEdit(row)}><FiEdit2/></button>:sourceRef?<a title="Buka sumber" href={sourceHref(sourceRef)}><FiExternalLink/></a>:null}<button type="button" title={manual?'Hapus kontak':'Sembunyikan dari database'} onClick={()=>void remove(row)}>{manual&&row.source_refs.length===1?<FiX/>:<FiArchive/>}</button></>}</div></td>
        </tr>;
      })}</tbody></table>:<div className={styles.empty}>{archiveMode?'Belum ada kontak yang diarsipkan.':'Tidak ada kontak yang cocok dengan filter.'}</div>}</div>
      <footer className={styles.tableFooter}><span><i/> Data sumber diperiksa otomatis tiap 45 detik.</span><span>Chat internal ditampilkan sebagai konteks, bukan bukti pesan terkirim ke klien.</span></footer>
    </section>

    {modal?<div className={styles.overlay} onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null)}}><form className={styles.modal} onSubmit={modal==='contact'?saveContact:modal==='touch'?saveTouch:saveConsent}>
      <header><div><span className={styles.eyebrow}>{modal==='contact'?'DATABASE CLIENT':modal==='touch'?'LOG INTERAKSI':'PREFERENSI KONTAK'}</span><h2>{modal==='contact'?(draft.id?'Edit kontak manual':'Tambah kontak'):modal==='touch'?'Catat kontak terbaru':'Kelola izin komunikasi'}</h2></div><button type="button" onClick={()=>setModal(null)}><FiX/></button></header>
      {modal==='contact'?<div className={styles.formGrid}>
        <label className={styles.wide}>Nama perusahaan<input autoFocus required maxLength={240} value={draft.company_name} onChange={e=>setDraft({...draft,company_name:e.target.value})}/></label>
        <label>Nama PIC<input value={draft.pic_name} onChange={e=>setDraft({...draft,pic_name:e.target.value})}/></label><label>Jabatan PIC<input value={draft.pic_role} onChange={e=>setDraft({...draft,pic_role:e.target.value})}/></label>
        <label>Email<input type="email" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})}/></label><label>WhatsApp<input value={draft.whatsapp} onChange={e=>setDraft({...draft,whatsapp:e.target.value})}/></label>
        <label>Telepon<input value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})}/></label><label>Kota<input value={draft.city} onChange={e=>setDraft({...draft,city:e.target.value})}/></label>
        <label className={styles.wide}>Alamat perusahaan<input value={draft.address} onChange={e=>setDraft({...draft,address:e.target.value})}/></label>
        <label>Website<input value={draft.website} onChange={e=>setDraft({...draft,website:e.target.value})}/></label><label>Layanan terkait<input value={draft.service_interest} onChange={e=>setDraft({...draft,service_interest:e.target.value})}/></label>
        <label className={styles.wide}>PIC internal<select value={draft.owner_membership_id} onChange={e=>setDraft({...draft,owner_membership_id:e.target.value})}><option value="">Belum ditentukan</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      </div>:modal==='touch'?<div className={styles.formGrid}>
        <div className={styles.wide}><strong>{active?.company_name}</strong><p className={styles.help}>Catat interaksi eksternal yang benar-benar terjadi. Chat internal tetap dipisahkan sebagai konteks.</p></div>
        <label>Platform<select value={touchDraft.channel} onChange={e=>setTouchDraft({...touchDraft,channel:e.target.value})}>{channels.map(c=><option key={c}>{c}</option>)}</select></label>
        <label>Tahap funnel<select value={touchDraft.funnel_stage} onChange={e=>setTouchDraft({...touchDraft,funnel_stage:e.target.value})}>{['TOFU','MOFU','BOFU'].map(s=><option key={s} value={s}>{stageNames[s]}</option>)}</select></label>
        <label>Tanggal dan waktu<input type="datetime-local" value={touchDraft.occurred_at} onChange={e=>setTouchDraft({...touchDraft,occurred_at:e.target.value})}/></label>
        <label className={styles.wide}>Topik yang dibahas<textarea required maxLength={1000} value={touchDraft.topic} onChange={e=>setTouchDraft({...touchDraft,topic:e.target.value})} placeholder="Contoh: mengirim company profile untuk pengenalan layanan."/></label>
      </div>:<div className={styles.formGrid}>
        <div className={styles.wide}><strong>{active?.company_name}</strong><p className={styles.help}>Aktifkan hanya jika ada persetujuan yang benar-benar diterima. Alamat email atau nomor yang tersedia bukan bukti izin.</p></div>
        <label>Channel<select value={consentDraft.channel} onChange={e=>setConsentDraft({...consentDraft,channel:e.target.value as 'email'|'whatsapp'})}><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select></label>
        <label>Status izin<select value={consentDraft.consented?'yes':'no'} onChange={e=>setConsentDraft({...consentDraft,consented:e.target.value==='yes'})}><option value="no">Belum / dicabut</option><option value="yes">Sudah memberi izin</option></select></label>
        <label className={styles.wide}>Bukti / sumber persetujuan{consentDraft.consented?<textarea required value={consentDraft.evidence} onChange={e=>setConsentDraft({...consentDraft,evidence:e.target.value})} placeholder="Contoh: formulir opt-in, tanggal, atau tautan bukti."/>:<input value={consentDraft.evidence} onChange={e=>setConsentDraft({...consentDraft,evidence:e.target.value})} placeholder="Opsional: catatan pencabutan izin."/>}</label>
      </div>}
      {error?<p className={styles.alert} role="alert">{error}</p>:null}
      <footer><button type="button" className={styles.ghost} onClick={()=>setModal(null)}>Batal</button><button type="submit" className={styles.primary} disabled={busy}>{busy?'Menyimpan…':modal==='contact'?'Simpan kontak':modal==='touch'?'Simpan log kontak':'Simpan status izin'}</button></footer>
    </form></div>:null}
  </main>;
}
