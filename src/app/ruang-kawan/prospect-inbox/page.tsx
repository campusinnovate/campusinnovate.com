'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
 FiAlertCircle,FiArrowLeft,FiCheckCircle,FiClock,FiCopy,FiExternalLink,FiFilter,
 FiInbox,FiRefreshCw,FiSearch,FiSend,FiUserCheck,FiUsers,FiX,
} from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';
import { safeWebUrl } from '@/lib/prospects/google';
import styles from './prospect-inbox.module.css';

type InboxStatus='new'|'needs_review'|'potential'|'duplicate'|'junk'|'replace_pic'|'converted';
type ProspectSummary={
 id:string;account_name:string;account_type:string|null;industry:string|null;city:string|null;primary_source:string;
 contact_name:string|null;contact_role:string|null;recommended_service:string|null;recommended_pipeline:string|null;
 fit_score:number;intent_score:number;accessibility_score:number;total_score:number;inbox_status:InboxStatus;
 duplicate_of_prospect_id:string|null;promoted_lead_id:string|null;updated_at:string;lead_code:string|null;
 source_status:string|null;pipeline_category:string|null;confidence:string|null;research_date:string|null;
 position_status:string|null;next_action:string|null;
};
type PipelineSource={id:string;key:string;name:string;color:string;module_config:{business_units?:string[]}};
type Member={id:string;name:string;position:string|null};
type ImportBatch={id:string;source_title:string;source_sheet_name:string|null;total_rows:number;processed_rows:number;failed_rows:number;status:string;created_at:string};
type Workspace={prospects:ProspectSummary[];stats:{total:number;needs_review:number;potential:number;duplicates:number;converted:number};pipeline_sources:PipelineSource[];members:Member[];imports:ImportBatch[]};
type Research=Record<string,string|null>&{id:string;raw_snapshot:Record<string,unknown>};
type Signal={id:string;source:string;signal_type:string;content:string|null;url:string|null;detected_at:string;signal_score:number};
type ReviewEvent={id:string;actor_membership_id:string|null;event_type:string;changed_fields:string[];previous_status:string|null;new_status:string|null;created_at:string};
type Detail=ProspectSummary&{
 address:string|null;website:string|null;phone:string|null;email:string|null;linkedin_url:string|null;threads_url:string|null;
 instagram_url:string|null;google_maps_url:string|null;recommended_business_unit:string|null;ai_summary:string|null;review_notes:string;
 research:Research|null;signals:Signal[];review_events:ReviewEvent[];duplicate_of:{id:string;account_name:string;contact_name:string|null;promoted_lead_id:string|null}|null;
};
type ReviewDraft={
 inbox_status:InboxStatus;duplicate_of_prospect_id:string;account_name:string;account_type:string;industry:string;city:string;
 website:string;phone:string;email:string;contact_name:string;contact_role:string;recommended_service:string;
 recommended_pipeline:string;recommended_business_unit:string;review_notes:string;review_manual_bd_ceo:string;review_manual_cto_digital_system:string;
};

