'use client';

import Link from 'next/link';
import { CSSProperties, FormEvent, useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiBookOpen, FiCalendar, FiCheckCircle, FiChevronDown, FiEdit2, FiFlag, FiPlus, FiRefreshCw, FiTarget, FiTrash2, FiTrendingUp, FiUsers, FiX } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';

type Pillar = 'foundation' | 'topline' | 'middleline' | 'bottomline';
type Period = 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'custom';
type Access = { membership_status?: string; position_name?: string | null; full_name?: string | null };
type Founder = { membership_id: string; full_name: string; position_name: string };
type Strategy = {
  id: string;
  pillar: Pillar;
  title: string;
  description: string | null;
  metric_name: string;
  target_value: number;
  current_value: number;
  unit_label: string;
  period_type: Period;
  starts_on: string;
  due_on: string;
  owner_membership_id: string;
  created_at: string;
  updated_at: string;
};
type Snapshot = { strategy_id: string; recorded_on: string; value: number };
type StrategyForm = {
  id: string | null;
  pillar: Pillar;
  title: string;
  description: string;
  metric_name: string;
  target_value: string;
  current_value: string;
  unit_label: string;
  period_type: Period;
  starts_on: string;
  due_on: string;
  owner_membership_id: string;
};

const founderRoles = ['CEO', 'CTO', 'COO'];
const pillars: { key: Pillar; title: string; subtitle: string; accent: string; soft: string; icon: string }[] = [
  { key: 'foundation', title: 'Foundation', subtitle: 'Fondasi, arah, dan kapasitas bisnis', accent: '#6177bd', soft: '#eef0fb', icon: '01' },
  { key: 'topline', title: 'Topline', subtitle: 'Lead generator dan pertumbuhan revenue', accent: '#c58a48', soft: '#fbf1e5', icon: '02' },
  { key: 'middleline', title: 'Middleline', subtitle: 'Eksekusi layanan dan kesiapan delivery', accent: '#278b8d', soft: '#e6f4f3', icon: '03' },
  { key: 'bottomline', title: 'Bottomline', subtitle: 'Administrasi, keuangan, dan kontrol bisnis', accent: '#8d67a9', soft: '#f3ecf7', icon: '04' },
];
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const currentMonthKey = () => today().slice(0, 7);
const monthEnd = (key: string) => { const [year, month] = key.split('-').map(Number); return new Date(year, month, 0).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); };
const shiftMonth = (key: string, amount: number) => { const [year, month] = key.split('-').map(Number); const date = new Date(year, month - 1 + amount, 1); return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(0, 7); };
const monthName = (key: string) => { const [year, month] = key.split('-').map(Number); return new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }); };
const afterDays = (days: number) => {
  const d = new Date(today() + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
};
const freshForm = (pillar: Pillar = 'topline', owner = ''): StrategyForm => ({
  id: null, pillar, title: '', description: '', metric_name: '', target_value: '', current_value: '0',
  unit_label: 'lead', period_type: 'monthly', starts_on: today(), due_on: afterDays(30), owner_membership_id: owner,
});
const ratio = (item: Strategy) => item.target_value > 0 ? Math.max(0, Math.min(100, Number(item.current_value) / Number(item.target_value) * 100)) : 0;
const number = (value: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(Number(value) || 0);
const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);
const formatMetric = (value: number, unit: string) => /^(rp|idr|rupiah)$/i.test(unit.trim()) ? money(value) : number(value) + (unit ? ' ' + unit : '');
const periodLabel = (period: Period) => ({ weekly: 'Mingguan', monthly: 'Bulanan', quarterly: 'Kuartalan', annual: 'Tahunan', custom: 'Khusus' }[period]);
const dateLabel = (date: string) => date ? new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const formFor = (item: Strategy): StrategyForm => ({
  id: item.id, pillar: item.pillar, title: item.title, description: item.description ?? '', metric_name: item.metric_name,
  target_value: String(item.target_value), current_value: String(item.current_value), unit_label: item.unit_label,
  period_type: item.period_type, starts_on: item.starts_on, due_on: item.due_on, owner_membership_id: item.owner_membership_id,
});
function strategyState(item: Strategy, asOf = today()) {
  const percent = ratio(item);
  if (percent >= 100) return { label: 'Tercapai', tone: 'done' };
  if (item.due_on < asOf) return { label: 'Berisiko', tone: 'risk' };
  if (item.starts_on > asOf) return { label: 'Terjadwal', tone: 'planned' };
  const start = Date.parse(item.starts_on + 'T00:00:00Z');
  const end = Date.parse(item.due_on + 'T00:00:00Z');
  const now = Date.parse(asOf + 'T00:00:00Z');
  const expected = end > start ? Math.min(100, Math.max(0, (now - start) / (end - start) * 100)) : 100;
  if (expected - percent >= 20) return { label: 'Perlu perhatian', tone: 'risk' };
  return { label: 'Berjalan', tone: 'active' };
}
function reportValues(strategies: Strategy[], snapshots: Snapshot[], month: string) {
  const through = monthEnd(month);
  return pillars.map(pillar => {
    const items = strategies.filter(item => item.pillar === pillar.key && item.starts_on <= through);
    const values = items.map(item => {
      const history = snapshots
        .filter(snapshot => snapshot.strategy_id === item.id && snapshot.recorded_on <= through)
        .sort((a, b) => b.recorded_on.localeCompare(a.recorded_on));
      const value = history[0] ? Number(history[0].value) : (item.updated_at.slice(0, 10) <= through ? Number(item.current_value) : null);
      return value === null || !Number.isFinite(value) || Number(item.target_value) <= 0
        ? null
        : Math.max(0, Math.min(100, value / Number(item.target_value) * 100));
    }).filter((value): value is number => value !== null);
    return { ...pillar, score: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, count: items.length, reported: values.length };
  });
}
function StrategicBalance({ strategies, snapshots, month, onMonthChange }: { strategies: Strategy[]; snapshots: Snapshot[]; month: string; onMonthChange: (value: string) => void }) {
  const availableMonths = useMemo(() => Array.from({ length: 12 }, (_, index) => shiftMonth(currentMonthKey(), -11 + index)), []);
  const current = useMemo(() => reportValues(strategies, snapshots, month), [strategies, snapshots, month]);
  const previous = useMemo(() => reportValues(strategies, snapshots, shiftMonth(month, -1)), [strategies, snapshots, month]);
  const values = current.filter(item => item.score !== null);
  const highest = values.length ? values.reduce((best, item) => item.score! > best.score! ? item : best) : null;
  const lowest = values.length ? values.reduce((worst, item) => item.score! < worst.score! ? item : worst) : null;
  const gap = highest && lowest ? Math.round(highest.score! - lowest.score!) : 0;
  const deltas = current.map(item => {
    const before = previous.find(old => old.key === item.key)?.score;
    return { ...item, delta: item.score !== null && before !== null && before !== undefined ? Math.round(item.score - before) : null };
  });
  const changed = deltas.filter(item => item.delta !== null).sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!));
  const center = [350, 174] as const;
  const corner: Record<Pillar, readonly [number, number]> = {
    topline: [80, 34], middleline: [620, 34], bottomline: [620, 314], foundation: [80, 314],
  };
  const point = (key: Pillar, score: number) => {
    const destination = corner[key], strength = Math.max(0, Math.min(100, score)) / 100;
    return [center[0] + (destination[0] - center[0]) * strength, center[1] + (destination[1] - center[1]) * strength] as const;
  };
  const polygon = (set: typeof current) => {
    const points = set.filter(item => item.score !== null).map(item => point(item.key, item.score!));
    return points.length > 1 ? points.map((p, index) => (index ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ') + (points.length === 4 ? ' Z' : '') : '';
  };
  const currentPath = polygon(current), previousPath = polygon(previous);
  return <section className="bs-panel bs-balance">
    <header className="bs-panel-head bs-balance-head">
      <div><span className="bs-eyebrow">LAPORAN STRATEGI</span><h2>Keseimbangan empat pilar</h2><p>Posisi tiap pilar menunjukkan rata-rata hasil aktual dibanding target pada bulan laporan.</p></div>
      <label className="bs-month-select"><span>Bulan laporan</span><select value={month} onChange={event => onMonthChange(event.target.value)}>{availableMonths.map(key => <option key={key} value={key}>{monthName(key)}</option>)}</select></label>
    </header>
    <div className="bs-balance-layout">
      <div className="bs-balance-map">
        <div className="bs-map-legend"><span><i className="bs-legend-current"/> {monthName(month)}</span><span><i className="bs-legend-previous"/> {monthName(shiftMonth(month, -1))}</span></div>
        <svg className="bs-map" viewBox="0 0 700 350" role="img" aria-label={'Peta hasil empat pilar untuk ' + monthName(month)}>
          <path d="M80 34 H620 V314 H80 Z" className="bs-map-boundary"/>
          <path d="M350 174 L80 34 M350 174 L620 34 M350 174 L620 314 M350 174 L80 314" className="bs-map-axis"/>
          <circle cx="350" cy="174" r="3" className="bs-map-center"/>
          {pillars.map(pillar => {
            const p = corner[pillar.key];
            return <g key={pillar.key}><text x={p[0] + (p[0] < 350 ? 0 : -2)} y={p[1] + (p[1] < 174 ? -13 : -25)} textAnchor={p[0] < 350 ? 'start' : 'end'} className="bs-map-label">{pillar.title}</text><text x={p[0] + (p[0] < 350 ? 0 : -2)} y={p[1] + (p[1] < 174 ? 2 : -10)} textAnchor={p[0] < 350 ? 'start' : 'end'} className="bs-map-count">{pillar.subtitle}</text></g>;
          })}
          {previousPath ? <path d={previousPath} className={previous.every(item => item.score !== null) ? 'bs-map-previous' : 'bs-map-previous bs-map-partial'}/> : null}
          {currentPath ? <path d={currentPath} className={current.every(item => item.score !== null) ? 'bs-map-current' : 'bs-map-current bs-map-partial'}/> : null}
          {current.map(item => {
            if (item.score === null) return null;
            const p = point(item.key, item.score);
            return <g key={item.key}><circle cx={p[0]} cy={p[1]} r="7" fill={item.accent} className="bs-map-point"/><text x={p[0]} y={p[1] - 11} textAnchor="middle" className="bs-map-value">{Math.round(item.score)}%</text></g>;
          })}
        </svg>
        <div className="bs-pillar-scores">{current.map(item => <div key={item.key} style={{ '--pillar-accent': item.accent } as CSSProperties}><span><i/>{item.title}</span><strong>{item.score === null ? 'Belum ada laporan' : Math.round(item.score) + '%'}</strong><small>{item.reported} dari {item.count} strategi punya catatan progres</small></div>)}</div>
      </div>
      <aside className="bs-interpretation">
        <span className="bs-eyebrow">INTERPRETASI PERIODE</span><h3>{monthName(month)}</h3>
        {highest && lowest ? <div className="bs-insight-main"><span>Pencapaian tertinggi</span><strong>{highest.title} · {Math.round(highest.score!)}%</strong><p>{gap > 0 ? lowest.title + ' berada ' + gap + ' poin persentase di bawah ' + highest.title + '.' : 'Keempat pilar berada pada capaian yang seimbang.'} Gunakan selisih ini sebagai bahan evaluasi alokasi fokus dan target.</p></div> : <div className="bs-insight-empty">Belum ada laporan progres yang tersimpan untuk periode ini. Perbarui nilai progres strategi agar evaluasi bulanan mulai terbentuk.</div>}
        {changed.length ? <div className="bs-insight-change"><strong>Perubahan dari bulan sebelumnya</strong>{changed.slice(0, 3).map(item => <div key={item.key}><span>{item.title}</span><b className={item.delta! >= 0 ? 'up' : 'down'}>{item.delta! > 0 ? '+' : ''}{item.delta} poin</b></div>)}</div> : <div className="bs-insight-change"><strong>Perubahan dari bulan sebelumnya</strong><p>Perlu catatan progres di dua periode untuk membandingkan hasil.</p></div>}
        <p className="bs-insight-note">Interpretasi dihitung dari laporan progres yang tersimpan. Selisih capaian memberi sinyal untuk dibahas, bukan kesimpulan sebab-akibat.</p>
      </aside>
    </div>
  </section>;
}
export default function BusinessStrategyPage() {
  const [access, setAccess] = useState<Access | null>(null);
  const [founders, setFounders] = useState<Founder[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'denied'>('loading');
  const [periodFilter, setPeriodFilter] = useState<'all' | Period>('all');
  const [reportMonth, setReportMonth] = useState(currentMonthKey());
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<StrategyForm>(freshForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    const sb = createClient();
    const { data: sessionData } = await sb.auth.getSession();
    if (!sessionData.session) { window.location.replace('/ruang-kawan/'); return; }
    const { data: accessData } = await sb.rpc('get_my_access');
    const current = (Array.isArray(accessData) ? accessData[0] : accessData) as Access | null;
    setAccess(current);
    if (!current || current.membership_status !== 'active' || !founderRoles.includes(current.position_name || '')) { setState('denied'); return; }
    const [founderResult, strategyResult, historyResult] = await Promise.all([
      sb.rpc('business_strategy_founders'),
      sb.from('business_strategies').select('*').order('due_on', { ascending: true }).order('created_at', { ascending: false }),
      sb.from('business_strategy_progress').select('strategy_id,recorded_on,value').order('recorded_on', { ascending: true }),
    ]);
    if (founderResult.error || strategyResult.error || historyResult.error) {
      setError(founderResult.error?.message || strategyResult.error?.message || historyResult.error?.message || 'Data strategi belum dapat dimuat.');
      setState('ready');
      return;
    }
    setFounders((founderResult.data ?? []) as Founder[]);
    setStrategies((strategyResult.data ?? []) as Strategy[]);
    setSnapshots((historyResult.data ?? []) as Snapshot[]);
    setState('ready');
  }
  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => periodFilter === 'all' ? strategies : strategies.filter(item => item.period_type === periodFilter), [strategies, periodFilter]);
  const average = visible.length ? visible.reduce((sum, item) => sum + ratio(item), 0) / visible.length : 0;
  const atRisk = visible.filter(item => strategyState(item).tone === 'risk').length;
  const done = visible.filter(item => ratio(item) >= 100).length;
  const ownerName = (id: string) => founders.find(person => person.membership_id === id)?.full_name || 'PIC belum tersedia';
  const updateField = (key: keyof StrategyForm, value: string) => setForm(current => ({ ...current, [key]: value }));

  function startCreate(pillar: Pillar = 'topline') {
    setError('');
    setForm(freshForm(pillar, founders[0]?.membership_id || ''));
    setModal(true);
  }
  function startEdit(item: Strategy) {
    setError('');
    setForm(formFor(item));
    setModal(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    const target = Number(form.target_value), currentValue = Number(form.current_value);
    if (!form.title.trim() || !form.metric_name.trim() || !form.owner_membership_id || !form.starts_on || !form.due_on || !Number.isFinite(target) || target <= 0 || !Number.isFinite(currentValue) || currentValue < 0) {
      setError('Lengkapi nama strategi, ukuran, target, PIC founder, dan periode yang valid.');
      return;
    }
    if (form.due_on < form.starts_on) { setError('Tanggal selesai tidak boleh sebelum tanggal mulai.'); return; }
    setSaving(true);
    const sb = createClient();
    const payload = {
      pillar: form.pillar, title: form.title.trim(), description: form.description.trim() || null,
      metric_name: form.metric_name.trim(), target_value: target, current_value: currentValue,
      unit_label: form.unit_label.trim(), period_type: form.period_type,
      starts_on: form.starts_on, due_on: form.due_on, owner_membership_id: form.owner_membership_id,
    };
    const result = form.id
      ? await sb.from('business_strategies').update(payload).eq('id', form.id)
      : await sb.from('business_strategies').insert(payload);
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    setModal(false);
    setNotice(form.id ? 'Strategi berhasil diperbarui.' : 'Strategi berhasil ditambahkan.');
    await load();
  }
  async function remove(item: Strategy) {
    if (!window.confirm('Hapus strategi “' + item.title + '”? Riwayat progresnya juga akan dihapus.')) return;
    const result = await createClient().from('business_strategies').delete().eq('id', item.id);
    if (result.error) { setError(result.error.message); return; }
    setNotice('Strategi berhasil dihapus.');
    await load();
  }
  if (state === 'loading') return <main className="bs-page"><p className="bs-loading">Menyiapkan Business Strategy...</p></main>;
  if (state === 'denied') return <main className="bs-page"><div className="bs-denied"><FiFlag/><h1>Ruang founder</h1><p>Business Strategy tersedia untuk CEO, CTO, dan COO.</p><Link href="/ruang-kawan/dashboard/">Kembali ke dashboard</Link></div></main>;

  return <main className="bs-page">
    <nav className="bs-back"><Link href="/ruang-kawan/dashboard/"><FiArrowLeft/> Dashboard</Link><button type="button" onClick={() => void load()}><FiRefreshCw/> Muat ulang</button></nav>
    <header className="bs-hero">
      <div><span className="bs-eyebrow">FOUNDER WORKSPACE · CAMPUS INNOVATE</span><h1>Business Strategy</h1><p>Strategi bisnis yang terukur, punya tenggat, dan jelas siapa founder yang bertanggung jawab.</p></div>
      <button type="button" className="bs-add-primary" onClick={() => startCreate()}><FiPlus/> Tambah strategi</button>
      <div className="bs-orbit bs-orbit-one"/><div className="bs-orbit bs-orbit-two"/>
    </header>

    <section className="bs-kpis">
      <article><span className="bs-kpi-icon blue"><FiTarget/></span><div><small>Strategi aktif</small><strong>{visible.length}</strong><span>di {periodFilter === 'all' ? 'semua periode' : periodLabel(periodFilter).toLowerCase()}</span></div></article>
      <article><span className="bs-kpi-icon teal"><FiTrendingUp/></span><div><small>Progres rata-rata</small><strong>{Math.round(average)}%</strong><span>akumulasi sasaran terpilih</span></div></article>
      <article><span className="bs-kpi-icon amber"><FiFlag/></span><div><small>Perlu perhatian</small><strong>{atRisk}</strong><span>tertinggal dari rencana atau lewat tenggat</span></div></article>
      <article><span className="bs-kpi-icon green"><FiCheckCircle/></span><div><small>Target tercapai</small><strong>{done}</strong><span>dari {visible.length} strategi</span></div></article>
    </section>

    <section className="bs-filters"><div><span>Periode target</span><strong>Filter rencana founder</strong></div><div className="bs-filter-pills">{(['all','weekly','monthly','quarterly','annual','custom'] as const).map(value=><button key={value} type="button" data-active={periodFilter===value} onClick={()=>setPeriodFilter(value)}>{value==='all'?'Semua':periodLabel(value)}</button>)}</div></section>

    <details className="bs-guide">
      <summary><span className="bs-guide-icon"><FiBookOpen/></span><span><strong>Panduan empat pilar</strong><small>Bingung strategi ini masuk ke mana? Lihat definisi dan contoh.</small></span><FiChevronDown className="bs-guide-chevron"/></summary>
      <div className="bs-guide-grid">
        <article style={{ '--pillar-accent': '#6177bd' } as CSSProperties}><span>01 · FOUNDATION</span><h3>Merancang bisnis</h3><p>Menentukan model bisnis, visi-misi, strategi, business plan, layanan, dan desain proses bisnis.</p><small>Contoh: menetapkan target pasar dan merancang alur prospek sampai handover.</small></article>
        <article style={{ '--pillar-accent': '#c58a48' } as CSSProperties}><span>02 · TOPLINE</span><h3>Menghasilkan peluang</h3><p>Menarik, mengkualifikasi, dan mengonversi prospek menjadi proposal serta deal.</p><small>Contoh: LinkedIn outreach, qualified leads, meeting, proposal, dan target penawaran/deal.</small></article>
        <article style={{ '--pillar-accent': '#278b8d' } as CSSProperties}><span>03 · MIDDLELINE</span><h3>Membangun sistem dan menjalankan layanan</h3><p>Mengubah rancangan Foundation menjadi sistem kerja dan delivery yang benar-benar dipakai.</p><small>Contoh: CRM untuk mendukung Topline; ticketing, handover, Project Space, vendor, dan delivery proyek.</small></article>
        <article style={{ '--pillar-accent': '#8d67a9' } as CSSProperties}><span>04 · BOTTOMLINE</span><h3>Menjaga profit dan ketersediaan kas</h3><p>Mengelola P&amp;L, arus kas, biaya, piutang, kewajiban, dan administrasi keuangan.</p><small>Contoh: memproyeksikan kas saat pembayaran proyek belum masuk atau proyek tertahan.</small></article>
      </div>
      <p className="bs-guide-rule"><strong>Cara cepat membedakan:</strong> rancangan prosesnya = Foundation; sistem untuk menjalankannya = Middleline; hasil penjualan = Topline; dampak profit dan kas = Bottomline. Jika proyek mangkrak, Middleline menangani pemulihan delivery dan Bottomline memetakan dampak keuangan serta kebutuhan kas.</p>
    </details>

    <StrategicBalance strategies={strategies} snapshots={snapshots} month={reportMonth} onMonthChange={setReportMonth}/>

    <section className="bs-strategy-section">
      <div className="bs-strategy-toolbar"><div><span className="bs-eyebrow">RENCANA DAN EKSEKUSI</span><h2>Strategi per pilar</h2></div><div className="bs-view-switch" role="group" aria-label="Tampilan strategi"><button type="button" aria-pressed={viewMode === 'board'} onClick={() => setViewMode('board')}>Pilar</button><button type="button" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}>List</button></div></div>
      {viewMode === 'board' ? <section className="bs-pillars">
        {pillars.map(pillar => {
          const list = visible.filter(item => item.pillar === pillar.key);
          return <article className="bs-pillar" key={pillar.key} style={{ '--pillar-accent': pillar.accent, '--pillar-soft': pillar.soft } as CSSProperties}>
            <header><div className="bs-pillar-heading"><span>{pillar.icon}</span><div><h2>{pillar.title}</h2><p>{pillar.subtitle}</p></div></div><button type="button" onClick={() => startCreate(pillar.key)} aria-label={'Tambah strategi ' + pillar.title} title="Tambah strategi"><FiPlus/></button></header>
            {list.length ? <div className="bs-strategy-list">{list.map(item => {
              const percent = ratio(item), status = strategyState(item);
              return <section className="bs-strategy-card" key={item.id}>
                <div className="bs-strategy-top"><span className={'bs-state ' + status.tone}>{status.label}</span><span className="bs-period">{periodLabel(item.period_type)}</span></div>
                <h3>{item.title}</h3>
                {item.description ? <p className="bs-description">{item.description}</p> : null}
                <div className="bs-metric-label">{item.metric_name}</div>
                <div className="bs-progress-values"><strong>{formatMetric(Number(item.current_value),item.unit_label)}</strong><span>Target {formatMetric(Number(item.target_value),item.unit_label)}</span></div>
                <div className="bs-progress-track"><i style={{ width: Math.min(100,percent) + '%' }}/></div>
                <div className="bs-progress-caption"><span>{Math.round(percent)}% progres</span><span>{Math.max(0,Math.ceil(Number(item.target_value)-Number(item.current_value)))} {item.unit_label} tersisa</span></div>
                <div className="bs-strategy-meta"><span><FiUsers/>{ownerName(item.owner_membership_id)}</span><span><FiCalendar/>{dateLabel(item.starts_on)} – {dateLabel(item.due_on)}</span></div>
                <footer><span>Diperbarui {dateLabel(item.updated_at.slice(0,10))}</span><div><button type="button" onClick={() => startEdit(item)} aria-label={'Edit ' + item.title} title="Edit strategi"><FiEdit2/></button><button type="button" onClick={() => void remove(item)} aria-label={'Hapus ' + item.title} title="Hapus strategi"><FiTrash2/></button></div></footer>
              </section>;
            })}</div> : <div className="bs-pillar-empty"><span>Belum ada strategi</span><button type="button" onClick={() => startCreate(pillar.key)}>Tambah rencana <FiPlus/></button></div>}
          </article>;
        })}
      </section> : <div className="bs-list-table-wrap"><table className="bs-list-table"><thead><tr><th>Pilar</th><th>Strategi / hasil</th><th>Progres</th><th>Status</th><th>PIC founder</th><th>Tenggat</th><th></th></tr></thead><tbody>{visible.length ? visible.map(item => {
        const pillar = pillars.find(value => value.key === item.pillar)!;
        const percent = ratio(item), status = strategyState(item);
        return <tr key={item.id} style={{ '--pillar-accent': pillar.accent } as CSSProperties}><td><span className="bs-list-pillar">{pillar.title}</span></td><td><strong>{item.title}</strong><small>{item.metric_name} · {formatMetric(Number(item.current_value),item.unit_label)} / {formatMetric(Number(item.target_value),item.unit_label)}</small></td><td><div className="bs-list-progress"><i><b style={{ width: Math.min(100,percent) + '%' }}/></i><strong>{Math.round(percent)}%</strong></div></td><td><span className={'bs-state ' + status.tone}>{status.label}</span></td><td>{ownerName(item.owner_membership_id)}</td><td>{dateLabel(item.due_on)}</td><td className="bs-list-actions"><button type="button" onClick={() => startEdit(item)} aria-label={'Edit ' + item.title}><FiEdit2/></button><button type="button" onClick={() => void remove(item)} aria-label={'Hapus ' + item.title}><FiTrash2/></button></td></tr>;
      }) : <tr><td colSpan={7} className="bs-empty-row">Belum ada strategi pada filter ini.</td></tr>}</tbody></table></div>}
    </section>

    {notice ? <div className="bs-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')}><FiX/></button></div> : null}
    {error && !modal ? <div className="bs-error" role="alert">{error}</div> : null}
    {modal ? <div className="bs-modal" onMouseDown={event => { if (event.target === event.currentTarget) setModal(false); }}><form onSubmit={save}>
      <header><div><span className="bs-eyebrow">{form.id ? 'PERBARUI RENCANA' : 'RENCANA STRATEGI BARU'}</span><h2>{form.id ? 'Edit strategi' : 'Tambah strategi'}</h2></div><button type="button" onClick={() => setModal(false)} aria-label="Tutup"><FiX/></button></header>
      <div className="bs-form">
        <label className="wide">Pilar<select value={form.pillar} onChange={e=>updateField('pillar',e.target.value)}>{pillars.map(p=><option key={p.key} value={p.key}>{p.title}</option>)}</select></label>
        <label className="wide">Nama strategi<input autoFocus value={form.title} onChange={e=>updateField('title',e.target.value)} placeholder="Contoh: Tingkatkan revenue layanan event" required/></label>
        <label className="wide">Deskripsi dan arah tindakan<textarea value={form.description} onChange={e=>updateField('description',e.target.value)} placeholder="Apa hasil bisnis yang ingin dicapai dan pendekatan utamanya?"/></label>
        <fieldset className="wide"><legend>Ukuran keberhasilan</legend><div className="bs-form-grid">
          <label>Indikator<input value={form.metric_name} onChange={e=>updateField('metric_name',e.target.value)} placeholder="Contoh: Revenue bulan November" required/></label>
          <label>Satuan<input value={form.unit_label} onChange={e=>updateField('unit_label',e.target.value)} placeholder="Rp / leads / venue" required/></label>
          <label>Target<input type="number" min="0.01" step="any" value={form.target_value} onChange={e=>updateField('target_value',e.target.value)} required/></label>
          <label>Progres saat ini<input type="number" min="0" step="any" value={form.current_value} onChange={e=>updateField('current_value',e.target.value)} required/></label>
        </div></fieldset>
        <fieldset className="wide"><legend>Jangka waktu dan PIC</legend><div className="bs-form-grid">
          <label>Jangka waktu<select value={form.period_type} onChange={e=>updateField('period_type',e.target.value)}><option value="weekly">Mingguan</option><option value="monthly">Bulanan</option><option value="quarterly">Kuartalan</option><option value="annual">Tahunan</option><option value="custom">Khusus</option></select></label>
          <label>PIC founder<select value={form.owner_membership_id} onChange={e=>updateField('owner_membership_id',e.target.value)} required><option value="">Pilih CEO, CTO, atau COO</option>{founders.map(person=><option key={person.membership_id} value={person.membership_id}>{person.full_name} · {person.position_name}</option>)}</select></label>
          <label>Mulai<input type="date" value={form.starts_on} onChange={e=>updateField('starts_on',e.target.value)} required/></label>
          <label>Tenggat<input type="date" value={form.due_on} onChange={e=>updateField('due_on',e.target.value)} required/></label>
        </div></fieldset>
      </div>
      {error ? <p className="bs-modal-error" role="alert">{error}</p> : null}
      <footer><button type="button" onClick={()=>setModal(false)}>Batal</button><button type="submit" className="bs-submit" disabled={saving}>{saving?'Menyimpan…':form.id?'Simpan perubahan':'Simpan strategi'}</button></footer>
    </form></div> : null}
  </main>;
}
