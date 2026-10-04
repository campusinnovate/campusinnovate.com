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
type Assumptions = { targetMargin:string; managementFeeBasis:string; managementFeeRate:string; managementFeeFixed:string; overhead:string; commission:string; tax:string; vat:string; units:string };
type State = { configured:boolean; accounts:Account[]; history:History[] };
const services=['EO / Event','Program Development','Website / System','Creative / Media','Custom'];
const modes=['Hybrid','Fixed Package','Open-book'];
const methods=['Package','Hybrid','Pass-through','Fixed / Retainer','Fee'];
const percentKeys: (keyof Assumptions)[]=['targetMargin','managementFeeRate','overhead','commission','tax','vat'];
const assumptionLabels: Record<keyof Assumptions,string>={targetMargin:'Target Project Margin',managementFeeBasis:'Management Fee Basis',managementFeeRate:'Management Fee Rate',managementFeeFixed:'Management Fee Fixed Amount',overhead:'Corporate Overhead (% HPP)',commission:'Sales / BD Commission (% Revenue)',tax:'Project Tax & Other (% Revenue)',vat:'VAT / PPN (% Invoice)',units:'Units / Participants'};
const initialAssumptions:Assumptions={targetMargin:'0.3',managementFeeBasis:'% of Total Offer',managementFeeRate:'0.15',managementFeeFixed:'0',overhead:'0.05',commission:'0.03',tax:'0',vat:'0',units:'0'};

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

