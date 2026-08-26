'use client';

import Link from 'next/link';
import { CSSProperties, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  FiArrowLeft, FiBriefcase, FiCalendar, FiCheckCircle, FiColumns, FiDollarSign,
  FiEdit3, FiExternalLink, FiList, FiPlus, FiRefreshCw, FiSearch, FiTrendingUp, FiX,
} from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';
import PipelineConfigurationPanel from './PipelineConfigurationPanel';

type PipelineKind = 'institution' | 'traveler';
type DynamicField = { key:string;label:string;type:'text'|'number'|'date'|'url'|'textarea'|'select'|'checkbox';options?:string[] };
type SourceConfig = {
  pipeline_kind?: PipelineKind; lead_prefix?: string; business_units?: string[]; stages?: string[];
  closed_stages?: string[]; priorities?: string[]; qualification_statuses?: string[]; account_types?: string[];
  interest_levels?: string[]; payment_statuses?: string[]; activity_types?: string[]; kpi_options?: string[];
};
type Source = { id:string;key:string;name:string;color:string;module_type:string;module_config:SourceConfig;field_schema:DynamicField[] };
type Member = { id:string;name:string;position:string|null };
type Lead = {
  id:string;activity_id:string;source_id:string;lead_code:string;date_added:string;business_unit:string|null;
  account_name:string;account_type:string|null;contact_name:string|null;contact_role:string|null;contact_details:string|null;
  lead_source:string|null;priority:string;stage:string;outreach_date:string|null;follow_up_count:number;
  last_contact_date:string|null;meeting_date:string|null;qualification_status:string|null;proposal_date:string|null;
  deal_value:number|null;probability:number|null;weighted_value:number;activity_type:string;next_action:string;due_date:string;
  document_url:string|null;notes:string|null;trip_program:string|null;interest_level:string|null;next_follow_up:string|null;
  seats:number|null;price_per_person:number|null;potential_revenue:number;payment_status:string|null;payment_date:string|null;
  community_join_date:string|null;payment_proof_url:string|null;extra_data:Record<string,unknown>;
  owner_membership_id:string;assigned_by_membership_id:string|null;workflow_status:string;progress:number;linked_kpi:string|null;
  owner_name:string;source_name:string;source_color:string;source_config:SourceConfig;
};
type Form = {
  id:string|null;sourceId:string;ownerId:string;leadCode:string;dateAdded:string;businessUnit:string;accountName:string;
  accountType:string;contactName:string;contactRole:string;contactDetails:string;leadSource:string;priority:string;stage:string;
  outreachDate:string;followUpCount:number;lastContactDate:string;meetingDate:string;qualificationStatus:string;proposalDate:string;
  dealValue:string;probability:number;activityType:string;nextAction:string;dueDate:string;documentUrl:string;notes:string;tripProgram:string;
  interestLevel:string;nextFollowUp:string;seats:string;pricePerPerson:string;paymentStatus:string;paymentDate:string;
  communityJoinDate:string;paymentProofUrl:string;linkedKpi:string;customData:Record<string,string|boolean>;
};

const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});
const addDays=(days:number)=>{const value=new Date(`${today()}T12:00:00`);value.setDate(value.getDate()+days);return value.toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});};
const money=(value:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value||0);
const emptyForm=():Form=>({id:null,sourceId:'',ownerId:'',leadCode:'',dateAdded:today(),businessUnit:'',accountName:'',accountType:'',contactName:'',contactRole:'',contactDetails:'',leadSource:'',priority:'Medium',stage:'',outreachDate:'',followUpCount:0,lastContactDate:'',meetingDate:'',qualificationStatus:'',proposalDate:'',dealValue:'',probability:0,activityType:'Follow Up',nextAction:'Follow up lead',dueDate:addDays(2),documentUrl:'',notes:'',tripProgram:'',interestLevel:'',nextFollowUp:'',seats:'',pricePerPerson:'',paymentStatus:'',paymentDate:'',communityJoinDate:'',paymentProofUrl:'',linkedKpi:'',customData:{}});
const stageTone=(stage:string,closedStages:string[]=[]):'lost'|'closed'|'active'=>{
  const normalized=stage.trim().toLowerCase();
  if(/\b(lost|lose|gagal|kalah|ditolak|rejected)\b/.test(normalized))return'lost';
  if(/\b(close|closed|won|deal|paid|booked|selesai)\b/.test(normalized)||closedStages.some(value=>value.trim().toLowerCase()===normalized))return'closed';
  return'active';
};

