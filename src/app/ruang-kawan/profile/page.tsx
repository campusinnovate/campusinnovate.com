'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiBriefcase, FiCreditCard, FiEdit3, FiKey, FiPhone, FiRefreshCw, FiSearch, FiShield, FiUser, FiUsers, FiX } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';

type Employee = {
  membership_id: string; full_name: string; email: string; avatar_url: string | null;
  position_name: string | null; department_name: string | null; engagement_type: string;
  preferred_name: string | null; phone: string | null; address: string | null; city: string | null;
  birth_date: string | null; employment_start_date: string | null;
  emergency_contact_name: string | null; emergency_contact_phone: string | null;
  administrative_id: string | null; tax_id: string | null;
  bank_name: string | null; bank_branch: string | null; bank_account_number: string | null; bank_account_holder: string | null;
  employee_document_urls: string[]; administrative_notes: string | null; updated_at: string | null;
};

type FormState = {
  full_name: string; preferred_name: string; phone: string; address: string; city: string;
  birth_date: string; employment_start_date: string; emergency_contact_name: string; emergency_contact_phone: string;
  administrative_id: string; tax_id: string; bank_name: string; bank_branch: string;
  bank_account_number: string; bank_account_holder: string; employee_document_urls: string; administrative_notes: string;
};
type AccessSummary = { membership_status:string; roles:string[]; permissions:string[]; position_name:string|null; department_name:string|null; engagement_type:string|null };

const engagementLabels: Record<string,string> = { employee: 'Karyawan', freelance: 'Freelance', contractor: 'Kontraktor', intern: 'Magang' };
const toForm = (member: Employee): FormState => ({
  full_name: member.full_name ?? '', preferred_name: member.preferred_name ?? '', phone: member.phone ?? '',
  address: member.address ?? '', city: member.city ?? '', birth_date: member.birth_date ?? '', employment_start_date: member.employment_start_date ?? '',
  emergency_contact_name: member.emergency_contact_name ?? '', emergency_contact_phone: member.emergency_contact_phone ?? '',
  administrative_id: member.administrative_id ?? '', tax_id: member.tax_id ?? '', bank_name: member.bank_name ?? '', bank_branch: member.bank_branch ?? '',
  bank_account_number: member.bank_account_number ?? '', bank_account_holder: member.bank_account_holder ?? '',
  employee_document_urls: (member.employee_document_urls ?? []).join('\n'), administrative_notes: member.administrative_notes ?? '',
});

