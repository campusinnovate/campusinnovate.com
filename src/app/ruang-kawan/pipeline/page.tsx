'use client';
import Link from 'next/link';
import { confirmedValue, dealDate, isWon, monthlyMetrics } from './metrics';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FiActivity, FiArrowLeft, FiBarChart2, FiBriefcase, FiCalendar, FiCheckCircle, FiDollarSign, FiEdit3, FiFilter, FiInbox, FiList, FiMessageCircle, FiPlus, FiRefreshCw, FiSave, FiSearch, FiTrendingUp, FiUsers, FiX } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';
type Config = {
    stages?: string[];
    priorities?: string[];
    activity_types?: string[];
};
type Source = {
    id: string;
    name: string;
    color: string;
    module_type: string;
    module_config: Config;
};
type Member = {
    id: string;
    name: string;
};
type Lead = {
    updated_at: string;
    extra_data: Record<string, unknown>;
    id: string;
    source_id: string;
    lead_code: string;
    date_added: string;
    account_name: string;
    contact_name: string | null;
    contact_role: string | null;
    whatsapp_contact: string | null;
    email_contact: string | null;
    linkedin_contact: string | null;
    lead_source: string | null;
    priority: string;
    stage: string;
    follow_up_count: number;
    last_contact_date: string | null;
    proposal_date: string | null;
    proposal_value: number | null;
    won_value: number | null;
    expected_close_date: string | null;
    won_at: string | null;
    lost_at: string | null;
    win_loss_reason: string | null;
    qualification_outcome: string;
    qualification_reason: string | null;
    qual_icp_fit: boolean;
    qual_need: boolean;
    qual_decision_maker: boolean;
    qual_budget: boolean;
    qual_timing: boolean;
    qual_buying_process: boolean;
    qual_service_needed: boolean;
    activity_type: string;
    next_action: string;
    due_date: string;
    document_url: string | null;
    notes: string | null;
    owner_membership_id: string;
    workflow_status: string;
    owner_name: string;
    source_name: string;
    source_color: string;
    commercial_ticket_id: string | null;
};
type Filters = {
    source: string;
    stage: string;
    priority: string;
    owner: string;
    quick: string;
    leadSource: string;
    qualification: string;
    closeMonth: string;
    minValue: string;
    maxValue: string;
    staleDays: string;
    query: string;
};
type SavedView = { id: string; name: string; filters: Partial<Filters> };
type Form = {
    expectedUpdatedAt?: string;
    wonDate?: string;
    id: string | null;
    sourceId: string;
    ownerId: string;
    dateAdded: string;
    accountName: string;
    contactName: string;
    contactRole: string;
    whatsapp: string;
    email: string;
    linkedin: string;
    leadSource: string;
    priority: string;
    stage: string;
    activityType: string;
    nextAction: string;
    dueDate: string;
    proposalDate: string;
    proposalValue: string;
    wonValue: string;
    expectedCloseDate: string;
    winLossReason: string;
    documentUrl: string;
    notes: string;
    qualificationReason: string;
    qualificationOutcome: string;
    qualification: Record<string, boolean>;
};
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }), addDays = (n: number) => { const d = new Date(`${today()}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); }, money = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: n >= 1e9 ? 'compact' : 'standard', maximumFractionDigits: n >= 1e6 ? 1 : 0 }).format(n || 0);
const qItems = [['icp_fit', 'ICP fit'], ['need', 'Need / problem'], ['decision_maker', 'Decision maker'], ['budget', 'Budget / kemampuan'], ['timing', 'Timing'], ['buying_process', 'Buying process'], ['service_needed', 'Service dibutuhkan']] as const;
const baseFilters: Filters = { source: 'all', stage: 'all', priority: 'all', owner: 'all', quick: 'all', leadSource: 'all', qualification: 'all', closeMonth: '', minValue: '', maxValue: '', staleDays: '', query: '' };
const amount = (value: number | null) => value === null ? 'Belum diverifikasi' : money(value);
const monthLabel = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString('id-ID', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const periodLabel = (kind: 'month' | 'year' | 'all', month: string, year: string) => kind === 'month' ? new Date(`${month}-01T00:00:00Z`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : kind === 'year' ? year : 'Semua waktu';
const blank = (s?: Source, owner = ''): Form => ({ id: null, sourceId: s?.id ?? '', ownerId: owner, dateAdded: today(), accountName: '', contactName: '', contactRole: '', whatsapp: '', email: '', linkedin: '', leadSource: '', priority: s?.module_config.priorities?.[1] ?? 'Medium', stage: s?.module_config.stages?.[0] ?? 'Target', activityType: s?.module_config.activity_types?.[0] ?? 'Follow Up', nextAction: 'Follow up lead', dueDate: addDays(2), proposalDate: '', proposalValue: '', wonValue: '', expectedCloseDate: '', winLossReason: '', documentUrl: '', notes: '', qualificationReason: '', qualificationOutcome: 'pending', qualification: Object.fromEntries(qItems.map(([k]) => [k, false])) });
export default function Page() {
    const [state, setState] = useState('loading'), [permissions, setPermissions] = useState<string[]>([]), [me, setMe] = useState(''), [sources, setSources] = useState<Source[]>([]), [members, setMembers] = useState<Member[]>([]), [leads, setLeads] = useState<Lead[]>([]), [savedViews, setSavedViews] = useState<SavedView[]>([]), [filters, setFilters] = useState(baseFilters), [period, setPeriod] = useState<'month' | 'year' | 'all'>('month'), [periodMonth, setPeriodMonth] = useState(today().slice(0, 7)), [periodYear, setPeriodYear] = useState(today().slice(0, 4)), [mode, setMode] = useState<'pipeline' | 'analytics'>('pipeline'), [layout, setLayout] = useState<'board' | 'list'>('board'), [form, setForm] = useState<Form>(blank()), [open, setOpen] = useState(false), [contact, setContact] = useState<Lead | null>(null), [selected, setSelected] = useState<string[]>([]), [advanced, setAdvanced] = useState(false), [saving, setSaving] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
    async function load() { const sb = createClient(), { data: { session } } = await sb.auth.getSession(); if (!session) {
        location.replace('/ruang-kawan/');
        return;
    } const [a, m, s, ms, l, v] = await Promise.all([sb.rpc('get_my_access'), sb.rpc('current_membership_id'), sb.rpc('list_my_work_sources'), sb.rpc('list_pipeline_members'), sb.rpc('list_pipeline_leads'), sb.rpc('list_pipeline_saved_views')]), access = Array.isArray(a.data) ? a.data[0] : a.data; if (!access?.permissions?.includes('pipeline.view')) {
        setState('denied');
        return;
    } if (l.error) {
        setError(l.error.message);
        setState('ready');
        return;
    } setPermissions(access.permissions ?? []); setMe(m.data as string); setSources(((s.data ?? []) as Source[]).filter(x => x.module_type === 'pipeline')); setMembers((ms.data ?? []) as Member[]); setLeads((l.data ?? []) as Lead[]); const linkedId = new URLSearchParams(window.location.search).get('lead'); const linked = ((l.data ?? []) as Lead[]).find(x => x.id === linkedId); if (linked) { setFilters(f => ({ ...f, source: 'all', stage: 'all', query: linked.lead_code })); setLayout('list'); } if (!v.error) setSavedViews((v.data ?? []) as SavedView[]); setState('ready'); }
    useEffect(() => { void load(); }, []);
    const stages = useMemo(() => Array.from(new Set([...sources.filter(s => filters.source === 'all' || s.id === filters.source).flatMap(s => s.module_config.stages ?? []), ...leads.filter(l => filters.source === 'all' || l.source_id === filters.source).map(l => l.stage)])), [sources, leads, filters.source]), leadSources = useMemo(() => Array.from(new Set(leads.map(l => l.lead_source).filter(Boolean) as string[])), [leads]), filtered = useMemo(() => leads.filter(l => { const value = (confirmedValue(l,'proposal_value') ?? 0), term = filters.query.toLowerCase(), stale = l.last_contact_date ? Math.floor((Date.now() - new Date(l.last_contact_date).getTime()) / 864e5) : 999, quick = filters.quick === 'all' || filters.quick === 'mine' && l.owner_membership_id === me || filters.quick === 'today' && l.due_date === today() || filters.quick === 'overdue' && l.workflow_status !== 'done' && l.due_date < today() || filters.quick === 'upcoming' && l.due_date > today() && l.due_date <= addDays(7) || filters.quick === 'missing' && !l.whatsapp_contact && !l.email_contact && !l.linkedin_contact || filters.quick === 'waiting' && /waiting|menunggu/i.test(l.activity_type + ' ' + l.next_action); return (filters.source === 'all' || l.source_id === filters.source) && (filters.stage === 'all' || l.stage === filters.stage) && (filters.priority === 'all' || l.priority === filters.priority) && (filters.owner === 'all' || l.owner_membership_id === filters.owner) && (filters.leadSource === 'all' || l.lead_source === filters.leadSource) && (filters.qualification === 'all' || l.qualification_outcome === filters.qualification) && (!filters.closeMonth || l.expected_close_date?.startsWith(filters.closeMonth)) && (!filters.minValue || value >= +filters.minValue) && (!filters.maxValue || value <= +filters.maxValue) && (!filters.staleDays || stale >= +filters.staleDays) && quick && (!term || [l.account_name, l.contact_name, l.lead_code, l.next_action, l.source_name].some(x => x?.toLowerCase().includes(term))); }), [leads, filters, me]), metricRows = monthlyMetrics(filtered, period === 'month' ? periodMonth : period === 'year' ? `${periodYear}-01` : [today().slice(0,7), ...filtered.flatMap(l => [l.date_added.slice(0,7), l.proposal_date?.slice(0,7), dealDate(l)?.slice(0,7)].filter((x): x is string => !!x))].sort()[0], period === 'month' ? periodMonth : period === 'year' ? `${periodYear}-12` : [today().slice(0,7), ...filtered.flatMap(l => [l.date_added.slice(0,7), l.proposal_date?.slice(0,7), dealDate(l)?.slice(0,7)].filter((x): x is string => !!x))].sort().at(-1) ?? today().slice(0,7)), stats = metricRows.reduce((a,r) => ({leads:a.leads+r.leads,proposal:a.proposal+r.proposal,won:a.won+r.won,projects:a.projects+r.projects}),{leads:0,proposal:0,won:0,projects:0});
    const canSelf = permissions.includes('pipeline.manage_self'), canTeam = permissions.includes('pipeline.manage_team') || permissions.includes('activity.assign_team'), patch = (p: Partial<Filters>) => setFilters(v => ({ ...v, ...p }));
    function edit(l: Lead) { setForm({ id: l.id, sourceId: l.source_id, ownerId: l.owner_membership_id, dateAdded: l.date_added, accountName: l.account_name, contactName: l.contact_name ?? '', contactRole: l.contact_role ?? '', whatsapp: l.whatsapp_contact ?? '', email: l.email_contact ?? '', linkedin: l.linkedin_contact ?? '', leadSource: l.lead_source ?? '', priority: l.priority, stage: l.stage, activityType: l.activity_type, nextAction: l.next_action, dueDate: l.due_date, proposalDate: l.proposal_date ?? '', proposalValue: String(confirmedValue(l,'proposal_value') ?? ''), wonValue: String(confirmedValue(l,'won_value') ?? ''), wonDate: dealDate(l) ?? '', expectedUpdatedAt: l.updated_at, expectedCloseDate: l.expected_close_date ?? '', winLossReason: l.win_loss_reason ?? '', documentUrl: l.document_url ?? '', notes: l.notes ?? '', qualificationReason: l.qualification_reason ?? '', qualificationOutcome: l.qualification_outcome, qualification: { icp_fit: l.qual_icp_fit, need: l.qual_need, decision_maker: l.qual_decision_maker, budget: l.qual_budget, timing: l.qual_timing, buying_process: l.qual_buying_process, service_needed: l.qual_service_needed } }); setOpen(true); }
    async function save(e: FormEvent) { e.preventDefault(); const source = sources.find(s => s.id === form.sourceId); if (!source?.module_config.stages?.includes(form.stage) || !source?.module_config.activity_types?.includes(form.activityType)) { setError('Pilih stage dan aktivitas aktif untuk memperbarui lead lama.'); return; } setSaving(true); const payload = { ...(form.expectedUpdatedAt ? {expected_updated_at:form.expectedUpdatedAt} : {}), source_id: form.sourceId, owner_membership_id: form.ownerId, date_added: form.dateAdded, account_name: form.accountName, contact_name: form.contactName, contact_role: form.contactRole, lead_source: form.leadSource, priority: form.priority, stage: form.stage, activity_type: form.activityType, next_action: form.nextAction, due_date: form.dueDate, proposal_date: form.proposalDate, document_url: form.documentUrl, notes: form.notes, extra_data: { won_date: form.wonDate ?? '', proposal_value: form.proposalValue, won_value: form.wonValue, expected_close_date: form.expectedCloseDate, win_loss_reason: form.winLossReason, whatsapp_contact: form.whatsapp, email_contact: form.email, linkedin_contact: form.linkedin, qualification: { ...form.qualification, outcome: form.qualificationOutcome, reason: form.qualificationReason } } }, r = await createClient().rpc('save_pipeline_lead', { pipeline_lead_id: form.id, payload }); setSaving(false); if (r.error) {
        setError(r.error.message);
        return;
    } setOpen(false); setMessage('Lead dan My Activity berhasil diperbarui.'); await load(); }
    async function saveView() { const name = prompt('Nama view pribadi:')?.trim(); if (!name)
        return; const sb = createClient(), r = await sb.rpc('save_pipeline_view', { target_id: null, target_name: name, target_filters: filters }); setMessage(r.error ? r.error.message : 'View pribadi tersimpan.'); if (!r.error) { const v = await sb.rpc('list_pipeline_saved_views'); if (!v.error) setSavedViews((v.data ?? []) as SavedView[]); } }
    async function bulk() { const chosen = leads.filter(l => selected.includes(l.id)); const stage = prompt(`Pindahkan ${selected.length} lead ke stage:`); if (!stage)
        return; if (chosen.some(l => !sources.find(s => s.id === l.source_id)?.module_config.stages?.includes(stage))) { setError('Stage harus tersedia pada semua layanan yang dipilih. Pilih satu layanan atau stage yang sama.'); return; } const r = await createClient().rpc('bulk_update_pipeline_leads', { target_ids: selected, payload: { stage } }); if (r.error)
        setError(r.error.message);
    else {
        setSelected([]);
        await load();
    } }
    if (state === 'loading')
        return <main className="rk-pos"><p>Menyiapkan Pipeline...</p></main>;
    if (state === 'denied')
        return <main className="rk-pos"><h1>Akses ditolak</h1></main>;
    return <main className="rk-pos"><nav className="rk-pos-back"><Link href="/ruang-kawan/marketing/"><FiArrowLeft /> Marketing</Link><button onClick={() => void load()}><FiRefreshCw /> Muat ulang</button></nav><header className="rk-pos-heading"><div><small>Revenue workspace</small><h1>Pipeline & Prospect</h1></div><div><Link href="/ruang-kawan/prospect-inbox/"><FiInbox /> Prospect Inbox</Link><Link href="/ruang-kawan/tickets/"><FiBriefcase /> Tickets</Link>{canSelf ? <button onClick={() => { setForm(blank(sources.find(s => filters.source === s.id) ?? sources[0], me)); setOpen(true); }}><FiPlus /> Tambah lead</button> : null}</div></header><div className="rk-pos-tabs"><button data-active={mode === 'pipeline'} onClick={() => setMode('pipeline')}><FiBriefcase /> Pipeline</button><button data-active={mode === 'analytics'} onClick={() => setMode('analytics')}><FiBarChart2 /> Analytics & insight</button></div><section className="rk-pos-period"><div><span>Ringkasan periode</span><strong>{periodLabel(period,periodMonth,periodYear)}</strong></div><div className="rk-pos-period-controls"><label>Periode<select aria-label="Periode KPI" value={period} onChange={e=>setPeriod(e.target.value as typeof period)}><option value="month">Bulanan</option><option value="year">Tahunan</option><option value="all">Semua waktu</option></select></label>{period==='month'?<label>Bulan<input aria-label="Bulan KPI" type="month" value={periodMonth} onChange={e=>setPeriodMonth(e.target.value)}/></label>:null}{period==='year'?<label>Tahun<select aria-label="Tahun KPI" value={periodYear} onChange={e=>setPeriodYear(e.target.value)}>{Array.from(new Set([today().slice(0,4),...leads.flatMap(l=>[l.date_added.slice(0,4),l.proposal_date?.slice(0,4),dealDate(l)?.slice(0,4)]),periodYear])).filter((y):y is string=>!!y).sort().reverse().map(y=><option key={y}>{y}</option>)}</select></label>:null}</div></section><section className="rk-pos-kpis"><article><FiUsers /><div><strong>{stats.leads}</strong><small>Lead masuk · {periodLabel(period,periodMonth,periodYear)}</small></div></article><article><FiTrendingUp /><div><strong>{money(stats.proposal)}</strong><small>Penawaran tercatat · {periodLabel(period,periodMonth,periodYear)}</small></div></article><article><FiDollarSign /><div><strong>{money(stats.won)}</strong><small>Deal tercatat · {periodLabel(period,periodMonth,periodYear)}</small></div></article><article><FiCheckCircle /><div><strong>{stats.projects}</strong><small>Project deal · {periodLabel(period,periodMonth,periodYear)}</small></div></article></section><section className="rk-pos-sources"><button data-active={filters.source === 'all'} onClick={() => patch({ source: 'all', stage: 'all' })}>Semua Pipeline <span>{leads.length}</span></button>{sources.map(s => <button key={s.id} data-active={filters.source === s.id} onClick={() => patch({ source: s.id, stage: 'all' })}><i style={{ background: s.color }}/>{s.name}<span>{leads.filter(l => l.source_id === s.id).length}</span></button>)}</section>
    <section className="rk-pos-filters"><div className="rk-pos-filter-main"><label><FiSearch /><input value={filters.query} onChange={e => patch({ query: e.target.value })} placeholder="Cari lead, PIC, kode..."/></label><select value={filters.stage} onChange={e => patch({ stage: e.target.value })}><option value="all">Semua stage</option>{stages.map(x => <option key={x}>{x}</option>)}</select><select value={filters.owner} onChange={e => patch({ owner: e.target.value })}><option value="all">Semua owner</option>{members.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select><button data-active={advanced} onClick={() => setAdvanced(!advanced)}><FiFilter /> Filter lanjut</button><select aria-label="View pribadi" defaultValue="" onChange={e => { const view = savedViews.find(v => v.id === e.target.value); if (view) setFilters({ ...baseFilters, ...view.filters }); }}><option value="">Pilih view pribadi</option>{savedViews.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select><button onClick={() => void saveView()}><FiSave /> Simpan view</button></div><div className="rk-pos-quick">{[['all', 'Semua'], ['mine', 'My leads'], ['today', 'Due today'], ['overdue', 'Overdue'], ['upcoming', 'Upcoming 7 days'], ['missing', 'Missing contact'], ['waiting', 'Waiting reply']].map(([v, n]) => <button key={v} data-active={filters.quick === v} onClick={() => patch({ quick: v })}>{n}</button>)}</div>{advanced ? <div className="rk-pos-filter-more"><select value={filters.priority} onChange={e => patch({ priority: e.target.value })}><option value="all">Semua priority</option><option>High</option><option>Medium</option><option>Low</option></select><select value={filters.leadSource} onChange={e => patch({ leadSource: e.target.value })}><option value="all">Semua lead source</option>{leadSources.map(x => <option key={x}>{x}</option>)}</select><select value={filters.qualification} onChange={e => patch({ qualification: e.target.value })}><option value="all">Semua qualification</option><option value="pending">Pending</option><option value="qualified">Qualified</option><option value="disqualified">Disqualified</option></select><label>Expected close<input type="month" value={filters.closeMonth} onChange={e => patch({ closeMonth: e.target.value })}/></label><label>Min value<input type="number" value={filters.minValue} onChange={e => patch({ minValue: e.target.value })}/></label><label>Max value<input type="number" value={filters.maxValue} onChange={e => patch({ maxValue: e.target.value })}/></label><label>Stale ≥ hari<input type="number" value={filters.staleDays} onChange={e => patch({ staleDays: e.target.value })}/></label><button onClick={() => setFilters(baseFilters)}>Reset</button></div> : null}</section>{message ? <p className="rk-pos-alert">{message}</p> : null}{error ? <p className="rk-pos-alert" data-error>{error}</p> : null}
    {mode === 'analytics' ? <Analytics leads={filtered} sources={sources}/> : <><div className="rk-pos-viewbar"><span><strong>{filtered.length}</strong> lead</span><div>{selected.length ? <button onClick={() => void bulk()}>Pindahkan {selected.length}</button> : null}<button data-active={layout === 'board'} onClick={() => setLayout('board')}><FiBriefcase /> Board</button><button data-active={layout === 'list'} onClick={() => setLayout('list')}><FiList /> List</button></div></div>{layout === 'board' ? <section className="rk-pos-board">{stages.map(stage => <div key={stage}><header><strong>{stage}</strong><span>{filtered.filter(l => l.stage === stage).length}</span></header><section>{filtered.filter(l => l.stage === stage).map(l => <Card key={l.id} l={l} edit={edit} contact={setContact} can={l.owner_membership_id === me ? canSelf : canTeam}/>)}</section></div>)}</section> : <section className="rk-pos-table"><header><span><input type="checkbox" aria-label="Pilih semua lead terfilter" checked={filtered.length > 0 && filtered.every(l => selected.includes(l.id))} onChange={e => setSelected(e.target.checked ? Array.from(new Set([...selected, ...filtered.map(l => l.id)])) : selected.filter(id => !filtered.some(l => l.id === id)))}/></span><span>Lead</span><span>Stage / aktivitas</span><span>Owner</span><span>Penawaran</span><span>Deal</span><span>Next action</span><span /></header>{filtered.map(l => <article key={l.id}><input type="checkbox" checked={selected.includes(l.id)} onChange={e => setSelected(e.target.checked ? [...selected, l.id] : selected.filter(x => x !== l.id))}/><span><strong>{l.account_name}</strong><small>{l.lead_code} · {l.source_name}</small></span><span><strong>{l.stage}</strong><small>{l.activity_type}</small></span><span>{l.owner_name}</span><b>{amount(confirmedValue(l,'proposal_value'))}</b><b>{isWon(l) ? amount(confirmedValue(l,'won_value')) : '—'}</b><span><strong>{l.next_action}</strong><small>{l.due_date}</small></span><button onClick={() => edit(l)}><FiEdit3 /></button></article>)}</section>}</>}{open ? <LeadForm f={form} set={setForm} sources={sources} members={members} saving={saving} error={error} close={() => setOpen(false)} save={save}/> : null}{contact ? <Contact l={contact} close={() => setContact(null)} done={async () => { setContact(null); setMessage('Aktivitas kontak tercatat otomatis.'); await load(); }}/> : null}</main>;
}
function Card({ l, can, edit, contact }: {
    l: Lead;
    can: boolean;
    edit: (x: Lead) => void;
    contact: (x: Lead) => void;
}) { return <article className="rk-pos-card" style={{ borderTopColor: l.source_color }}><header><span>{l.lead_code}</span><em>{l.priority}</em></header><h3>{l.account_name}</h3><p>{l.contact_name || 'PIC belum diisi'} · {l.source_name}</p><div className="rk-pos-activity"><FiActivity /><span><small>Aktivitas saat ini</small><strong>{l.activity_type}</strong></span></div><dl><div><dt>Penawaran</dt><dd>{amount(confirmedValue(l,'proposal_value'))}</dd></div><div><dt>Deal</dt><dd>{isWon(l) ? amount(confirmedValue(l,'won_value')) : '—'}</dd></div></dl><div className="rk-pos-next" data-overdue={l.workflow_status !== 'done' && l.due_date < today()}><FiCalendar /><span><small>{l.next_action}</small><strong>{l.due_date}</strong></span></div><footer><span data-state={l.qualification_outcome}>{l.qualification_outcome}</span><div><button onClick={() => contact(l)}><FiMessageCircle /></button>{l.commercial_ticket_id ? <Link href={`/ruang-kawan/tickets/?ticket=${l.commercial_ticket_id}`}><FiBriefcase /></Link> : null}{can ? <button onClick={() => edit(l)}><FiEdit3 /></button> : null}</div></footer></article>; }
type TrendRow = ReturnType<typeof monthlyMetrics>[number];
function TrendChart({rows,kind}:{rows:TrendRow[];kind:'revenue'|'volume'}) {
 const currency=kind==='revenue';
 const series=currency
  ? [{key:'proposal' as const,label:'Penawaran',color:'#5d85ed'},{key:'won' as const,label:'Deal',color:'#24a589'}]
  : [{key:'leads' as const,label:'Lead masuk',color:'#5d85ed'},{key:'projects' as const,label:'Project deal',color:'#24a589'}];
 const peak=Math.max(1,...rows.flatMap(row=>series.map(item=>row[item.key])));
 const width=Math.max(900,rows.length*72), left=72,right=22,top=18,bottom=43,plotW=width-left-right,plotH=270-top-bottom;
 const x=(index:number)=>left+(rows.length===1?plotW/2:index*plotW/Math.max(1,rows.length-1));
 const y=(value:number)=>top+plotH-(value/peak)*plotH;
 const points=(key:typeof series[number]['key'])=>rows.map((row,index)=>[x(index),y(row[key])] as const);
 const line=(key:typeof series[number]['key'])=>{const p=points(key);return p.reduce((path,[px,py],index)=>index===0?`M ${px} ${py}`:path+` C ${(p[index-1][0]+px)/2} ${p[index-1][1]}, ${(p[index-1][0]+px)/2} ${py}, ${px} ${py}`,'')};
 const present=rows.some(row=>series.some(item=>row[item.key]>0));
 const label=(n:number)=>currency?new Intl.NumberFormat('id-ID',{notation:'compact',maximumFractionDigits:1}).format(n):String(Math.round(n));
 return <div className="rk-pos-chart-body">
  <div className="rk-pos-chart-legend">{series.map(item=><span key={item.key}><i style={{background:item.color}}/>{item.label}</span>)}</div>
  <div className="rk-pos-chart-scroll">
   <svg role="img" aria-label={`${currency?'Nilai penawaran dan deal':'Jumlah lead dan project deal'} per bulan`} viewBox={`0 0 ${width} 270`} style={{minWidth:width}} preserveAspectRatio="xMinYMid meet">
    <defs><linearGradient id={currency?'revenue-fill':'volume-fill'} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#5d85ed" stopOpacity=".19"/><stop offset="1" stopColor="#5d85ed" stopOpacity="0"/></linearGradient></defs>
    {[0,.25,.5,.75,1].map(t=><g key={t}><line x1={left} x2={width-right} y1={y(peak*t)} y2={y(peak*t)} stroke="#dbe6ef" strokeDasharray={t===0?'0':'4 6'}/><text x={left-12} y={y(peak*t)+4} textAnchor="end" className="rk-pos-axis">{label(peak*t)}</text></g>)}
    {present&&rows.length>1?<path d={`${line(series[0].key)} L ${x(rows.length-1)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill={`url(#${currency?'revenue-fill':'volume-fill'})`}/>:null}
    {series.map(item=><g key={item.key}><path d={line(item.key)} fill="none" stroke={item.color} strokeWidth="3.5" strokeLinecap="round"/>{rows.map((row,index)=><circle key={row.month} cx={x(index)} cy={y(row[item.key])} r="5" fill="#fff" stroke={item.color} strokeWidth="3"><title>{`${monthLabel(row.month)} · ${item.label}: ${currency?money(row[item.key]):row[item.key]}`}</title></circle>)}</g>)}
    {rows.map((row,index)=><text key={row.month} x={x(index)} y={258} textAnchor="middle" className="rk-pos-axis rk-pos-axis-month">{monthLabel(row.month)}</text>)}
   </svg>
   {!present?<p className="rk-pos-chart-empty">Belum ada data tercatat pada periode ini.</p>:null}
  </div>
 </div>;
}
function Analytics({leads,sources}:{leads:Lead[];sources:Source[]}) {
 const current=today().slice(0,7);
 const [from,setFrom]=useState(current.slice(0,4)+'-01'),[to,setTo]=useState(current);
 const rows=useMemo(()=>monthlyMetrics(leads,from,to),[leads,from,to]);
 return <section className="rk-pos-analytics"><header><h2>Analytics & insight</h2><span>Tren pipeline</span></header>
 <div className="rk-pos-analytics-range"><label>Dari bulan<input type="month" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Sampai bulan<input type="month" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
 {from>to?<p role="alert">Rentang tanggal tidak valid.</p>:null}
 <article className="rk-pos-chart"><header><div><small>NILAI PROJECT</small><h3>Penawaran vs deal per bulan</h3></div><span>Pergerakan nilai yang tercatat</span></header><TrendChart rows={rows} kind="revenue"/></article>
 <article className="rk-pos-chart"><header><div><small>VOLUME PIPELINE</small><h3>Kurva bulanan</h3></div><span>Lead masuk dan project deal</span></header><TrendChart rows={rows} kind="volume"/></article>
 <div className="rk-pos-analysis-grid"><article><h3>Performa per layanan pada periode</h3><div className="rk-pos-service-table"><header><span>Layanan</span><span>Lead masuk</span><span>Penawaran</span><span>Deal</span><span>Project</span></header>{sources.map(s=>{const records=monthlyMetrics(leads.filter(l=>l.source_id===s.id),from,to);const total=records.reduce((a,r)=>({l:a.l+r.leads,p:a.p+r.proposal,w:a.w+r.won,c:a.c+r.projects}),{l:0,p:0,w:0,c:0});return <div key={s.id}><span>{s.name}</span><b>{total.l}</b><b>{money(total.p)}</b><b>{money(total.w)}</b><strong>{total.c}</strong></div>})}</div></article>
 <article className="rk-pos-winloss"><h3>Konversi cohort lead masuk</h3><p>Persentase lead yang masuk pada periode ini dan saat ini Won.</p>{Array.from(new Set(leads.map(l=>l.lead_source||'Belum diisi'))).map(source=>{const cohort=leads.filter(l=>(l.lead_source||'Belum diisi')===source&&l.date_added.slice(0,7)>=from&&l.date_added.slice(0,7)<=to);return {source,count:cohort.length,won:cohort.filter(isWon).length}}).filter(x=>x.count).sort((a,b)=>b.count-a.count).slice(0,6).map(x=><p key={x.source}><span>{x.source}</span><b>{x.count} lead · {Math.round(x.won/x.count*100)}%</b></p>)}</article></div></section>;
}
function LeadForm({ f, set, sources, members, saving, error, close, save }: {
    f: Form;
    set: (x: Form) => void;
    sources: Source[];
    members: Member[];
    saving: boolean;
    error: string;
    close: () => void;
    save: (e: FormEvent) => void;
}) { const src = sources.find(s => s.id === f.sourceId), score = Object.values(f.qualification).filter(Boolean).length; return <div className="rk-pos-modal"><form onSubmit={save}><header><div><small>{f.id ? 'Perbarui lead' : 'Lead baru'}</small><h2>{f.accountName || 'Pipeline BD'}</h2></div><button type="button" onClick={close}><FiX /></button></header><div className="rk-pos-form"><fieldset><legend>Pipeline & owner</legend><div><label>Layanan<select value={f.sourceId} onChange={e => set({ ...f, sourceId: e.target.value, stage: sources.find(x => x.id === e.target.value)?.module_config.stages?.[0] ?? 'Target' })}>{sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Owner<select value={f.ownerId} onChange={e => set({ ...f, ownerId: e.target.value })}>{f.id&&!members.some(m=>m.id===f.ownerId)?<option value={f.ownerId}>Owner lama (nonaktif)</option>:null}{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Stage<select value={f.stage} onChange={e => set({ ...f, stage: e.target.value })}>{f.id && !src?.module_config.stages?.includes(f.stage) ? <option value={f.stage}>{f.stage} · arsip, pilih stage aktif</option> : null}{src?.module_config.stages?.map(x => <option key={x}>{x}</option>)}</select></label><label>Priority<select value={f.priority} onChange={e => set({ ...f, priority: e.target.value })}><option>High</option><option>Medium</option><option>Low</option></select></label></div></fieldset><fieldset><legend>Lead & kontak terpisah</legend><div><label className="wide">Perusahaan / instansi<input required value={f.accountName} onChange={e => set({ ...f, accountName: e.target.value })}/></label><label>Nama PIC<input value={f.contactName} onChange={e => set({ ...f, contactName: e.target.value })}/></label><label>Jabatan PIC<input value={f.contactRole} onChange={e => set({ ...f, contactRole: e.target.value })}/></label><label>WhatsApp<input value={f.whatsapp} onChange={e => set({ ...f, whatsapp: e.target.value })}/></label><label>Email<input type="email" value={f.email} onChange={e => set({ ...f, email: e.target.value })}/></label><label>LinkedIn<input type="url" value={f.linkedin} onChange={e => set({ ...f, linkedin: e.target.value })}/></label><label>Lead source<input value={f.leadSource} onChange={e => set({ ...f, leadSource: e.target.value })}/></label></div></fieldset><fieldset><legend>Qualification <span>{score}/7</span></legend><p className="rk-pos-qual-note">Qualified otomatis: minimal 6/7; ICP, Need, dan Service wajib.</p><div className="rk-pos-checks">{qItems.map(([k, n]) => <label key={k}><input type="checkbox" checked={f.qualification[k]} onChange={e => set({ ...f, qualification: { ...f.qualification, [k]: e.target.checked } })}/><span>{n}</span></label>)}</div><div><label>Outcome<select value={f.qualificationOutcome} onChange={e => set({ ...f, qualificationOutcome: e.target.value })}><option value="pending">Pending</option><option value="qualified">Qualified otomatis</option><option value="disqualified">Disqualified</option></select></label><label className="wide">Alasan<textarea value={f.qualificationReason} onChange={e => set({ ...f, qualificationReason: e.target.value })}/></label></div></fieldset><fieldset><legend>Nilai & closing</legend><div><label>Nilai penawaran<input type="number" min="0" value={f.proposalValue} onChange={e => set({ ...f, proposalValue: e.target.value })}/></label><label>Nilai project deal<input type="number" min="0" required={['Won','Closed Won','Deal','Paid/Booked'].includes(f.stage)} value={f.wonValue} onChange={e => set({ ...f, wonValue: e.target.value })}/></label><label>Tanggal proposal<input type="date" value={f.proposalDate} onChange={e => set({ ...f, proposalDate: e.target.value })}/></label><label>Tanggal deal aktual<input type="date" required={['Won','Closed Won','Deal','Paid/Booked'].includes(f.stage)} value={f.wonDate??''} onChange={e => set({ ...f, wonDate:e.target.value })}/></label><label>Expected close<input type="date" value={f.expectedCloseDate} onChange={e => set({ ...f, expectedCloseDate: e.target.value })}/></label><label className="wide">Alasan win / loss<input value={f.winLossReason} onChange={e => set({ ...f, winLossReason: e.target.value })}/></label></div></fieldset><fieldset><legend>Aktivitas & next action</legend><div><label>Stage aktivitas<select value={f.activityType} onChange={e => set({ ...f, activityType: e.target.value })}>{f.id && !src?.module_config.activity_types?.includes(f.activityType) ? <option value={f.activityType}>{f.activityType} · arsip, pilih aktivitas aktif</option> : null}{src?.module_config.activity_types?.map(value=><option key={value}>{value}</option>)}</select></label><label>Due date<input required type="date" value={f.dueDate} onChange={e => set({ ...f, dueDate: e.target.value })}/></label><label className="wide">Next action<input required value={f.nextAction} onChange={e => set({ ...f, nextAction: e.target.value })}/></label><label className="wide">Catatan<textarea value={f.notes} onChange={e => set({ ...f, notes: e.target.value })}/></label></div></fieldset></div>{error ? <p className="rk-pos-modal-error">{error}</p> : null}<footer><button type="button" onClick={close}>Batal</button><button data-primary disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan lead'}</button></footer></form></div>; }
function Contact({ l, close, done }: {
    l: Lead;
    close: () => void;
    done: () => void;
}) { const [channel, setChannel] = useState('whatsapp'), [outcome, setOutcome] = useState(''), [notes, setNotes] = useState(''), [error, setError] = useState(''); async function go(e: FormEvent) { e.preventDefault(); const r = await createClient().rpc('log_pipeline_contact', { target_pipeline_lead_id: l.id, payload: { channel, direction: 'outbound', outcome, notes } }); if (r.error)
    setError(r.error.message);
else
    done(); } return <div className="rk-pos-modal rk-pos-contact-modal"><form onSubmit={go}><header><h2>Catat kontak · {l.account_name}</h2><button type="button" onClick={close}><FiX /></button></header><div className="rk-pos-form"><fieldset><div><label>Channel<select value={channel} onChange={e => setChannel(e.target.value)}><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="linkedin">LinkedIn</option><option value="call">Call</option><option value="meeting">Meeting</option></select></label><label className="wide">Hasil<input required value={outcome} onChange={e => setOutcome(e.target.value)}/></label><label className="wide">Catatan<textarea value={notes} onChange={e => setNotes(e.target.value)}/></label></div></fieldset></div>{error ? <p>{error}</p> : null}<footer><button type="button" onClick={close}>Batal</button><button data-primary>Catat aktivitas</button></footer></form></div>; }
