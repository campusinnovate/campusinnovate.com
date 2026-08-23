'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { FiArrowLeft, FiEdit3, FiLayers, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';

type Reference = { roles: { key: string; name: string }[]; positions: { key: string; name: string }[] };
type Field = { key: string; label: string; type: 'text' | 'number' | 'date' | 'url' | 'textarea' };
type Source = {
  id: string; key: string; name: string; description: string | null; color: string; icon: string;
  source_kind: string; field_schema: Field[]; allowed_role_keys: string[]; allowed_position_keys: string[];
  is_active: boolean; sort_order: number;
};
type FormState = Omit<Source, 'id' | 'source_kind'> & { id: string | null };

const blankForm = (): FormState => ({ id: null, key: '', name: '', description: '', color: '#315c4f', icon: 'activity', field_schema: [], allowed_role_keys: [], allowed_position_keys: [], is_active: true, sort_order: 100 });

export default function WorkSourcesAdminPage() {
  const [state, setState] = useState<'loading' | 'ready' | 'denied'>('loading');
  const [reference, setReference] = useState<Reference>({ roles: [], positions: [] });
  const [sources, setSources] = useState<Source[]>([]);
  const [form, setForm] = useState<FormState>(blankForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadData() {
    setError('');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.replace('/ruang-kawan/'); return; }
    const { data: accessData } = await supabase.rpc('get_my_access');
    const access = Array.isArray(accessData) ? accessData[0] : accessData;
    if (!access?.permissions?.includes('work_sources.manage')) { setState('denied'); return; }
    const [referenceResult, sourcesResult] = await Promise.all([
      supabase.rpc('admin_access_reference'),
      supabase.rpc('admin_list_work_sources'),
    ]);
    if (referenceResult.error || sourcesResult.error) {
      setError('Sumber kerja belum dapat dimuat.'); setState('ready'); return;
    }
    setReference(referenceResult.data as Reference);
    setSources((sourcesResult.data ?? []) as Source[]);
    setState('ready');
  }

  useEffect(() => { void loadData(); }, []);

  function toggle(list: string[], key: string) { return list.includes(key) ? list.filter((item) => item !== key) : [...list, key]; }
  function addField() { setForm({ ...form, field_schema: [...form.field_schema, { key: '', label: '', type: 'text' }] }); }
  function updateField(index: number, patch: Partial<Field>) { setForm({ ...form, field_schema: form.field_schema.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...patch } : field) }); }
  function editSource(source: Source) { setForm({ ...source, description: source.description ?? '' }); setError(''); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  async function saveSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    const invalidField = form.field_schema.some((field) => !field.key.match(/^[a-z0-9_]+$/) || !field.label.trim());
    if (invalidField) { setSaving(false); setError('Kode field hanya boleh huruf kecil, angka, dan garis bawah; label wajib diisi.'); return; }
    const { error: saveError } = await createClient().rpc('admin_save_work_source', {
      source_id: form.id, source_key: form.key, source_name: form.name, source_description: form.description,
      source_color: form.color, source_icon: form.icon, source_field_schema: form.field_schema,
      source_allowed_role_keys: form.allowed_role_keys, source_allowed_position_keys: form.allowed_position_keys,
      source_is_active: form.is_active, source_sort_order: form.sort_order,
    });
    setSaving(false);
    if (saveError) { setError(saveError.message || 'Sumber kerja belum berhasil disimpan.'); return; }
    setMessage(form.id ? 'Sumber kerja berhasil diperbarui.' : 'Sumber kerja baru langsung tersedia tanpa perubahan backend.');
    setForm(blankForm()); await loadData();
  }

  if (state === 'loading') return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><p>Memuat sumber kerja...</p></section></main>;
  if (state === 'denied') return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><h1>Akses administrator diperlukan</h1><p>Akun ini tidak dapat mengelola sumber kerja.</p><Link href="/ruang-kawan/dashboard/">Kembali</Link></section></main>;

  return <main className="rk-dashboard-foundation"><section className="rk-admin-shell">
    <nav className="rk-admin-nav"><Link href="/ruang-kawan/admin/"><FiArrowLeft /> Anggota & Akses</Link><button type="button" onClick={() => void loadData()}><FiRefreshCw /> Muat ulang</button></nav>
    <header className="rk-admin-heading"><div><small>Konfigurasi My Activity</small><h1>Sumber Kerja</h1><p>Tambah tab atau sumber baru beserta field-nya. Perubahan langsung terbaca oleh My Activity tanpa membuat tabel atau mengubah backend lagi.</p></div><button type="button" onClick={() => setForm(blankForm())}><FiPlus /> Sumber baru</button></header>
    <section className="rk-admin-layout">
      <form className="rk-member-form" onSubmit={saveSource}>
        <div className="rk-admin-section-title"><FiLayers /><div><small>{form.id ? 'Ubah sumber' : 'Buat sumber'}</small><h2>{form.name || 'Sumber kerja baru'}</h2></div></div>
        <div className="rk-form-grid">
          <label>Nama<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label>Kode sumber<input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} disabled={Boolean(form.id)} placeholder="contoh: partnership" required /></label>
          <label>Warna<input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></label>
          <label>Urutan<input type="number" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} /></label>
        </div>
        <label className="rk-reason-field">Deskripsi<textarea value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>

        <fieldset><legend>Field tambahan</legend><p className="rk-field-hint">Field inti seperti tanggal, status, progress, KPI, output, risiko, dan bukti sudah otomatis tersedia.</p><div className="rk-source-fields">{form.field_schema.map((field, index) => <div key={`${index}-${field.key}`}><input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} placeholder="Nama field" /><input value={field.key} onChange={(event) => updateField(index, { key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} placeholder="kode_field" /><select value={field.type} onChange={(event) => updateField(index, { type: event.target.value as Field['type'] })}><option value="text">Teks</option><option value="textarea">Teks panjang</option><option value="number">Angka</option><option value="date">Tanggal</option><option value="url">URL</option></select><button type="button" aria-label="Hapus field" onClick={() => setForm({ ...form, field_schema: form.field_schema.filter((_, fieldIndex) => fieldIndex !== index) })}><FiTrash2 /></button></div>)}</div><button className="rk-secondary-admin-button" type="button" onClick={addField}><FiPlus /> Tambah field</button></fieldset>

        <fieldset><legend>Tersedia untuk peran</legend><p className="rk-field-hint">Kosongkan peran dan posisi jika sumber boleh dipakai semua anggota.</p><div className="rk-role-options">{reference.roles.map((role) => <label key={role.key}><input type="checkbox" checked={form.allowed_role_keys.includes(role.key)} onChange={() => setForm({ ...form, allowed_role_keys: toggle(form.allowed_role_keys, role.key) })} /><span><strong>{role.name}</strong></span></label>)}</div></fieldset>
        <fieldset><legend>Tersedia untuk posisi</legend><div className="rk-role-options">{reference.positions.map((position) => <label key={position.key}><input type="checkbox" checked={form.allowed_position_keys.includes(position.key)} onChange={() => setForm({ ...form, allowed_position_keys: toggle(form.allowed_position_keys, position.key) })} /><span><strong>{position.name}</strong></span></label>)}</div></fieldset>
        <label className="rk-source-active"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /><span>Sumber aktif dan tampil di My Activity</span></label>
        {error ? <p className="rk-password-error">{error}</p> : null}{message ? <p className="rk-password-success">{message}</p> : null}
        <button className="rk-primary-admin-button" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan sumber kerja'}</button>
      </form>
      <div className="rk-admin-side"><section className="rk-member-list"><div className="rk-admin-section-title"><FiLayers /><div><small>{sources.length} sumber</small><h2>Daftar sumber kerja</h2></div></div>{sources.map((source) => <article key={source.id}><div><strong><i className="rk-source-dot" style={{ background: source.color }} />{source.name}</strong><span>{source.key} · {source.source_kind === 'custom' ? 'Buatan admin' : 'Sumber awal'}</span><small>{source.description || 'Tanpa deskripsi'}</small><div className="rk-member-tags"><i data-status={source.is_active ? 'active' : 'inactive'}>{source.is_active ? 'Aktif' : 'Nonaktif'}</i><i>{source.field_schema.length} field tambahan</i></div></div><button type="button" onClick={() => editSource(source)} aria-label={`Ubah ${source.name}`}><FiEdit3 /></button></article>)}</section></div>
    </section>
  </section></main>;
}
