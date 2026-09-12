'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { FiMessageCircle, FiRefreshCw, FiSend, FiAward, FiTag, FiFilter } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';
import WhatsAppCrmPanel from './WhatsAppCrmPanel';
import styles from './inbox.module.css';

type Conversation = { 
  id: string; 
  phone: string; 
  profile_name: string; 
  preview: string; 
  last_message_at: string; 
  last_incoming_at: string | null; 
  unread_count: number;
  lead_score?: number;
  score_breakdown?: Record<string, unknown>;
  reference_code?: string;
  tags?: string[];
};
type Message = { id: string; direction: string; content: string; delivery_status: string; message_type: string; error_code: string | null; sent_at: string; created_at: string };
const stamp = (value: string) => new Date(value).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const status: Record<string, string> = { received: 'Diterima', sending: 'Memproses · jangan kirim ulang', sent: 'Terkirim', delivered: 'Diterima customer', read: 'Dibaca customer', failed: 'Gagal', unknown: 'Status belum pasti · jangan kirim ulang' };
const scoreColor = (score?: number) => score !== undefined && score >= 70 ? 'var(--score-high)' : score !== undefined && score >= 40 ? 'var(--score-med)' : 'var(--score-low)';
const scoreLabel = (score?: number) => score !== undefined && score >= 70 ? 'Hot' : score !== undefined && score >= 40 ? 'Warm' : 'Cold';

