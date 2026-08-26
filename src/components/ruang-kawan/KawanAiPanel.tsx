'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FiArrowRight, FiLoader, FiMessageSquare, FiSend, FiX, FiZap } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';
import { supabasePublishableKey, supabaseUrl } from '@/lib/supabase/config';

type AiContext = { entityType?: string | null; entityId?: string | null; label?: string | null; data?: Record<string, unknown> };
type AiAction = { id: string; type: 'create_assignment' | 'save_decision' | 'create_meeting' | 'link_project'; title: string; payload_json?: string };
type AiReply = { id: string; role: 'user' | 'assistant'; text: string; actions?: AiAction[]; runId?: string | null };
type Access = { membership_status?: string; permissions?: string[] };

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard', activity: 'My Activity', notes: 'Coret-coret', assignments: 'Assignment', chat: 'Kawan Chat',
  'content-plan': 'Content Plan', pipeline: 'Pipeline BD', projects: 'Project', kpi: 'KPI', marketing: 'Marketing',
  documents: 'Document Center', reports: 'Report & Analysis', finance: 'Finance', notifications: 'Notifikasi', profile: 'Profil Pegawai', admin: 'Admin',
};

const routeSuggestions: Record<string, string[]> = {
  dashboard: ['Ringkas kondisi kerja saya hari ini', 'Apa yang perlu segera saya tindak lanjuti?'],
  activity: ['Prioritas apa yang harus saya kerjakan?', 'Ringkas pekerjaan terbuka saya'],
  notes: ['Ringkas catatan penting saya', 'Kelompokkan ide dan tindak lanjut dari catatan saya'],
  assignments: ['Assignment mana yang paling mendesak?', 'Ringkas pekerjaan yang perlu direview'],
  chat: ['Ringkas percakapan ini', 'Apa keputusan dan tindak lanjutnya?', 'Buat draft assignment dari pembahasan'],
  'content-plan': ['Konten apa yang perlu diprioritaskan?', 'Ringkas status Content Plan'],
  pipeline: ['Lead mana yang perlu segera ditindaklanjuti?', 'Ringkas risiko dan peluang pipeline'],
  projects: ['Ringkas status project yang dapat saya akses', 'Apa blocker dan tindak lanjut project?'],
  kpi: ['Ringkas progres KPI saya', 'Apa KPI yang masih perlu diperbarui?'],
  marketing: ['Ringkas pekerjaan Marketing aktif', 'Apa proposal atau brand task yang perlu ditindaklanjuti?'],
  finance: ['Ringkas kondisi Finance terbaru', 'Apa transaksi atau dokumen yang perlu diperhatikan?'],
  documents: ['Dokumen apa yang perlu direview?', 'Ringkas status Document Center'],
  reports: ['Ringkas report dan action item saya', 'Apa laporan yang belum selesai?'],
  notifications: ['Ringkas notifikasi penting saya', 'Apa yang perlu saya tindaklanjuti dari notifikasi?'],
  profile: ['Ringkas profil kerja saya', 'Data profil apa yang belum lengkap?'],
  admin: ['Ringkas kondisi akses dan anggota aktif', 'Apa konfigurasi yang perlu diperiksa?'],
};

