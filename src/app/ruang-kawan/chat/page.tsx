'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiArrowLeft, FiAtSign, FiBell, FiBriefcase, FiCalendar, FiCheckCircle,
  FiChevronDown, FiCornerUpLeft, FiDownload, FiEdit3, FiFile, FiHash, FiInfo, FiLink, FiLoader,
  FiMessageCircle, FiMoreVertical, FiPaperclip, FiPlus, FiSearch, FiSend,
  FiSmile, FiStar, FiTrash2, FiUploadCloud, FiUsers, FiVideo, FiX, FiZap,
} from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';
import { supabaseUrl } from '@/lib/supabase/config';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Member = { id: string; name: string; email?: string | null; avatar_url: string | null; position_name?: string | null; online?: boolean; last_read_at?: string | null };
type Conversation = {
  id: string; name: string; kind: 'direct' | 'group' | 'team' | 'project' | 'private';
  avatar_url: string | null; last_message: string | null; last_message_at: string | null;
  unread_count: number; mention_count?: number; starred?: boolean; member_count?: number;
};
type Attachment = { id: string; name: string; url: string; mime_type?: string | null; size_label?: string | null; size_bytes?: number | null };
type Reaction = { emoji: string; count: number; reacted_by_me?: boolean };
type Message = {
  id: string; body: string; created_at: string; edited_at?: string | null; sender: Member;
  parent_id?: string | null; reply_count?: number; reactions?: Reaction[]; attachments?: Attachment[];
  pinned?: boolean; deleted_at?: string | null; read_count?: number; mentions?: string[];
};
type RelatedItem = { id: string; type: 'project' | 'assignment' | 'document' | 'meeting' | 'decision' | 'content' | 'pipeline'; title: string; subtitle?: string | null; url?: string | null };
type Workspace = { conversations: Conversation[]; members: Member[]; unread_total: number; mentions_total?: number; me?: Member | null };
type ConversationPayload = { conversation: Conversation; members: Member[]; messages: Message[]; related: RelatedItem[] };
type ThreadPayload = { parent: Message; replies: Message[] };
type SearchResult = { id: string; conversation_id: string; conversation_name: string; body: string; created_at: string; sender_name: string; parent_id?: string | null };
type ProjectOption = { id: string; name: string; project_code?: string | null };
type ActionKind = 'assignment' | 'decision' | 'meeting' | 'project' | 'edit' | null;
type AiAction = { id: string; type: 'create_assignment' | 'save_decision' | 'create_meeting' | 'link_project'; title: string; payload_json?: string };

const emptyWorkspace: Workspace = { conversations: [], members: [], unread_total: 0 };
const apiMissingCodes = new Set(['42883', 'PGRST202', 'PGRST205']);