const emptyWorkspace:Workspace={prospects:[],stats:{total:0,needs_review:0,potential:0,duplicates:0,converted:0},pipeline_sources:[],members:[],imports:[]};
const statusMeta:Record<InboxStatus,{label:string;hint:string}>={
 new:{label:'New',hint:'Baru masuk dan belum diperiksa'},needs_review:{label:'Needs Review',hint:'Perlu dilengkapi atau diverifikasi'},
 potential:{label:'Potential',hint:'Layak diprioritaskan untuk outreach'},duplicate:{label:'Duplicate',hint:'Ditautkan ke prospect utama'},
 junk:{label:'Junk',hint:'Tidak relevan dengan target market'},replace_pic:{label:'Replace PIC',hint:'Account relevan, PIC perlu diganti'},
 converted:{label:'In Pipeline',hint:'Sudah menjadi lead aktif'},
};
const services=['Event Management','Training & Development','Digital Transformation','Program Development','COREVA ERP Organisasi','Stripmate Trip & Community'];
const researchGroups=[
 {title:'Research & Opportunity',fields:[['description','Description'],['context_findings','Context / Findings'],['potential_problem_opportunity','Potential Problem / Opportunity'],['recommended_solution','Recommended Campus Innovate Solution']]},
 {title:'BANT & Confidence',fields:[['budget','Budget'],['authority','Authority'],['need','Need'],['timeline','Timeline'],['confidence','Confidence']]},
 {title:'Position Verification',fields:[['position_status','Position Status'],['verified_current_position','Verified Current Position'],['verified_current_organization','Verified Current Organization'],['position_verification_source','Position Verification Source']]},
 {title:'Outreach',fields:[['suggested_outreach_angle','Suggested Outreach Angle'],['next_action','Next Action'],['linkedin_saved_lead','LinkedIn Saved Lead'],['research_date','Research Date']]},
] as const;
const blankDraft=(p:Detail):ReviewDraft=>({
 inbox_status:p.inbox_status,duplicate_of_prospect_id:p.duplicate_of_prospect_id??'',account_name:p.account_name,
 account_type:p.account_type??'',industry:p.industry??'',city:p.city??'',website:p.website??'',phone:p.phone??'',email:p.email??'',
 contact_name:p.contact_name??'',contact_role:p.contact_role??'',recommended_service:p.recommended_service??'',
 recommended_pipeline:p.recommended_pipeline??'',recommended_business_unit:p.recommended_business_unit??'',review_notes:p.review_notes??'',
 review_manual_bd_ceo:p.research?.review_manual_bd_ceo??'',review_manual_cto_digital_system:p.research?.review_manual_cto_digital_system??'',
});
const dateLabel=(value:string|null)=>value?new Date(value).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'—';
const urlsFrom=(...values:(string|null)[])=>Array.from(new Set(values.flatMap(value=>(value??'').match(/https?:\/\/[^\s|]+/g)??[]).map(value=>value.replace(/[),.;]+$/,''))));

