'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  FiArrowLeft, FiBarChart2, FiCalendar, FiCheckCircle, FiColumns, FiEdit3,
  FiExternalLink, FiList, FiPlus, FiRefreshCw, FiSearch, FiSend, FiX,
} from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';

type SourceConfig = {
  platforms?: string[];
  content_formats?: string[];
  content_pillars?: string[];
  content_strategies?: string[];
  funnels?: string[];
  publish_times?: string[];
};
type Source = { id:string;key:string;name:string;color:string;module_type:string;module_config:SourceConfig };
type Member = { id:string;name:string;email:string;position:string|null };
type ContentItem = {
  id:string;activity_id:string;source_id:string;title:string;publish_date:string|null;deadline:string;publish_time:string|null;
  platforms:string[];reference_url:string|null;content_pillar:string|null;content_strategy:string|null;content_format:string|null;
  funnel:string|null;brief_url:string|null;brief_text:string|null;caption:string|null;production_url:string|null;thumbnail_url:string|null;
  concept_status:'research'|'finalizing'|'done';production_status:'not_started'|'in_progress'|'revision'|'done';
  publication_status:'not_scheduled'|'scheduled'|'published'|'cancelled';owner_membership_id:string;reviewer_membership_id:string|null;
  assigned_by_membership_id:string|null;workflow_status:'not_started'|'in_progress'|'done'|'blocked';progress:number;
  priority:'low'|'medium'|'high'|'urgent';linked_kpi:string|null;review_status:'not_submitted'|'waiting_review'|'approved'|'revision_requested';
  review_note:string|null;owner_name:string;reviewer_name:string|null;source_name:string;source_color:string;
};
type Form = {
  id:string|null;sourceId:string;ownerId:string;reviewerId:string;title:string;publishDate:string;deadline:string;publishTime:string;
  platforms:string[];referenceUrl:string;contentPillar:string;contentStrategy:string;contentFormat:string;funnel:string;
  briefUrl:string;briefText:string;caption:string;productionUrl:string;thumbnailUrl:string;conceptStatus:ContentItem['concept_status'];
  productionStatus:ContentItem['production_status'];publicationStatus:ContentItem['publication_status'];workflowStatus:ContentItem['workflow_status'];
  progress:number;priority:ContentItem['priority'];linkedKpi:string;
};

const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});
const emptyForm=():Form=>({id:null,sourceId:'',ownerId:'',reviewerId:'',title:'',publishDate:'',deadline:today(),publishTime:'',platforms:[],referenceUrl:'',contentPillar:'',contentStrategy:'',contentFormat:'',funnel:'',briefUrl:'',briefText:'',caption:'',productionUrl:'',thumbnailUrl:'',conceptStatus:'research',productionStatus:'not_started',publicationStatus:'not_scheduled',workflowStatus:'not_started',progress:0,priority:'medium',linkedKpi:''});
const conceptLabels={research:'Riset ide',finalizing:'Finalisasi ide',done:'Ide selesai'};
const productionLabels={not_started:'Belum produksi',in_progress:'Produksi',revision:'Revisi',done:'Produksi selesai'};
const publicationLabels={not_scheduled:'Belum dijadwalkan',scheduled:'Terjadwal',published:'Sudah publish',cancelled:'Dibatalkan'};
const workflowLabels={not_started:'Belum mulai',in_progress:'Berjalan',done:'Selesai',blocked:'Terhambat'};
const reviewLabels={not_submitted:'Belum diajukan',waiting_review:'Menunggu review',approved:'Disetujui',revision_requested:'Perlu revisi'};
const priorityLabels={low:'Rendah',medium:'Sedang',high:'Tinggi',urgent:'Mendesak'};

function stage(item:ContentItem){
  if(item.publication_status==='published')return 'published';
  if(item.review_status==='waiting_review'||item.review_status==='revision_requested')return 'review';
  if(item.production_status==='in_progress'||item.production_status==='revision'||item.concept_status==='done')return 'production';
  return 'idea';
}

