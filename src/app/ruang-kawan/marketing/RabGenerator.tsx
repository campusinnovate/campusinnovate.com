'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FiArrowUpRight, FiDownload, FiFileText, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';
import { supabasePublishableKey, supabaseUrl } from '@/lib/supabase/config';
import styles from './rab-generator.module.css';

type Account = { id:string; email:string; granted_scopes:string[]; updated_at:string };
type History = { id:string; project_name:string; client_name:string; pricing_mode:string; connection_id:string|null; drive_file_id:string|null; status:'pending'|'ready'|'failed'; error_message:string|null; created_at:string };
type LibraryRow = (string|number)[];
type Component = { row:number; title:string; scope:string; type:string; include:string; method:string; adjustment:string; notes:string; changes:Record<string,string|number> };
type Cost = { row:number; component:string; detail:string; costClass:string; unit:string; qty:string; days:string; rate:string; include:'YES'|'NO' };
type CostLibrary = { service:string; component:string; detail:string; costClass:string; unit:string };
type Assumptions = { targetMargin:string; managementFeeBasis:string; managementFeeRate:string; managementFeeFixed:string; overheadPool:string; revenueBase:string; overheadFloor:string; marketingFeeCap:string; originatorRate:string; proposalOwnerRate:string; pitchSupportRate:string; tax:string; vat:string; units:string };
type ApprovalAction = { id:string; request_id:string; actor_name:string; actor_position_key:string; decision:string; comment:string|null; created_at:string };
type Approval = { id:string; generation_id:string; requester_user_id:string; requester_name:string; project_name:string; client_name:string; service_family:string; pricing_mode:string; source_file_id:string; source_hash:string; snapshot:{submittedAt:string;requester:string;sourceUrl:string;values:string[][][]}; status:'pending_coo'|'pending_ceo'|'revision_requested'|'rejected'|'approved'; submitted_at:string };
type State = { configured:boolean; accounts:Account[]; history:History[]; actor:string; approvals:Approval[]; approvalActions:ApprovalAction[] };
const services=['EO / Event','Program Development','Website / System','Creative / Media','Custom'];
const modes=['Hybrid','Fixed Package','Open-book'];
const methods=['Package','Hybrid','Pass-through','Fixed / Retainer','Fee'];
const percentKeys: (keyof Assumptions)[]=['targetMargin','managementFeeRate','overheadFloor','marketingFeeCap','originatorRate','proposalOwnerRate','pitchSupportRate','tax','vat'];
const assumptionLabels: Record<keyof Assumptions,string>={targetMargin:'Target Gross Margin',managementFeeBasis:'Management Fee Basis',managementFeeRate:'Management Fee Rate',managementFeeFixed:'Management Fee Fixed Amount',overheadPool:'Project Overhead Pool',revenueBase:'Revenue Base for OH Rate',overheadFloor:'Minimum Pricing OH Floor',marketingFeeCap:'Marketing Fee Cap',originatorRate:'Lead Originator · Requested Rate',proposalOwnerRate:'Proposal Owner · Requested Rate',pitchSupportRate:'Pitch Support · Requested Rate',tax:'Project Tax & Other',vat:'VAT / PPN',units:'Units / Participants'};
const initialAssumptions:Assumptions={targetMargin:'0.4',managementFeeBasis:'% of Total Offer',managementFeeRate:'0.15',managementFeeFixed:'0',overheadPool:'3152000',revenueBase:'100000000',overheadFloor:'0.04',marketingFeeCap:'0.03',originatorRate:'0.03',proposalOwnerRate:'0',pitchSupportRate:'0',tax:'0',vat:'0',units:'0'};

async function request(action:string,payload:Record<string,unknown>={}) {
  const { data, error } = await createClient().functions.invoke('rab-generator',{ body:{ action,...payload } });
  if (error) {
    const response = error.context as Response|undefined;
    const detail = await response?.json?.().catch(()=>null);
    throw new Error(detail?.message ?? error.message);
  }
  if (data?.message) throw new Error(data.message);
  return data;
}

const inputNumber=(value:string,label:string,max=1e12) => {
  const number=Number(value);
  if (value.trim()===''||!Number.isFinite(number)||number<0||number>max) throw new Error(`${label} harus berupa angka positif yang valid.`);
  return number;
};
const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));