export default function PipelinePage(){
  const [state,setState]=useState<'loading'|'ready'|'denied'>('loading');
  const [membershipId,setMembershipId]=useState('');
  const [permissions,setPermissions]=useState<string[]>([]);
  const [sources,setSources]=useState<Source[]>([]);
  const [members,setMembers]=useState<Member[]>([]);
  const [leads,setLeads]=useState<Lead[]>([]);
  const [sourceFilter,setSourceFilter]=useState('');
  const [stageFilter,setStageFilter]=useState('all');
  const [priorityFilter,setPriorityFilter]=useState('all');
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
    const [accessR,memberR,sourcesR,membersR,leadsR]=await Promise.all([
      supabase.rpc('get_my_access'),supabase.rpc('current_membership_id'),supabase.rpc('list_my_work_sources'),
      supabase.rpc('list_pipeline_members'),supabase.rpc('list_pipeline_leads'),
    ]);
    const access=Array.isArray(accessR.data)?accessR.data[0]:accessR.data;
    if(!access?.permissions?.includes('pipeline.view')){setState('denied');return;}
    if(memberR.error||sourcesR.error||leadsR.error){setError('Pipeline BD belum dapat dimuat. Silakan muat ulang.');setState('ready');return;}
    const pipelineSources=((sourcesR.data??[]) as Source[]).filter(source=>source.module_type==='pipeline');
    setMembershipId(memberR.data as string);setPermissions(access.permissions??[]);setSources(pipelineSources);
    setMembers((membersR.data??[]) as Member[]);setLeads((leadsR.data??[]) as Lead[]);
    setSourceFilter(current=>current&&pipelineSources.some(source=>source.id===current)?current:(pipelineSources[0]?.id??''));setState('ready');
  }
  useEffect(()=>{void load();},[]);

  const selectedFilterSource=useMemo(()=>sources.find(source=>source.id===sourceFilter),[sources,sourceFilter]);
  const selectedFormSource=useMemo(()=>sources.find(source=>source.id===form.sourceId),[sources,form.sourceId]);
  const visible=useMemo(()=>leads.filter(lead=>{
    const term=query.trim().toLowerCase();
    return (!sourceFilter||lead.source_id===sourceFilter)&&(stageFilter==='all'||lead.stage===stageFilter)&&(priorityFilter==='all'||lead.priority.toLowerCase()===priorityFilter.toLowerCase())&&(!term||[lead.account_name,lead.contact_name,lead.lead_code,lead.business_unit,lead.next_action].some(value=>value?.toLowerCase().includes(term)));
  }),[leads,sourceFilter,stageFilter,priorityFilter,query]);
  const stages=selectedFilterSource?.module_config.stages??[];
  const priorities=useMemo(()=>{
    const configured=selectedFilterSource?.module_config.priorities??[];
    const existing=leads.filter(lead=>!sourceFilter||lead.source_id===sourceFilter).map(lead=>lead.priority).filter(Boolean);
    return Array.from(new Set([...configured,...existing]));
  },[selectedFilterSource,leads,sourceFilter]);
  const canManage=permissions.includes('pipeline.manage_self');
  const canManageTeam=permissions.includes('pipeline.manage_team')||permissions.includes('activity.assign_team');
  const sourceLeads=leads.filter(lead=>!sourceFilter||lead.source_id===sourceFilter);
  const stats={
    total:sourceLeads.length,
    overdue:sourceLeads.filter(lead=>lead.workflow_status!=='done'&&lead.due_date<today()).length,
    weighted:sourceLeads.reduce((total,lead)=>total+Number(lead.weighted_value||lead.potential_revenue||0),0),
    won:sourceLeads.filter(lead=>lead.stage==='Won'||lead.stage==='Paid/Booked').length,
  };

  function sourceDefaults(source:Source|undefined){return {stage:source?.module_config.stages?.[0]??'',priority:source?.module_config.priorities?.[1]??source?.module_config.priorities?.[0]??'Medium',businessUnit:source?.module_config.business_units?.[0]??'',qualificationStatus:source?.module_config.qualification_statuses?.includes('Pending')?'Pending':'',paymentStatus:source?.module_config.payment_statuses?.[0]??'',activityType:source?.module_config.activity_types?.[0]??'Follow Up',linkedKpi:source?.module_config.kpi_options?.[0]??''};}
  function startCreate(){const source=selectedFilterSource??sources[0];setForm({...emptyForm(),sourceId:source?.id??'',ownerId:membershipId,...sourceDefaults(source)});setError('');setMessage('');setFormOpen(true);}
  function startEdit(lead:Lead){setForm({id:lead.id,sourceId:lead.source_id,ownerId:lead.owner_membership_id,leadCode:lead.lead_code,dateAdded:lead.date_added,businessUnit:lead.business_unit??'',accountName:lead.account_name,accountType:lead.account_type??'',contactName:lead.contact_name??'',contactRole:lead.contact_role??'',contactDetails:lead.contact_details??'',leadSource:lead.lead_source??'',priority:lead.priority,stage:lead.stage,outreachDate:lead.outreach_date??'',followUpCount:lead.follow_up_count,lastContactDate:lead.last_contact_date??'',meetingDate:lead.meeting_date??'',qualificationStatus:lead.qualification_status??'',proposalDate:lead.proposal_date??'',dealValue:lead.deal_value?.toString()??'',probability:Math.round(Number(lead.probability??0)*100),activityType:lead.activity_type,nextAction:lead.next_action,dueDate:lead.due_date,documentUrl:lead.document_url??'',notes:lead.notes??'',tripProgram:lead.trip_program??'',interestLevel:lead.interest_level??'',nextFollowUp:lead.next_follow_up??'',seats:lead.seats?.toString()??'',pricePerPerson:lead.price_per_person?.toString()??'',paymentStatus:lead.payment_status??'',paymentDate:lead.payment_date??'',communityJoinDate:lead.community_join_date??'',paymentProofUrl:lead.payment_proof_url??'',linkedKpi:lead.linked_kpi??'',customData:Object.fromEntries(Object.entries(lead.extra_data??{}).map(([key,value])=>[key,typeof value==='boolean'?value:String(value??'')]))});setError('');setMessage('');setFormOpen(true);}
  function changeFormSource(sourceId:string){const source=sources.find(item=>item.id===sourceId);setForm({...emptyForm(),id:form.id,sourceId,ownerId:form.ownerId||membershipId,accountName:form.accountName,contactName:form.contactName,contactDetails:form.contactDetails,...sourceDefaults(source)});}

  async function save(event:FormEvent){
    event.preventDefault();setSaving(true);setError('');
    const payload={source_id:form.sourceId,owner_membership_id:form.ownerId||membershipId,lead_code:form.leadCode,date_added:form.dateAdded,business_unit:form.businessUnit,account_name:form.accountName,account_type:form.accountType,contact_name:form.contactName,contact_role:form.contactRole,contact_details:form.contactDetails,lead_source:form.leadSource,priority:form.priority,stage:form.stage,outreach_date:form.outreachDate,follow_up_count:form.followUpCount,last_contact_date:form.lastContactDate,meeting_date:form.meetingDate,qualification_status:form.qualificationStatus,proposal_date:form.proposalDate,deal_value:form.dealValue,probability:form.probability,activity_type:form.activityType,next_action:form.nextAction,due_date:form.dueDate,document_url:form.documentUrl,notes:form.notes,trip_program:form.tripProgram,interest_level:form.interestLevel,next_follow_up:form.nextFollowUp,seats:form.seats,price_per_person:form.pricePerPerson,payment_status:form.paymentStatus,payment_date:form.paymentDate,community_join_date:form.communityJoinDate,payment_proof_url:form.paymentProofUrl,linked_kpi:form.linkedKpi,extra_data:form.customData};
    const result=await createClient().rpc('save_pipeline_lead',{pipeline_lead_id:form.id,payload});setSaving(false);
    if(result.error){setError(result.error.message);return;}setFormOpen(false);setMessage(form.id?'Lead berhasil diperbarui.':'Lead ditambahkan dan next action otomatis masuk ke My Activity.');await load();
  }
  async function quickUpdate(lead:Lead,patch:Partial<Pick<Lead,'stage'|'next_action'|'due_date'>>){
    const stage=patch.stage??lead.stage;const nextAction=patch.next_action??lead.next_action;const dueDate=patch.due_date??lead.due_date;
    setLeads(current=>current.map(item=>item.id===lead.id?{...item,stage,next_action:nextAction,due_date:dueDate}:item));
    const result=await createClient().rpc('quick_update_pipeline_lead',{target_pipeline_lead_id:lead.id,target_stage:stage,target_next_action:nextAction,target_due_date:dueDate});
    if(result.error){setError(result.error.message);await load();}else setMessage(`${lead.account_name} berhasil diperbarui.`);
  }
  async function remove(){if(!form.id||!window.confirm('Hapus lead ini beserta aktivitas tindak lanjutnya?'))return;setSaving(true);const result=await createClient().rpc('delete_pipeline_lead',{target_pipeline_lead_id:form.id});setSaving(false);if(result.error){setError(result.error.message);return;}setFormOpen(false);setMessage('Lead berhasil dihapus.');await load();}

  if(state==='loading')return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><p>Menyiapkan Pipeline BD...</p></section></main>;
  if(state==='denied')return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><h1>Pipeline BD belum tersedia</h1><p>Hubungi administrator untuk mengaktifkan akses.</p><Link href="/ruang-kawan/marketing/">Kembali ke Marketing</Link></section></main>;
  return <main className="rk-pipeline-foundation"><section className="rk-pipeline-shell">
    <nav className="rk-pipeline-nav"><Link href="/ruang-kawan/marketing/"><FiArrowLeft/> Marketing</Link><button onClick={()=>void load()}><FiRefreshCw/> Muat ulang</button></nav>
    <header className="rk-pipeline-heading"><div><small>Revenue workspace</small><h1>Pipeline Business Development</h1><p>Kelola lead, next action, follow-up, meeting, proposal, dan closing dalam satu funnel.</p></div><span>{permissions.includes('pipeline.propose_config')?<PipelineConfigurationPanel onChanged={load}/>:null}{canManage?<button onClick={startCreate}><FiPlus/> Tambah lead</button>:null}</span></header>
    <section className="rk-pipeline-stats"><article><FiBriefcase/><span><strong>{stats.total}</strong><small>Total lead</small></span></article><article data-alert={stats.overdue>0}><FiCalendar/><span><strong>{stats.overdue}</strong><small>Next action terlambat</small></span></article><article><FiDollarSign/><span><strong>{money(stats.weighted)}</strong><small>Weighted pipeline</small></span></article><article><FiCheckCircle/><span><strong>{stats.won}</strong><small>Won / booked</small></span></article></section>
    <section className="rk-pipeline-toolbar"><div className="rk-pipeline-sources">{sources.map(source=><button key={source.id} data-active={sourceFilter===source.id} onClick={()=>{setSourceFilter(source.id);setStageFilter('all');setPriorityFilter('all');}}><i style={{background:source.color}}/>{source.name}<span>{leads.filter(lead=>lead.source_id===source.id).length}</span></button>)}</div><div className="rk-pipeline-controls"><label><FiSearch/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Cari lead, PIC, next action..."/></label><select value={stageFilter} onChange={event=>setStageFilter(event.target.value)}><option value="all">Semua stage</option>{stages.map(stage=><option key={stage}>{stage}</option>)}</select><select value={priorityFilter} onChange={event=>setPriorityFilter(event.target.value)} aria-label="Filter priority"><option value="all">Semua Priority</option>{priorities.map(priority=><option key={priority} value={priority}>{priority}</option>)}</select><span><button data-active={view==='board'} onClick={()=>setView('board')} aria-label="Board"><FiColumns/></button><button data-active={view==='list'} onClick={()=>setView('list')} aria-label="List"><FiList/></button></span></div></section>
    {message?<p className="rk-pipeline-alert">{message}</p>:null}{error?<p className="rk-pipeline-alert" data-error>{error}</p>:null}
    {view==='board'?<section className="rk-pipeline-board">{stages.map(stage=><div key={stage} data-stage-tone={stageTone(stage,selectedFilterSource?.module_config.closed_stages)}><header><h2>{stage}</h2><span>{visible.filter(lead=>lead.stage===stage).length}</span></header><section>{visible.filter(lead=>lead.stage===stage).map(lead=><LeadCard key={lead.id} lead={lead} stages={stages} canEdit={lead.owner_membership_id===membershipId||canManageTeam} onEdit={startEdit} onUpdate={quickUpdate}/>)}</section></div>)}</section>:<section className="rk-pipeline-list"><header><span>Lead</span><span>Stage & owner</span><span>Nilai</span><span>Next action</span><span/></header>{visible.map(lead=><article key={lead.id} data-stage-tone={stageTone(lead.stage,lead.source_config?.closed_stages)}><div><strong>{lead.account_name}</strong><small>{lead.lead_code} · {lead.contact_name||'Kontak belum diisi'}</small></div><div><em>{lead.stage}</em><small>{lead.owner_name}</small></div><div><strong>{money(Number(lead.weighted_value||lead.potential_revenue||0))}</strong><small>{lead.probability!=null?`${Math.round(Number(lead.probability)*100)}% probability`:lead.payment_status||'Belum dihitung'}</small></div><div data-overdue={lead.workflow_status!=='done'&&lead.due_date<today()}><strong>{lead.next_action}</strong><small>{new Date(`${lead.due_date}T12:00:00`).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</small></div>{lead.owner_membership_id===membershipId||canManageTeam?<button onClick={()=>startEdit(lead)}><FiEdit3/></button>:<span/>}</article>)}</section>}
    {!visible.length?<div className="rk-pipeline-empty"><FiTrendingUp/><strong>Belum ada lead pada pipeline ini</strong><p>Tambahkan lead baru atau ubah filter pencarian.</p></div>:null}
  </section>
  {formOpen?<div className="rk-pipeline-modal"><form onSubmit={save}><header><div><small>{form.id?'Ubah lead':'Lead baru'}</small><h2>{form.accountName||selectedFormSource?.name||'Pipeline BD'}</h2></div><button type="button" onClick={()=>setFormOpen(false)}><FiX/></button></header><div className="rk-pipeline-form">
    <fieldset><legend>Pipeline & ownership</legend><div><label>Pipeline<select value={form.sourceId} onChange={event=>changeFormSource(event.target.value)} required>{sources.map(source=><option key={source.id} value={source.id}>{source.name}</option>)}</select></label><label>Lead ID<input value={form.leadCode} onChange={event=>setForm({...form,leadCode:event.target.value})} placeholder={`${selectedFormSource?.module_config.lead_prefix||'LEAD'} — otomatis`}/></label><label>Date added<input type="date" value={form.dateAdded} onChange={event=>setForm({...form,dateAdded:event.target.value})} required/></label>{canManageTeam?<label>Owner<select value={form.ownerId} onChange={event=>setForm({...form,ownerId:event.target.value})} required>{members.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label>:null}<label>Priority<select value={form.priority} onChange={event=>setForm({...form,priority:event.target.value})}>{selectedFormSource?.module_config.priorities?.map(value=><option key={value}>{value}</option>)}</select></label><label>Stage<select value={form.stage} onChange={event=>setForm({...form,stage:event.target.value})} required>{selectedFormSource?.module_config.stages?.map(value=><option key={value}>{value}</option>)}</select></label><label>Unit bisnis<select value={form.businessUnit} onChange={event=>setForm({...form,businessUnit:event.target.value})}><option value="">Belum dipilih</option>{selectedFormSource?.module_config.business_units?.map(value=><option key={value}>{value}</option>)}</select></label><label>KPI terkait<select value={form.linkedKpi} onChange={event=>setForm({...form,linkedKpi:event.target.value})}><option value="">Tanpa KPI</option>{selectedFormSource?.module_config.kpi_options?.map(value=><option key={value}>{value}</option>)}</select></label></div></fieldset>
    <fieldset><legend>{selectedFormSource?.module_config.pipeline_kind==='traveler'?'Calon peserta':'Lead & kontak'}</legend><div><label className="wide">{selectedFormSource?.module_config.pipeline_kind==='traveler'?'Nama calon peserta':'Perusahaan / instansi / organisasi'}<input value={form.accountName} onChange={event=>setForm({...form,accountName:event.target.value})} maxLength={180} required/></label>{selectedFormSource?.module_config.pipeline_kind!=='traveler'?<><label>Jenis organisasi<select value={form.accountType} onChange={event=>setForm({...form,accountType:event.target.value})}><option value="">Belum dipilih</option>{selectedFormSource?.module_config.account_types?.map(value=><option key={value}>{value}</option>)}</select></label><label>Nama PIC<input value={form.contactName} onChange={event=>setForm({...form,contactName:event.target.value})}/></label><label>Jabatan PIC<input value={form.contactRole} onChange={event=>setForm({...form,contactRole:event.target.value})}/></label></>:null}<label>{selectedFormSource?.module_config.pipeline_kind==='traveler'?'WhatsApp':'WhatsApp / email'}<input value={form.contactDetails} onChange={event=>setForm({...form,contactDetails:event.target.value})}/></label><label>Lead source<input value={form.leadSource} onChange={event=>setForm({...form,leadSource:event.target.value})}/></label></div></fieldset>
    {selectedFormSource?.field_schema?.length?<fieldset><legend>Field sumber</legend><div>{selectedFormSource.field_schema.map(field=>field.type==='checkbox'?<label key={field.key} className="rk-pipeline-checkbox"><input type="checkbox" checked={Boolean(form.customData[field.key])} onChange={event=>setForm({...form,customData:{...form.customData,[field.key]:event.target.checked}})}/><span>{field.label}</span></label>:<label key={field.key} className={field.type==='textarea'?'wide':''}>{field.label}{field.type==='textarea'?<textarea value={String(form.customData[field.key]??'')} onChange={event=>setForm({...form,customData:{...form.customData,[field.key]:event.target.value}})}/>:field.type==='select'?<select value={String(form.customData[field.key]??'')} onChange={event=>setForm({...form,customData:{...form.customData,[field.key]:event.target.value}})}><option value="">Belum dipilih</option>{field.options?.map(option=><option key={option}>{option}</option>)}</select>:<input type={field.type} value={String(form.customData[field.key]??'')} onChange={event=>setForm({...form,customData:{...form.customData,[field.key]:event.target.value}})}/>}</label>)}</div></fieldset>:null}
    {selectedFormSource?.module_config.pipeline_kind==='traveler'?<fieldset><legend>Trip & pembayaran</legend><div><label>Trip / program<input value={form.tripProgram} onChange={event=>setForm({...form,tripProgram:event.target.value})}/></label><label>Interest<select value={form.interestLevel} onChange={event=>setForm({...form,interestLevel:event.target.value})}><option value="">Belum dipilih</option>{selectedFormSource.module_config.interest_levels?.map(value=><option key={value}>{value}</option>)}</select></label><label>Seats<input type="number" min="0" value={form.seats} onChange={event=>setForm({...form,seats:event.target.value})}/></label><label>Harga / pax<input type="number" min="0" value={form.pricePerPerson} onChange={event=>setForm({...form,pricePerPerson:event.target.value})}/></label><label>Payment status<select value={form.paymentStatus} onChange={event=>setForm({...form,paymentStatus:event.target.value})}><option value="">Belum dipilih</option>{selectedFormSource.module_config.payment_statuses?.map(value=><option key={value}>{value}</option>)}</select></label><label>Payment date<input type="date" value={form.paymentDate} onChange={event=>setForm({...form,paymentDate:event.target.value})}/></label><label>Join community<input type="date" value={form.communityJoinDate} onChange={event=>setForm({...form,communityJoinDate:event.target.value})}/></label><label>Bukti pembayaran<input type="url" value={form.paymentProofUrl} onChange={event=>setForm({...form,paymentProofUrl:event.target.value})}/></label></div></fieldset>:<fieldset><legend>Qualification & deal</legend><div><label>Qualified?<select value={form.qualificationStatus} onChange={event=>setForm({...form,qualificationStatus:event.target.value})}><option value="">Belum dipilih</option>{selectedFormSource?.module_config.qualification_statuses?.map(value=><option key={value}>{value}</option>)}</select></label><label>Meeting date<input type="date" value={form.meetingDate} onChange={event=>setForm({...form,meetingDate:event.target.value})}/></label><label>Proposal date<input type="date" value={form.proposalDate} onChange={event=>setForm({...form,proposalDate:event.target.value})}/></label><label>Deal value<input type="number" min="0" value={form.dealValue} onChange={event=>setForm({...form,dealValue:event.target.value})}/></label><label>Probability ({form.probability}%)<input type="range" min="0" max="100" step="5" value={form.probability} onChange={event=>setForm({...form,probability:Number(event.target.value)})}/></label><label>Link dokumen<input type="url" value={form.documentUrl} onChange={event=>setForm({...form,documentUrl:event.target.value})}/></label></div></fieldset>}
    <fieldset><legend>Outreach & next action</legend><div><label>Outreach date<input type="date" value={form.outreachDate} onChange={event=>setForm({...form,outreachDate:event.target.value})}/></label><label>Follow-up count<input type="number" min="0" value={form.followUpCount} onChange={event=>setForm({...form,followUpCount:Number(event.target.value)})}/></label><label>Last contact<input type="date" value={form.lastContactDate} onChange={event=>setForm({...form,lastContactDate:event.target.value})}/></label><label>Next follow-up<input type="date" value={form.nextFollowUp} onChange={event=>setForm({...form,nextFollowUp:event.target.value})}/></label><label>Jenis aktivitas<select value={form.activityType} onChange={event=>setForm({...form,activityType:event.target.value})}>{selectedFormSource?.module_config.activity_types?.map(value=><option key={value}>{value}</option>)}</select></label><label className="wide">Next action<input value={form.nextAction} onChange={event=>setForm({...form,nextAction:event.target.value})} required/></label><label>Due date<input type="date" value={form.dueDate} onChange={event=>setForm({...form,dueDate:event.target.value})} required/></label><label className="wide">Notes<textarea value={form.notes} onChange={event=>setForm({...form,notes:event.target.value})}/></label></div></fieldset>
  </div>{error?<p className="rk-pipeline-modal-error">{error}</p>:null}<footer>{form.id?<button type="button" data-danger onClick={()=>void remove()} disabled={saving}>Hapus lead</button>:<span/>}<div><button type="button" onClick={()=>setFormOpen(false)}>Batal</button><button type="submit" data-primary disabled={saving}>{saving?'Menyimpan...':'Simpan lead'}</button></div></footer></form></div>:null}
  </main>;
}

function LeadCard({lead,stages,canEdit,onEdit,onUpdate}:{lead:Lead;stages:string[];canEdit:boolean;onEdit:(lead:Lead)=>void;onUpdate:(lead:Lead,patch:Partial<Pick<Lead,'stage'|'next_action'|'due_date'>>)=>Promise<void>}){
  const overdue=lead.workflow_status!=='done'&&lead.due_date<today();
  const [nextAction,setNextAction]=useState(lead.next_action);
  useEffect(()=>setNextAction(lead.next_action),[lead.next_action]);
  return <article className="rk-pipeline-card" data-stage-tone={stageTone(lead.stage,lead.source_config?.closed_stages)} style={{'--pipeline-color':lead.source_color} as CSSProperties}>
    <header><span>{lead.lead_code}</span><em data-priority={lead.priority.toLowerCase()}>{lead.priority}</em></header><h3>{lead.account_name}</h3><p>{lead.contact_name||lead.trip_program||lead.business_unit||'Kontak belum dilengkapi'}</p>
    <div className="rk-pipeline-card-value"><strong>{money(Number(lead.weighted_value||lead.potential_revenue||0))}</strong><small>{lead.deal_value?`${Math.round(Number(lead.probability??0)*100)}% weighted`:lead.payment_status||'Potensi belum dihitung'}</small></div>
    {canEdit?<div className="rk-pipeline-quick"><select value={lead.stage} onChange={event=>void onUpdate(lead,{stage:event.target.value})}>{stages.map(stage=><option key={stage}>{stage}</option>)}</select><input value={nextAction} onChange={event=>setNextAction(event.target.value)} onBlur={()=>{if(nextAction.trim()&&nextAction!==lead.next_action)void onUpdate(lead,{next_action:nextAction});}}/><label data-overdue={overdue}><FiCalendar/><input type="date" value={lead.due_date} onChange={event=>void onUpdate(lead,{due_date:event.target.value})}/></label></div>:<div className="rk-pipeline-next" data-overdue={overdue}><small>Next action</small><strong>{lead.next_action}</strong><span>{lead.due_date}</span></div>}
    <footer><span>{lead.owner_name}</span>{lead.document_url?<a href={lead.document_url} target="_blank" rel="noreferrer"><FiExternalLink/></a>:null}{canEdit?<button onClick={()=>onEdit(lead)}><FiEdit3/></button>:null}</footer>
  </article>;
}
