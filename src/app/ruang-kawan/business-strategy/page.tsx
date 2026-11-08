'use client';

import Link from 'next/link';
import { CSSProperties, FormEvent, useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiCalendar, FiCheckCircle, FiEdit2, FiFlag, FiPlus, FiRefreshCw, FiTarget, FiTrash2, FiTrendingUp, FiUsers, FiX } from 'react-icons/fi';
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
function TrendChart({ strategies, snapshots }: { strategies: Strategy[]; snapshots: Snapshot[] }) {
  const chart = useMemo(() => {
    const now = new Date(today() + 'T12:00:00');
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return {
        key: d.toLocaleDateString('en-CA'),
        label: d.toLocaleDateString('id-ID', { month: 'short' }),
        end: last.toLocaleDateString('en-CA'),
      };
    });
    const series = pillars.map(pillar => ({
      ...pillar,
      points: months.map(month => {
        const values = strategies.filter(item => item.pillar === pillar.key && item.starts_on <= month.end);
        const progresses = values.map(item => {
          const history = snapshots.filter(s => s.strategy_id === item.id && s.recorded_on <= month.end).sort((a, b) => b.recorded_on.localeCompare(a.recorded_on));
          const value = history[0] ? Number(history[0].value) : (item.created_at.slice(0, 10) <= month.end ? Number(item.current_value) : NaN);
          return Number.isFinite(value) ? Math.max(0, Math.min(100, value / Number(item.target_value) * 100)) : NaN;
        }).filter(Number.isFinite);
        return progresses.length ? progresses.reduce((sum, value) => sum + value, 0) / progresses.length : null;
      }),
    }));
    return { months, series };
  }, [strategies, snapshots]);
  const x = (i: number) => 46 + i * 132;
  const y = (v: number) => 214 - Math.min(100, Math.max(0, v)) * 1.78;
  const hasData = chart.series.some(s => s.points.some(v => v !== null));
  return <section className="bs-panel bs-trend">
    <header className="bs-panel-head"><div><span className="bs-eyebrow">PROGRES STRATEGI</span><h2>Perkembangan tiap pilar</h2><p>Rata-rata progres sasaran dari catatan pembaruan yang tersimpan.</p></div></header>
    <div className="bs-chart-wrap">
      {hasData ? <>
        <div className="bs-legend">{chart.series.map(s => <span key={s.key}><i style={{ background: s.accent }}/>{s.title}</span>)}</div>
        <svg className="bs-chart" viewBox="0 0 760 260" role="img" aria-label="Grafik progres rata-rata strategi per pilar selama enam bulan">
          {[0, 25, 50, 75, 100].map(t => <g key={t}><line x1="42" x2="710" y1={y(t)} y2={y(t)} className="bs-gridline"/><text x="4" y={y(t) + 4} className="bs-axis">{t}%</text></g>)}
          {chart.series.map(s => {
            const coords = s.points.map((point, index) => point === null ? null : [x(index), y(point)] as [number, number]).filter(Boolean) as [number, number][];
            if (!coords.length) return null;
            const path = coords.map((point, index) => (index ? 'L' : 'M') + point[0] + ' ' + point[1]).join(' ');
            return <g key={s.key}><path d={path} fill="none" stroke={s.accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>{coords.map((point, index) => <circle key={index} cx={point[0]} cy={point[1]} r="4" fill={s.accent} stroke="white" strokeWidth="2"/>)}</g>;
          })}
          {chart.months.map((month, index) => <text key={month.key} x={x(index)} y="246" textAnchor="middle" className="bs-axis">{month.label}</text>)}
        </svg>
      </> : <div className="bs-chart-empty"><FiTrendingUp/><strong>Grafik progres akan terbentuk otomatis</strong><span>Catat nilai progres saat strategi diperbarui untuk melihat perubahannya dari waktu ke waktu.</span></div>}
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

    <TrendChart strategies={visible} snapshots={snapshots}/>

    <section className="bs-pillars">
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
