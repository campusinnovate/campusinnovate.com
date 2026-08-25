'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FiArchive, FiArrowLeft, FiCheck, FiEdit3, FiGrid, FiPlus, FiRefreshCw, FiSearch, FiStar, FiTrash2, FiX } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';

type Note = { id:string; owner_membership_id:string; title:string|null; content:string; tags:string[]; color:'yellow'|'blue'|'green'|'pink'|'plain'; is_pinned:boolean; archived_at:string|null; created_at:string; updated_at:string };
type NoteForm = { id:string|null; title:string; content:string; tags:string; color:Note['color']; isPinned:boolean };
type PersonalSpreadsheet = { id:string; drive_file_id:string; drive_file_url:string; embed_url:string; status:'ready'|'error' };
const emptyForm = ():NoteForm => ({ id:null,title:'',content:'',tags:'',color:'yellow',isPinned:false });

export default function NotesPage(){
  const [state,setState]=useState<'loading'|'ready'|'denied'>('loading');
  const [membershipId,setMembershipId]=useState('');
  const [notes,setNotes]=useState<Note[]>([]);
  const [query,setQuery]=useState('');
  const [showArchived,setShowArchived]=useState(false);
  const [form,setForm]=useState<NoteForm>(emptyForm());
  const [open,setOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [sheet,setSheet]=useState<PersonalSpreadsheet|null>(null);
  const [sheetLoading,setSheetLoading]=useState(false);

  async function loadSpreadsheet(create=false){
    setSheetLoading(true); const supabase=createClient();
    const session=(await supabase.auth.getSession()).data.session;
    if(!session){setSheetLoading(false);return;}
    try{
      const response=await fetch('https://lxwqhtuhlddgwfxjtlas.supabase.co/functions/v1/ruang-kawan-calendar/workspace/personal-spreadsheet',{method:create?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`}});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error??'Spreadsheet belum dapat dimuat.');
      setSheet(result.sheet??null);
    }catch(sheetError){setError(sheetError instanceof Error?sheetError.message:'Spreadsheet belum dapat dimuat.');}
    finally{setSheetLoading(false);}
  }

  async function load(){
    setError(''); const supabase=createClient();
    const {data:{session}}=await supabase.auth.getSession(); if(!session){window.location.replace('/ruang-kawan/');return;}
    const [accessResult,membershipResult]=await Promise.all([supabase.rpc('get_my_access'),supabase.rpc('current_membership_id')]);
    const access=Array.isArray(accessResult.data)?accessResult.data[0]:accessResult.data;
    if(!access?.permissions?.includes('notes.manage_self')){setState('denied');return;}
    const memberId=membershipResult.data as string; setMembershipId(memberId);
    const result=await supabase.from('personal_notes').select('*').eq('owner_membership_id',memberId).order('is_pinned',{ascending:false}).order('updated_at',{ascending:false});
    if(result.error)setError('Coret-coret belum dapat dimuat.'); else setNotes((result.data??[]) as Note[]); setState('ready'); void loadSpreadsheet(false);
  }
  useEffect(()=>{void load();},[]);
  const visible=useMemo(()=>notes.filter(note=>Boolean(note.archived_at)===showArchived).filter(note=>`${note.title??''} ${note.content} ${note.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())),[notes,query,showArchived]);
  function edit(note?:Note){setMessage('');setError('');setForm(note?{id:note.id,title:note.title??'',content:note.content,tags:note.tags.join(', '),color:note.color,isPinned:note.is_pinned}:emptyForm());setOpen(true);}
  async function save(event:FormEvent){event.preventDefault();if(!membershipId||(!form.title.trim()&&!form.content.trim()))return;setSaving(true);setError('');
    const payload={owner_membership_id:membershipId,title:form.title.trim()||null,content:form.content.trim(),tags:form.tags.split(',').map(x=>x.trim()).filter(Boolean).slice(0,10),color:form.color,is_pinned:form.isPinned,updated_at:new Date().toISOString()};
    const result=form.id?await createClient().from('personal_notes').update(payload).eq('id',form.id):await createClient().from('personal_notes').insert(payload);
    setSaving(false);if(result.error){setError(result.error.message);return;}setOpen(false);setMessage('Catatan pribadi tersimpan.');await load();
  }
  async function updateNote(id:string,changes:Partial<Note>){const {error:updateError}=await createClient().from('personal_notes').update({...changes,updated_at:new Date().toISOString()}).eq('id',id);if(updateError)setError('Catatan belum berhasil diperbarui.');else await load();}
  async function remove(){if(!form.id||!window.confirm('Hapus permanen catatan ini?'))return;setSaving(true);const {error:deleteError}=await createClient().from('personal_notes').delete().eq('id',form.id);setSaving(false);if(deleteError)setError('Catatan belum berhasil dihapus.');else{setOpen(false);await load();}}
  async function convertToActivity(note:Note){
    const source=await createClient().from('work_sources').select('id').eq('key','manual_activity').single();if(source.error){setError('Sumber Activity Manual tidak ditemukan.');return;}
    const result=await createClient().from('activities').insert({owner_membership_id:membershipId,source_id:source.data.id,title:note.title||note.content.slice(0,80)||'Catatan baru',activity_date:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'}),detail:note.content||null,priority:'medium',status:'not_started',progress:0});
    if(result.error)setError('Catatan belum berhasil dijadikan aktivitas.');else setMessage('Aktivitas dibuat. Catatan asli tetap tersimpan.');
  }
  if(state==='loading')return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><p>Menyiapkan Coret-coret...</p></section></main>;
  if(state==='denied')return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><h1>Coret-coret belum tersedia</h1><Link href="/ruang-kawan/activity/">Kembali ke My Activity</Link></section></main>;
  return <main className="rk-work-foundation"><section className="rk-work-shell">
    <nav className="rk-work-nav"><Link href="/ruang-kawan/activity/"><FiArrowLeft/> My Activity</Link><button onClick={()=>setShowArchived(!showArchived)}><FiArchive/> {showArchived?'Catatan aktif':'Arsip'}</button></nav>
    <header className="rk-work-heading"><div><small>Ruang pribadi</small><h1>Coret-coret</h1><p>Brainstorm, simpan ide, dan catat hal penting. Hanya kamu yang dapat melihat isinya.</p></div><button onClick={()=>edit()}><FiPlus/> Catatan baru</button></header>
    <section className="rk-note-tools"><label><FiSearch/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari catatan atau tag..."/></label><span>{visible.length} catatan</span></section>
    {message?<p className="rk-work-alert">{message}</p>:null}{error?<p className="rk-work-alert" data-error>{error}</p>:null}
    <section className="rk-notes-grid">{visible.map(note=><article key={note.id} data-color={note.color}><header><button aria-label="Pin" onClick={()=>void updateNote(note.id,{is_pinned:!note.is_pinned})} data-active={note.is_pinned}><FiStar/></button><small>{new Date(note.updated_at).toLocaleDateString('id-ID',{day:'numeric',month:'short'})}</small></header><button className="rk-note-body" onClick={()=>edit(note)}><h2>{note.title||'Tanpa judul'}</h2><p>{note.content||'Catatan kosong'}</p></button><footer><span>{note.tags.slice(0,3).map(tag=><i key={tag}>#{tag}</i>)}</span><div><button title="Jadikan aktivitas" onClick={()=>void convertToActivity(note)}><FiCheck/></button><button title={note.archived_at?'Aktifkan':'Arsipkan'} onClick={()=>void updateNote(note.id,{archived_at:note.archived_at?null:new Date().toISOString()})}><FiArchive/></button><button title="Ubah" onClick={()=>edit(note)}><FiEdit3/></button></div></footer></article>)}{!visible.length?<div className="rk-work-empty"><FiEdit3/><strong>{showArchived?'Belum ada arsip':'Mulai dari satu ide'}</strong><p>Catatan tersimpan privat dan dapat dijadikan aktivitas saat siap dikerjakan.</p></div>:null}</section>
    <section className="rk-sheet-widget"><header><div><small>Spreadsheet pribadi</small><h2><FiGrid/> Lembar kerja Coret-coret</h2><p>Hitung, susun tabel, dan brainstorm langsung di halaman ini. Hanya akunmu yang mendapat akses edit.</p></div>{sheet?<button onClick={()=>void loadSpreadsheet(false)} disabled={sheetLoading}><FiRefreshCw/> Muat ulang</button>:<button onClick={()=>void loadSpreadsheet(true)} disabled={sheetLoading}><FiPlus/> {sheetLoading?'Menyiapkan...':'Buat spreadsheet'}</button>}</header>{sheet?<iframe title="Spreadsheet pribadi Coret-coret" src={sheet.embed_url} allow="clipboard-read; clipboard-write"/>:<div><FiGrid/><strong>Belum ada spreadsheet pribadi</strong><p>Buat satu kali; berikutnya lembar kerja akan langsung tampil di bawah catatan.</p></div>}</section>
  </section>{open?<div className="rk-work-modal" role="dialog" aria-modal="true"><form onSubmit={save}><header><div><small>Catatan pribadi</small><h2>{form.id?'Ubah coretan':'Coretan baru'}</h2></div><button type="button" onClick={()=>setOpen(false)}><FiX/></button></header><div className="rk-work-form"><label>Judul<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} maxLength={180}/></label><label>Isi<textarea value={form.content} onChange={e=>setForm({...form,content:e.target.value})} autoFocus rows={12}/></label><label>Tag, pisahkan dengan koma<input value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})}/></label><div className="rk-note-options"><label>Warna<select value={form.color} onChange={e=>setForm({...form,color:e.target.value as Note['color']})}><option value="yellow">Kuning</option><option value="blue">Biru</option><option value="green">Hijau</option><option value="pink">Merah muda</option><option value="plain">Putih</option></select></label><label data-check><input type="checkbox" checked={form.isPinned} onChange={e=>setForm({...form,isPinned:e.target.checked})}/> Pin catatan</label></div></div><footer>{form.id?<button type="button" data-danger onClick={()=>void remove()}><FiTrash2/> Hapus</button>:<span/>}<div><button type="button" onClick={()=>setOpen(false)}>Batal</button><button data-primary disabled={saving}>{saving?'Menyimpan...':'Simpan'}</button></div></footer></form></div>:null}</main>;
}