export default function InboxPage() {
  const [access, setAccess] = useState<'loading' | 'ready' | 'denied'>('loading');
  const [canReply, setCanReply] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [membershipId, setMembershipId] = useState('');
  const [inboxLoaded, setInboxLoaded] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [older, setOlder] = useState(false);
  const selectedRef = useRef('');
  const sendLock = useRef(false);
  const initialLinkHandled = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const conversation = conversations.find(c => c.id === selected);
  
  const allTags = useRef<string[]>([]);
  useEffect(() => {
    const tags = new Set<string>();
    conversations.forEach(c => c.tags?.forEach(t => tags.add(t)));
    allTags.current = Array.from(tags).sort();
  }, [conversations]);

  const refresh = useCallback(async () => {
    const db = createClient();
    const result = await db.rpc('whatsapp_inbox');
    if (result.error) { setError('Inbox belum dapat dimuat. Pastikan migrasi WhatsApp sudah diterapkan, lalu muat ulang.'); return; }
    const rows = (result.data ?? []) as Conversation[];
    const requested = selectedRef.current || new URLSearchParams(window.location.search).get('conversation');
    if (requested && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requested) && !rows.some(c => c.id === requested)) {
      const extra = await db.from('whatsapp_conversations').select('id,phone,profile_name,last_message_at,last_incoming_at,lead_score,score_breakdown,reference_code,tags').eq('id', requested).maybeSingle();
      if (extra.error) { setError('Percakapan tertaut belum dapat dimuat. Coba muat ulang.'); return; }
      if (extra.data) rows.push({ ...extra.data, preview: 'Percakapan tertaut dari pipeline', unread_count: 0 });
    }
    setConversations(rows); setInboxLoaded(true);
    window.dispatchEvent(new Event('kawan-inbox-refresh'));
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const db = createClient();
      const { data: { session } } = await db.auth.getSession();
      if (!session) { window.location.replace('/ruang-kawan/'); return; }
      const [{ data }, member] = await Promise.all([db.rpc('get_my_access'), db.rpc('current_membership_id')]);
      if (!active) return;
      const rights = Array.isArray(data) ? data[0] : data;
      if (rights?.membership_status !== 'active' || !rights?.permissions?.includes('pipeline.view')) { setAccess('denied'); return; }
      setPermissions(rights.permissions); setMembershipId(member.data ?? '');
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
  useEffect(() => {
    if (!inboxLoaded || initialLinkHandled.current) return;
    initialLinkHandled.current = true;
    const requested = new URLSearchParams(window.location.search).get('conversation');
    if (!requested) return;
    if (!conversations.some(c => c.id === requested)) { setError('Percakapan tertaut tidak ditemukan atau tidak dapat diakses.'); return; }
    selectedRef.current = requested; setSelected(requested); setLoadingChat(true); void loadChat(requested);
  }, [conversations, inboxLoaded, loadChat]);

  function select(cid: string) {
    if (sendLock.current) return;
    selectedRef.current = cid; setSelected(cid); setMessages([]); setDraft(''); setError(''); setLoadingChat(true); void loadChat(cid);
    const url = new URL(window.location.href); url.searchParams.set('conversation', cid); window.history.replaceState(null, '', url);
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
  const visible = conversations.filter(c => 
    (!unreadOnly || c.unread_count > 0) && 
    (!tagFilter || c.tags?.includes(tagFilter)) &&
    `${c.profile_name} ${c.phone} ${c.preview} ${c.reference_code || ''}`.toLowerCase().includes(query.toLowerCase())
  );

  if (access !== 'ready') return <main className={styles.page}><h1>Kawan Inbox</h1><p>{access === 'loading' ? 'Menyiapkan inbox…' : 'Akses Pipeline diperlukan. Hubungi administrator.'}</p></main>;

  return <main className={styles.page}>
    <header className={styles.heading}><div><small>COMMUNICATION & CRM</small><h1>Kawan Inbox</h1><p>Pesan WhatsApp, data pelanggan, dan tindak lanjut pipeline dalam satu ruang kerja.</p></div><button onClick={() => { setError(''); void refresh(); if (selected) void loadChat(selected); }}><FiRefreshCw /> Muat ulang</button></header>
    <nav className={styles.tabs} aria-label="Communication"><strong>WhatsApp & CRM</strong><Link href="/ruang-kawan/pipeline/">Pipeline BD →</Link></nav>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <section className={styles.workspace}>
      <aside className={styles.list}>
        <div className={styles.filters}>
          <input aria-label="Cari conversation" placeholder="Cari nama, nomor, pesan, reference code…" value={query} onChange={e => setQuery(e.target.value)} />
          <label><input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} /> Belum dibaca</label>
          {allTags.current.length > 0 && <div className={styles.tagFilter}>
            <FiFilter size={14} />
            <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
              <option value="">Semua tag</option>
              {allTags.current.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>}
          <small>200 conversation terbaru · diperbarui tiap 5 detik</small>
        </div>
        <div className={styles.conversations}>
          {visible.map(c => {
            const score = c.lead_score;
            return <button key={c.id} data-active={selected === c.id} disabled={sending} onClick={() => select(c.id)} style={{borderLeft: score !== undefined ? `4px solid ${scoreColor(score)}` : 'none'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px'}}>
                <div style={{flex:1, minWidth:0}}>
                  <strong style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block'}}>{c.profile_name || `+${c.phone}`}</strong>
                  {c.reference_code && <span className={styles.referenceCode} style={{fontSize:10, marginLeft:8}}>{c.reference_code}</span>}
                </div>
                <time style={{fontSize:10, whiteSpace:'nowrap'}}>{stamp(c.last_message_at)}</time>
              </div>
              <p style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:13, margin:'8px 0'}}>{c.preview}</p>
              <div style={{display:'flex', flexWrap:'wrap', gap:'6px', alignItems:'center'}}>
                <small style={{color:'var(--rk-muted)', fontSize:12}}>+{c.phone}</small>
                {c.unread_count > 0 && <b style={{borderRadius:'20px', background:'var(--rk-navy)', color:'white', fontSize:11, padding:'2px 7px'}}>{c.unread_count}</b>}
                {score !== undefined && <span className={styles.scoreBadge} style={{background:scoreColor(score), color:'white', fontSize:10, padding:'2px 6px', borderRadius:'4px'}}>{score} {scoreLabel(score)}</span>}
                {c.tags?.length && c.tags.map(t => <span key={t} className={styles.tagBadge} style={{fontSize:10, padding:'1px 6px', borderRadius:'4px', background:'var(--rk-line)', color:'var(--rk-muted)'}}>{t}</span>)}
              </div>
            </button>
          })}
          {!visible.length && <p className={styles.empty}>{query || unreadOnly || tagFilter ? 'Tidak ada conversation yang cocok.' : 'Belum ada pesan. Pesan customer akan muncul setelah webhook aktif.'}</p>}
        </div>
      </aside>
      <section className={styles.chat} aria-label="Pesan conversation">
        {!conversation ? <div className={styles.empty}><FiMessageCircle size={32} /><h2>Pilih conversation</h2><p>Baca dan balas pesan WhatsApp customer.</p></div> : <><header><strong>{conversation.profile_name || conversation.phone}</strong><small>+{conversation.phone}</small></header><div className={styles.messages} aria-busy={loadingChat}>{loadingChat && <p>Memuat pesan…</p>}{older && <p className={styles.notice}>Menampilkan 100 pesan terbaru.</p>}{messages.map(m => <article key={m.id} data-outgoing={m.direction === 'outgoing'}><p>{m.content}</p>{!['text','button','interactive'].includes(m.message_type) && <small>Pratinjau lampiran belum tersedia pada Phase 1.</small>}<footer><time>{stamp(m.sent_at)}</time><span>{status[m.delivery_status] ?? m.delivery_status}{m.error_code ? ` (${m.error_code})` : ''}</span></footer></article>)}<div ref={end} /></div><form className={styles.composer} onSubmit={send}><textarea aria-label="Pesan WhatsApp" placeholder={openWindow ? 'Tulis pesan…' : 'Sesi 24 jam berakhir. Tunggu pesan customer.'} value={draft} onChange={e => setDraft(e.target.value)} disabled={!canReply || !openWindow || sending} maxLength={4096} rows={3} /><div><small>{!canReply ? 'Izin kelola Pipeline diperlukan untuk reply.' : 'Reply teks · sesi layanan 24 jam'} · {draft.length}/4096</small><button disabled={!canReply || !openWindow || !draft.trim() || sending}><FiSend /> {sending ? 'Mengirim…' : 'Kirim'}</button></div></form></>}
      </section>
      <aside className={styles.details}><h2>Detail pelanggan</h2>{conversation ? <><dl><dt>Nama WhatsApp</dt><dd>{conversation.profile_name || 'Belum tersedia'}</dd><dt>WhatsApp</dt><dd>+{conversation.phone}</dd><dt>Pesan masuk terakhir</dt><dd>{conversation.last_incoming_at ? stamp(conversation.last_incoming_at) : '—'}</dd>
        {conversation.reference_code && <><dt>Reference Code</dt><dd><code>{conversation.reference_code}</code></dd></>}
        {conversation.lead_score !== undefined && <><dt>Lead Score</dt><dd><span style={{background:scoreColor(conversation.lead_score), color:'white', padding:'2px 8px', borderRadius:'4px', fontWeight:600}}>{conversation.lead_score} {scoreLabel(conversation.lead_score)}</span></dd></>}
        {conversation.tags?.length && <><dt>Tag</dt><dd>{conversation.tags.map(t => <span key={t} style={{display:'inline-block', margin:'2px 4px 2px 0', padding:'1px 6px', borderRadius:'4px', background:'var(--rk-line)', fontSize:12}}>{t}</span>)}</dd></>}
      </dl><WhatsAppCrmPanel key={conversation.id} conversationId={conversation.id} permissions={permissions} membershipId={membershipId} lastIncomingAt={conversation.last_incoming_at} /><p className={styles.notice}>Status baca inbox bersifat per staff. Status "Dibaca customer" berasal dari WhatsApp.</p></> : <div className={styles.captureIntro}><FiMessageCircle size={28} /><h3>Dari percakapan ke peluang</h3><p>Nama dan nomor pelanggan tersimpan otomatis saat pesan masuk. Pilih percakapan untuk melengkapi kontak, mengaitkan lead, dan mengatur tindak lanjut.</p></div>}</aside>
    </section>
  </main>;
}