export default function ContentPlanPage(){
  const [state,setState]=useState<'loading'|'ready'|'denied'>('loading');
  const [membershipId,setMembershipId]=useState('');
  const [permissions,setPermissions]=useState<string[]>([]);
  const [sources,setSources]=useState<Source[]>([]);
  const [members,setMembers]=useState<Member[]>([]);
  const [items,setItems]=useState<ContentItem[]>([]);
  const [sourceFilter,setSourceFilter]=useState('all');
  const [statusFilter,setStatusFilter]=useState('all');
  const [query,setQuery]=useState('');
  const [view,setView]=useState<'board'|'list'>('board');
  const [form,setForm]=useState<Form>(emptyForm());
  const [formOpen,setFormOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  async function load(){
    setError('');
    const supabase=createClient();
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){window.location.replace('/ruang-kawan/');return;}
    const [accessR,memberR,sourcesR,membersR,itemsR]=await Promise.all([
      supabase.rpc('get_my_access'),supabase.rpc('current_membership_id'),supabase.rpc('list_my_work_sources'),
      supabase.rpc('list_content_plan_members'),supabase.rpc('list_content_items'),
    ]);
    const access=Array.isArray(accessR.data)?accessR.data[0]:accessR.data;
    if(!access?.permissions?.includes('content_plan.view')){setState('denied');return;}
    if(memberR.error||sourcesR.error||itemsR.error){setError('Content Plan belum dapat dimuat. Silakan muat ulang.');setState('ready');return;}
    const availableSources=((sourcesR.data??[]) as Source[]).filter(source=>source.module_type==='content_plan');
    setMembershipId(memberR.data as string);setPermissions(access.permissions??[]);setSources(availableSources);
    setMembers((membersR.data??[]) as Member[]);setItems((itemsR.data??[]) as ContentItem[]);setState('ready');
  }
  useEffect(()=>{void load();},[]);

  const selectedSource=useMemo(()=>sources.find(source=>source.id===form.sourceId),[sources,form.sourceId]);
  const visible=useMemo(()=>items.filter(item=>{
    const matchesSource=sourceFilter==='all'||item.source_id===sourceFilter;
    const matchesStatus=statusFilter==='all'||stage(item)===statusFilter;
    const term=query.trim().toLowerCase();
    const matchesQuery=!term||[item.title,item.owner_name,item.content_pillar,item.content_format,...item.platforms].some(value=>value?.toLowerCase().includes(term));
    return matchesSource&&matchesStatus&&matchesQuery;
  }),[items,sourceFilter,statusFilter,query]);
  const canManage=permissions.includes('content_plan.manage_self');
  const canManageTeam=permissions.includes('content_plan.manage_team')||permissions.includes('activity.assign_team');
  const stats={month:items.filter(item=>item.publish_date?.slice(0,7)===today().slice(0,7)).length,production:items.filter(item=>stage(item)==='production').length,review:items.filter(item=>item.review_status==='waiting_review').length,published:items.filter(item=>item.publication_status==='published').length};

  function startCreate(){
    setForm({...emptyForm(),sourceId:sources[0]?.id??'',ownerId:membershipId});setError('');setMessage('');setFormOpen(true);
  }
  function startEdit(item:ContentItem){
    setForm({id:item.id,sourceId:item.source_id,ownerId:item.owner_membership_id,reviewerId:item.reviewer_membership_id??'',title:item.title,publishDate:item.publish_date??'',deadline:item.deadline,publishTime:item.publish_time?.slice(0,5)??'',platforms:item.platforms??[],referenceUrl:item.reference_url??'',contentPillar:item.content_pillar??'',contentStrategy:item.content_strategy??'',contentFormat:item.content_format??'',funnel:item.funnel??'',briefUrl:item.brief_url??'',briefText:item.brief_text??'',caption:item.caption??'',productionUrl:item.production_url??'',thumbnailUrl:item.thumbnail_url??'',conceptStatus:item.concept_status,productionStatus:item.production_status,publicationStatus:item.publication_status,workflowStatus:item.workflow_status,progress:item.progress,priority:item.priority,linkedKpi:item.linked_kpi??''});
    setError('');setMessage('');setFormOpen(true);
  }
  function togglePlatform(platform:string){setForm({...form,platforms:form.platforms.includes(platform)?form.platforms.filter(item=>item!==platform):[...form.platforms,platform]});}
  async function save(event:FormEvent){
    event.preventDefault();setSaving(true);setError('');
    const payload={source_id:form.sourceId,owner_membership_id:form.ownerId||membershipId,reviewer_membership_id:form.reviewerId,title:form.title,publish_date:form.publishDate,deadline:form.deadline,publish_time:form.publishTime,platforms:form.platforms,reference_url:form.referenceUrl,content_pillar:form.contentPillar,content_strategy:form.contentStrategy,content_format:form.contentFormat,funnel:form.funnel,brief_url:form.briefUrl,brief_text:form.briefText,caption:form.caption,production_url:form.productionUrl,thumbnail_url:form.thumbnailUrl,concept_status:form.conceptStatus,production_status:form.productionStatus,publication_status:form.publicationStatus,workflow_status:form.workflowStatus,progress:form.progress,priority:form.priority,linked_kpi:form.linkedKpi};
    const result=await createClient().rpc('save_content_item',{content_item_id:form.id,payload});setSaving(false);
    if(result.error){setError(result.error.message);return;}setFormOpen(false);setMessage(form.id?'Konten berhasil diperbarui.':'Konten ditambahkan dan otomatis terhubung ke My Activity serta Assignment.');await load();
  }
  async function remove(){if(!form.id||!window.confirm('Hapus konten ini beserta aktivitas yang terhubung?'))return;setSaving(true);const result=await createClient().rpc('delete_content_item',{target_content_item_id:form.id});setSaving(false);if(result.error){setError(result.error.message);return;}setFormOpen(false);setMessage('Konten berhasil dihapus.');await load();}
  async function submitReview(item:ContentItem){const result=await createClient().rpc('submit_activity_review',{target_activity_id:item.activity_id});if(result.error)setError(result.error.message);else{setMessage('Konten diajukan untuk review.');await load();}}

  if(state==='loading')return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><p>Menyiapkan Content Plan...</p></section></main>;
  if(state==='denied')return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><h1>Content Plan belum tersedia</h1><p>Hubungi administrator untuk mengaktifkan akses.</p><Link href="/ruang-kawan/marketing/">Kembali ke Marketing</Link></section></main>;
  const groups:[string,string][]=[['idea','Ide & Brief'],['production','Produksi'],['review','Review'],['published','Published']];
  return <main className="rk-content-foundation"><section className="rk-content-shell">
    <nav className="rk-content-nav"><Link href="/ruang-kawan/marketing/"><FiArrowLeft/> Marketing</Link><button onClick={()=>void load()}><FiRefreshCw/> Muat ulang</button></nav>
    <header className="rk-content-heading"><div><small>Marketing workspace</small><h1>Content Plan</h1><p>Rencanakan ide, produksi, review, dan publikasi dalam satu alur kerja.</p></div>{canManage?<button onClick={startCreate}><FiPlus/> Tambah konten</button>:null}</header>
    <section className="rk-content-stats"><article><FiCalendar/><span><strong>{stats.month}</strong><small>Publish bulan ini</small></span></article><article><FiBarChart2/><span><strong>{stats.production}</strong><small>Dalam produksi</small></span></article><article><FiSend/><span><strong>{stats.review}</strong><small>Menunggu review</small></span></article><article><FiCheckCircle/><span><strong>{stats.published}</strong><small>Sudah publish</small></span></article></section>
    <section className="rk-content-toolbar"><div className="rk-content-sources"><button data-active={sourceFilter==='all'} onClick={()=>setSourceFilter('all')}>Semua brand</button>{sources.map(source=><button key={source.id} data-active={sourceFilter===source.id} onClick={()=>setSourceFilter(source.id)}><i style={{background:source.color}}/>{source.name}</button>)}</div><div className="rk-content-controls"><label><FiSearch/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Cari konten..."/></label><select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="all">Semua tahap</option>{groups.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><span><button data-active={view==='board'} onClick={()=>setView('board')} aria-label="Board"><FiColumns/></button><button data-active={view==='list'} onClick={()=>setView('list')} aria-label="List"><FiList/></button></span></div></section>
    {message?<p className="rk-content-alert">{message}</p>:null}{error?<p className="rk-content-alert" data-error>{error}</p>:null}
    {view==='board'?<section className="rk-content-board">{groups.map(([key,label])=><div key={key}><header><h2>{label}</h2><span>{visible.filter(item=>stage(item)===key).length}</span></header><div>{visible.filter(item=>stage(item)===key).map(item=><ContentCard key={item.id} item={item} membershipId={membershipId} canManageTeam={canManageTeam} onEdit={startEdit} onSubmitReview={submitReview}/>)}</div></div>)}</section>:<section className="rk-content-list"><header><span>Konten</span><span>Brand & PIC</span><span>Jadwal</span><span>Status</span><span/></header>{visible.map(item=><article key={item.id}><div><strong>{item.title}</strong><small>{item.content_format||'Format belum dipilih'} · {item.content_pillar||'Pilar belum dipilih'}</small></div><div><strong>{item.source_name}</strong><small>{item.owner_name}</small></div><div><strong>{item.publish_date?new Date(`${item.publish_date}T12:00:00`).toLocaleDateString('id-ID',{day:'numeric',month:'short'}):'Belum dijadwalkan'}</strong><small>Deadline {new Date(`${item.deadline}T12:00:00`).toLocaleDateString('id-ID',{day:'numeric',month:'short'})}</small></div><div><em data-status={item.workflow_status}>{workflowLabels[item.workflow_status]}</em><small>{reviewLabels[item.review_status]}</small></div>{item.owner_membership_id===membershipId||canManageTeam?<button onClick={()=>startEdit(item)}><FiEdit3/></button>:<span/>}</article>)}</section>}
    {!visible.length?<div className="rk-content-empty"><FiCalendar/><strong>Belum ada konten pada filter ini</strong><p>Ubah filter atau tambahkan rencana konten baru.</p></div>:null}
  </section>
  {formOpen?<div className="rk-content-modal"><form onSubmit={save}><header><div><small>{form.id?'Ubah konten':'Konten baru'}</small><h2>{form.title||'Rencana konten'}</h2></div><button type="button" onClick={()=>setFormOpen(false)}><FiX/></button></header><div className="rk-content-form">
    <fieldset><legend>Penjadwalan & ownership</legend><div><label>Brand<select value={form.sourceId} onChange={event=>setForm({...form,sourceId:event.target.value,platforms:[],contentPillar:'',contentStrategy:'',contentFormat:'',funnel:'',publishTime:''})} required>{sources.map(source=><option key={source.id} value={source.id}>{source.name}</option>)}</select></label><label>Deadline<input type="date" value={form.deadline} onChange={event=>setForm({...form,deadline:event.target.value})} required/></label><label>Tanggal publish<input type="date" value={form.publishDate} onChange={event=>setForm({...form,publishDate:event.target.value})}/></label><label>Jam publish<select value={form.publishTime} onChange={event=>setForm({...form,publishTime:event.target.value})}><option value="">Belum ditentukan</option>{selectedSource?.module_config.publish_times?.map(value=><option key={value}>{value}</option>)}</select></label>{canManageTeam?<label>PIC<select value={form.ownerId} onChange={event=>setForm({...form,ownerId:event.target.value})} required>{members.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label>:null}<label>Reviewer<select value={form.reviewerId} onChange={event=>setForm({...form,reviewerId:event.target.value})}><option value="">Tanpa reviewer</option>{members.filter(member=>member.id!==form.ownerId).map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label className="wide">Judul konten<input value={form.title} onChange={event=>setForm({...form,title:event.target.value})} maxLength={180} required/></label></div></fieldset>
    <fieldset><legend>Strategi konten</legend><div><label>Bentuk konten<select value={form.contentFormat} onChange={event=>setForm({...form,contentFormat:event.target.value})}><option value="">Pilih format</option>{selectedSource?.module_config.content_formats?.map(value=><option key={value}>{value}</option>)}</select></label><label>Content pillar<select value={form.contentPillar} onChange={event=>setForm({...form,contentPillar:event.target.value})}><option value="">Pilih pilar</option>{selectedSource?.module_config.content_pillars?.map(value=><option key={value}>{value}</option>)}</select></label><label>Content strategy<select value={form.contentStrategy} onChange={event=>setForm({...form,contentStrategy:event.target.value})}><option value="">Pilih strategi</option>{selectedSource?.module_config.content_strategies?.map(value=><option key={value}>{value}</option>)}</select></label><label>Funnel<select value={form.funnel} onChange={event=>setForm({...form,funnel:event.target.value})}><option value="">Pilih funnel</option>{selectedSource?.module_config.funnels?.map(value=><option key={value}>{value}</option>)}</select></label><label>KPI terkait<input value={form.linkedKpi} onChange={event=>setForm({...form,linkedKpi:event.target.value})} placeholder="Reels, Story, UGC..."/></label><label>Referensi konten<input type="url" value={form.referenceUrl} onChange={event=>setForm({...form,referenceUrl:event.target.value})} placeholder="https://..."/></label><div className="wide rk-platform-picker"><small>Platform</small>{selectedSource?.module_config.platforms?.map(platform=><label key={platform}><input type="checkbox" checked={form.platforms.includes(platform)} onChange={()=>togglePlatform(platform)}/><span>{platform}</span></label>)}</div></div></fieldset>
    <fieldset><legend>Brief & produksi</legend><div><label className="wide">Brief<textarea value={form.briefText} onChange={event=>setForm({...form,briefText:event.target.value})}/></label><label>Link brief<input type="url" value={form.briefUrl} onChange={event=>setForm({...form,briefUrl:event.target.value})}/></label><label>Link hasil<input type="url" value={form.productionUrl} onChange={event=>setForm({...form,productionUrl:event.target.value})}/></label><label>Link thumbnail<input type="url" value={form.thumbnailUrl} onChange={event=>setForm({...form,thumbnailUrl:event.target.value})}/></label><label className="wide">Caption & hashtag<textarea value={form.caption} onChange={event=>setForm({...form,caption:event.target.value})}/></label></div></fieldset>
    <fieldset><legend>Status kerja</legend><div><label>Status ide<select value={form.conceptStatus} onChange={event=>setForm({...form,conceptStatus:event.target.value as Form['conceptStatus']})}>{Object.entries(conceptLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Status produksi<select value={form.productionStatus} onChange={event=>setForm({...form,productionStatus:event.target.value as Form['productionStatus']})}>{Object.entries(productionLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Status publikasi<select value={form.publicationStatus} onChange={event=>setForm({...form,publicationStatus:event.target.value as Form['publicationStatus']})}>{Object.entries(publicationLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Status aktivitas<select value={form.workflowStatus} onChange={event=>setForm({...form,workflowStatus:event.target.value as Form['workflowStatus']})}>{Object.entries(workflowLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Prioritas<select value={form.priority} onChange={event=>setForm({...form,priority:event.target.value as Form['priority']})}>{Object.entries(priorityLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Progress ({form.workflowStatus==='done'?100:form.progress}%)<input type="range" min="0" max="100" step="5" value={form.workflowStatus==='done'?100:form.progress} onChange={event=>setForm({...form,progress:Number(event.target.value)})} disabled={form.workflowStatus==='done'}/></label></div></fieldset>
  </div>{error?<p className="rk-modal-error">{error}</p>:null}<footer>{form.id?<button type="button" data-danger onClick={()=>void remove()} disabled={saving}>Hapus</button>:<span/>}<div><button type="button" onClick={()=>setFormOpen(false)}>Batal</button><button data-primary disabled={saving}>{saving?'Menyimpan...':'Simpan konten'}</button></div></footer></form></div>:null}
  </main>;
}

function ContentCard({item,membershipId,canManageTeam,onEdit,onSubmitReview}:{item:ContentItem;membershipId:string;canManageTeam:boolean;onEdit:(item:ContentItem)=>void;onSubmitReview:(item:ContentItem)=>void}){
  return <article className="rk-content-card"><header><span><i style={{background:item.source_color}}/>{item.source_name}</span>{item.owner_membership_id===membershipId||canManageTeam?<button onClick={()=>onEdit(item)}><FiEdit3/></button>:<span/>}</header><h3>{item.title}</h3><p>{item.content_format||'Format belum dipilih'} · {item.content_pillar||'Pilar belum dipilih'}</p><div className="rk-content-card-tags">{item.platforms.slice(0,2).map(platform=><span key={platform}>{platform}</span>)}{item.platforms.length>2?<span>+{item.platforms.length-2}</span>:null}</div><dl><div><dt>PIC</dt><dd>{item.owner_name}</dd></div><div><dt>Publish</dt><dd>{item.publish_date?new Date(`${item.publish_date}T12:00:00`).toLocaleDateString('id-ID',{day:'numeric',month:'short'}):'Belum ada'}</dd></div></dl><footer><span><em data-status={item.workflow_status}>{workflowLabels[item.workflow_status]}</em><small>{item.progress}%</small></span>{item.production_url?<a href={item.production_url} target="_blank" rel="noreferrer"><FiExternalLink/></a>:null}{item.owner_membership_id===membershipId&&item.reviewer_membership_id&&item.review_status!=='waiting_review'&&item.review_status!=='approved'?<button onClick={()=>void onSubmitReview(item)}><FiSend/> Review</button>:<Link href="/ruang-kawan/assignments/" data-review={item.review_status}>{reviewLabels[item.review_status]}</Link>}</footer></article>;
}
