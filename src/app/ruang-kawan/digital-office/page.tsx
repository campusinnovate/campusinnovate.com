'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@/lib/supabase/client';
import { notify } from '@/lib/notify';
import { OfficeDocument, Placement, Signature, sha256, validPlacement } from '@/lib/office/types';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import OfficePdfCanvas from '@/components/ruang-kawan/OfficePdfCanvas';
import { officeErrorMessage } from '@/lib/office/errors';

export default function DigitalOffice() {
  const [documents, setDocuments] = useState<OfficeDocument[]>([]), [signatures, setSignatures] = useState<Signature[]>([]), [me, setMe] = useState('');
  const [selected, setSelected] = useState<OfficeDocument | null>(null), [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [draft, setDraft] = useState(false), [title, setTitle] = useState(''), [pages, setPages] = useState(0), [page, setPage] = useState(1);
  const [placements, setPlacements] = useState<Placement[]>([]), [selectedSigner, setSelectedSigner] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [query, setQuery] = useState('');
  const [signatureImages,setSignatureImages]=useState<Record<string,string>>({});
  const [approvalMode, setApprovalMode] = useState<'required' | 'direct'>('required');
  const [events, setEvents] = useState<{ id: number; action: string; created_at: string }[]>([]);
  async function load() {
    const client = createClient(); const session = (await client.auth.getSession()).data.session;
    if (!session) { window.location.replace('/ruang-kawan/'); return; }
    const result = await client.rpc('office_workspace'); setLoading(false);
    if (result.error) { setError('Digital Office belum dapat dimuat. Pastikan migrasi database dan penyimpanan Digital Office sudah terpasang.'); return; }
    setMe(result.data.me); setSignatures(result.data.signatures ?? []); setDocuments(result.data.documents ?? []);setSelected(current=>current?(result.data.documents as OfficeDocument[]).find(d=>d.id===current.id)??current:null);
    return result.data.documents as OfficeDocument[];
  }
  useEffect(() => { void load().then(docs => { const id = new URLSearchParams(window.location.search).get('document'); const doc = docs?.find(item => item.id === id); if (doc) void open(doc); }); }, []);
  useEffect(()=>{let active=true;const sources=selected?selected.signers.map(s=>({id:s.membership_id,path:s.signature_path})):signatures.map(s=>({id:s.membership_id,path:s.path}));void (async()=>{if(!sources.length){setSignatureImages({});return;}const result=await createClient().storage.from('office-signatures').createSignedUrls(sources.map(s=>s.path),3600);if(active)setSignatureImages(Object.fromEntries((result.data??[]).map((value,index)=>[sources[index].id,value.signedUrl]).filter((entry)=>Boolean(entry[1]))));})();return()=>{active=false;};},[selected,signatures]);
  useEffect(()=>{if(!selected)return;let active=true;void createClient().from('office_events').select('id,action,created_at').eq('document_id',selected.id).order('created_at',{ascending:false}).then(result=>{if(active&&!result.error)setEvents(result.data??[]);});return()=>{active=false;};},[selected]);
  useEffect(()=>{const refresh=()=>{if(!busy&&document.visibilityState==='visible')void load();};const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[busy]);
  async function cancel(){if(!selected||busy||!window.confirm('Batalkan pengajuan ini? Riwayat tetap tersimpan dan pengajuan baru dapat dibuat.'))return;setBusy(true);setError('');try{const result=await createClient().rpc('cancel_office_document',{target:selected.id});if(result.error)throw result.error;await load();notify({title:'Pengajuan dibatalkan',kind:'success'});}catch(e){setError(e instanceof Error?e.message:'Pengajuan gagal dibatalkan.');}finally{setBusy(false);}}
  async function downloadBytes(path: string, bucket = 'office-documents') {
    const result = await createClient().storage.from(bucket).download(path);
    if (result.error) throw new Error(result.error.message);
    return result.data.arrayBuffer();
  }
  async function open(doc: OfficeDocument) {
    if (busy) return;
    setBusy(true); setError(''); setBytes(null); setDraft(false); setSelected(doc); setTitle(doc.title); setPages(doc.page_count); setPage(1); setPlacements(doc.signers);
    try { setBytes(await downloadBytes(doc.source_path)); const history = await createClient().from('office_events').select('id,action,created_at').eq('document_id', doc.id).order('created_at', { ascending: false }); if (history.error) throw history.error; setEvents(history.data ?? []); }
    catch (error) { setError(error instanceof Error ? error.message : 'Dokumen tidak dapat dibuka.'); }
    finally { setBusy(false); }
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setError('');
    try {
      if (file.type !== 'application/pdf' || file.size > 25 * 1024 * 1024) throw new Error('Gunakan PDF maksimal 25 MB.');
      const data = await file.arrayBuffer(), pdf = await PDFDocument.load(data);
      if (pdf.getPageCount() > 200 || pdf.getPageCount() < 1) throw new Error('Dokumen harus memiliki 1–200 halaman.');
      if (pdf.getPages().some(p => ![0,90,180,270].includes((p.getRotation().angle % 360 + 360) % 360))) throw new Error('Rotasi halaman PDF tidak didukung. Simpan ulang PDF sebelum mengunggah.');
      setBytes(data); setPages(pdf.getPageCount()); setTitle(file.name.replace(/\.pdf$/i, '')); setPlacements([]); setPage(1); setSelected(null); setDraft(true); setEvents([]);
    } catch (error) { setError(error instanceof Error ? error.message : 'PDF gagal dibaca. Gunakan PDF tanpa password.'); }
    finally { setBusy(false); }
  }
  function updatePlacement(id: string, patch: Partial<Placement>) {
    setPlacements(current => current.map(p => {
      if (p.membership_id !== id) return p;
      const next = { ...p, ...patch }; const maxY = 1;
      next.x = Math.min(next.x, 1 - next.width); next.y = Math.min(next.y, maxY - next.height);
      return next;
    }));
  }
  async function send() {
    if (!bytes || busy) return;
    if (!title.trim() || !placements.length || placements.some(p => !validPlacement(p, pages))) { setError('Isi judul, pilih penandatangan, dan periksa semua posisi tanda tangan.'); return; }
    setBusy(true); setError('');
    try {
      const client = createClient(), user = (await client.auth.getSession()).data.session?.user;
      if (!user) throw new Error('Silakan masuk kembali.');
      const id = crypto.randomUUID(), path = `${user.id}/${id}/source.pdf`;
      const upload = await client.storage.from('office-documents').upload(path, bytes, { contentType: 'application/pdf', upsert: false }); if (upload.error) throw upload.error;
      const result = await client.rpc('create_office_document', { payload: { id, title: title.trim(), source_path: path, source_hash: await sha256(bytes), page_count: pages, signers: placements, approval_mode: approvalMode } }); if (result.error) throw result.error;
      const docs = await load(); const doc = docs?.find(item => item.id === id); if (doc) { setSelected(doc); setPlacements(doc.signers); setDraft(false); }
      notify({ title: approvalMode === 'direct' ? 'Dokumen siap difinalisasi' : 'Permintaan tanda tangan terkirim', message: approvalMode === 'direct' ? 'TTD digunakan tanpa approval per dokumen dan tercatat dalam riwayat.' : 'Setiap pemilik harus menyetujui lokasi dan dokumen, termasuk tanda tangan milik sendiri.', kind: 'success' });
    } catch (error) { setError(officeErrorMessage(error, 'Permintaan belum tersimpan.')); }
    finally { setBusy(false); }
  }
  async function respond(approve: boolean) {
    if (!selected || busy) return;
    setBusy(true); setError('');
    try { const result = await createClient().rpc('respond_office_document', { target: selected.id, approve }); if (result.error) throw result.error; const docs = await load(); setSelected(docs?.find(d => d.id === selected.id) ?? selected); notify({ title: approve ? 'Persetujuan tersimpan' : 'Permintaan ditolak', kind: 'success' }); }
    catch (error) { setError(officeErrorMessage(error, 'Respons gagal disimpan.')); }
    finally { setBusy(false); }
  }
  async function finalize() {
    if (!selected || !bytes || busy) return;
    setBusy(true); setError('');
    try {
      if (await sha256(bytes) !== selected.source_hash) throw new Error('File sumber tidak cocok dengan dokumen yang diajukan.');
      const session=(await createClient().auth.getSession()).data.session;
      if(!session)throw new Error('Silakan masuk kembali.');
      const { error: requestError } = await createClient().functions.invoke('digital-office/finalize', {
        body: { documentId: selected.id }, headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (requestError instanceof FunctionsFetchError) throw new Error('Layanan finalisasi tidak dapat dihubungi. Periksa koneksi dan pastikan Edge Function digital-office sudah dideploy dengan konfigurasi CORS terbaru.');
      if (requestError instanceof FunctionsHttpError) {
        const detail = await requestError.context.json().catch(() => null);
        if (requestError.context.status === 404 && detail?.code === 'NOT_FOUND') {
          throw new Error('Edge Function digital-office belum dideploy di Supabase. Jalankan deploy fungsi digital-office; migrasi SQL saja belum cukup.');
        }
        throw new Error(detail?.error || detail?.message || `Finalisasi gagal (HTTP ${requestError.context.status}).`);
      }
      if (requestError) throw requestError;
      const docs = await load(); setSelected(docs?.find(d => d.id === selected.id) ?? selected);
      notify({ title: 'PDF bertanda tangan siap diunduh', message: 'QR kredensial dan riwayat penggunaan TTD tersedia.', kind: 'success' });
    } catch (error) { setError(error instanceof Error ? error.message : 'Finalisasi belum berhasil.'); }
    finally { setBusy(false); }
  }
  async function download() {
    if (!selected?.output_path || busy) return;
    setBusy(true); setError('');
    try { const data = await downloadBytes(selected.output_path); if (await sha256(data) !== selected.output_hash) throw new Error('Hash PDF tidak cocok. File tidak diunduh.'); const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = `${selected.title}-signed.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
    catch (error) { setError(error instanceof Error ? error.message : 'Unduh gagal.'); }
    finally { setBusy(false); }
  }
  const names = Object.fromEntries([...signatures, ...(selected?.signers ?? [])].map(s => [s.membership_id, s.name]));
  const currentPlacement = placements.find(p => p.membership_id === selectedSigner);
  const own = selected?.signers.find(s => s.membership_id === me);
  return <main className="rk-office"><header><div><small>Campus Innovate</small><h1>Digital Office</h1><p>Tanda tangan bersama, penempatan di PDF, dan kredensial QR internal.</p></div><Link href="/ruang-kawan/profile/">Kelola tanda tangan saya</Link></header>
    <div className="rk-office-toolbar"><label className="rk-office-upload">+ Unggah PDF<input type="file" accept="application/pdf" disabled={busy || !me} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} /></label><button disabled={busy} onClick={() => void load()}>Muat ulang daftar</button>{busy ? <span role="status">Memproses…</span> : null}</div>
    {error ? <p className="rk-office-error" role="alert">{error}</p> : null}{loading ? <p>Memuat Digital Office…</p> : null}
    <div className="rk-office-layout"><aside className="rk-office-panel"><h2>Database dokumen</h2><input aria-label="Cari dokumen" placeholder="Cari judul…" value={query} onChange={event => setQuery(event.target.value)} />{documents.filter(d => d.title.toLowerCase().includes(query.toLowerCase())).map(d => <button className="rk-office-document" data-active={selected?.id === d.id} disabled={busy} key={d.id} onClick={() => void open(d)}><strong>{d.title}</strong><small>{d.status === 'completed' ? 'Selesai' : d.status === 'cancelled' ? 'Ditolak / dibatalkan' : d.approval_mode === 'direct' ? 'Tanpa approval' : `${d.signers.filter(s => s.approved_at).length}/${d.signers.length} persetujuan`} · {new Date(d.created_at).toLocaleDateString('id-ID')}</small></button>)}{!documents.length && !loading ? <p>Belum ada dokumen. Unggah PDF atau tunggu undangan tanda tangan.</p> : null}</aside>
    <section className="rk-office-panel">{bytes ? <><div className="rk-office-toolbar"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>←</button><span>Halaman {page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>→</button></div><OfficePdfCanvas bytes={bytes} page={page} placements={placements} names={names} images={signatureImages} selected={selectedSigner} onSelect={setSelectedSigner} onMove={draft ? (id, x, y) => updatePlacement(id, { x, y }) : undefined} />{page === pages ? <p>Kredensial QR ditambahkan pada halaman baru setelah halaman terakhir, sehingga isi dokumen tetap terlihat.</p> : null}</> : <p>Pilih dokumen atau unggah PDF untuk mengatur tanda tangan.</p>}</section>
    <aside className="rk-office-panel">{draft ? <><h2>Atur tanda tangan</h2><label>Mode tanda tangan<select disabled={busy} value={approvalMode} onChange={event => setApprovalMode(event.target.value as 'required' | 'direct')}><option value="required">Minta persetujuan pemilik</option><option value="direct">Langsung tanpa approval</option></select></label>{approvalMode === 'direct' ? <p>TTD anggota yang dibagikan dapat langsung digunakan. Penggunaan dicatat atas nama pembuat dokumen tanpa mencatat persetujuan pemilik.</p> : null}<label>Judul<input maxLength={160} value={title} onChange={event => setTitle(event.target.value)} /></label><p>Pilih anggota, lalu geser kotak di PDF. Lokasi dibekukan ketika permintaan dikirim.</p>{signatures.map(s => <label className="rk-office-check" key={s.membership_id}><input type="checkbox" checked={placements.some(p => p.membership_id === s.membership_id)} onChange={event => { setPlacements(current => event.target.checked ? [...current, { membership_id: s.membership_id, page, x: .1, y: .55, width: .28, height: .1 }] : current.filter(p => p.membership_id !== s.membership_id)); setSelectedSigner(s.membership_id); }} />{s.name}</label>)}{!signatures.length ? <p>Unggah tanda tangan di profil terlebih dahulu. Anggota lain harus mengaktifkan izin berbagi.</p> : null}
      {currentPlacement ? <fieldset><legend>{names[currentPlacement.membership_id]}</legend><label>Halaman<select value={currentPlacement.page} onChange={event => { updatePlacement(currentPlacement.membership_id, { page: Number(event.target.value) }); setPage(Number(event.target.value)); }}>{Array.from({ length: pages }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label>{(['x','y','width','height'] as const).map(key => <label key={key}>{({ x: 'Posisi kiri', y: 'Posisi atas', width: 'Lebar', height: 'Tinggi' })[key]} (%)<input type="number" step="1" min={key === 'width' ? 5 : key === 'height' ? 3 : 0} max={key === 'width' ? 90 : key === 'height' ? 50 : 100} value={Math.round(currentPlacement[key] * 100)} onChange={event => { const value = Number(event.target.value) / 100; if (Number.isFinite(value) && value >= 0 && value <= 1) updatePlacement(currentPlacement.membership_id, { [key]: value }); }} /></label>)}</fieldset> : null}<button className="rk-office-primary" disabled={busy || !placements.length} onClick={() => void send()}>{approvalMode === 'direct' ? 'Simpan tanpa approval' : 'Kirim permintaan persetujuan'}</button></> : selected ? <><h2>{selected.title}</h2><p>{selected.status === 'completed' ? 'PDF selesai' : selected.status === 'cancelled' ? 'Dokumen ditolak' : selected.approval_mode === 'direct' ? 'Tanpa approval · siap difinalisasi' : 'Menunggu persetujuan / finalisasi'}</p>{selected.signers.map(s => <button className="rk-office-document" key={s.membership_id} onClick={() => { setPage(s.page); setSelectedSigner(s.membership_id); }}><strong>{s.name}</strong><small>{selected.approval_mode === 'direct' ? 'Digunakan tanpa approval' : s.approved_at ? 'Disetujui' : s.rejected_at ? 'Ditolak' : 'Menunggu'} · halaman {s.page}</small></button>)}{selected.status === 'pending' && selected.approval_mode !== 'direct' && own && !own.approved_at ? <div className="rk-office-actions"><p>Dengan menyetujui, kamu mengizinkan tanda tangan profilmu digunakan pada PDF dan posisi yang ditampilkan.</p><button disabled={busy || !bytes} onClick={() => void respond(true)}>Setujui tanda tangan saya</button><button disabled={busy} onClick={() => void respond(false)}>Tolak</button></div> : null}{selected.creator_id === me && selected.status === 'pending' ? <button disabled={busy} onClick={()=>void cancel()}>Batalkan pengajuan</button>:null}{selected.creator_id===me&&selected.status==='cancelled'?<button disabled={busy} onClick={()=>{setDraft(true);setSelected(null);setSelectedSigner(placements[0]?.membership_id??'');}}>Salin untuk pengajuan baru</button>:null}{selected.creator_id === me && selected.status === 'pending' ? <button disabled={busy || !bytes || (selected.approval_mode !== 'direct' && !selected.signers.every(s => s.approved_at))} onClick={() => void finalize()}>Finalisasi PDF + QR</button> : null}{selected.output_path ? <button disabled={busy} onClick={() => void download()}>Unduh PDF bertanda tangan</button> : null}<Link href={`/ruang-kawan/digital-office/verify/?credential=${selected.credential}`}>Verifikasi kredensial →</Link><h3>Riwayat</h3>{events.map(event => <p key={event.id}>{({created_direct:'Dokumen dibuat tanpa approval',created:'Dokumen diajukan',approved:'Persetujuan diberikan',rejected:'Permintaan ditolak',completed:'PDF difinalisasi',cancelled:'Pengajuan dibatalkan'} as Record<string,string>)[event.action] ?? event.action} · {new Date(event.created_at).toLocaleString('id-ID')}</p>)}</> : <p>Atur tanda tangan atau periksa persetujuan dari panel ini.</p>}</aside></div>
  </main>;
}
