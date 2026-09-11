'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './ProspectReview.module.css';

export type ReviewableProspect = {
 id: string; account_name: string; account_type: string | null; industry: string | null; city: string | null;
 address: string | null; website: string | null; phone: string | null; email: string | null;
 contact_name: string | null; contact_role: string | null; recommended_service: string | null;
 review_notes?: string; updated_at: string; status: string; promoted_lead_id: string | null;
};
const fields = [
 ['account_name','Nama account'],['account_type','Jenis account'],['industry','Industri'],['city','Kota'],
 ['address','Alamat'],['website','Website'],['phone','Telepon / WhatsApp'],['email','Email'],
 ['contact_name','Nama kontak'],['contact_role','Jabatan kontak'],['recommended_service','Kebutuhan / service'],['review_notes','Catatan review'],
] as const;
type Field = typeof fields[number][0];
type Draft = Record<Field, string>;
type Event = { id: string; actor_membership_id: string | null; event_type: string; changed_fields: string[]; previous_status: string | null; new_status: string | null; created_at: string };
const draftFor = (p: ReviewableProspect) => Object.fromEntries(fields.map(([key]) => [key, p[key] ?? ''])) as Draft;
const labels: Record<string, string> = { new: 'Baru', reviewed: 'Sudah direview', archived: 'Diarsipkan', promoted: 'Masuk Pipeline' };

export default function ProspectReview({ prospect, canManage, busy, members, onSaved, onBusyChange }: {
 prospect: ReviewableProspect; canManage: boolean; busy: boolean; members: { id: string; name: string }[];
 onSaved: () => Promise<void>; onBusyChange: (busy: boolean) => void;
}) {
 const [editing, setEditing] = useState(false);
 const [draft, setDraft] = useState<Draft>(() => draftFor(prospect));
 const [version, setVersion] = useState(prospect.updated_at);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState('');
 const [feedback, setFeedback] = useState('');
 const [events, setEvents] = useState<Event[]>([]);
 const [historyError, setHistoryError] = useState('');
 const lock = useRef(false);
 const promoted = !!prospect.promoted_lead_id || prospect.status === 'promoted';
 const history = useCallback(async () => {
  const result = await createClient().from('prospect_review_events').select('*').eq('prospect_id', prospect.id).order('created_at', { ascending: false }).limit(20);
  if (result.error) setHistoryError('Riwayat belum dapat dimuat. Pastikan migrasi review prospect sudah diterapkan.');
  else { setHistoryError(''); setEvents(result.data ?? []); }
 }, [prospect.id]);
 useEffect(() => { void history(); }, [history]);
 async function mutate(action: 'save' | 'new' | 'reviewed' | 'archived') {
  if (lock.current || busy || !canManage || promoted) return;
  lock.current = true; setSaving(true); onBusyChange(true); setError(''); setFeedback('');
  try {
   const result = action === 'save'
    ? await createClient().rpc('update_prospect_details', { target_prospect_id: prospect.id, expected_updated_at: version, payload: draft })
    : await createClient().rpc('review_prospect_status', { target_prospect_id: prospect.id, expected_updated_at: prospect.updated_at, target_status: action });
   if (result.error) throw result.error;
   setEditing(false); await onSaved(); await history();
   setFeedback(action === 'save' ? 'Detail prospect tersimpan.' : action === 'archived' ? 'Prospect diarsipkan.' : action === 'new' ? 'Prospect dipulihkan ke status Baru.' : 'Prospect ditandai sudah direview.');
  } catch (e) { setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Perubahan belum tersimpan. Coba kembali.'); }
  finally { lock.current = false; setSaving(false); onBusyChange(false); }
 }
 function startEdit() { setDraft(draftFor(prospect)); setVersion(prospect.updated_at); setEditing(true); setFeedback(''); setError(''); }
 function submit(e: FormEvent) { e.preventDefault(); void mutate('save'); }
 return <section className={styles.review}>
  <header><h3>Review prospect</h3><span className={styles.status}>{labels[prospect.status] ?? prospect.status}</span></header>
  {error && <p className={styles.error} role="alert">{error}</p>}
  {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
  {editing ? <form onSubmit={submit}>
   {version !== prospect.updated_at && <p className={styles.error}>Data telah berubah sejak form dibuka. Tutup form lalu buka kembali untuk memakai data terbaru.</p>}
   <div className={styles.fields}>{fields.map(([key, label]) => <label key={key}>{label}{key === 'review_notes' ? <textarea rows={4} value={draft[key]} maxLength={5000} onChange={e => setDraft({ ...draft, [key]: e.target.value })} disabled={saving} /> : <input value={draft[key]} required={key === 'account_name'} type={key === 'email' ? 'email' : key === 'website' ? 'url' : 'text'} maxLength={key === 'address' || key === 'website' ? 2000 : 180} placeholder={key === 'website' ? 'https://example.com' : key === 'phone' ? '0812… atau +62812…' : undefined} onChange={e => setDraft({ ...draft, [key]: e.target.value })} disabled={saving} />}</label>)}</div>
   <div className={styles.actions}><button type="submit" disabled={saving || busy || version !== prospect.updated_at}>{saving ? 'Menyimpan…' : 'Simpan perubahan'}</button><button type="button" disabled={saving} onClick={() => setEditing(false)}>Batal</button></div>
  </form> : <>
   <dl><dt>Kontak</dt><dd>{[prospect.contact_name, prospect.contact_role].filter(Boolean).join(' · ') || 'Belum diisi'}</dd><dt>Telepon</dt><dd>{prospect.phone || '—'}</dd><dt>Email</dt><dd>{prospect.email || '—'}</dd><dt>Kebutuhan</dt><dd>{prospect.recommended_service || '—'}</dd></dl>
   <p className={styles.notes}>{prospect.review_notes || 'Belum ada catatan review manual.'}</p>
   {canManage && !promoted && <div className={styles.actions}><button disabled={busy || saving} onClick={startEdit}>Edit detail</button>{prospect.status === 'archived' ? <button disabled={busy || saving} onClick={() => void mutate('new')}>Pulihkan prospect</button> : <>{prospect.status === 'new' && <button disabled={busy || saving} onClick={() => void mutate('reviewed')}>Tandai sudah direview</button>}<button disabled={busy || saving} onClick={() => void mutate('archived')}>Arsipkan</button></>}</div>}
   {promoted && <p>Data operasional dikelola melalui Pipeline BD setelah promosi.</p>}
   {!canManage && <p>Akses baca saja. Izin kelola Pipeline diperlukan untuk mengubah prospect.</p>}
  </>}
  <div className={styles.history}><h4>Riwayat review</h4>{historyError ? <p role="alert">{historyError} <button onClick={() => void history()}>Coba lagi</button></p> : !events.length ? <p>Belum ada perubahan manual yang tercatat.</p> : <ol>{events.map(event => <li key={event.id}><strong>{event.event_type === 'status_changed' ? `${labels[event.previous_status ?? ''] ?? event.previous_status} → ${labels[event.new_status ?? ''] ?? event.new_status}` : `Diperbarui: ${event.changed_fields.map(key => fields.find(([field]) => field === key)?.[1] ?? key).join(', ')}`}</strong><small>{members.find(m => m.id === event.actor_membership_id)?.name ?? 'Staff'} · {new Date(event.created_at).toLocaleString('id-ID')}</small></li>)}</ol>}<small>20 perubahan manual terbaru. Riwayat dimulai sejak fitur review diaktifkan.</small></div>
 </section>;
}