export default function EmployeeProfilePage() {
  const [state,setState]=useState<'loading'|'ready'|'denied'>('loading');
  const [members,setMembers]=useState<Employee[]>([]); const [myId,setMyId]=useState(''); const [canManage,setCanManage]=useState(false);
  const [selected,setSelected]=useState<Employee|null>(null); const [form,setForm]=useState<FormState|null>(null); const [editing,setEditing]=useState(false);
  const [query,setQuery]=useState(''); const [saving,setSaving]=useState(false); const [error,setError]=useState(''); const [message,setMessage]=useState('');
  const [access,setAccess]=useState<AccessSummary|null>(null); const [newPassword,setNewPassword]=useState(''); const [confirmPassword,setConfirmPassword]=useState(''); const [passwordBusy,setPasswordBusy]=useState(false); const [passwordMessage,setPasswordMessage]=useState(''); const [passwordError,setPasswordError]=useState('');

  async function load(preferredId?: string) {
    setError(''); const supabase=createClient(); const {data:{session}}=await supabase.auth.getSession();
    if(!session){window.location.replace('/ruang-kawan/');return;}
    const [{data,error:loadError},accessResult]=await Promise.all([supabase.rpc('employee_directory'),supabase.rpc('get_my_access')]);
    if(loadError){setState('denied');return;} const accessValue=(Array.isArray(accessResult.data)?accessResult.data[0]:accessResult.data) as AccessSummary|null;setAccess(accessValue);
    const payload=data as {my_membership_id:string;can_manage:boolean;members:Employee[]};
    setMembers(payload.members??[]);setMyId(payload.my_membership_id);setCanManage(payload.can_manage);
    const target=(payload.members??[]).find(item=>item.membership_id===(preferredId??selected?.membership_id??payload.my_membership_id))??payload.members?.[0]??null;
    setSelected(target);setForm(target?toForm(target):null);setState('ready');
  }
  useEffect(()=>{void load();},[]);
  const filtered=useMemo(()=>members.filter(member=>`${member.full_name} ${member.email} ${member.position_name??''} ${member.department_name??''}`.toLowerCase().includes(query.toLowerCase())),[members,query]);
  const canEdit=Boolean(selected&&(selected.membership_id===myId||canManage));
  function choose(member:Employee){setSelected(member);setForm(toForm(member));setEditing(false);setError('');setMessage('');}
  async function save(event:FormEvent){event.preventDefault();if(!selected||!form)return;setSaving(true);setError('');setMessage('');
    const urls=form.employee_document_urls.split('\n').map(value=>value.trim()).filter(Boolean);
    const {error:saveError}=await createClient().rpc('save_employee_profile',{target_membership_id:selected.membership_id,payload:{...form,employee_document_urls:urls}});
    setSaving(false);if(saveError){setError(saveError.message);return;}setMessage('Profil dan informasi rekening berhasil disimpan.');setEditing(false);await load(selected.membership_id);
  }
  async function savePassword(event:FormEvent<HTMLFormElement>){event.preventDefault();setPasswordError('');setPasswordMessage('');if(newPassword.length<8){setPasswordError('Password minimal 8 karakter.');return}if(newPassword!==confirmPassword){setPasswordError('Konfirmasi password belum sama.');return}setPasswordBusy(true);const{error:updateError}=await createClient().auth.updateUser({password:newPassword});setPasswordBusy(false);if(updateError){setPasswordError('Password belum berhasil disimpan. Silakan coba kembali.');return}setNewPassword('');setConfirmPassword('');setPasswordMessage('Password berhasil diperbarui. Login Google tetap dapat digunakan.')}
  const maskAccount=(value:string|null)=>{if(!value)return '—';if(canManage||selected?.membership_id===myId)return value;const compact=value.replace(/\s/g,'');return compact.length<=4?'•'.repeat(compact.length):`•••• •••• ${compact.slice(-4)}`};
  if(state==='loading')return <main className="rk-profile-foundation"><section className="rk-access-denied"><p>Menyiapkan profil pegawai...</p></section></main>;
  if(state==='denied')return <main className="rk-profile-foundation"><section className="rk-access-denied"><FiShield/><h1>Direktori pegawai belum tersedia</h1><p>Akun ini belum memiliki akses internal aktif.</p><Link href="/ruang-kawan/dashboard/">Kembali</Link></section></main>;
  return <main className="rk-profile-foundation"><section className="rk-profile-shell">
    <nav className="rk-profile-nav"><Link href="/ruang-kawan/dashboard/"><FiArrowLeft/> Dashboard</Link><button onClick={()=>void load()}><FiRefreshCw/> Muat ulang</button></nav>
    <header className="rk-profile-heading rk-glossy-hero"><div className="rk-hero-ring" aria-hidden="true"/><div className="rk-hero-square" aria-hidden="true"/><div><small>People &amp; account</small><h1>Profil Pegawai</h1><p>Profil kerja, kontak internal, informasi administratif, rekening, dan keamanan akun.</p></div><span><FiUsers/><b>{members.length}</b><small>anggota aktif</small></span></header>
    {error?<p className="rk-profile-alert" data-error>{error}</p>:null}{message?<p className="rk-profile-alert">{message}</p>:null}
    <section className="rk-profile-layout">
      <aside className="rk-profile-directory"><label><FiSearch/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Cari nama, posisi, atau departemen"/></label><div>{filtered.map(member=><button key={member.membership_id} data-active={selected?.membership_id===member.membership_id} onClick={()=>choose(member)}><span>{member.avatar_url?<img src={member.avatar_url} alt=""/>:<FiUser/>}</span><div><strong>{member.preferred_name||member.full_name}</strong><small>{member.position_name||'Posisi belum ditetapkan'}</small><em>{member.department_name||'Departemen belum ditetapkan'}</em></div>{member.membership_id===myId?<b>Saya</b>:null}</button>)}{!filtered.length?<p>Anggota tidak ditemukan.</p>:null}</div></aside>
      <section className="rk-profile-detail">{selected&&form?<>
        <header><div><small>{engagementLabels[selected.engagement_type]||selected.engagement_type}</small><h2>{selected.full_name}</h2><p>{selected.email} · {selected.position_name||'Posisi belum ditetapkan'} · {selected.department_name||'Departemen belum ditetapkan'}</p></div>{canEdit?<button onClick={()=>setEditing(value=>!value)}>{editing?<><FiX/> Tutup</>:<><FiEdit3/> Ubah profil</>}</button>:null}</header>
        {!editing?<div className="rk-profile-summary">
          <article><header><FiBriefcase/><h3>Informasi kerja</h3></header><dl><dt>Nama panggilan</dt><dd>{selected.preferred_name||'—'}</dd><dt>Mulai bergabung</dt><dd>{selected.employment_start_date?new Date(`${selected.employment_start_date}T12:00:00`).toLocaleDateString('id-ID'):'—'}</dd><dt>ID administratif</dt><dd>{selected.administrative_id||'—'}</dd><dt>NPWP / Tax ID</dt><dd>{selected.tax_id||'—'}</dd></dl></article>
          <article><header><FiPhone/><h3>Kontak</h3></header><dl><dt>Telepon</dt><dd>{selected.phone||'—'}</dd><dt>Kota</dt><dd>{selected.city||'—'}</dd><dt>Alamat</dt><dd>{selected.address||'—'}</dd><dt>Kontak darurat</dt><dd>{selected.emergency_contact_name?`${selected.emergency_contact_name} · ${selected.emergency_contact_phone||'-'}`:'—'}</dd></dl></article>
          <article className="rk-profile-bank"><header><FiCreditCard/><h3>Rekening pembayaran</h3></header><strong>{selected.bank_name||'Bank belum diisi'}</strong><code>{maskAccount(selected.bank_account_number)}</code><p>{selected.bank_account_holder||'Nama pemilik belum diisi'}{selected.bank_branch?` · ${selected.bank_branch}`:''}</p></article>
          <article><header><FiShield/><h3>Administrasi</h3></header><dl><dt>Tanggal lahir</dt><dd>{selected.birth_date?new Date(`${selected.birth_date}T12:00:00`).toLocaleDateString('id-ID'):'—'}</dd><dt>Dokumen</dt><dd>{selected.employee_document_urls?.length?selected.employee_document_urls.map((url,index)=><a key={url} href={url} target="_blank" rel="noreferrer">Dokumen {index+1}</a>):'—'}</dd><dt>Catatan</dt><dd>{selected.administrative_notes||'—'}</dd></dl></article>
        </div>:<form className="rk-profile-form" onSubmit={save}>
          <fieldset><legend>Identitas dan kontak</legend><label>Nama lengkap<input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></label><label>Nama panggilan<input value={form.preferred_name} onChange={e=>setForm({...form,preferred_name:e.target.value})}/></label><label>Telepon<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>Kota<input value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label><label className="wide">Alamat<textarea value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label><label>Tanggal lahir<input type="date" value={form.birth_date} onChange={e=>setForm({...form,birth_date:e.target.value})}/></label><label>Mulai bergabung<input type="date" value={form.employment_start_date} onChange={e=>setForm({...form,employment_start_date:e.target.value})}/></label></fieldset>
          <fieldset><legend>Darurat dan administrasi</legend><label>Nama kontak darurat<input value={form.emergency_contact_name} onChange={e=>setForm({...form,emergency_contact_name:e.target.value})}/></label><label>Telepon darurat<input value={form.emergency_contact_phone} onChange={e=>setForm({...form,emergency_contact_phone:e.target.value})}/></label><label>ID administratif<input value={form.administrative_id} onChange={e=>setForm({...form,administrative_id:e.target.value})}/></label><label>NPWP / Tax ID<input value={form.tax_id} onChange={e=>setForm({...form,tax_id:e.target.value})}/></label></fieldset>
          <fieldset><legend>Rekening pembayaran</legend><label>Bank<input value={form.bank_name} onChange={e=>setForm({...form,bank_name:e.target.value})}/></label><label>Cabang<input value={form.bank_branch} onChange={e=>setForm({...form,bank_branch:e.target.value})}/></label><label>Nomor rekening<input value={form.bank_account_number} onChange={e=>setForm({...form,bank_account_number:e.target.value})}/></label><label>Nama pemilik<input value={form.bank_account_holder} onChange={e=>setForm({...form,bank_account_holder:e.target.value})}/></label></fieldset>
          <fieldset><legend>Dokumen dan catatan</legend><label className="wide">URL dokumen — satu URL per baris<textarea value={form.employee_document_urls} onChange={e=>setForm({...form,employee_document_urls:e.target.value})}/></label><label className="wide">Catatan administratif<textarea value={form.administrative_notes} onChange={e=>setForm({...form,administrative_notes:e.target.value})}/></label></fieldset>
          <footer><button type="button" onClick={()=>{setForm(toForm(selected));setEditing(false);}}>Batal</button><button data-primary disabled={saving}>{saving?'Menyimpan...':'Simpan profil'}</button></footer>
        </form>}
        {selected.membership_id===myId&&!editing?<section className="rk-profile-account-panel"><article><small>STATUS AKUN</small><h3>{access?.position_name||selected.position_name||'Anggota Ruang Kawan'}</h3><p>{access?.roles?.length?access.roles.join(' · '):'Akses dasar'} · {access?.engagement_type||selected.engagement_type}</p></article><form onSubmit={savePassword}><header><FiKey/><div><small>KEAMANAN AKUN</small><h3>Buat atau ubah password</h3></div></header><p>Setelah disimpan, kamu tetap bisa login menggunakan Google maupun email dan password.</p><label>Password baru<input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={event=>setNewPassword(event.target.value)} required/></label><label>Ulangi password<input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} required/></label>{passwordError?<p className="rk-password-error" role="alert">{passwordError}</p>:null}{passwordMessage?<p className="rk-password-success">{passwordMessage}</p>:null}<button disabled={passwordBusy}>{passwordBusy?'Menyimpan...':'Simpan password'}</button></form></section>:null}
      </>:<p className="rk-profile-empty">Pilih anggota untuk melihat profil.</p>}</section>
    </section>
  </section></main>;
}
