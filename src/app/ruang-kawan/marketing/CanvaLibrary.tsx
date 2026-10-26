'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiClock, FiExternalLink, FiFileText, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';

type CanvaLink = {
  id: string;
  url: string;
  normalized_url: string;
  title_hint: string | null;
  shared_at: string;
  sender_name: string;
  conversation_name: string;
  share_count: number;
  last_shared_at: string;
};

type Period = 'all' | 'month' | 'year';
type Kind = 'Semua' | 'Proposal' | 'Deck' | 'Company profile' | 'Lainnya';

function contentKind(item: CanvaLink): Exclude<Kind, 'Semua'> {
  const text = `${item.title_hint ?? ''} ${item.url} ${item.conversation_name}`.toLowerCase();
  if (/company profile|company-profile|compro|profil perusahaan/.test(text)) return 'Company profile';
  if (/proposal|penawaran|offering/.test(text)) return 'Proposal';
  if (/deck|pitch|ppt|powerpoint|presentasi/.test(text)) return 'Deck';
  return 'Lainnya';
}

function canvaPreview(url: string) {
  const clean = url.split(/[?#]/, 1)[0];
  if (!/^https?:\/\/(www\.)?canva\.com\/design\//i.test(clean)) return clean;
  return `${clean.replace(/\/(edit|view)\/?$/i, '')}/view?embed`;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

export default function CanvaLibrary() {
  const [items, setItems] = useState<CanvaLink[]>([]);
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [kind, setKind] = useState<Kind>('Semua');
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const { data, error: rpcError } = await createClient().rpc('marketing_canva_library');
    if (rpcError) {
      setError('Galeri belum dapat dimuat. Coba muat ulang.');
    } else {
      setItems((data ?? []) as CanvaLink[]);
      setError('');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const client = createClient();
    void load();
    const channel = client
      .channel('marketing-canva-library-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_canva_links' }, () => {
        void load(true);
      })
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') void load(true);
      });
    return () => { void client.removeChannel(channel); };
  }, [load]);

  const years = useMemo(() => Array.from(new Set(items.map((item) => new Date(item.shared_at).getFullYear()))).sort((a, b) => b - a), [items]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const date = new Date(item.shared_at);
      const searchable = `${item.title_hint ?? ''} ${item.url} ${item.sender_name} ${item.conversation_name}`.toLowerCase();
      if (needle && !searchable.includes(needle)) return false;
      if (kind !== 'Semua' && contentKind(item) !== kind) return false;
      if (period === 'month' && item.shared_at.slice(0, 7) !== month) return false;
      if (period === 'year' && String(date.getFullYear()) !== year) return false;
      return true;
    });
  }, [items, query, period, month, year, kind]);

  return (
    <section className="rk-marketing-panel rk-canva-library">
      <header className="rk-canva-heading">
        <div>
          <small>SHARED IN KAWAN CHAT</small>
          <h2>Canva Library</h2>
          <p>Link Canva yang dibagikan di chat terkumpul otomatis di sini. Galeri diperbarui saat ada link baru.</p>
        </div>
        <div className="rk-canva-live" data-live={live}>
          <i /> {live ? 'Realtime aktif' : 'Menghubungkan...'}
        </div>
      </header>

      <div className="rk-canva-controls">
        <label className="rk-canva-search"><FiSearch /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari judul, ruang, atau pengirim" /></label>
        <div className="rk-canva-date-filter">
          <FiClock />
          <select aria-label="Filter waktu" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="all">Semua waktu</option><option value="month">Per bulan</option><option value="year">Per tahun</option>
          </select>
          {period === 'month' ? <input aria-label="Pilih bulan" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /> : null}
          {period === 'year' ? <select aria-label="Pilih tahun" value={year} onChange={(e) => setYear(e.target.value)}>{Array.from(new Set([new Date().getFullYear(), ...years])).map((itemYear) => <option key={itemYear}>{itemYear}</option>)}</select> : null}
        </div>
        <button className="rk-canva-refresh" onClick={() => void load()} disabled={loading}><FiRefreshCw className={loading ? 'is-spinning' : ''} /> Muat ulang</button>
      </div>

      <nav className="rk-canva-kinds" aria-label="Filter jenis desain">
        {(['Semua', 'Proposal', 'Deck', 'Company profile', 'Lainnya'] as Kind[]).map((itemKind) => <button key={itemKind} data-active={kind === itemKind} onClick={() => setKind(itemKind)}>{itemKind}</button>)}
        <span>{filtered.length} desain</span>
      </nav>

      {error ? <div className="rk-canva-empty" role="alert">{error}<button onClick={() => void load()}>Coba lagi</button></div> : null}
      {loading && !items.length ? <div className="rk-canva-empty">Mengumpulkan desain dari Kawan Chat…</div> : null}
      {!loading && !error && filtered.length === 0 ? <div className="rk-canva-empty"><FiFileText /><strong>Belum ada desain pada filter ini</strong><span>Link Canva yang dibagikan di Kawan Chat akan muncul otomatis.</span></div> : null}

      <div className="rk-canva-grid">
        {filtered.map((item) => {
          const preview = canvaPreview(item.url);
          const title = item.title_hint?.trim() || `${contentKind(item)} Canva`;
          return <article className="rk-canva-card" key={item.normalized_url}>
            <div className="rk-canva-preview">
              {preview ? <iframe src={preview} title={`Preview Canva: ${title}`} loading="lazy" allowFullScreen /> : <div className="rk-canva-preview-fallback"><span>CANVA</span><strong>Preview mengikuti izin tautan</strong><small>Buka desain untuk melihat halaman dan menggeser slide.</small></div>}
              <span className="rk-canva-kind">{contentKind(item)}</span>
            </div>
            <div className="rk-canva-card-body">
              <h3 title={title}>{title}</h3>
              <p><strong>{item.conversation_name}</strong><span>·</span>{item.sender_name}</p>
              <footer><time dateTime={item.shared_at}>{shortDate(item.shared_at)}</time><span>{item.share_count > 1 ? `${item.share_count} kali dibagikan` : '1 kali dibagikan'}</span></footer>
              <a href={item.url} target="_blank" rel="noreferrer">Buka di Canva <FiExternalLink /></a>
            </div>
          </article>;
        })}
      </div>
    </section>
  );
}