function initials(value: string) {
  return value.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'KI';
}
function formatTime(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
function localInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export default function KawanChatPage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'denied'>('loading');
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationPayload | null>(null);
  const [query, setQuery] = useState('');
  const [listMode, setListMode] = useState<'all' | 'unread' | 'mentions' | 'starred'>('all');
  const [message, setMessage] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [mentionTerm, setMentionTerm] = useState<string | null>(null);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [typingMembers, setTypingMembers] = useState<Record<string, string>>({});
  const [thread, setThread] = useState<ThreadPayload | null>(null);
  const [threadOpen, setThreadOpen] = useState(false);
  const [threadMessage, setThreadMessage] = useState('');
  const [threadSending, setThreadSending] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [backendPending, setBackendPending] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionKind, setActionKind] = useState<ActionKind>(null);
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [actionSeed, setActionSeed] = useState<Record<string, unknown>>({});
  const [menuMessageId, setMenuMessageId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestedConversation = useRef<string | null>(null);

  async function loadWorkspace() {
    setError('');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.replace('/ruang-kawan/'); return; }
    const accessResult = await supabase.rpc('get_my_access');
    const access = Array.isArray(accessResult.data) ? accessResult.data[0] : accessResult.data;
    if (!access || access.membership_status !== 'active') { setStatus('denied'); return; }
    const result = await supabase.rpc('chat_workspace');
    if (result.error) {
      setBackendPending(apiMissingCodes.has(result.error.code));
      if (!apiMissingCodes.has(result.error.code)) setError('Kawan Chat belum dapat dimuat. Coba muat ulang beberapa saat lagi.');
      setStatus('ready');
      return;
    }
    const payload = (result.data ?? emptyWorkspace) as Workspace;
    setWorkspace(payload);
    window.dispatchEvent(new CustomEvent('kawan-chat-unread', { detail: { count: payload.unread_total } }));
    setBackendPending(false);
    setStatus('ready');
    if (!requestedConversation.current) requestedConversation.current = new URLSearchParams(window.location.search).get('conversation');
    if (!selectedId) setSelectedId(requestedConversation.current ?? payload.conversations[0]?.id ?? null);
  }

  async function loadConversation(id: string, markRead = true) {
    setSelectedId(id); setError('');
    const result = await createClient().rpc('chat_conversation', { target_conversation_id: id });
    if (result.error) { setError('Percakapan belum dapat dimuat.'); return; }
    const payload = result.data as ConversationPayload;
    setDetail(payload);
    window.dispatchEvent(new CustomEvent('kawan-ai-context', { detail: {
      entityType: 'chat_conversation', entityId: id, label: payload.conversation.name,
      data: { conversationId: id, kind: payload.conversation.kind, memberCount: payload.members.length },
    } }));
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: 'end' }));
    if (markRead) {
      await createClient().rpc('mark_chat_conversation_read', { target_conversation_id: id });
      void loadWorkspace();
    }
  }

  async function loadThread(messageId: string) {
    const result = await createClient().rpc('chat_thread', { target_message_id: messageId });
    if (result.error) { setError('Thread belum dapat dimuat.'); return; }
    setThread(result.data as ThreadPayload); setThreadOpen(true); setDetailOpen(true); setMenuMessageId(null);
  }

  useEffect(() => { void loadWorkspace(); }, []);
  useEffect(() => { if (selectedId) void loadConversation(selectedId); else setDetail(null); }, [selectedId]);
  useEffect(() => {
    if (!selectedId) return;
    const supabase = createClient();
    const channel = supabase.channel(`kawan-chat:${selectedId}`, { config: { presence: { key: workspace.me?.id ?? 'anonymous' } } }).on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ membership_id?: string }>();
      setOnlineIds(new Set(Object.values(state).flat().map((entry) => entry.membership_id).filter((id): id is string => Boolean(id))));
    }).on('broadcast', { event: 'typing' }, ({ payload }) => {
      const value = payload as { membershipId?: string; name?: string; typing?: boolean };
      if (!value.membershipId || value.membershipId === workspace.me?.id) return;
      setTypingMembers((current) => { const next = { ...current }; if (value.typing && value.name) next[value.membershipId!] = value.name; else delete next[value.membershipId!]; return next; });
    }).on('postgres_changes', {
      event: '*', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${selectedId}`,
    }, () => { void loadConversation(selectedId); if (thread?.parent.id) void loadThread(thread.parent.id); }).on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'chat_conversation_members', filter: `conversation_id=eq.${selectedId}`,
    }, () => void loadConversation(selectedId, false)).subscribe((state) => {
      if (state === 'SUBSCRIBED' && workspace.me) void channel.track({ membership_id: workspace.me.id, name: workspace.me.name, online_at: new Date().toISOString() });
    });
    channelRef.current = channel;
    return () => { channelRef.current = null; setOnlineIds(new Set()); setTypingMembers({}); void supabase.removeChannel(channel); };
  }, [selectedId, workspace.me?.id, thread?.parent.id]);
  useEffect(() => {
    const receive = (event: Event) => {
      const action = (event as CustomEvent<{ action?: AiAction }>).detail?.action;
      if (!action || !detail) return;
      let seed: Record<string, unknown> = {};
      try { seed = JSON.parse(action.payload_json || '{}') as Record<string, unknown>; } catch { seed = {}; }
      const eventDetail = (event as CustomEvent<{ action?: AiAction; runId?: string | null }>).detail;
      setActionSeed({ title: action.title, ...seed, _aiRunId: eventDetail.runId ?? null, _aiActionId: action.id ?? null });
      setActionMessage(detail.messages.at(-1) ?? null);
      setActionKind(action.type === 'create_assignment' ? 'assignment' : action.type === 'save_decision' ? 'decision' : action.type === 'create_meeting' ? 'meeting' : 'project');
    };
    window.addEventListener('kawan-ai-action', receive);
    return () => window.removeEventListener('kawan-ai-action', receive);
  }, [detail]);

  const conversations = useMemo(() => workspace.conversations.filter((item) => {
    const term = query.trim().toLowerCase();
    const matchesMode = listMode === 'all' || (listMode === 'unread' ? item.unread_count > 0 : listMode === 'mentions' ? Boolean(item.mention_count) : Boolean(item.starred));
    return matchesMode && (!term || item.name.toLowerCase().includes(term) || item.last_message?.toLowerCase().includes(term));
  }), [workspace.conversations, query, listMode]);
  const direct = conversations.filter((item) => item.kind === 'direct' || item.kind === 'group');
  const spaces = conversations.filter((item) => !['direct', 'group'].includes(item.kind));

  async function send(event: FormEvent) {
    event.preventDefault();
    const body = message.trim();
    if (!selectedId || (!body && !pendingAttachments.length) || sending) return;
    setSending(true); setError('');
    const activeMentions = mentionIds.filter((id) => {
      const member = detail?.members.find((item) => item.id === id);
      return member ? body.includes(`@${member.name}`) : false;
    });
    const result = await createClient().rpc('send_chat_message', { target_conversation_id: selectedId, message_body: body, reply_to_message_id: null, attachment_ids: pendingAttachments.map((item) => item.id), mention_membership_ids: activeMentions });
    setSending(false);
    if (result.error) { setError('Pesan belum berhasil dikirim.'); return; }
    setMessage(''); setPendingAttachments([]); setMentionIds([]); setMentionTerm(null); void channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { membershipId: workspace.me?.id, typing: false } }); await loadConversation(selectedId); await loadWorkspace();
  }

  function updateMessage(value: string) {
    setMessage(value);
    const found = value.match(/(?:^|\s)@([^@\n]*)$/);
    setMentionTerm(found ? found[1].toLowerCase() : null);
    void channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { membershipId: workspace.me?.id, name: workspace.me?.name, typing: Boolean(value.trim()) } });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => void channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { membershipId: workspace.me?.id, name: workspace.me?.name, typing: false } }), 1500);
  }

  function selectMention(member: Member) {
    setMessage((value) => value.replace(/(?:^|\s)@([^@\n]*)$/, (match) => `${match.startsWith(' ') ? ' ' : ''}@${member.name} `));
    setMentionIds((items) => items.includes(member.id) ? items : [...items, member.id]); setMentionTerm(null);
  }

  async function uploadFiles(files: FileList | null) {
    if (!selectedId || !files?.length || uploading) return;
    setUploading(true); setError('');
    const supabase = createClient(); const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setUploading(false); setError('Sesi login berakhir.'); return; }
    for (const file of Array.from(files).slice(0, 5)) {
      const form = new FormData(); form.append('file', file); form.append('conversationId', selectedId); form.append('registerDocument', 'true');
      const response = await fetch(`${supabaseUrl}/functions/v1/ruang-kawan-calendar/chat/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
      const payload = await response.json();
      if (!response.ok || !payload.attachment) { setError(payload.error ?? `${file.name} belum berhasil diunggah.`); continue; }
      setPendingAttachments((items) => [...items, payload.attachment as Attachment]);
    }
    setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function sendThread(event: FormEvent) {
    event.preventDefault(); const body = threadMessage.trim();
    if (!selectedId || !thread?.parent.id || !body || threadSending) return;
    setThreadSending(true); const result = await createClient().rpc('send_chat_message', { target_conversation_id: selectedId, message_body: body, reply_to_message_id: thread.parent.id, attachment_ids: [], mention_membership_ids: [] }); setThreadSending(false);
    if (result.error) { setError('Balasan belum berhasil dikirim.'); return; }
    setThreadMessage(''); await loadThread(thread.parent.id); await loadConversation(selectedId);
  }

  async function runSearch(event?: FormEvent) {
    event?.preventDefault(); const term = searchText.trim(); if (!term || searching) return;
    setSearching(true); const result = await createClient().rpc('search_chat_messages', { search_query: term, target_conversation_id: null, mentions_only: listMode === 'mentions' }); setSearching(false);
    if (result.error) { setError('Pencarian pesan belum dapat digunakan.'); return; }
    setSearchResults((result.data ?? []) as SearchResult[]);
  }

  async function react(messageId: string, emoji: string) {
    if (!selectedId) return;
    const result = await createClient().rpc('toggle_chat_reaction', { target_message_id: messageId, reaction_emoji: emoji });
    if (result.error) { setError('Reaksi belum berhasil disimpan.'); return; }
    await loadConversation(selectedId);
  }
  async function toggleStar() {
    if (!selectedId) return; const result = await createClient().rpc('toggle_chat_star', { target_conversation_id: selectedId });
    const currentlyStarred = workspace.conversations.find((item) => item.id === selectedId)?.starred;
    if (result.error) setError(result.error.message); else { setNotice(currentlyStarred ? 'Percakapan tidak lagi berbintang.' : 'Percakapan ditambahkan ke Berbintang.'); await loadWorkspace(); }
  }

  function openAction(kind: Exclude<ActionKind, null>, source?: Message | null, seed: Record<string, unknown> = {}) {
    setMenuMessageId(null); setActionMessage(source ?? null); setActionSeed(seed); setActionKind(kind); setError(''); setNotice('');
  }
  async function pin(item: Message) {
    setMenuMessageId(null); const result = await createClient().rpc('toggle_chat_pin', { target_message_id: item.id });
    if (result.error) setError(result.error.message); else if (selectedId) { setNotice(item.pinned ? 'Pin pesan dilepas.' : 'Pesan disematkan.'); await loadConversation(selectedId); }
  }
  async function removeMessage(item: Message) {
    setMenuMessageId(null); if (!window.confirm('Hapus pesan ini? Pesan akan dihapus secara soft delete dan audit tetap tersimpan.')) return;
    const result = await createClient().rpc('delete_chat_message', { target_message_id: item.id });
    if (result.error) setError(result.error.message); else if (selectedId) { setNotice('Pesan dihapus.'); await loadConversation(selectedId); }
  }
  function askAiAbout(item: Message) {
    setMenuMessageId(null);
    window.dispatchEvent(new CustomEvent('kawan-ai-context', { detail: { entityType: 'chat_conversation', entityId: selectedId, label: detail?.conversation.name, data: { selectedMessageId: item.id } } }));
    window.dispatchEvent(new CustomEvent('kawan-ai-open', { detail: { prompt: 'Ringkas pesan yang dipilih dan jelaskan tindak lanjut yang diperlukan.' } }));
  }
  if (status === 'loading') return <main className="rk-chat-foundation"><section className="rk-chat-loading"><FiLoader /> Menyiapkan Kawan Chat...</section></main>;
  if (status === 'denied') return <main className="rk-chat-foundation"><section className="rk-chat-loading"><FiMessageCircle /><h1>Kawan Chat belum tersedia</h1><p>Akun ini belum memiliki keanggotaan internal aktif.</p></section></main>;
  const hasMeeting = Boolean(detail?.related.some((item) => item.type === 'meeting'));

  return <main className="rk-chat-foundation">
    <section className="rk-chat-shell" data-sidebar={sidebarOpen} data-detail={detailOpen}>
      <aside className="rk-chat-sidebar">
        <header><div><FiMessageCircle /><span><small>Ruang Kawan</small><strong>Kawan Chat</strong></span></div><button onClick={() => setSidebarOpen(false)} aria-label="Tutup daftar percakapan"><FiX /></button></header>
        <button className="rk-chat-new" onClick={() => setCreateOpen(true)} disabled={backendPending}><FiPlus /> Percakapan baru</button>
        <label className="rk-chat-search"><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari percakapan" /></label>
        <nav className="rk-chat-shortcuts"><button data-active={listMode === 'unread'} onClick={() => setListMode((value) => value === 'unread' ? 'all' : 'unread')}><FiBell /><span>Belum dibaca</span><b>{workspace.unread_total}</b></button><button data-active={listMode === 'mentions'} onClick={() => setListMode((value) => value === 'mentions' ? 'all' : 'mentions')}><FiAtSign /><span>Mention</span>{workspace.mentions_total ? <b>{workspace.mentions_total}</b> : null}</button><button data-active={listMode === 'starred'} onClick={() => setListMode((value) => value === 'starred' ? 'all' : 'starred')}><FiStar /><span>Berbintang</span></button></nav>
        <ConversationGroup title="Pesan langsung" items={direct} selectedId={selectedId} onSelect={setSelectedId} />
        <ConversationGroup title="Ruang" items={spaces} selectedId={selectedId} onSelect={setSelectedId} />
      </aside>

      <section className="rk-chat-main">
        {detail ? <>
          <header className="rk-chat-conversation-head" data-meeting={hasMeeting}>
            <button className="rk-chat-mobile-back" onClick={() => setSidebarOpen(true)} aria-label="Buka daftar percakapan"><FiArrowLeft /></button>
            <Avatar name={detail.conversation.name} url={detail.conversation.avatar_url} />
            <div><h1>{detail.conversation.kind !== 'direct' ? '# ' : ''}{detail.conversation.name}</h1><span><FiUsers /> {detail.members.length || detail.conversation.member_count || 0} anggota</span>{hasMeeting ? <span className="rk-chat-meeting-badge"><FiVideo /> Meeting tersedia</span> : null}</div>
            <nav><button onClick={() => setSearchOpen(true)} aria-label="Cari pesan"><FiSearch /></button><button onClick={() => void toggleStar()} aria-label="Tandai percakapan berbintang"><FiStar /></button><button onClick={() => openAction('meeting')} aria-label="Buat Google Meet" title="Integrasi Google Meet"><FiVideo /><span>Buat Google Meet</span></button><button onClick={() => { setThreadOpen(false); setDetailOpen((value) => !value); }} aria-label="Detail percakapan"><FiInfo /></button></nav>
          </header>
          <section className="rk-chat-timeline">
            {detail.messages.map((item) => <article className="rk-chat-message" key={item.id} data-pinned={item.pinned}>
              <Avatar name={item.sender.name} url={item.sender.avatar_url} online={onlineIds.has(item.sender.id)} />
              <div><header><strong>{item.sender.name}</strong><time>{formatTime(item.created_at)}</time>{item.edited_at ? <small>diedit</small> : null}<button onClick={() => setMenuMessageId((value) => value === item.id ? null : item.id)} aria-label="Aksi pesan" aria-expanded={menuMessageId === item.id}><FiMoreVertical /></button></header>
                {menuMessageId === item.id ? <nav className="rk-chat-message-menu" aria-label="Aksi pesan">
                  <button onClick={() => void loadThread(item.id)}><FiCornerUpLeft /> Balas dalam thread</button>
                  <button onClick={() => openAction('assignment', item)}><FiBriefcase /> Buat assignment</button>
                  <button onClick={() => openAction('decision', item)}><FiCheckCircle /> Simpan keputusan</button>
                  <button onClick={() => openAction('project', item)}><FiHash /> Hubungkan project</button>
                  <button onClick={() => openAction('meeting', item)}><FiVideo /> Buat Google Meet</button>
                  <button onClick={() => askAiAbout(item)}><FiZap /> Ringkas dengan Kawan AI</button>
                  <button onClick={() => void pin(item)}><FiStar /> {item.pinned ? 'Lepas pin' : 'Sematkan pesan'}</button>
                  {!item.deleted_at ? <button onClick={() => openAction('edit', item, { body: item.body })}><FiEdit3 /> Edit pesan</button> : null}
                  {!item.deleted_at ? <button data-danger onClick={() => void removeMessage(item)}><FiTrash2 /> Hapus pesan</button> : null}
                </nav> : null}
                {item.deleted_at ? <p><em>Pesan telah dihapus.</em></p> : <p>{item.body}</p>}
                {item.attachments?.map((file) => <a className="rk-chat-file" href={file.url} target="_blank" rel="noreferrer" key={file.id}><FiFile /><span><strong>{file.name}</strong><small>{file.mime_type || 'Dokumen'}{file.size_label ? ` · ${file.size_label}` : ''}</small></span><FiDownload /></a>)}
                <footer>{item.reactions?.map((reaction) => <button data-active={reaction.reacted_by_me} onClick={() => void react(item.id, reaction.emoji)} key={reaction.emoji}>{reaction.emoji} {reaction.count}</button>)}<button onClick={() => void react(item.id, '👍')} aria-label="Beri reaksi"><FiSmile /></button><button className="rk-chat-replies" onClick={() => void loadThread(item.id)}><FiMessageCircle /> {item.reply_count ? `${item.reply_count} balasan` : 'Balas'}</button>{item.sender.id === workspace.me?.id ? <small className="rk-chat-delivery">{item.read_count ? `Dibaca ${item.read_count}` : 'Terkirim'}</small> : null}</footer>
              </div>
            </article>)}
            {!detail.messages.length ? <div className="rk-chat-empty"><FiMessageCircle /><strong>Mulai percakapan</strong><p>Kirim pesan pertama untuk berkoordinasi dengan ruang ini.</p></div> : null}
            <div ref={bottomRef} />
          </section>
          {notice ? <p className="rk-chat-alert" data-success>{notice}</p> : null}{error ? <p className="rk-chat-alert">{error}</p> : null}
          {Object.keys(typingMembers).length ? <p className="rk-chat-typing">{Object.values(typingMembers).slice(0, 2).join(' dan ')} sedang mengetik...</p> : null}
          <section className="rk-chat-compose-wrap">
            {pendingAttachments.length ? <div className="rk-chat-upload-queue">{pendingAttachments.map((file) => <span key={file.id}><FiFile /><span><strong>{file.name}</strong><small>Siap dikirim · tersimpan di Document Center bila kamu memiliki izin</small></span><button type="button" onClick={() => setPendingAttachments((items) => items.filter((item) => item.id !== file.id))} aria-label={`Hapus ${file.name} dari pesan`}><FiX /></button></span>)}</div> : null}
            {mentionTerm !== null ? <div className="rk-chat-mention-menu">{detail.members.filter((member) => member.id !== workspace.me?.id && member.name.toLowerCase().includes(mentionTerm)).slice(0, 6).map((member) => <button type="button" key={member.id} onClick={() => selectMention(member)}><Avatar name={member.name} url={member.avatar_url} online={onlineIds.has(member.id)} /><span><strong>{member.name}</strong><small>{member.position_name || 'Anggota'}</small></span></button>)}{!detail.members.some((member) => member.id !== workspace.me?.id && member.name.toLowerCase().includes(mentionTerm)) ? <p>Tidak ada anggota yang cocok.</p> : null}</div> : null}
            <form className="rk-chat-composer" onSubmit={send}><input ref={fileInputRef} hidden type="file" multiple onChange={(event) => void uploadFiles(event.target.files)} /><button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label="Lampirkan file">{uploading ? <FiLoader /> : <FiPaperclip />}</button><input value={message} onChange={(event) => updateMessage(event.target.value)} placeholder={`Ketik pesan ke ${detail.conversation.name}`} /><button type="button" onClick={() => updateMessage(`${message} ${message.endsWith(' ') || !message ? '' : ' '}@`)} aria-label="Mention anggota"><FiAtSign /></button><button type="submit" disabled={(!message.trim() && !pendingAttachments.length) || sending || uploading} aria-label="Kirim pesan">{sending ? <FiLoader /> : <FiSend />}</button></form>
          </section>
        </> : <ChatLanding backendPending={backendPending} onCreate={() => setCreateOpen(true)} />}
      </section>

      <aside className="rk-chat-detail">
        {threadOpen && thread ? <>
          <header><strong>Thread · {thread.replies.length} balasan</strong><button onClick={() => { setThreadOpen(false); setThread(null); }} aria-label="Tutup thread"><FiX /></button></header>
          <section className="rk-chat-thread"><MessageExcerpt item={thread.parent} online={onlineIds.has(thread.parent.sender.id)} />{thread.replies.map((item) => <MessageExcerpt item={item} online={onlineIds.has(item.sender.id)} key={item.id} />)}{!thread.replies.length ? <div className="rk-chat-detail-empty"><FiCornerUpLeft /><p>Belum ada balasan. Jadikan percakapan panjang tetap rapi lewat thread.</p></div> : null}</section>
          <form className="rk-chat-thread-composer" onSubmit={sendThread}><textarea value={threadMessage} onChange={(event) => setThreadMessage(event.target.value)} placeholder="Balas di thread" /><button disabled={!threadMessage.trim() || threadSending}>{threadSending ? <FiLoader /> : <FiSend />} Kirim</button></form>
        </> : <>
          <header><strong>Terkait</strong><button onClick={() => setDetailOpen(false)} aria-label="Tutup detail"><FiX /></button></header>
          {detail?.related.map((item) => <article key={`${item.type}-${item.id}`} data-type={item.type}><span>{item.type === 'project' ? <FiHash /> : item.type === 'meeting' ? <FiVideo /> : item.type === 'document' ? <FiFile /> : <FiMessageCircle />}</span><div><small>{item.type}</small><strong>{item.title}</strong>{item.subtitle ? <p>{item.subtitle}</p> : null}{item.url ? <a href={item.url}>Buka <FiArrowLeft /></a> : null}</div></article>)}
          {!detail?.related.length ? <div className="rk-chat-detail-empty"><FiLink /><p>Belum ada project, assignment, dokumen, atau meeting yang dihubungkan.</p></div> : null}
          <section><strong>Anggota</strong><div>{detail?.members.slice(0, 8).map((member) => <span className="rk-chat-member-dot" key={member.id}><Avatar name={member.name} url={member.avatar_url} online={onlineIds.has(member.id)} /><small>{member.name}</small></span>)}</div></section>
        </>}
      </aside>
    </section>
    {createOpen ? <CreateConversation members={workspace.members} onClose={() => setCreateOpen(false)} onCreated={async (id) => { setCreateOpen(false); await loadWorkspace(); setSelectedId(id); }} /> : null}
    {actionKind && detail ? <WorkActionDialog kind={actionKind} conversationId={detail.conversation.id} source={actionMessage} members={detail.members} seed={actionSeed} onClose={() => setActionKind(null)} onSaved={async (text) => { setActionKind(null); setNotice(text); await loadConversation(detail.conversation.id); }} /> : null}
    {searchOpen ? <ChatSearchDialog value={searchText} results={searchResults} searching={searching} mentionsOnly={listMode === 'mentions'} onChange={setSearchText} onSearch={runSearch} onClose={() => setSearchOpen(false)} onSelect={(item) => { setSelectedId(item.conversation_id); setSearchOpen(false); }} /> : null}
  </main>;
}