export default function KawanAiPanel() {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [context, setContext] = useState<AiContext>({});
  const [replies, setReplies] = useState<AiReply[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const result = await supabase.rpc('get_my_access');
      const access = (Array.isArray(result.data) ? result.data[0] : result.data) as Access | null;
      if (active) setAllowed(access?.membership_status === 'active' && Boolean(access.permissions?.includes('ai.use')));
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setContext({});
  }, [pathname]);

  useEffect(() => {
    const receiveContext = (event: Event) => setContext((event as CustomEvent<AiContext>).detail ?? {});
    const openPanel = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string }>).detail;
      if (detail?.prompt) setPrompt(detail.prompt);
      setOpen(true);
    };
    window.addEventListener('kawan-ai-context', receiveContext);
    window.addEventListener('kawan-ai-open', openPanel);
    return () => {
      window.removeEventListener('kawan-ai-context', receiveContext);
      window.removeEventListener('kawan-ai-open', openPanel);
    };
  }, []);

  const moduleName = useMemo(() => {
    const segment = pathname.split('/').filter(Boolean)[1] ?? '';
    return context.label || routeLabels[segment] || 'Ruang Kawan';
  }, [pathname, context.label]);

  const activeSegment = pathname.split('/').filter(Boolean)[1] ?? '';
  const suggestions = routeSuggestions[activeSegment] ?? ['Apa yang perlu saya perhatikan di halaman ini?', 'Bantu susun langkah kerja berikutnya'];

  async function ask(event: FormEvent) {
    event.preventDefault();
    const question = prompt.trim();
    if (!question || loading) return;
    setPrompt(''); setError(''); setLoading(true);
    setReplies((items) => [...items, { id: crypto.randomUUID(), role: 'user', text: question }]);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Sesi Ruang Kawan sudah berakhir. Silakan login ulang.'); setLoading(false); return; }
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/kawan-ai`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: supabasePublishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: question, route: pathname, entityType: context.entityType ?? null, entityId: context.entityId ?? null, contextHint: context.data ?? {} }),
      });
      const payload = await response.json().catch(() => ({})) as { answer?: string; actions?: AiAction[]; runId?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Kawan AI belum dapat menjawab.');
      setReplies((items) => [...items, { id: crypto.randomUUID(), role: 'assistant', text: payload.answer || 'Tidak ada jawaban.', actions: payload.actions ?? [], runId: payload.runId ?? null }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kawan AI belum dapat menjawab.');
    } finally { setLoading(false); }
  }

  function reviewAction(action: AiAction, runId?: string | null) {
    window.dispatchEvent(new CustomEvent('kawan-ai-action', { detail: { action, runId: runId ?? null } }));
    setOpen(false);
  }

  if (!allowed || pathname === '/ruang-kawan' || pathname.startsWith('/ruang-kawan/callback')) return null;
  return <aside className="rk-ai" data-open={open} aria-label="Kawan AI">
    <button className="rk-ai-launcher" onClick={() => setOpen(true)} aria-label="Buka Kawan AI"><FiZap /><span>Kawan AI</span></button>
    {open ? <section className="rk-ai-panel">
      <header><div><span><FiZap /></span><div><small>Asisten kerja kontekstual</small><strong>Kawan AI</strong></div></div><button onClick={() => setOpen(false)} aria-label="Tutup Kawan AI"><FiX /></button></header>
      <div className="rk-ai-context"><span>Konteks aktif</span><strong>{moduleName}</strong><small>Kawan AI hanya membaca data yang memang boleh kamu akses.</small></div>
      <div className="rk-ai-conversation">
        {!replies.length ? <div className="rk-ai-welcome"><FiMessageSquare /><strong>Apa yang ingin kamu kerjakan?</strong><p>Minta ringkasan, prioritas, atau draft tindak lanjut. Aksi tidak akan dijalankan tanpa konfirmasi kamu.</p><div>{suggestions.map((item) => <button key={item} onClick={() => setPrompt(item)}>{item}<FiArrowRight /></button>)}</div></div> : null}
        {replies.map((reply) => <article key={reply.id} data-role={reply.role}><small>{reply.role === 'assistant' ? 'Kawan AI' : 'Kamu'}</small><p>{reply.text}</p>{reply.actions?.length ? <div className="rk-ai-actions">{reply.actions.map((action) => <button key={action.id} onClick={() => reviewAction(action, reply.runId)}><span><small>Draft tindakan</small><strong>{action.title}</strong></span><FiArrowRight /></button>)}</div> : null}</article>)}
        {loading ? <article data-role="assistant"><small>Kawan AI</small><p><FiLoader className="rk-ai-spin" /> Sedang menyusun jawaban...</p></article> : null}
      </div>
      {error ? <p className="rk-ai-error">{error}</p> : null}
      <form onSubmit={ask}><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={`Tanyakan sesuatu tentang ${moduleName}`} maxLength={2000} /><button type="submit" disabled={!prompt.trim() || loading} aria-label="Kirim ke Kawan AI"><FiSend /></button></form>
      <footer>Jawaban AI perlu diperiksa. Draft aksi selalu menunggu konfirmasi.</footer>
    </section> : null}
  </aside>;
}