export default function RabGenerator(){
  const [state,setState]=useState<State|null>(null);
  const [accountId,setAccountId]=useState('');
  const [library,setLibrary]=useState<LibraryRow[]>([]);
  const [costLibrary,setCostLibrary]=useState<CostLibrary[]>([]);
  const [service,setService]=useState('EO / Event');
  const [mode,setMode]=useState('Open-book');
  const [project,setProject]=useState('');
  const [client,setClient]=useState('');
  const [proposal,setProposal]=useState('OFF-000');
  const [assumptions,setAssumptions]=useState(initialAssumptions);
  const [components,setComponents]=useState<Component[]>([]);
  const [componentsEdited,setComponentsEdited]=useState(false);
  const [costs,setCosts]=useState<Cost[]>([]);
  const [costsEdited,setCostsEdited]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [newUrl,setNewUrl]=useState('');
  const [approvalNotes,setApprovalNotes]=useState<Record<string,string>>({});

  async function load(){
    try { const data=await request('status') as State;setState(data);setAccountId(current=>current||data.accounts[0]?.id||''); }
    catch(e){setError(e instanceof Error?e.message:'RAB belum dapat dimuat.');}
  }
  useEffect(()=>{void load();const status=new URLSearchParams(window.location.search).get('rab_google');if(status){setMessage(status==='connected'?'Google Drive terhubung. Pilih akun untuk membuat RAB.':`Koneksi Google: ${status}.`);}},[]);
  useEffect(()=>{
    if(!accountId)return;
    let live=true;
    void request('template',{connectionId:accountId}).then(data=>{
      if(!live)return;
      setLibrary(data.library??[]);
      const costRows=(data.costLibrary??[]) as (string|number)[][];
      const normalized=costRows.filter(r=>r[0]&&r[1]&&r[2]).map(r=>({service:String(r[0]),component:String(r[1]),detail:String(r[2]),costClass:String(r[3]??''),unit:String(r[4]??'')}));
      setCostLibrary(normalized);
      setService(data.serviceFamily??'EO / Event');setMode(data.pricingMode??'Open-book');setProposal(String(data.proposalNumber??'OFF-000'));
      const a=data.assumptions??{};
      setAssumptions(Object.fromEntries(Object.keys(assumptionLabels).map(key=>[key,String(key==='units'?data.units??0:a[key]??initialAssumptions[key as keyof Assumptions])])) as Assumptions);
      const svc=String(data.serviceFamily??'EO / Event');
      const serviceComponents=(data.library??[]).filter((row:LibraryRow)=>row[0]===svc);
      const sharedComponent=(data.library??[]).find((row:LibraryRow)=>row[0]==='All');
      setComponents(sharedComponent?[{row:30+serviceComponents.length,title:String(sharedComponent[1]??''),scope:String(sharedComponent[2]??''),type:String(sharedComponent[3]??'Core'),include:String(sharedComponent[4]??'YES'),method:String(sharedComponent[5]??'Fee'),adjustment:'',notes:String(sharedComponent[6]??''),changes:{title:String(sharedComponent[1]??''),scope:String(sharedComponent[2]??''),type:String(sharedComponent[3]??'Core'),include:String(sharedComponent[4]??'YES'),method:String(sharedComponent[5]??'Fee'),notes:String(sharedComponent[6]??'')}}]:[]);
      setCosts(normalized.filter(c=>c.service===svc||c.service==='All').slice(0,30).map((c,i)=>({row:10+i,component:c.component,detail:c.detail,costClass:c.costClass,unit:c.unit,qty:'0',days:'1',rate:'0',include:'NO'})));
      setComponentsEdited(false);setCostsEdited(false);
    }).catch(e=>{if(live)setError(e instanceof Error?e.message:'Template tidak tersedia.');});
    return()=>{live=false};
  },[accountId]);
  const suggestions=useMemo(()=>[...library.filter(row=>row[0]===service).slice(0,11),...library.filter(row=>row[0]==='All').slice(0,1)],[library,service]);
  const rows=useMemo(()=>Array.from({length:12},(_,i)=>{
    const override=components.find(x=>x.row===30+i);
    const source=suggestions[i];
    return override??{row:30+i,title:String(source?.[1]??''),scope:String(source?.[2]??''),type:String(source?.[3]??'Optional'),include:String(source?.[4]??'NO'),method:String(source?.[5]??'Package'),adjustment:'',notes:'',changes:{}};
  }),[components,suggestions]);
  function changeComponent(row:number,key:keyof Omit<Component,'row'|'changes'>,value:string){
    const current=rows[row-30];
    setComponentsEdited(true);
    setComponents(old=>[...old.filter(x=>x.row!==row),{...current,[key]:value,changes:{...current.changes,[key]:key==='adjustment'&&value!==''?Number(value):value}}]);
  }
  function changeCost(row:number,key:keyof Cost,value:string){setCostsEdited(true);setCosts(old=>old.map(c=>c.row===row?{...c,[key]:value}:c));}
  function addCost(){if(costs.length>=30)return;setCostsEdited(true);setCosts(old=>[...old,{row:10+old.length,component:'',detail:'',costClass:'',unit:'',qty:'1',days:'1',rate:'0',include:'YES'}]);}
  async function authorize(){setBusy(true);setError('');try{const data=await request('authorize');window.location.assign(data.url);}catch(e){setError(e instanceof Error?e.message:'Koneksi gagal.');setBusy(false);}}
  async function generate(event:FormEvent){
    event.preventDefault();setBusy(true);setError('');setNewUrl('');
    try{
      const numbers=Object.fromEntries(Object.entries(assumptions).map(([key,value])=>[key,key==='managementFeeBasis'?value:inputNumber(value,assumptionLabels[key as keyof Assumptions],key==='marketingFeeCap'||key==='originatorRate'||key==='proposalOwnerRate'||key==='pitchSupportRate'?0.03:percentKeys.includes(key as keyof Assumptions)?1:1e12)]));
      const payload={projectName:project,clientName:client,serviceFamily:service,pricingMode:mode,proposalNumber:proposal,assumptions:numbers,
        components:components.filter(x=>Object.keys(x.changes).length).map(x=>({row:x.row,changes:x.changes})),
        costs:costs.filter(c=>c.detail.trim()).map(c=>({row:c.row,component:c.component,detail:c.detail,qty:inputNumber(c.qty,'Qty'),days:inputNumber(c.days,'Days'),rate:inputNumber(c.rate,'HPP per unit'),include:c.include}))};
      const result=await request('generate',{connectionId:accountId,payload});setNewUrl(result.url);setMessage('RAB berhasil dibuat dan disimpan di Drive Campus Innovate.');await load();
    }catch(e){setError(e instanceof Error?e.message:'Gagal membuat RAB.');}
    finally{setBusy(false);}
  }
  async function submitApproval(job:History){setBusy(true);setError('');try{const result=await request('submit-approval',{connectionId:job.connection_id,jobId:job.id});setMessage(result.duplicate?'Versi RAB ini sudah pernah diajukan atau disetujui.':'RAB terkini sudah diajukan ke COO.');await load();}catch(e){setError(e instanceof Error?e.message:'Pengajuan tidak berhasil.');}finally{setBusy(false);}}
  async function decideApproval(approval:Approval,decision:'approved'|'revision_requested'|'rejected'){
    setBusy(true);setError('');try{await request('decide-approval',{approvalId:approval.id,decision,comment:approvalNotes[approval.id]??''});setMessage(decision==='approved'?'Persetujuan tercatat dan status diperbarui.':'Catatan keputusan sudah tercatat.');setApprovalNotes(old=>({...old,[approval.id]:''}));await load();}catch(e){setError(e instanceof Error?e.message:'Keputusan tidak berhasil.');}finally{setBusy(false);}
  }
  function openApprovalDocument(item:Approval){
    const values=item.snapshot.values??[];
    const info=values[0]??[];const assumptions=values[1]??[];const allocations=values[2]??[];const summary=values[3]??[];const components=values[4]??[];const costs=values[5]??[];
    const actions=(state?.approvalActions??[]).filter(a=>a.request_id===item.id);
    const bodyRows=(data:string[][])=>data.filter(row=>row.some(cell=>String(cell??'').trim())).map(row=>`<tr>${row.map(cell=>`<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
    const table=(title:string,headers:string[],data:string[][])=>`<h2>${escapeHtml(title)}</h2><table><thead><tr>${headers.map(cell=>`<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead><tbody>${bodyRows(data)}</tbody></table>`;
    const signatures=['coo','ceo'].map(role=>{const action=actions.find(a=>a.actor_position_key===role&&a.decision==='approved');return `<div class="sign"><strong>${role.toUpperCase()}</strong><p>${action?`Disetujui oleh ${escapeHtml(action.actor_name)} · ${escapeHtml(new Date(action.created_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}))}`:'Ruang tanda tangan dan tanggal'}</p><div></div></div>`;}).join('');
    const html=`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Pengajuan RAB - ${escapeHtml(item.project_name)}</title><style>@page{size:A4 landscape;margin:14mm}body{font:12px Arial,sans-serif;color:#17202a;margin:32px}h1{font-size:22px;margin:0 0 6px}h2{font-size:15px;margin:24px 0 8px;border-bottom:1px solid #ccd3da;padding-bottom:5px}.meta{color:#596574;margin:0 0 18px}.info{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin:18px 0}table{width:100%;border-collapse:collapse;table-layout:auto;font-size:10px}td,th{border:1px solid #cfd6dd;padding:5px;vertical-align:top;text-align:left}thead{display:table-header-group;background:#edf2f7}td:first-child{white-space:nowrap}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px;page-break-inside:avoid}.sign{min-height:100px}.sign div{border-bottom:1px solid #333;margin-top:60px}.source{font-size:10px;color:#506070;margin-top:20px}@media print{body{margin:0}h2{break-after:avoid}tr{break-inside:avoid}table{break-inside:auto}.signatures{break-inside:avoid}}</style></head><body><h1>Pengajuan RAB Proyek</h1><p class="meta">Versi ${escapeHtml(item.source_hash.slice(0,12))} · Diajukan ${escapeHtml(new Date(item.submitted_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}))} WIB</p><div class="info"><div><b>Proyek:</b> ${escapeHtml(info[0]?.[0])}</div><div><b>Client:</b> ${escapeHtml(info[1]?.[0])}</div><div><b>Layanan:</b> ${escapeHtml(info[2]?.[0])}</div><div><b>Mode:</b> ${escapeHtml(info[3]?.[0])}</div><div><b>No. penawaran:</b> ${escapeHtml(info[4]?.[0])}</div><div><b>Pengaju:</b> ${escapeHtml(item.requester_name)}</div></div>${table('Asumsi Harga',['Parameter','Nilai','','Parameter','Nilai',''],assumptions)}${table('Alokasi Marketing',allocations[0]??[],allocations.slice(1))}${table('Ringkasan Harga',['Metric','Nilai'],summary)}${table('Komponen Penawaran',components[0]??[],components.slice(1))}${table('RAB Internal · Rincian HPP',costs[0]??[],costs.slice(1))}<p class="source">Sumber angka adalah snapshot Google Sheet saat pengajuan. <a href="${escapeHtml(item.snapshot.sourceUrl)}">Buka Google Sheet sumber</a></p><div class="signatures">${signatures}</div><script>window.onload=()=>window.print()</script></body></html>`;
    const win=window.open('','_blank');if(!win){setError('Izinkan pop-up untuk membuka dokumen persetujuan.');return;}win.document.write(html);win.document.close();
  }
  async function download(job:History){
    setBusy(true);setError('');
    try{
      const { data:{session} }=await createClient().auth.getSession();if(!session)throw new Error('Sesi habis. Masuk kembali.');
      const response=await fetch(`${supabaseUrl}/functions/v1/rab-generator`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:supabasePublishableKey,'Content-Type':'application/json'},body:JSON.stringify({action:'export',connectionId:job.connection_id,jobId:job.id})});
      if(!response.ok){const failure=await response.json();throw new Error(failure.message??'Excel tidak dapat diunduh.');}
      const blob=await response.blob();const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`RAB - ${job.project_name}.xlsx`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),30000);
    }catch(e){setError(e instanceof Error?e.message:'Excel tidak dapat diunduh.');}
    finally{setBusy(false);}
  }
  return <section className={styles.shell}>
    <header className={styles.hero}><div><span className={styles.eyebrow}>CAMPUS INNOVATE · COMMERCIAL</span><h2>RAB Generator</h2><p>Isi asumsi dan biaya proyek. Sistem menyalin tujuh sheet dari master resmi, menjaga rumus dan formatnya, lalu menyimpan hasil di Google Drive.</p></div><FiFileText className={styles.heroIcon}/></header>
    {error?<p className={styles.error} role="alert">{error}</p>:null}{message?<p className={styles.notice}>{message}</p>:null}
    <div className={styles.toolbar}><div><strong>Google Drive</strong><small>{!state?'Memuat koneksi…':!state.configured?'Integrasi belum diatur oleh admin':state.accounts.length?`${state.accounts.length} akun terhubung`:'Hubungkan akun yang punya akses ke master dan folder output'}</small></div>{state?.accounts.length?<select value={accountId} onChange={e=>setAccountId(e.target.value)} aria-label="Akun Google Drive">{state.accounts.map(a=><option key={a.id} value={a.id}>{a.email}</option>)}</select>:null}<button type="button" onClick={()=>void authorize()} disabled={busy||!state?.configured}>{state?.accounts.length?'Hubungkan akun lain':'Hubungkan Google Drive'}</button></div>
    <form onSubmit={generate} className={styles.form}>
      <section className={styles.panel}><div className={styles.panelHead}><span>01</span><div><h3>Informasi proyek</h3><p>Mengisi bagian Project Information pada Pricing Control.</p></div></div><div className={styles.fields}>
        <label>Nama proyek<input value={project} onChange={e=>setProject(e.target.value)} maxLength={160} required placeholder="Contoh: Leadership Camp 2026"/></label>
        <label>Client<input value={client} onChange={e=>setClient(e.target.value)} maxLength={160} required placeholder="Nama organisasi / perusahaan"/></label>
        <label>Service Family<select value={service} onChange={e=>{const next=e.target.value;const edited=componentsEdited||costsEdited||costs.some(c=>Number(c.qty)>0||Number(c.rate)>0||c.include==='YES');if(edited&&!window.confirm('Mengganti layanan akan memuat ulang komponen dan rincian HPP. Perubahan yang belum disimpan akan hilang. Lanjutkan?'))return;setService(next);const serviceComponents=library.filter(row=>row[0]===next);const shared=library.find(row=>row[0]==='All');setComponents(shared?[{row:30+serviceComponents.length,title:String(shared[1]??''),scope:String(shared[2]??''),type:String(shared[3]??'Core'),include:String(shared[4]??'YES'),method:String(shared[5]??'Fee'),adjustment:'',notes:String(shared[6]??''),changes:{title:String(shared[1]??''),scope:String(shared[2]??''),type:String(shared[3]??'Core'),include:String(shared[4]??'YES'),method:String(shared[5]??'Fee'),notes:String(shared[6]??'')}}]:[]);setComponentsEdited(false);setCosts(costLibrary.filter(c=>c.service===next||c.service==='All').slice(0,30).map((c,i)=>({row:10+i,component:c.component,detail:c.detail,costClass:c.costClass,unit:c.unit,qty:'0',days:'1',rate:'0',include:'NO'})));setCostsEdited(false);}}>{services.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Pricing Mode<select value={mode} onChange={e=>setMode(e.target.value)}>{modes.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Nomor penawaran<input value={proposal} onChange={e=>setProposal(e.target.value)} maxLength={80} required/></label>
        <label>Units / Participants<input type="number" min="0" step="any" value={assumptions.units} onChange={e=>setAssumptions({...assumptions,units:e.target.value})}/></label>
      </div></section>
      <section className={styles.panel}><div className={styles.panelHead}><span>02</span><div><h3>Asumsi komersial</h3><p>Persentase ditulis sebagai desimal: 0,30 berarti 30%.</p></div></div><div className={styles.fields}>
        {(Object.keys(assumptionLabels) as (keyof Assumptions)[]).filter(key=>key!=='units').map(key=><label key={key}>{assumptionLabels[key]}{key==='managementFeeBasis'?<select value={assumptions[key]} onChange={e=>setAssumptions({...assumptions,[key]:e.target.value})}><option>% of Total Offer</option><option>Fixed Amount</option></select>:<input type="number" min="0" max={percentKeys.includes(key)?(key==='marketingFeeCap'||key==='originatorRate'||key==='proposalOwnerRate'||key==='pitchSupportRate'?0.03:1):undefined} step="any" value={assumptions[key]} onChange={e=>setAssumptions({...assumptions,[key]:e.target.value})}/>}</label>)}
      </div></section>
      <section className={styles.panel}><div className={styles.panelHead}><span>03</span><div><h3>Komponen penawaran</h3><p>Saran mengikuti Component Library. Hanya perubahan yang lu lakukan di sini yang menimpa sel formula/default template.</p></div></div><div className={styles.componentList}>{rows.map(row=><details key={`${service}-${row.row}`} className={styles.component}><summary><span>{row.row-29 < 10 ? `0${row.row-29}`:row.row-29}</span><strong>{row.title||'Komponen custom / kosong'}</strong><small>{row.include} · {row.method}</small></summary><div className={styles.fields}>
        <label>Nama komponen<input value={row.title} onChange={e=>changeComponent(row.row,'title',e.target.value)} placeholder="Kosongkan bila tidak dipakai"/></label>
        <label>Scope / Deliverable<input value={row.scope} onChange={e=>changeComponent(row.row,'scope',e.target.value)}/></label>
        <label>Tipe<select value={row.type} onChange={e=>changeComponent(row.row,'type',e.target.value)}>{['Core','Optional','Custom'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Include Client<select value={row.include} onChange={e=>changeComponent(row.row,'include',e.target.value)}><option>YES</option><option>NO</option></select></label>
        <label>Pricing Method<select value={row.method} onChange={e=>changeComponent(row.row,'method',e.target.value)}>{methods.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Commercial Adjustment (desimal)<input type="number" min="0" step="any" value={row.adjustment} onChange={e=>changeComponent(row.row,'adjustment',e.target.value)} placeholder="Ikuti formula template"/></label>
        <label className={styles.wide}>Notes<input value={row.notes} onChange={e=>changeComponent(row.row,'notes',e.target.value)}/></label>
      </div></details>)}</div></section>
      <section className={styles.panel}><div className={styles.panelHead}><span>04</span><div><h3>RAB Internal · HPP</h3><p>Maksimal 30 baris. Detail biaya dan pemetaan komponen tetap terlihat dalam file hasil.</p></div></div><div className={styles.costList}>{costs.map((cost,index)=><div key={cost.row} className={styles.cost}><div className={styles.costHead}><strong>Biaya #{index+1}</strong><button type="button" onClick={()=>setCosts(old=>old.filter(c=>c.row!==cost.row).map((c,i)=>({...c,row:10+i})))} aria-label={`Hapus biaya ${index+1}`}><FiTrash2/> Hapus</button></div><div className={styles.fields}>
        <label>Client Component<select value={cost.component} onChange={e=>{const component=e.target.value;const option=costLibrary.find(c=>(c.service===service||c.service==='All')&&c.component===component);setCostsEdited(true);setCosts(old=>old.map(c=>c.row===cost.row?{...c,component,detail:option?.detail??''}:c));}} required><option value="">Pilih komponen</option>{rows.filter(r=>r.title).map(r=><option key={r.row} value={r.title}>{r.title}</option>)}</select></label>
        <label>Internal Cost Detail<select value={cost.detail} onChange={e=>changeCost(cost.row,'detail',e.target.value)} required><option value="">Pilih rincian dari Component Library</option>{costLibrary.filter(c=>(c.service===service||c.service==='All')&&c.component===cost.component).map((c,i)=><option key={`${c.detail}-${i}`} value={c.detail}>{c.detail}</option>)}</select></label>
        <label>Cost Class<input value={costLibrary.find(c=>(c.service===service||c.service==='All')&&c.detail===cost.detail)?.costClass??''} readOnly/></label>
        <label>Unit<input value={costLibrary.find(c=>(c.service===service||c.service==='All')&&c.detail===cost.detail)?.unit??''} readOnly/></label>
        <label>Qty<input type="number" min="0" step="any" value={cost.qty} onChange={e=>changeCost(cost.row,'qty',e.target.value)}/></label>
        <label>Days<input type="number" min="0" step="any" value={cost.days} onChange={e=>changeCost(cost.row,'days',e.target.value)}/></label>
        <label>HPP per Unit<input type="number" min="0" step="any" value={cost.rate} onChange={e=>changeCost(cost.row,'rate',e.target.value)}/></label>
        <label>Include Cost<select value={cost.include} onChange={e=>changeCost(cost.row,'include',e.target.value)}><option>YES</option><option>NO</option></select></label>
      </div></div>)}</div><button type="button" className={styles.add} onClick={addCost} disabled={costs.length>=30}><FiPlus/> Tambah baris HPP</button></section>
      <div className={styles.actions}><p>Periksa angka dan hasil rumus di Google Sheets sebelum penawaran dikirim ke client.</p><button type="submit" disabled={busy||!accountId||!state?.configured}>{busy?'Memproses…':'Generate RAB ke Google Sheets'} <FiArrowUpRight/></button></div>
    </form>
    {newUrl?<div className={styles.success}><strong>RAB baru siap.</strong><a href={newUrl} target="_blank" rel="noopener noreferrer">Buka Google Sheets <FiArrowUpRight/></a></div>:null}
    <section className={styles.history}><div className={styles.historyHead}><div><span className={styles.eyebrow}>RIWAYAT</span><h3>RAB terbaru</h3></div><button type="button" onClick={()=>void load()}><FiRefreshCw/> Muat ulang</button></div>{state?.history.length?<div className={styles.historyList}>{state.history.map(job=><article key={job.id}><div><strong>{job.project_name}</strong><small>{job.client_name} · {job.pricing_mode} · {new Date(job.created_at).toLocaleString('id-ID')}</small>{job.status==='failed'?<em>{job.error_message}</em>:null}</div><span data-status={job.status}>{job.status==='ready'?'Siap':job.status==='failed'?'Gagal':'Diproses'}</span>{job.status==='ready'&&job.drive_file_id?<><a href={`https://docs.google.com/spreadsheets/d/${job.drive_file_id}/edit`} target="_blank" rel="noopener noreferrer" aria-label={`Buka ${job.project_name}`}><FiArrowUpRight/></a><button type="button" onClick={()=>void download(job)} disabled={busy} aria-label={`Unduh Excel ${job.project_name}`}><FiDownload/></button><button type="button" onClick={()=>void submitApproval(job)} disabled={busy} title="Ajukan versi Google Sheet terkini ke COO">Ajukan approval</button></>:null}</article>)}</div>:<p className={styles.empty}>Belum ada RAB yang dibuat dari akun ini.</p>}</section>
    <section className={styles.history}><div className={styles.historyHead}><div><span className={styles.eyebrow}>APPROVAL</span><h3>Pengajuan & persetujuan</h3></div><button type="button" onClick={()=>void load()}><FiRefreshCw/> Muat ulang</button></div>{state?.approvals?.length?<div className={styles.historyList}>{state.approvals.map(item=>{const canAct=(state.actor==='coo'&&item.status==='pending_coo')||(state.actor==='ceo'&&item.status==='pending_ceo');const statusText:Record<string,string>={pending_coo:'Menunggu COO',pending_ceo:'Menunggu CEO',revision_requested:'Perlu revisi',rejected:'Ditolak',approved:'Disetujui COO & CEO'};const lastAction=state.approvalActions.filter(a=>a.request_id===item.id).at(-1);return <article key={item.id} className={styles.approvalItem}><div><strong>{item.project_name} · {item.client_name}</strong><small>{item.service_family} · {item.pricing_mode} · Diajukan {new Date(item.submitted_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB · oleh {item.requester_name}</small><small>Versi {item.source_hash.slice(0,12)}</small>{lastAction?.comment?<small>Catatan {lastAction.actor_position_key.toUpperCase()}: {lastAction.comment}</small>:null}</div><span data-status={item.status}>{statusText[item.status]}</span><button type="button" onClick={()=>openApprovalDocument(item)}>Dokumen / Print</button>{canAct?<div className={styles.approvalActions}><textarea aria-label={`Catatan persetujuan ${item.project_name}`} value={approvalNotes[item.id]??''} onChange={e=>setApprovalNotes(old=>({...old,[item.id]:e.target.value}))} placeholder="Catatan wajib untuk revisi atau penolakan"/><button type="button" disabled={busy} onClick={()=>void decideApproval(item,'approved')}>Setujui</button><button type="button" disabled={busy} onClick={()=>void decideApproval(item,'revision_requested')}>Minta revisi</button><button type="button" disabled={busy} onClick={()=>void decideApproval(item,'rejected')}>Tolak</button></div>:null}</article>})}</div>:<p className={styles.empty}>Belum ada RAB yang diajukan. Setelah sheet final direview, ajukan dari daftar RAB di atas.</p>}</section>
  </section>;
}
