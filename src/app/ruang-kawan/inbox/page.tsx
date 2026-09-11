'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { FiMessageCircle, FiRefreshCw, FiSend } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';
import styles from './inbox.module.css';

type Conversation = { id: string; phone: string; profile_name: string; preview: string; last_message_at: string; last_incoming_at: string | null; unread_count: number };
type Message = { id: string; direction: string; content: string; delivery_status: string; message_type: string; error_code: string | null; sent_at: string; created_at: string };
const stamp = (value: string) => new Date(value).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const status: Record<string, string> = { received: 'Diterima', sending: 'Memproses · jangan kirim ulang', sent: 'Terkirim', delivered: 'Diterima customer', read: 'Dibaca customer', failed: 'Gagal', unknown: 'Status belum pasti · jangan kirim ulang' };

export default function InboxPage() {
  const [access, setAccess] = useState<'loading' | 'ready' | 'denied'>('loading');
  const [canReply, setCanReply] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [older, setOlder] = useState(false);
  const selectedRef = useRef('');
  const sendLock = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const conversation = conversations.find(c => c.id === selected);
  const refresh = useCallback(async () => {
    const result = await createClient().rpc('whatsapp_inbox');
    if (result.error) { setError('Inbox belum dapat dimuat. Pastikan migrasi WhatsApp sudah diterapkan, lalu muat ulang.'); return; }
    setConversations(result.data ?? []);
    window.dispatchEvent(new Event('kawan-inbox-refresh'));
  }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      const db = createClient();
      const { data: { session } } = await db.auth.getSession();
      if (!session) { window.location.replace('/ruang-kawan/'); return; }
      const { data } = await db.rpc('get_my_access');
      if (!active) return;
      const rights = Array.isArray(data) ? data[0] : data;
      if (rights?.membership_status !== 'active' || !rights?.permissions?.includes('pipeline.view')) { setAccess('denied'); return; }
      setCanReply(rights.permissions.includes('pipeline.manage_self')); setAccess('ready'); await refresh();
    })();
    return () => { active = false; };
  }, [refresh]);
  const loadChat = useCallback(async (cid: string) => {
    const db = createClient();
    const result = await db.from('whatsapp_messages').select('*').eq('conversation_id', cid).order('created_at', { ascending: false }).limit(100);
    if (selectedRef.current !== cid) return;
    setLoadingChat(false);
    if (result.error) { setError('Pesan gagal dimuat.'); return; }
    const rows = (result.data ?? []) as Message[];
    setMessages([...rows].reverse()); setOlder(rows.length === 100);
    // Mark only the fetched messages through their server timestamp, never the client clock.
    if (rows.length && document.visibilityState === 'visible') {
      const marked = await db.rpc('whatsapp_mark_read', { cid, through_time: rows[0].created_at });
      if (marked.error) setError('Status baca belum tersimpan.');
      else await refresh();
    }
  }, [refresh]);
  useEffect(() => {
    if (access !== 'ready') return;
    const tick = () => { if (document.visibilityState === 'visible') { void refresh(); if (selectedRef.current) void loadChat(selectedRef.current); } };
    const timer = window.setInterval(tick, 5000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [access, refresh, loadChat]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length, selected]);
  function select(cid: string) {
    if (sendLock.current) return;
    selectedRef.current = cid; setSelected(cid); setMessages([]); setDraft(''); setError(''); setLoadingChat(true); void loadChat(cid);
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!selected || !draft.trim() || sendLock.current) return;
    sendLock.current = true; setSending(true); setError('');
    const cid = selected;
    try {
      const result = await createClient().functions.invoke('whatsapp-send', { body: { conversation_id: cid, content: draft.trim(), request_id: crypto.randomUUID() } });
      if (result.error) {
        const details = await result.error.context?.json?.().catch(() => null);
        setError(details?.error ?? 'Pengiriman belum terkonfirmasi. Periksa status pesan sebelum mencoba lagi.');
      } else if (result.data?.error) setError(result.data.error);
      else setDraft('');
      await loadChat(cid); await refresh();
    } catch { setError('Koneksi terputus. Periksa status pesan sebelum mencoba lagi.'); }
    finally { sendLock.current = false; setSending(false); }
  }
  const openWindow = !!conversation?.last_incoming_at && Date.now() - Date.parse(conversation.last_incoming_at) < 86400000;
  const visible = conversations.filter(c => (!unreadOnly || c.unread_count > 0) && `${c.profile_name} ${c.phone} ${c.preview}`.toLowerCase().includes(query.toLowerCase()));
  if (access !== 'ready') return <main className={styles.page}><h1>Kawan Inbox</h1><p>{access === 'loading' ? 'Menyiapkan inbox…' : 'Akses Pipeline diperlukan. Hubungi administrator.'}</p></main>;
  return <main className={styles.page}>
    <header className={styles.heading}><div><small>COMMUNICATION</small><h1>Kawan Inbox</h1><p>WhatsApp customer dalam satu ruang kerja.</p></div><button onClick={() => { setError(''); void refresh(); if (selected) void loadChat(selected); }}><FiRefreshCw /> Muat ulang</button></header>
    <nav className={styles.tabs} aria-label="Communication"><strong>Kawan Inbox</strong><span aria-disabled="true" title="Tersedia pada Phase 4">Templates · segera</span><span aria-disabled="true" title="Belum tersedia pada Phase 1">Broadcast · segera</span></nav>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <section className={styles.workspace}>
      <aside className={styles.list}><div className={styles.filters}><input aria-label="Cari conversation" placeholder="Cari nama, nomor, pesan…" value={query} onChange={e => setQuery(e.target.value)} /><label><input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} /> Belum dibaca</label><small>200 conversation terbaru · diperbarui tiap 5 detik</small></div>
        <div className={styles.conversations}>{visible.map(c => <button key={c.id} data-active={selected === c.id} disabled={sending} onClick={() => select(c.id)}><div><strong>{c.profile_name || `+${c.phone}`}</strong><time>{stamp(c.last_message_at)}</time></div><p>{c.preview}</p><small>+{c.phone}</small>{c.unread_count > 0 && <b>{c.unread_count}</b>}</button>)}{!visible.length && <p className={styles.empty}>{query || unreadOnly ? 'Tidak ada conversation yang cocok.' : 'Belum ada pesan. Pesan customer akan muncul setelah webhook aktif.'}</p>}</div>
      </aside>
      <section className={styles.chat} aria-label="Pesan conversation">
        {!conversation ? <div className={styles.empty}><FiMessageCircle size={32} /><h2>Pilih conversation</h2><p>Baca dan balas pesan WhatsApp customer.</p></div> : <><header><strong>{conversation.profile_name || conversation.phone}</strong><small>+{conversation.phone}</small></header><div className={styles.messages} aria-busy={loadingChat}>{loadingChat && <p>Memuat pesan…</p>}{older && <p className={styles.notice}>Menampilkan 100 pesan terbaru.</p>}{messages.map(m => <article key={m.id} data-outgoing={m.direction === 'outgoing'}><p>{m.content}</p>{!['text','button','interactive'].includes(m.message_type) && <small>Pratinjau lampiran belum tersedia pada Phase 1.</small>}<footer><time>{stamp(m.sent_at)}</time><span>{status[m.delivery_status] ?? m.delivery_status}{m.error_code ? ` (${m.error_code})` : ''}</span></footer></article>)}<div ref={end} /></div><form className={styles.composer} onSubmit={send}><textarea aria-label="Pesan WhatsApp" placeholder={openWindow ? 'Tulis pesan…' : 'Sesi 24 jam berakhir. Tunggu pesan customer.'} value={draft} onChange={e => setDraft(e.target.value)} disabled={!canReply || !openWindow || sending} maxLength={4096} rows={3} /><div><small>{!canReply ? 'Izin kelola Pipeline diperlukan untuk reply.' : 'Reply teks · sesi layanan 24 jam'} · {draft.length}/4096</small><button disabled={!canReply || !openWindow || !draft.trim() || sending}><FiSend /> {sending ? 'Mengirim…' : 'Kirim'}</button></div></form></>}
      </section>
      <aside className={styles.details}><h2>Detail customer</h2>{conversation ? <><dl><dt>Nama WhatsApp</dt><dd>{conversation.profile_name || 'Belum tersedia'}</dd><dt>WhatsApp</dt><dd>+{conversation.phone}</dd><dt>Pesan masuk terakhir</dt><dd>{conversation.last_incoming_at ? stamp(conversation.last_incoming_at) : '—'}</dd><dt>Channel</dt><dd>WhatsApp Business Platform</dd></dl><h2>CRM existing</h2><p>Contact matching, link/create lead, owner, dan activity history dilanjutkan pada Phase 2.</p><Link href="/ruang-kawan/pipeline/">Buka Pipeline BD →</Link><p className={styles.notice}>Status baca inbox bersifat per staff. Status “Dibaca customer” berasal dari WhatsApp.</p></> : <p>Detail muncul saat conversation dipilih.</p>}</aside>
    </section>
  </main>;
}