export default function ProspectInboxPage(){
 const[state,setState]=useState<'loading'|'ready'|'denied'>('loading');const[data,setData]=useState<Workspace>(emptyWorkspace);
 const[canManage,setCanManage]=useState(false);const[query,setQuery]=useState('');const[status,setStatus]=useState<'all'|InboxStatus>('all');
 const[source,setSource]=useState('all');const[selected,setSelected]=useState<Detail|null>(null);const[draft,setDraft]=useState<ReviewDraft|null>(null);
 const[pipelineId,setPipelineId]=useState('');const[ownerId,setOwnerId]=useState('');const[busy,setBusy]=useState('');
 const[message,setMessage]=useState('');const[error,setError]=useState('');
 async function load(){
  setError('');const s=createClient();const{data:{session}}=await s.auth.getSession();if(!session){location.replace('/ruang-kawan/');return}
  const[workspace,accessR]=await Promise.all([s.rpc('prospect_inbox_workspace'),s.rpc('get_my_access')]);
  const access=Array.isArray(accessR.data)?accessR.data[0]:accessR.data;setCanManage(access?.membership_status==='active'&&!!access?.permissions?.includes('pipeline.manage_self'));
  if(workspace.error){if(workspace.error.code==='42501')setState('denied');else{setError(workspace.error.message);setState('ready')}return}
  setData(workspace.data as Workspace);setState('ready');
 }
 useEffect(()=>{void load()},[]);
 async function openDetail(id:string){
  setBusy(`detail-${id}`);setError('');const r=await createClient().rpc('prospect_inbox_detail',{target_prospect_id:id});setBusy('');
  if(r.error){setError(r.error.message);return}const detail=r.data as Detail;setSelected(detail);setDraft(blankDraft(detail));
  const recommended=data.pipeline_sources.find(item=>item.name===detail.recommended_pipeline||item.key==='pipeline_bd'&&detail.recommended_pipeline==='B2B Services');
  setPipelineId(recommended?.id??data.pipeline_sources[0]?.id??'');setOwnerId('');
 }
 async function refreshDetail(){if(!selected)return;await load();await openDetail(selected.id)}
 const visible=useMemo(()=>data.prospects.filter(p=>{
  const needle=query.trim().toLowerCase();const match=!needle||[p.account_name,p.contact_name,p.contact_role,p.lead_code,p.pipeline_category,p.recommended_service,p.next_action].some(v=>v?.toLowerCase().includes(needle));
  return match&&(status==='all'||p.inbox_status===status)&&(source==='all'||p.primary_source===source);
 }),[data.prospects,query,status,source]);
 async function saveReview(e:FormEvent){
  e.preventDefault();if(!selected||!draft||!canManage||busy)return;setBusy('review');setError('');setMessage('');
  const r=await createClient().rpc('save_prospect_inbox_review',{target_prospect_id:selected.id,expected_updated_at:selected.updated_at,payload:draft});
  setBusy('');if(r.error){setError(r.error.message);return}setMessage('Review Prospect Inbox tersimpan.');await refreshDetail();
 }
 async function promote(){
  if(!selected||!canManage||busy)return;if(!pipelineId){setError('Pilih Pipeline tujuan.');return}
  setBusy('promote');setError('');const r=await createClient().rpc('promote_inbox_prospect_to_pipeline',{target_prospect_id:selected.id,target_source_id:pipelineId,target_owner_id:ownerId||null});setBusy('');
  if(r.error){setError(r.error.message);return}setMessage(`${selected.account_name} masuk ke Pipeline BD sebagai record yang sama.`);await refreshDetail();
 }
 if(state==='loading')return <main className={styles.foundation}><div className={styles.empty}>Menyiapkan Prospect Inbox…</div></main>;
 if(state==='denied')return <main className={styles.foundation}><div className={styles.empty}><h1>Prospect Inbox belum tersedia</h1><p>Akses Pipeline BD diperlukan.</p><Link href="/ruang-kawan/marketing/">Kembali ke Marketing</Link></div></main>;
 return <main className={styles.foundation}><section className={styles.shell}>
  <nav className={styles.topnav}><Link href="/ruang-kawan/marketing/?tab=pipeline"><FiArrowLeft/> Pipeline & Prospect</Link><button onClick={()=>void load()}><FiRefreshCw/> Muat ulang</button></nav>
  <header className={styles.hero}><div><small>Pre-pipeline review workspace</small><h1>Prospect Inbox</h1><p>Review seluruh data riset, tandai duplicate atau junk, validasi PIC, lalu pindahkan record yang sama ke Pipeline BD saat siap outreach.</p></div><Link href="/ruang-kawan/pipeline/">Buka Pipeline BD <FiSend/></Link></header>
  {message?<p className={styles.success}>{message}</p>:null}{error?<p className={styles.error}>{error}</p>:null}
  <section className={styles.stats}>
   <article><FiInbox/><span><strong>{data.stats.total}</strong><small>Seluruh prospect</small></span></article>
   <article data-attention={data.stats.needs_review>0}><FiClock/><span><strong>{data.stats.needs_review}</strong><small>Perlu review</small></span></article>
   <article><FiUserCheck/><span><strong>{data.stats.potential}</strong><small>Potential</small></span></article>
   <article><FiCopy/><span><strong>{data.stats.duplicates}</strong><small>Duplicate</small></span></article>
   <article><FiCheckCircle/><span><strong>{data.stats.converted}</strong><small>In Pipeline</small></span></article>
  </section>
  <section className={styles.toolbar}><label><FiSearch/><input aria-label="Cari prospect" placeholder="Cari account, PIC, lead code, layanan, next action…" value={query} onChange={e=>setQuery(e.target.value)}/></label><span><FiFilter/><select value={status} onChange={e=>setStatus(e.target.value as 'all'|InboxStatus)}><option value="all">Semua status</option>{Object.entries(statusMeta).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select><select value={source} onChange={e=>setSource(e.target.value)}><option value="all">Semua sumber</option>{Array.from(new Set(data.prospects.map(p=>p.primary_source))).sort().map(value=><option key={value}>{value}</option>)}</select></span></section>
  <div className={styles.resultMeta}><span><b>{visible.length}</b> prospect tampil</span>{data.imports[0]?<span>Impor terakhir: <b>{data.imports[0].source_title}</b> · {data.imports[0].processed_rows}/{data.imports[0].total_rows} diproses · {data.imports[0].failed_rows} gagal</span>:<span>Belum ada batch impor tercatat.</span>}</div>
  <section className={styles.table} aria-label="Daftar Prospect Inbox"><header><span>Account & PIC</span><span>Research</span><span>Service / Category</span><span>Next Action</span><span>Status</span><span/></header>{visible.map(p=><article key={p.id}>
   <div><strong>{p.account_name}</strong><small>{[p.contact_name,p.contact_role].filter(Boolean).join(' · ')||'PIC belum tersedia'}</small><em>{p.lead_code||p.primary_source}</em></div>
   <div><strong>{p.confidence||'Belum dinilai'}</strong><small>{p.position_status||'Posisi belum diverifikasi'}</small><em>{dateLabel(p.research_date)}</em></div>
   <div><strong>{p.recommended_service||p.pipeline_category||'Belum dipetakan'}</strong><small>{p.recommended_pipeline||p.account_type||'—'}</small></div>
   <div><p>{p.next_action||'Tentukan next action saat review.'}</p></div>
   <div><span className={styles.status} data-status={p.inbox_status}>{statusMeta[p.inbox_status].label}</span></div>
   <button aria-label={`Buka ${p.account_name}`} disabled={busy===`detail-${p.id}`} onClick={()=>void openDetail(p.id)}>Detail</button>
  </article>)}{!visible.length?<div className={styles.empty}>Tidak ada prospect pada filter ini.</div>:null}</section>
 </section>
 {selected&&draft?<div className={styles.overlay} onMouseDown={e=>{if(e.target===e.currentTarget&&!busy){setSelected(null);setDraft(null)}}}><aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={`Detail ${selected.account_name}`}>
  <header className={styles.drawerHeader}><div><small>{selected.lead_code||selected.primary_source}</small><h2>{selected.account_name}</h2><p>{[selected.contact_name,selected.contact_role,selected.city].filter(Boolean).join(' · ')||'Data dasar belum lengkap'}</p></div><button aria-label="Tutup" disabled={!!busy} onClick={()=>{setSelected(null);setDraft(null)}}><FiX/></button></header>
  <section className={styles.scoreCard}><strong>{selected.total_score}</strong><div><b>Research score</b><span>Fit {selected.fit_score}/40 · Intent {selected.intent_score}/40 · Access {selected.accessibility_score}/20</span></div><span className={styles.status} data-status={selected.inbox_status}>{statusMeta[selected.inbox_status].label}</span></section>
  {error?<p className={styles.error}>{error}</p>:null}
  <form className={styles.reviewForm} onSubmit={saveReview}>
   <section><header><div><small>Human review</small><h3>Status & keputusan</h3></div><span title={statusMeta[draft.inbox_status].hint}><FiAlertCircle/> {statusMeta[draft.inbox_status].hint}</span></header><div className={styles.formGrid}><label>Status<select value={draft.inbox_status} disabled={!canManage||selected.inbox_status==='converted'} onChange={e=>setDraft({...draft,inbox_status:e.target.value as InboxStatus})}>{Object.entries(statusMeta).filter(([key])=>key!=='converted'||selected.inbox_status==='converted').map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select></label>{draft.inbox_status==='duplicate'?<label>Prospect utama<select required value={draft.duplicate_of_prospect_id} onChange={e=>setDraft({...draft,duplicate_of_prospect_id:e.target.value})}><option value="">Pilih prospect utama</option>{data.prospects.filter(p=>p.id!==selected.id&&p.inbox_status!=='duplicate'&&p.inbox_status!=='junk').map(p=><option key={p.id} value={p.id}>{p.account_name}{p.contact_name?` · ${p.contact_name}`:''}</option>)}</select></label>:null}<label className={styles.wide}>Catatan internal BD<textarea rows={3} maxLength={5000} value={draft.review_notes} onChange={e=>setDraft({...draft,review_notes:e.target.value})}/></label><label className={styles.wide}>Review Manual BD/CEO<textarea rows={4} maxLength={5000} value={draft.review_manual_bd_ceo} onChange={e=>setDraft({...draft,review_manual_bd_ceo:e.target.value})}/></label><label className={styles.wide}>Review Manual CTO — Digital System<textarea rows={4} maxLength={5000} value={draft.review_manual_cto_digital_system} onChange={e=>setDraft({...draft,review_manual_cto_digital_system:e.target.value})}/></label></div></section>
   <section><header><div><small>Canonical data</small><h3>Account & PIC</h3></div></header><div className={styles.formGrid}><label>Account<input required value={draft.account_name} onChange={e=>setDraft({...draft,account_name:e.target.value})}/></label><label>Jenis account<input value={draft.account_type} onChange={e=>setDraft({...draft,account_type:e.target.value})}/></label><label>Nama PIC<input value={draft.contact_name} onChange={e=>setDraft({...draft,contact_name:e.target.value})}/></label><label>Posisi PIC<input value={draft.contact_role} onChange={e=>setDraft({...draft,contact_role:e.target.value})}/></label><label>Industri<input value={draft.industry} onChange={e=>setDraft({...draft,industry:e.target.value})}/></label><label>Kota<input value={draft.city} onChange={e=>setDraft({...draft,city:e.target.value})}/></label><label>Website<input type="url" value={draft.website} onChange={e=>setDraft({...draft,website:e.target.value})}/></label><label>Telepon / WhatsApp<input value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})}/></label><label>Email<input type="email" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})}/></label><label>Final service<select value={draft.recommended_service} onChange={e=>setDraft({...draft,recommended_service:e.target.value})}><option value="">Belum ditentukan</option>{services.map(value=><option key={value}>{value}</option>)}</select></label><label>Recommended pipeline<input value={draft.recommended_pipeline} onChange={e=>setDraft({...draft,recommended_pipeline:e.target.value})}/></label><label>Business unit<input value={draft.recommended_business_unit} onChange={e=>setDraft({...draft,recommended_business_unit:e.target.value})}/></label></div></section>
   {selected.research?<>{researchGroups.map(group=><section key={group.title}><header><h3>{group.title}</h3></header><dl className={styles.research}>{group.fields.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{selected.research?.[key]||'—'}</dd></div>)}</dl></section>)}<section><header><h3>Evidence & Sources</h3></header><p className={styles.longText}>{selected.research.evidence_sources||'Belum ada evidence.'}</p><div className={styles.links}>{urlsFrom(selected.website,selected.linkedin_url,selected.research.evidence_sources,selected.research.position_verification_source,selected.research.company_website_social_media).map((value,index)=>safeWebUrl(value)?<a key={value} href={safeWebUrl(value)} target="_blank" rel="noopener noreferrer">Sumber {index+1} <FiExternalLink/></a>:null)}</div><details><summary>Raw source snapshot (28 kolom)</summary><pre>{JSON.stringify(selected.research.raw_snapshot,null,2)}</pre></details></section></>:<section><p>Prospect ini belum memiliki profil Lead Research. Data canonical tetap dapat direview dan dipromosikan.</p></section>}
   <section><header><h3>Riwayat</h3></header><ol className={styles.history}>{selected.review_events.map(event=><li key={event.id}><strong>{event.event_type.replaceAll('_',' ')}</strong><span>{event.changed_fields.join(', ')||'Status diperbarui'}</span><small>{data.members.find(m=>m.id===event.actor_membership_id)?.name||'Staff'} · {new Date(event.created_at).toLocaleString('id-ID')}</small></li>)}{!selected.review_events.length?<li>Belum ada perubahan manual tercatat.</li>:null}</ol></section>
   {canManage&&selected.inbox_status!=='converted'?<button className={styles.saveButton} disabled={!!busy}>{busy==='review'?'Menyimpan…':'Simpan review & data prospect'}</button>:null}
  </form>
  {selected.inbox_status!=='converted'&&selected.inbox_status!=='junk'&&selected.inbox_status!=='duplicate'?<section className={styles.promote}><header><div><small>Same-record promotion</small><h3>Terima ke Pipeline BD</h3></div></header><p>Prospect tidak disalin. Record ini ditautkan ke lead aktif, owner, next action, due date, dan My Activity.</p><div><label>Pipeline<select value={pipelineId} onChange={e=>setPipelineId(e.target.value)}>{data.pipeline_sources.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Owner<select value={ownerId} onChange={e=>setOwnerId(e.target.value)}><option value="">Saya sendiri</option>{data.members.map(member=><option key={member.id} value={member.id}>{member.name}{member.position?` · ${member.position}`:''}</option>)}</select></label></div><button disabled={!canManage||!!busy} onClick={()=>void promote()}><FiSend/> {busy==='promote'?'Memproses…':'Accept Prospect / Start Outreach'}</button></section>:selected.inbox_status==='converted'?<section className={styles.converted}><FiCheckCircle/><div><strong>Sudah masuk Pipeline BD</strong><Link href="/ruang-kawan/pipeline/">Buka lead aktif</Link></div></section>:null}
 </aside></div>:null}
 </main>;
}