export default function RabGenerator(){
  const [state,setState]=useState<State|null>(null);
  const [accountId,setAccountId]=useState('');
  const [library,setLibrary]=useState<LibraryRow[]>([]);
  const [service,setService]=useState('EO / Event');
  const [mode,setMode]=useState('Open-book');
  const [project,setProject]=useState('');
  const [client,setClient]=useState('');
  const [proposal,setProposal]=useState('OFF-000');
  const [assumptions,setAssumptions]=useState(initialAssumptions);
  const [components,setComponents]=useState<Component[]>([]);
  const [costs,setCosts]=useState<Cost[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [newUrl,setNewUrl]=useState('');

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
      setService(data.serviceFamily??'EO / Event');setMode(data.pricingMode??'Open-book');setProposal(String(data.proposalNumber??'OFF-000'));
      const values=data.assumptions??[];
      setAssumptions({targetMargin:String(values[0]?.[0]??0.3),managementFeeBasis:String(values[1]?.[0]??'% of Total Offer'),managementFeeRate:String(values[2]?.[0]??0.15),managementFeeFixed:String(values[3]?.[0]??0),overhead:String(values[4]?.[0]??0.05),commission:String(values[5]?.[0]??0.03),tax:String(values[6]?.[0]??0),vat:String(values[7]?.[0]??0),units:String(data.units??0)});
      setComponents([]);setCosts([]);
    }).catch(e=>{if(live)setError(e instanceof Error?e.message:'Template tidak tersedia.');});
    return()=>{live=false};
  },[accountId]);
  const suggestions=useMemo(()=>library.filter(row=>row[0]===service).slice(0,12),[library,service]);
  const rows=useMemo(()=>Array.from({length:12},(_,i)=>{
    const override=components.find(x=>x.row===30+i);
    const source=suggestions[i];
    return override??{row:30+i,title:String(source?.[1]??''),scope:String(source?.[2]??''),type:String(source?.[3]??'Optional'),include:String(source?.[4]??'NO'),method:String(source?.[5]??'Package'),adjustment:'',notes:'',changes:{}};
  }),[components,suggestions]);
  function changeComponent(row:number,key:keyof Omit<Component,'row'|'changes'>,value:string){
    const current=rows[row-30];
    setComponents(old=>[...old.filter(x=>x.row!==row),{...current,[key]:value,changes:{...current.changes,[key]:key==='adjustment'&&value!==''?Number(value):value}}]);
  }
  function changeCost(row:number,key:keyof Cost,value:string){setCosts(old=>old.map(c=>c.row===row?{...c,[key]:value}:c));}
  function addCost(){if(costs.length>=30)return;setCosts(old=>[...old,{row:10+old.length,component:'',detail:'',costClass:'',unit:'',qty:'1',days:'1',rate:'0',include:'YES'}]);}
  async function authorize(){setBusy(true);setError('');try{const data=await request('authorize');window.location.assign(data.url);}catch(e){setError(e instanceof Error?e.message:'Koneksi gagal.');setBusy(false);}}
  async function generate(event:FormEvent){
    event.preventDefault();setBusy(true);setError('');setNewUrl('');
    try{
      const numbers=Object.fromEntries(Object.entries(assumptions).map(([key,value])=>[key,key==='managementFeeBasis'?value:inputNumber(value,assumptionLabels[key as keyof Assumptions],percentKeys.includes(key as keyof Assumptions)?1:1e12)]));
      const payload={projectName:project,clientName:client,serviceFamily:service,pricingMode:mode,proposalNumber:proposal,assumptions:numbers,
        components:components.filter(x=>Object.keys(x.changes).length).map(x=>({row:x.row,changes:x.changes})),
        costs:costs.filter(c=>c.detail.trim()).map(c=>({row:c.row,component:c.component,detail:c.detail,costClass:c.costClass,unit:c.unit,qty:inputNumber(c.qty,'Qty'),days:inputNumber(c.days,'Days'),rate:inputNumber(c.rate,'HPP per unit'),include:c.include}))};
      const result=await request('generate',{connectionId:accountId,payload});setNewUrl(result.url);setMessage('RAB berhasil dibuat dan disimpan di Drive Campus Innovate.');await load();
    }catch(e){setError(e instanceof Error?e.message:'Gagal membuat RAB.');}
    finally{setBusy(false);}
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
        <label>Service Family<select value={service} onChange={e=>{setService(e.target.value);setComponents([]);setCosts([]);}}>{services.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Pricing Mode<select value={mode} onChange={e=>setMode(e.target.value)}>{modes.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Nomor penawaran<input value={proposal} onChange={e=>setProposal(e.target.value)} maxLength={80} required/></label>
        <label>Units / Participants<input type="number" min="0" step="any" value={assumptions.units} onChange={e=>setAssumptions({...assumptions,units:e.target.value})}/></label>
      </div></section>
      <section className={styles.panel}><div className={styles.panelHead}><span>02</span><div><h3>Asumsi komersial</h3><p>Persentase ditulis sebagai desimal: 0,30 berarti 30%.</p></div></div><div className={styles.fields}>
        {(Object.keys(assumptionLabels) as (keyof Assumptions)[]).filter(key=>key!=='units').map(key=><label key={key}>{assumptionLabels[key]}{key==='managementFeeBasis'?<select value={assumptions[key]} onChange={e=>setAssumptions({...assumptions,[key]:e.target.value})}><option>% of Total Offer</option><option>Fixed Amount</option></select>:<input type="number" min="0" max={percentKeys.includes(key)?1:undefined} step="any" value={assumptions[key]} onChange={e=>setAssumptions({...assumptions,[key]:e.target.value})}/>}</label>)}
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
        <label>Client Component<select value={cost.component} onChange={e=>changeCost(cost.row,'component',e.target.value)} required><option value="">Pilih komponen</option>{rows.filter(r=>r.title).map(r=><option key={r.row} value={r.title}>{r.title}</option>)}</select></label>
        <label>Internal Cost Detail<input value={cost.detail} onChange={e=>changeCost(cost.row,'detail',e.target.value)} required placeholder="Contoh: Venue dan perlengkapan"/></label>
        <label>Cost Class<select value={cost.costClass} onChange={e=>changeCost(cost.row,'costClass',e.target.value)}><option value="">Ikuti lookup template</option>{['Vendor','Internal Delivery','Direct Labor','Material','Other'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Unit<input value={cost.unit} onChange={e=>changeCost(cost.row,'unit',e.target.value)} placeholder="Ikuti lookup template"/></label>
        <label>Qty<input type="number" min="0" step="any" value={cost.qty} onChange={e=>changeCost(cost.row,'qty',e.target.value)}/></label>
        <label>Days<input type="number" min="0" step="any" value={cost.days} onChange={e=>changeCost(cost.row,'days',e.target.value)}/></label>
        <label>HPP per Unit<input type="number" min="0" step="any" value={cost.rate} onChange={e=>changeCost(cost.row,'rate',e.target.value)}/></label>
        <label>Include Cost<select value={cost.include} onChange={e=>changeCost(cost.row,'include',e.target.value)}><option>YES</option><option>NO</option></select></label>
      </div></div>)}</div><button type="button" className={styles.add} onClick={addCost} disabled={costs.length>=30}><FiPlus/> Tambah baris HPP</button></section>
      <div className={styles.actions}><p>Periksa angka dan hasil rumus di Google Sheets sebelum penawaran dikirim ke client.</p><button type="submit" disabled={busy||!accountId||!state?.configured}>{busy?'Memproses…':'Generate RAB ke Google Sheets'} <FiArrowUpRight/></button></div>
    </form>
    {newUrl?<div className={styles.success}><strong>RAB baru siap.</strong><a href={newUrl} target="_blank" rel="noopener noreferrer">Buka Google Sheets <FiArrowUpRight/></a></div>:null}
    <section className={styles.history}><div className={styles.historyHead}><div><span className={styles.eyebrow}>RIWAYAT MILIK LU</span><h3>RAB terbaru</h3></div><button type="button" onClick={()=>void load()}><FiRefreshCw/> Muat ulang</button></div>{state?.history.length?<div className={styles.historyList}>{state.history.map(job=><article key={job.id}><div><strong>{job.project_name}</strong><small>{job.client_name} · {job.pricing_mode} · {new Date(job.created_at).toLocaleString('id-ID')}</small>{job.status==='failed'?<em>{job.error_message}</em>:null}</div><span data-status={job.status}>{job.status==='ready'?'Siap':job.status==='failed'?'Gagal':'Diproses'}</span>{job.status==='ready'&&job.drive_file_id?<><a href={`https://docs.google.com/spreadsheets/d/${job.drive_file_id}/edit`} target="_blank" rel="noopener noreferrer" aria-label={`Buka ${job.project_name}`}><FiArrowUpRight/></a><button type="button" onClick={()=>void download(job)} disabled={busy} aria-label={`Unduh Excel ${job.project_name}`}><FiDownload/></button></>:null}</article>)}</div>:<p className={styles.empty}>Belum ada RAB yang dibuat dari akun ini.</p>}</section>
  </section>;
}
