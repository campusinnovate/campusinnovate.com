'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AttachmentPreview, LinkedText, PreviewAttachment } from './ChatPreview';
type ArchiveMessage = { id: string; body: string; created_at: string; sender_name: string; attachments: PreviewAttachment[] };
export default function ChatArchive({ conversationId }: { conversationId: string }) {
  const [items, setItems] = useState<ArchiveMessage[]>([]), [query, setQuery] = useState(''), [term, setTerm] = useState(''), [more, setMore] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const generation = useRef(0);
  async function load(offset = 0, search = term) {
    const request = ++generation.current;
    setBusy(true); setError('');
    try { const result = await createClient().rpc('chat_archive', { target_conversation_id: conversationId, page_offset: offset, search_text: search }); if (request !== generation.current) return; if (result.error) throw result.error; const next = result.data.messages as ArchiveMessage[]; setItems(current => offset ? [...current, ...next.filter(n => !current.some(i => i.id === n.id))] : next); setMore(next.length === 50); }
    catch { if (request === generation.current) setError('Arsip belum tersedia. Periksa koneksi dan migrasi database chat.'); }
    finally { if (request === generation.current) setBusy(false); }
  }
  useEffect(() => { setItems([]); setQuery(''); setTerm(''); void load(0, ''); return () => { ++generation.current; }; }, [conversationId]);
  useEffect(()=>{if(items.length>50)return;const timer=setInterval(()=>{if(document.visibilityState==='visible'&&!busy)void load(0,term);},60000);return()=>clearInterval(timer);},[conversationId,term,items.length,busy]);
  function search(event: FormEvent) { event.preventDefault(); setTerm(query.trim()); void load(0, query.trim()); }
  return <section className="rk-chat-archive"><h3>Database file & tautan grup</h3><form onSubmit={search}><input aria-label="Cari arsip grup" placeholder="Cari pesan atau nama file" value={query} onChange={event => setQuery(event.target.value)} /><button disabled={busy}>Cari</button></form>{error ? <p role="alert">{error}</p> : null}{items.map(item => <article key={item.id}><small>{item.sender_name} · {new Date(item.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</small><p><LinkedText body={item.body} /></p>{item.attachments.map(file => <AttachmentPreview key={file.id} file={file} />)}</article>)}{!items.length && !busy ? <p>Belum ada file atau tautan pada pencarian ini.</p> : null}{busy ? <p>Memuat arsip…</p> : more ? <button onClick={() => void load(items.length)}>Muat riwayat sebelumnya</button> : null}</section>;
}
