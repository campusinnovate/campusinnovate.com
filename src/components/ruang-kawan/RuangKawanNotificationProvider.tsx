'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FiBell, FiX } from 'react-icons/fi';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { ToastNotice, workspaceUrl } from '@/lib/notify';

type Row = { id: string; title: string; message: string | null; action_url: string | null; created_at: string; read_at: string | null };
function Toast({ item, close }: { item: ToastNotice & { id: string }; close: (id: string) => void }) {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  useEffect(() => { if (paused) return; const timer = setTimeout(() => close(item.id), item.kind === 'error' ? 9000 : 6000); return () => clearTimeout(timer); }, [paused, close, item.kind, item.id]);
  return <motion.article layout initial={{ opacity: 0, x: reduced ? 0 : 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : 100 }} transition={{ duration: reduced ? 0 : .25 }} data-kind={item.kind} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
    <FiBell /><div><strong>{item.title}</strong>{item.message ? <p>{item.message}</p> : null}{item.url ? <a href={workspaceUrl(item.url)}>Lihat detail</a> : null}</div><button onClick={() => close(item.id)} aria-label="Tutup pemberitahuan"><FiX /></button>
  </motion.article>;
}
export default function RuangKawanNotificationProvider() {
  const [items, setItems] = useState<(ToastNotice & { id: string })[]>([]);
  const dismiss = useCallback((id:string) => setItems(current => current.filter(item => item.id !== id)), []);
  const seen = useRef(new Map<string, number>());
  useEffect(() => {
    let connectionVersion=0;
    let active = true, channel: RealtimeChannel | null = null, polling = false;
    const supabase = createClient();
    let lastSeen = new Date().toISOString();
    const push = (notice: ToastNotice) => {
      const key = notice.id ?? `${notice.title}:${notice.message}`;
      if (Date.now() - (seen.current.get(key) ?? 0) < 15000) return;
      seen.current.set(key, Date.now());
      if (seen.current.size > 300) seen.current.delete(seen.current.keys().next().value!);
      setItems(current => [...current, { ...notice, id: notice.id ?? crypto.randomUUID() }].slice(-4));
    };
    const receive = (event: Event) => push((event as CustomEvent<ToastNotice>).detail);
    const offline = () => push({ title: 'Koneksi terputus', message: 'Perubahan belum tentu tersimpan. Periksa koneksi sebelum melanjutkan.', kind: 'error' });
    const online = () => { push({ title: 'Koneksi kembali tersedia', kind: 'success' }); void refresh(); };
    const invalid = (event: Event) => {
      const field = event.target as HTMLInputElement;
      push({ title: 'Periksa isian formulir', message: `${field.labels?.[0]?.textContent?.slice(0, 100) || field.placeholder || 'Isian'}: ${field.validationMessage}`, kind: 'error' });
    };
    const refresh = async () => {
      if (polling || !active) return;
      polling = true;
      try {
        const result = await supabase.rpc('notification_center_workspace');
        if (result.error || !active) return;
        const data = result.data as { unread: number; items: Row[] };
        window.dispatchEvent(new CustomEvent('kawan-notification-unread', { detail: { count: data.unread ?? 0 } }));
        window.dispatchEvent(new CustomEvent('kawan-notifications-updated'));
        for (const row of [...(data.items ?? [])].reverse()) {
          if (row.created_at > lastSeen && !row.read_at) push({ id: row.id, title: row.title, message: row.message, url: row.action_url });
        }
        lastSeen = (data.items ?? []).reduce((latest, row) => row.created_at > latest ? row.created_at : latest, lastSeen);
      } finally { polling = false; }
    };
    const connect = async () => {
      const version=++connectionVersion;
      if (channel) { await supabase.removeChannel(channel); channel = null; }
      const member = await supabase.rpc('current_membership_id');
      if (!active || !member.data || version!==connectionVersion) return;
      await refresh();
      if(!active || version!==connectionVersion)return;
      channel = supabase.channel(`rk-notifications:${member.data}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_membership_id=eq.${member.data}` }, () => void refresh()).subscribe();
    };
    void connect();
    const { data: auth } = supabase.auth.onAuthStateChange(event => { if (event === 'SIGNED_IN') setTimeout(() => { if (active) void connect(); }, 0); if (event === 'SIGNED_OUT') { setItems([]); if (channel) void supabase.removeChannel(channel); } });
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30000);
    window.addEventListener('kawan-toast', receive); window.addEventListener('offline', offline); window.addEventListener('online', online); window.addEventListener('focus', refresh); document.addEventListener('invalid', invalid, true);
    // Surface existing inline validation and status messages across workspace pages.
    const observer = new MutationObserver(records => {
      const candidates = new Set<Element>();
      for (const record of records) {
        const element = record.target instanceof Element ? record.target : record.target.parentElement;
        const parent = element?.closest('[class*="-alert"], [class*="-error"], [role="alert"]');
        if (parent) candidates.add(parent);
        record.addedNodes.forEach(node => { if (node instanceof Element) { if (node.matches('[class*="-alert"], [class*="-error"], [role="alert"]')) candidates.add(node); node.querySelectorAll('[class*="-alert"], [class*="-error"], [role="alert"]').forEach(value => candidates.add(value)); } });
      }
      candidates.forEach(element => {
        if (element.closest('.rk-toast-stack') || !element.textContent?.trim()) return;
        const failed = element.hasAttribute('data-error') || element.className.includes('-error');
        push({ title: failed ? 'Perlu diperiksa' : 'Informasi Ruang Kawan', message: element.textContent.trim().slice(0, 400), kind: failed ? 'error' : 'info' });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { active = false; observer.disconnect(); clearInterval(timer); auth.subscription.unsubscribe(); if (channel) void supabase.removeChannel(channel); window.removeEventListener('kawan-toast', receive); window.removeEventListener('offline', offline); window.removeEventListener('online', online); window.removeEventListener('focus', refresh); document.removeEventListener('invalid', invalid, true); };
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(<aside className="rk-toast-stack" aria-live="polite" aria-label="Pemberitahuan Ruang Kawan"><AnimatePresence>{items.map(item => <Toast key={item.id} item={item} close={dismiss} />)}</AnimatePresence></aside>, document.body);
}