function Avatar({ name, url, online }: { name: string; url: string | null; online?: boolean }) {
  return <span className="rk-chat-avatar">{url ? <img src={url} alt="" /> : <i>{initials(name)}</i>}{online ? <b /> : null}</span>;
}
function MessageExcerpt({ item, online }: { item: Message; online: boolean }) {
  return <article className="rk-chat-thread-message"><Avatar name={item.sender.name} url={item.sender.avatar_url} online={online} /><div><header><strong>{item.sender.name}</strong><time>{formatTime(item.created_at)}</time></header><p>{item.deleted_at ? <em>Pesan telah dihapus.</em> : item.body}</p>{item.attachments?.map((file) => <a href={file.url} target="_blank" rel="noreferrer" key={file.id}><FiFile /> {file.name} <FiDownload /></a>)}</div></article>;
}
function ChatSearchDialog({ value, results, searching, mentionsOnly, onChange, onSearch, onClose, onSelect }: { value: string; results: SearchResult[]; searching: boolean; mentionsOnly: boolean; onChange: (value: string) => void; onSearch: (event: FormEvent) => Promise<void>; onClose: () => void; onSelect: (item: SearchResult) => void }) {
  return <div className="rk-chat-modal rk-chat-search-modal" role="dialog" aria-modal="true" aria-labelledby="chat-search-title"><section><header><div><small>{mentionsOnly ? 'Pencarian mention' : 'Semua percakapan'}</small><h2 id="chat-search-title">Cari pesan</h2></div><button onClick={onClose} aria-label="Tutup pencarian"><FiX /></button></header><form onSubmit={(event) => void onSearch(event)}><FiSearch /><input autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder="Ketik kata, keputusan, atau nama file" /><button disabled={!value.trim() || searching}>{searching ? <FiLoader /> : 'Cari'}</button></form><div className="rk-chat-search-results">{results.map((item) => <button key={item.id} onClick={() => onSelect(item)}><span><strong>{item.conversation_name}</strong><time>{new Date(item.created_at).toLocaleDateString('id-ID')}</time></span><p>{item.body}</p><small>{item.sender_name}{item.parent_id ? ' · balasan thread' : ''}</small></button>)}{!results.length && value ? <p>Belum ada hasil. Jalankan pencarian untuk menemukan pesan yang dapat kamu akses.</p> : null}</div></section></div>;
}
function ConversationGroup({ title, items, selectedId, onSelect }: { title: string; items: Conversation[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return <section className="rk-chat-group"><header><strong>{title}</strong><FiChevronDown /></header>{items.map((item) => <button key={item.id} data-active={selectedId === item.id} onClick={() => onSelect(item.id)}><Avatar name={item.name} url={item.avatar_url} /><span><strong>{item.kind !== 'direct' ? '# ' : ''}{item.name}</strong><small>{item.last_message || 'Belum ada pesan'}</small></span>{item.unread_count ? <b>{item.unread_count > 99 ? '99+' : item.unread_count}</b> : <time>{formatTime(item.last_message_at)}</time>}</button>)}{!items.length ? <p>Belum ada percakapan.</p> : null}</section>;
}
function ChatLanding({ backendPending, onCreate }: { backendPending: boolean; onCreate: () => void }) {
  return <div className="rk-chat-landing"><span><FiMessageCircle /></span><small>Kawan Chat</small><h1>Koordinasi kerja tetap di Ruang Kawan.</h1><p>{backendPending ? 'Tampilan Kawan Chat sudah siap. Endpoint realtime dan penyimpanan pesan masih perlu dihubungkan sebelum percakapan dapat digunakan.' : 'Pilih percakapan di samping atau mulai percakapan baru bersama tim.'}</p><button onClick={onCreate} disabled={backendPending}><FiPlus /> Percakapan baru</button>{backendPending ? <em>Backend chat belum terpasang · lihat catatan integrasi</em> : null}</div>;
}
function CreateConversation({ members, onClose, onCreated }: { members: Member[]; onClose: () => void; onCreated: (id: string) => Promise<void> }) {
  const [name, setName] = useState(''); const [kind, setKind] = useState<'direct' | 'group' | 'team' | 'project' | 'private'>('direct'); const [selected, setSelected] = useState<string[]>([]); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function save(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); const result = await createClient().rpc('create_chat_conversation', { conversation_name: name || null, conversation_kind: kind, member_ids: selected }); setSaving(false); if (result.error) { setError('Percakapan belum berhasil dibuat.'); return; } await onCreated(result.data as string); }
  return <div className="rk-chat-modal" role="dialog" aria-modal="true" aria-labelledby="new-chat-title"><form onSubmit={save}><header><div><small>Kawan Chat</small><h2 id="new-chat-title">Percakapan baru</h2></div><button type="button" onClick={onClose} aria-label="Tutup"><FiX /></button></header><label>Jenis percakapan<select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="direct">Pesan langsung</option><option value="group">Grup</option><option value="team">Team Space</option><option value="project">Project Space</option><option value="private">Private Space</option></select></label>{kind !== 'direct' ? <label>Nama ruang<input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Contoh: Tim Marketing" /></label> : null}<fieldset><legend>Pilih anggota</legend>{members.map((member) => <label key={member.id}><input type="checkbox" checked={selected.includes(member.id)} onChange={() => setSelected((value) => value.includes(member.id) ? value.filter((id) => id !== member.id) : [...value, member.id])} /><Avatar name={member.name} url={member.avatar_url} /><span><strong>{member.name}</strong><small>{member.position_name || 'Kawan Inovasi'}</small></span></label>)}{!members.length ? <p>Daftar anggota belum tersedia dari API chat.</p> : null}</fieldset>{error ? <p className="rk-chat-modal-error">{error}</p> : null}<footer><button type="button" onClick={onClose}>Batal</button><button type="submit" data-primary disabled={saving || !selected.length}>{saving ? 'Membuat...' : 'Mulai percakapan'}</button></footer></form></div>;
}

function WorkActionDialog({ kind, conversationId, source, members, seed, onClose, onSaved }: {
  kind: Exclude<ActionKind, null>; conversationId: string; source: Message | null; members: Member[];
  seed: Record<string, unknown>; onClose: () => void; onSaved: (message: string) => Promise<void>;
}) {
  const now = new Date(); const defaultEnd = new Date(now.getTime() + 60 * 60_000);
  const [title, setTitle] = useState(String(seed.title ?? (kind === 'assignment' ? source?.body : kind === 'decision' ? source?.body : kind === 'meeting' ? 'Koordinasi Kawan Inovasi' : '')));
  const [detailText, setDetailText] = useState(String(seed.detail ?? seed.description ?? source?.body ?? ''));
  const [dueDate, setDueDate] = useState(String(seed.due_date ?? new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })));
  const [ownerId, setOwnerId] = useState(String(seed.owner_membership_id ?? ''));
  const [reviewerId, setReviewerId] = useState(String(seed.reviewer_membership_id ?? ''));
  const [priority, setPriority] = useState(String(seed.priority ?? 'medium'));
  const [startsAt, setStartsAt] = useState(String(seed.starts_at ?? localInputValue(now)));
  const [endsAt, setEndsAt] = useState(String(seed.ends_at ?? localInputValue(defaultEnd)));
  const [attendees, setAttendees] = useState<string[]>(() => Array.isArray(seed.attendee_membership_ids) ? seed.attendee_membership_ids.map(String) : members.map((member) => member.id));
  const [projects, setProjects] = useState<ProjectOption[]>([]); const [projectId, setProjectId] = useState(String(seed.project_id ?? ''));
  const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [needsGoogle, setNeedsGoogle] = useState(false);

  useEffect(() => { if (kind === 'project') void createClient().rpc('list_projects').then((result) => { if (!result.error) setProjects((result.data ?? []) as ProjectOption[]); }); }, [kind]);

  async function complete(message: string) {
    if (seed._aiRunId && seed._aiActionId) {
      try { await createClient().rpc('confirm_kawan_ai_action', { target_run_id: String(seed._aiRunId), action_id: String(seed._aiActionId) }); } catch { /* Aksi utama tetap berhasil; audit AI dapat direkonsiliasi. */ }
    }
    await onSaved(message);
  }

  async function connectGoogle() {
    setSaving(true); setError(''); const supabase = createClient(); const refreshed = await supabase.auth.refreshSession(); const session = refreshed.data.session ?? (await supabase.auth.getSession()).data.session;
    if (!session) { setSaving(false); setError('Sesi login berakhir.'); return; }
    const response = await fetch(`${supabaseUrl}/functions/v1/ruang-kawan-calendar/authorize`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ connectionType: 'personal', returnUrl: window.location.href }) });
    const body = await response.json(); setSaving(false);
    if (!response.ok || !body.url) { setError(body.error ?? 'Google Calendar belum dapat dihubungkan.'); return; }
    window.location.assign(body.url);
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setNeedsGoogle(false); const supabase = createClient();
    if (kind === 'edit') {
      if (!source) { setSaving(false); setError('Pesan sumber tidak tersedia.'); return; }
      const result = await supabase.rpc('update_chat_message', { target_message_id: source.id, message_body: detailText }); setSaving(false);
      if (result.error) { setError(result.error.message); return; } await complete('Pesan berhasil diperbarui.'); return;
    }
    if (kind === 'assignment') {
      if (!source) { setSaving(false); setError('Pilih pesan sumber untuk membuat assignment.'); return; }
      const payload = { title, detail: detailText, due_date: dueDate, priority, owner_membership_id: ownerId || undefined, reviewer_membership_id: reviewerId || undefined, next_action: String(seed.next_action ?? '') };
      const result = await supabase.rpc('create_assignment_from_chat', { target_message_id: source.id, payload }); setSaving(false);
      if (result.error) { setError(result.error.message); return; } await complete('Assignment dibuat dan dihubungkan ke percakapan.'); return;
    }
    if (kind === 'decision') {
      const result = await supabase.rpc('save_chat_relation', { target_conversation_id: conversationId, target_message_id: source?.id ?? null, relation_kind: 'decision', relation_uuid: null, relation_title: title, relation_url: null, relation_metadata: { summary: detailText } }); setSaving(false);
      if (result.error) { setError(result.error.message); return; } await complete('Keputusan disimpan pada konteks percakapan.'); return;
    }
    if (kind === 'project') {
      const project = projects.find((item) => item.id === projectId);
      if (!project) { setSaving(false); setError('Pilih project yang dapat kamu akses.'); return; }
      const result = await supabase.rpc('save_chat_relation', { target_conversation_id: conversationId, target_message_id: source?.id ?? null, relation_kind: 'project', relation_uuid: project.id, relation_title: project.name, relation_url: '/ruang-kawan/projects/', relation_metadata: { project_code: project.project_code } }); setSaving(false);
      if (result.error) { setError(result.error.message); return; } await complete('Project dihubungkan ke percakapan.'); return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); setError('Sesi login berakhir.'); return; }
    const response = await fetch(`${supabaseUrl}/functions/v1/ruang-kawan-calendar/meetings`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId, sourceMessageId: source?.id ?? null, title, agenda: detailText, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), timezone: 'Asia/Jakarta', attendeeMembershipIds: attendees }) });
    const body = await response.json(); setSaving(false);
    if (!response.ok) { setNeedsGoogle(Boolean(body.needsAuthorization)); setError(body.error ?? 'Meeting belum berhasil dibuat.'); return; }
    await complete(body.meetUrl ? `Google Meet dibuat: ${body.meetUrl}` : 'Event Calendar berhasil dibuat dan dihubungkan.');
  }

  const labels = { assignment: ['Assignment dari chat', 'Buat assignment'], decision: ['Catatan keputusan', 'Simpan keputusan'], meeting: ['Google Meet & Calendar', 'Buat meeting'], project: ['Relasi pekerjaan', 'Hubungkan project'], edit: ['Pesan', 'Edit pesan'] } as const;
  return <div className="rk-chat-modal rk-chat-action-modal" role="dialog" aria-modal="true" aria-labelledby="chat-action-title"><form onSubmit={save}>
    <header><div><small>{labels[kind][0]}</small><h2 id="chat-action-title">{labels[kind][1]}</h2></div><button type="button" onClick={onClose} aria-label="Tutup"><FiX /></button></header>
    {kind === 'project' ? <label>Project<select value={projectId} onChange={(event) => setProjectId(event.target.value)} required><option value="">Pilih project</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.project_code ? `${project.project_code} · ` : ''}{project.name}</option>)}</select></label> : <>
      {kind !== 'edit' ? <label>Judul<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label> : null}
      <label>{kind === 'meeting' ? 'Agenda' : kind === 'edit' ? 'Isi pesan' : kind === 'decision' ? 'Ringkasan keputusan' : 'Detail'}<textarea value={detailText} onChange={(event) => setDetailText(event.target.value)} required /></label>
    </>}
    {kind === 'assignment' ? <div className="rk-chat-action-grid"><label>Deadline<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></label><label>Prioritas<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="low">Rendah</option><option value="medium">Sedang</option><option value="high">Tinggi</option><option value="urgent">Mendesak</option></select></label><label>PIC<select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}><option value="">Saya sendiri</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label>Reviewer<select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)}><option value="">Tanpa reviewer</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label></div> : null}
    {kind === 'meeting' ? <><div className="rk-chat-action-grid"><label>Mulai<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label><label>Selesai<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required /></label></div><fieldset><legend>Undang anggota percakapan</legend>{members.map((member) => <label key={member.id}><input type="checkbox" checked={attendees.includes(member.id)} onChange={() => setAttendees((items) => items.includes(member.id) ? items.filter((id) => id !== member.id) : [...items, member.id])} /><Avatar name={member.name} url={member.avatar_url} /><span><strong>{member.name}</strong><small>{member.email || member.position_name || 'Anggota percakapan'}</small></span></label>)}</fieldset></> : null}
    {source && kind !== 'edit' ? <blockquote><small>Sumber pesan</small><p>{source.body}</p></blockquote> : null}
    {error ? <p className="rk-chat-modal-error">{error}</p> : null}
    <footer>{needsGoogle ? <button type="button" onClick={() => void connectGoogle()} disabled={saving}><FiCalendar /> Hubungkan Google Calendar</button> : null}<button type="button" onClick={onClose}>Batal</button><button type="submit" data-primary disabled={saving}>{saving ? 'Memproses...' : labels[kind][1]}</button></footer>
  </form></div>;
}
