'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { notify } from '@/lib/notify';
import type { Signature } from '@/lib/office/types';
export default function SignatureProfile() {
  const [signature, setSignature] = useState<Signature | null>(null);
  const [preview, setPreview] = useState('');
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    const client = createClient();
    const result = await client.rpc('office_workspace');
    if (result.error) { setError('Data tanda tangan belum tersedia. Pastikan migrasi Digital Office sudah terpasang.'); return; }
    const own = (result.data.signatures as Signature[]).find(item => item.membership_id === result.data.me) ?? null;
    setSignature(own); setShared(own?.shared ?? false);
    if (own) { const url = await client.storage.from('office-signatures').createSignedUrl(own.path, 3600); setPreview(url.data?.signedUrl ?? ''); }
  }
  useEffect(() => { void load(); }, []);
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setError('');
    try {
      if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1048576) throw new Error('Pilih gambar PNG/JPG maksimal 1 MB.');
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1000 / bitmap.width, 400 / bitmap.height);
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Gambar gagal diproses.')), 'image/png'));
      const client = createClient(), session = (await client.auth.getSession()).data.session;
      if (!session) throw new Error('Silakan masuk kembali.');
      const path = `${session.user.id}/${crypto.randomUUID()}.png`;
      const upload = await client.storage.from('office-signatures').upload(path, blob, { contentType: 'image/png', upsert: false });
      if (upload.error) throw upload.error;
      const result = await client.rpc('save_office_signature', { asset_path: path, allow_shared: shared });
      if (result.error) throw result.error;
      notify({ title: 'Tanda tangan tersimpan', message: 'Tanda tangan siap digunakan di Digital Office.', kind: 'success' });
      await load();
    } catch (error) { setError(error instanceof Error ? error.message : 'Unggah tanda tangan gagal.'); }
    finally { setBusy(false); }
  }
  async function saveSharing(value: boolean) {
    if (!signature) { setShared(value); return; }
    setBusy(true); setError('');
    try { const result = await createClient().rpc('save_office_signature', { asset_path: signature.path, allow_shared: value }); if (result.error) throw result.error; setShared(value); notify({ title: value ? 'Tanda tangan tersedia bagi anggota' : 'Berbagi tanda tangan dinonaktifkan', kind: 'success' }); }
    catch { setError('Pengaturan berbagi belum tersimpan. Coba kembali.'); }
    finally { setBusy(false); }
  }
  return <section className="rk-office-panel"><h3>Tanda tangan Digital Office</h3><p>Unggah tanda tangan milikmu. PNG transparan memberikan hasil terbaik.</p>{preview ? <img className="rk-signature-preview" src={preview} alt="Tanda tangan saya" /> : <p>Belum ada tanda tangan.</p>}<label>Unggah PNG / JPG (maks. 1 MB)<input type="file" accept="image/png,image/jpeg" disabled={busy} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} /></label><label className="rk-office-check"><input type="checkbox" checked={shared} disabled={busy} onChange={event => void saveSharing(event.target.checked)} />Izinkan anggota memilih tanda tangan saya. Penggunaannya pada setiap dokumen tetap memerlukan persetujuan saya.</label>{error ? <p className="rk-office-error" role="alert">{error}</p> : null}<Link href="/ruang-kawan/digital-office/">Buka Digital Office →</Link></section>;
}
