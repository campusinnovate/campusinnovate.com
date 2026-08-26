'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  FiActivity, FiArrowLeft, FiCalendar, FiChevronLeft, FiChevronRight, FiClock,
  FiCheck, FiEdit3, FiExternalLink, FiPlus, FiRefreshCw, FiX,
} from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';

type FieldSchema = { key: string; label: string; type: 'text' | 'number' | 'date' | 'url' | 'textarea' | 'select' | 'checkbox'; options?: string[] };
type WorkSource = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  source_kind: string;
  module_type: 'activity' | 'content_plan' | 'pipeline' | 'project';
  field_schema: FieldSchema[];
};
type Activity = {
  id: string;
  owner_membership_id: string;
  source_id: string;
  title: string;
  activity_date: string;
  start_at: string | null;
  end_at: string | null;
  activity_type: string | null;
  linked_kpi: string | null;
  status: 'not_started' | 'in_progress' | 'done' | 'blocked';
  progress: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  detail: string | null;
  output: string | null;
  blocker_risk: string | null;
  next_action: string | null;
  evidence_url: string | null;
  custom_data: Record<string, string | number | boolean>;
  assigned_by_membership_id: string | null;
  reviewer_membership_id: string | null;
  review_status: 'not_submitted' | 'waiting_review' | 'approved' | 'revision_requested';
  feed_kind: 'manual' | 'assignment' | 'content_plan' | 'pipeline' | 'project' | 'report_action';
  relationship: 'mine' | 'assigned_by_me' | 'review';
  module_route: string | null;
  owner_name: string;
  assigned_by_name: string | null;
  reviewer_name: string | null;
  work_sources?: WorkSource;
};
type CalendarConnection = { connected: true; email: string | null; selected_calendar_ids: string[]; updated_at: string } | null;
type CalendarStatus = { personal: CalendarConnection; company: CalendarConnection };
type GoogleEvent = {
  id: string; title: string; start: { date?: string; dateTime?: string }; end: { date?: string; dateTime?: string };
  htmlLink?: string; calendarId: string; calendarType: 'personal' | 'company'; account: string | null; error?: string;
};
type ActivityForm = {
  id: string | null;
  sourceId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  activityType: string;
  linkedKpi: string;
  status: Activity['status'];
  progress: number;
  priority: Activity['priority'];
  detail: string;
  output: string;
  blockerRisk: string;
  nextAction: string;
  evidenceUrl: string;
  customData: Record<string, string | boolean>;
};

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const emptyForm = (): ActivityForm => ({
  id: null, sourceId: '', title: '', date: today(), startTime: '', endTime: '', activityType: '', linkedKpi: '',
  status: 'not_started', progress: 0, priority: 'medium', detail: '', output: '', blockerRisk: '', nextAction: '', evidenceUrl: '', customData: {},
});
const statusLabels = { not_started: 'Belum Mulai', in_progress: 'Berjalan', done: 'Selesai', blocked: 'Terhambat' };
const priorityLabels = { low: 'Rendah', medium: 'Sedang', high: 'Tinggi', urgent: 'Mendesak' };
const reviewLabels = { not_submitted: 'Belum diajukan', waiting_review: 'Menunggu review', approved: 'Disetujui', revision_requested: 'Perlu revisi' };
const feedKindLabels = { manual: 'Aktivitas Manual', assignment: 'Assignment', content_plan: 'Content Plan', pipeline: 'Pipeline BD', project: 'Project Management', report_action: 'Report Action Item' };
const relationshipLabels = { mine: 'Untuk saya', assigned_by_me: 'Saya delegasikan', review: 'Perlu review' };
const monthLabels = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function toIso(date: string, time: string) {
  if (!time) return null;
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

function timeFromIso(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
}

function googleEventDate(event: GoogleEvent) { return event.start?.date ?? event.start?.dateTime?.slice(0, 10) ?? ''; }
function googleEventTime(event: GoogleEvent) {
  if (!event.start?.dateTime) return 'Seharian';
  return new Date(event.start.dateTime).toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
}

export default function MyActivityPage() {
  const [state, setState] = useState<'loading' | 'ready' | 'denied'>('loading');
  const [membershipId, setMembershipId] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [sources, setSources] = useState<WorkSource[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>({ personal: null, company: null });
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([]);
  const [monthCursor, setMonthCursor] = useState(() => new Date(`${today()}T12:00:00`));
  const [selectedDate, setSelectedDate] = useState(today());
  const [focusFilter, setFocusFilter] = useState('');
  const [form, setForm] = useState<ActivityForm>(emptyForm());
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingId, setCheckingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadData() {
    setError('');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.replace('/ruang-kawan/'); return; }

    const [accessResult, membershipResult, sourcesResult, feedResult, calendarResult] = await Promise.all([
      supabase.rpc('get_my_access'),
      supabase.rpc('current_membership_id'),
      supabase.rpc('list_my_work_sources'),
      supabase.rpc('list_my_activity_feed'),
      supabase.rpc('get_my_calendar_status'),
    ]);
    const access = Array.isArray(accessResult.data) ? accessResult.data[0] : accessResult.data;
    if (!access || access.membership_status !== 'active' || !access.permissions?.includes('activity.view_self')) {
      setState('denied'); return;
    }
    if (membershipResult.error || sourcesResult.error || feedResult.error) {
      setError('My Activity belum dapat dimuat. Silakan muat ulang.');
      setState('ready'); return;
    }

    const memberId = membershipResult.data as string;
    const availableSources = (sourcesResult.data ?? []) as WorkSource[];
    setMembershipId(memberId);
    setPermissions(access.permissions ?? []);
    setSources(availableSources);
    setActivities((feedResult.data ?? []) as Activity[]);
    const connectedCalendars = (calendarResult.data ?? { personal: null, company: null }) as CalendarStatus;
    setCalendarStatus(connectedCalendars);
    if (connectedCalendars.personal || connectedCalendars.company) {
      const refreshedSession = (await supabase.auth.refreshSession()).data.session ?? session;
      const timeMin = new Date(Date.now() - 180 * 86_400_000).toISOString();
      const timeMax = new Date(Date.now() + 365 * 86_400_000).toISOString();
      try {
        const response = await fetch(`https://lxwqhtuhlddgwfxjtlas.supabase.co/functions/v1/ruang-kawan-calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, { headers: { Authorization: `Bearer ${refreshedSession.access_token}` } });
        const body = await response.json();
        setGoogleEvents((body.events ?? []).filter((item: GoogleEvent) => !item.error));
      } catch { setGoogleEvents([]); }
    } else setGoogleEvents([]);
    setState('ready');
  }

  useEffect(() => { void loadData(); }, []);
  useEffect(() => { const value = new URLSearchParams(window.location.search).get('focus') ?? ''; setFocusFilter(value); if (value === 'today') setSelectedDate(today()); }, []);

  const selectedSource = useMemo(() => sources.find((source) => source.id === form.sourceId), [sources, form.sourceId]);
  const manualSources = useMemo(() => sources.filter((source) => source.module_type === 'activity'), [sources]);
  const monthDays = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => `${year}-${String(month + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`),
    ];
  }, [monthCursor]);

  const filteredActivities = useMemo(() => activities.filter((activity) =>
    (focusFilter !== 'today' || activity.activity_date === today())
    && (focusFilter !== 'overdue' || (activity.activity_date < today() && activity.status !== 'done'))
    && (focusFilter !== 'review' || activity.relationship === 'review' || activity.review_status === 'waiting_review')
    && (focusFilter !== 'open' || activity.status !== 'done')
  ), [activities, focusFilter]);
  const selectedActivities = useMemo(() => filteredActivities.filter((activity) => activity.activity_date === selectedDate), [filteredActivities, selectedDate]);
  const selectedGoogleEvents = useMemo(() => googleEvents.filter((event) => googleEventDate(event) === selectedDate), [googleEvents, selectedDate]);
  const countByDate = useMemo(() => filteredActivities.reduce<Record<string, number>>((counts, activity) => ({ ...counts, [activity.activity_date]: (counts[activity.activity_date] ?? 0) + 1 }), {}), [filteredActivities]);

  function startCreate(date = selectedDate) {
    setForm({ ...emptyForm(), date, sourceId: manualSources[0]?.id ?? '' });
    setError(''); setMessage(''); setFormOpen(true);
  }

  function startEdit(activity: Activity) {
    setForm({
      id: activity.id, sourceId: activity.source_id, title: activity.title, date: activity.activity_date,
      startTime: timeFromIso(activity.start_at), endTime: timeFromIso(activity.end_at), activityType: activity.activity_type ?? '',
      linkedKpi: activity.linked_kpi ?? '', status: activity.status, progress: activity.progress, priority: activity.priority,
      detail: activity.detail ?? '', output: activity.output ?? '', blockerRisk: activity.blocker_risk ?? '', nextAction: activity.next_action ?? '',
      evidenceUrl: activity.evidence_url ?? '', customData: Object.fromEntries(Object.entries(activity.custom_data ?? {}).map(([key, value]) => [key, typeof value === 'boolean' ? value : String(value)])),
    });
    setError(''); setMessage(''); setFormOpen(true);
  }

  function canEditDirectly(activity: Activity) {
    return activity.feed_kind === 'manual'
      && activity.owner_membership_id === membershipId
      && permissions.includes('activity.manage_self');
  }

  function canToggleCompletion(activity: Activity) {
    return activity.owner_membership_id === membershipId;
  }

  async function toggleCompletion(activity: Activity) {
    if (!canToggleCompletion(activity) || checkingId) return;
    const completed = activity.status !== 'done';
    setCheckingId(activity.id); setError(''); setMessage('');
    const { error: completionError } = await createClient().rpc('set_activity_completion', {
      target_activity: activity.id,
      completed,
    });
    setCheckingId('');
    if (completionError) {
      setError(completionError.message || 'Status aktivitas belum berhasil diperbarui.');
      return;
    }
    setActivities((current) => current.map((item) => item.id === activity.id
      ? { ...item, status: completed ? 'done' : 'in_progress', progress: completed ? 100 : 0 }
      : item));
    setMessage(completed ? 'Aktivitas ditandai selesai.' : 'Aktivitas dibuka kembali.');
  }

  async function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!membershipId || !form.sourceId) return;
    if (form.endTime && (!form.startTime || form.endTime <= form.startTime)) {
      setError('Jam selesai harus lebih akhir dari jam mulai.'); return;
    }
    setSaving(true); setError(''); setMessage('');
    const payload = {
      owner_membership_id: membershipId, source_id: form.sourceId, title: form.title.trim(), activity_date: form.date,
      start_at: toIso(form.date, form.startTime), end_at: toIso(form.date, form.endTime), activity_type: form.activityType.trim() || null,
      linked_kpi: form.linkedKpi.trim() || null, status: form.status, progress: form.status === 'done' ? 100 : form.progress,
      priority: form.priority, detail: form.detail.trim() || null, output: form.output.trim() || null,
      blocker_risk: form.blockerRisk.trim() || null, next_action: form.nextAction.trim() || null,
      evidence_url: form.evidenceUrl.trim() || null, custom_data: form.customData, updated_by: (await createClient().auth.getUser()).data.user?.id,
    };
    const result = form.id
      ? await createClient().from('activities').update(payload).eq('id', form.id)
      : await createClient().from('activities').insert(payload);
    setSaving(false);
    if (result.error) { setError(result.error.message || 'Aktivitas belum berhasil disimpan.'); return; }
    setMessage(form.id ? 'Aktivitas berhasil diperbarui.' : 'Aktivitas berhasil ditambahkan ke feed.');
    setFormOpen(false); await loadData();
  }

  async function removeActivity() {
    if (!form.id || !window.confirm('Hapus aktivitas ini dari My Activity?')) return;
    setSaving(true);
    const { error: deleteError } = await createClient().from('activities').delete().eq('id', form.id);
    setSaving(false);
    if (deleteError) { setError('Aktivitas belum berhasil dihapus.'); return; }
    setFormOpen(false); setMessage('Aktivitas berhasil dihapus.'); await loadData();
  }

  async function connectCalendar(connectionType: 'personal' | 'company') {
    setError('');
    const supabase = createClient();
    const refreshed = await supabase.auth.refreshSession();
    const session = refreshed.data.session ?? (await supabase.auth.getSession()).data.session;
    if (!session) return;
    try {
      const response = await fetch('https://lxwqhtuhlddgwfxjtlas.supabase.co/functions/v1/ruang-kawan-calendar/authorize', {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionType, returnUrl: window.location.href }),
      });
      const body = await response.json();
      if (!response.ok || !body.url) throw new Error(body.error || 'Koneksi belum tersedia.');
      window.location.assign(body.url);
    } catch (calendarError) {
      setError(calendarError instanceof Error ? calendarError.message : 'Layanan koneksi Calendar sedang disiapkan. Data My Activity tetap dapat digunakan.');
    }
  }

  if (state === 'loading') return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><p>Menyiapkan My Activity...</p></section></main>;
  if (state === 'denied') return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><h1>Akses My Activity belum tersedia</h1><p>Hubungi administrator untuk mengaktifkan izin aktivitas.</p><Link href="/ruang-kawan/dashboard/">Kembali ke dashboard</Link></section></main>;

  return (
    <main className="rk-activity-foundation">
      <section className="rk-activity-shell">
        <nav className="rk-activity-nav">
          <Link href="/ruang-kawan/dashboard/"><FiArrowLeft /> Dashboard</Link>
          <span><a href="#calendar-connect" aria-label="Calendar Connect" title="Calendar Connect"><FiCalendar /></a><button type="button" onClick={() => void loadData()}><FiRefreshCw /> Muat ulang</button></span>
        </nav>

        <header className="rk-activity-heading">
          <div><small>Ruang Kawan · Pusat kerja personal</small><h1>My Activity</h1><p>Satu feed untuk aktivitas manual, assignment, Content Plan, dan seluruh Pipeline BD yang terkait langsung dengan kamu.</p></div>
          {permissions.includes('activity.manage_self') && manualSources.length ? <button type="button" onClick={() => startCreate()}><FiPlus /> Tambah aktivitas</button> : null}
        </header>

        <nav className="rk-personal-tabs" aria-label="Bagian My Activity">
          <a href="#overview"><FiActivity /> Overview & Feed</a>
          {permissions.includes('notes.manage_self') ? <Link href="/ruang-kawan/notes/"><FiEdit3 /> Coret-coret</Link> : null}
          <Link href="/ruang-kawan/assignments/"><FiClock /> Assignment</Link>
          <a href="#calendar"><FiCalendar /> Calendar</a>
        </nav>

        <section className="rk-calendar-connections" id="calendar-connect">
          <article><span><FiCalendar /><i>Kalender Perusahaan</i></span><strong>Campus Innovate</strong><small>{calendarStatus.company ? `Terhubung melalui ${calendarStatus.company.email}` : 'Kalender utama innovatecampus@gmail.com'}</small>{calendarStatus.company ? <div className="rk-calendar-connection-actions"><b data-connected>Terhubung</b>{permissions.includes('calendar.manage_company') ? <button type="button" onClick={() => void connectCalendar('company')}>Hubungkan ulang</button> : null}</div> : <button type="button" onClick={() => void connectCalendar('company')}>Hubungkan bridge</button>}</article>
          <article><span><FiCalendar /><i>Kalender Pribadi</i></span><strong>Google Calendar saya</strong><small>{calendarStatus.personal ? `Terhubung sebagai ${calendarStatus.personal.email}` : 'Tampil bersama agenda kerja kamu'}</small>{calendarStatus.personal ? <div className="rk-calendar-connection-actions"><b data-connected>Terhubung</b><button type="button" onClick={() => void connectCalendar('personal')}>Hubungkan ulang</button></div> : <button type="button" onClick={() => void connectCalendar('personal')}>Hubungkan kalender</button>}</article>
        </section>

        {focusFilter ? <div className="rk-focus-filter"><span>Filter Dashboard: <strong>{focusFilter === 'today' ? 'Jatuh tempo hari ini' : focusFilter === 'overdue' ? 'Terlambat' : focusFilter === 'review' ? 'Perlu review' : 'Action item terbuka'}</strong></span><button type="button" onClick={() => { setFocusFilter(''); window.history.replaceState({}, '', '/ruang-kawan/activity/'); }}>Tampilkan semua</button></div> : null}

        {error ? <p className="rk-activity-alert" data-error>{error}</p> : null}
        {message ? <p className="rk-activity-alert">{message}</p> : null}

        <section className="rk-activity-layout" id="calendar">
          <div className="rk-calendar-panel">
            <div className="rk-calendar-toolbar"><div><small>Kalender terpadu</small><h2>{monthLabels[monthCursor.getMonth()]} {monthCursor.getFullYear()}</h2></div><span><button type="button" aria-label="Bulan sebelumnya" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}><FiChevronLeft /></button><button type="button" onClick={() => { const current = new Date(`${today()}T12:00:00`); setMonthCursor(current); setSelectedDate(today()); }}>Hari ini</button><button type="button" aria-label="Bulan berikutnya" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}><FiChevronRight /></button></span></div>
            <div className="rk-calendar-grid rk-calendar-weekdays">{['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => <strong key={day}>{day}</strong>)}</div>
            <div className="rk-calendar-grid rk-calendar-days">{monthDays.map((date, index) => date ? <button type="button" key={date} data-selected={date === selectedDate} data-today={date === today()} onClick={() => setSelectedDate(date)}><span>{Number(date.slice(-2))}</span>{(countByDate[date] || googleEvents.some((event) => googleEventDate(event) === date)) ? <i>{(countByDate[date] ?? 0) + googleEvents.filter((event) => googleEventDate(event) === date).length}</i> : null}<div>{filteredActivities.filter((activity) => activity.activity_date === date).slice(0, 2).map((activity) => <b key={activity.id} style={{ background: activity.work_sources?.color ?? '#315c4f' }} />)}{googleEvents.filter((event) => googleEventDate(event) === date).slice(0, 2).map((event) => <b key={`${event.calendarType}-${event.id}`} data-google={event.calendarType} />)}</div></button> : <i key={`blank-${index}`} />)}</div>
          </div>

          <aside className="rk-day-panel">
            <div className="rk-day-heading"><div><small>Agenda harian</small><h2>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div>{permissions.includes('activity.manage_self') && manualSources.length ? <button type="button" onClick={() => startCreate(selectedDate)}><FiPlus /></button> : null}</div>
            <div className="rk-day-list">{selectedActivities.map((activity) => canEditDirectly(activity) ? <button type="button" key={activity.id} onClick={() => startEdit(activity)}><i style={{ background: activity.work_sources?.color ?? '#315c4f' }} /><span><small>{activity.start_at ? timeFromIso(activity.start_at) : 'Seharian'} · {feedKindLabels[activity.feed_kind]} · {activity.work_sources?.name}</small><strong>{activity.title}</strong><em data-status={activity.status}>{statusLabels[activity.status]}</em></span></button> : <Link key={activity.id} href={activity.module_route ?? '/ruang-kawan/assignments/'} data-work-module={activity.feed_kind}><i style={{ background: activity.work_sources?.color ?? '#315c4f' }} /><span><small>{activity.start_at ? timeFromIso(activity.start_at) : 'Seharian'} · {feedKindLabels[activity.feed_kind]} · {activity.work_sources?.name}</small><strong>{activity.title}</strong><em data-status={activity.status}>{statusLabels[activity.status]}</em></span><FiExternalLink /></Link>)}{selectedGoogleEvents.map((event) => <a key={`${event.calendarType}-${event.id}`} href={event.htmlLink} target="_blank" rel="noreferrer" data-calendar={event.calendarType}><i /><span><small>{googleEventTime(event)} · Google Calendar {event.calendarType === 'company' ? 'Perusahaan' : 'Pribadi'}</small><strong>{event.title}</strong><em>{event.calendarType === 'company' ? 'Company' : 'Personal'}</em></span><FiExternalLink /></a>)}{!selectedActivities.length && !selectedGoogleEvents.length ? <div className="rk-activity-empty"><FiCalendar /><strong>Belum ada aktivitas</strong><p>Tambahkan agenda kerja untuk tanggal ini.</p></div> : null}</div>
          </aside>
        </section>

        <section className="rk-feed-panel">
          <div className="rk-feed-heading"><div><small>Feed terpadu</small><h2>Pekerjaan yang terkait dengan saya</h2></div><span>{filteredActivities.length} aktivitas</span></div>
          <div className="rk-feed-list">{filteredActivities.length ? filteredActivities.map((activity) => <article key={activity.id} data-feed-kind={activity.feed_kind} data-completed={activity.status === 'done'}><i style={{ background: activity.work_sources?.color ?? '#315c4f' }} /><button className="rk-activity-check" type="button" role="checkbox" aria-checked={activity.status === 'done'} aria-label={`${activity.status === 'done' ? 'Buka kembali' : 'Tandai selesai'} ${activity.title}`} title={canToggleCompletion(activity) ? (activity.status === 'done' ? 'Buka kembali aktivitas' : 'Tandai aktivitas selesai') : `Hanya ${activity.owner_name} sebagai PIC yang dapat mengubah status`} disabled={!canToggleCompletion(activity) || checkingId === activity.id} onClick={() => void toggleCompletion(activity)}><FiCheck /></button><div className="rk-feed-content"><div><small>{new Date(`${activity.activity_date}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} · {activity.work_sources?.name}</small><span data-feed-kind={activity.feed_kind}>{feedKindLabels[activity.feed_kind]}</span><span data-relationship={activity.relationship}>{relationshipLabels[activity.relationship]}</span><span data-priority={activity.priority}>{priorityLabels[activity.priority]}</span></div><h3>{activity.title}</h3>{activity.detail ? <p>{activity.detail}</p> : null}<footer><em data-status={activity.status}>{statusLabels[activity.status]}</em><b>{activity.progress}%</b>{activity.feed_kind === 'assignment' ? <Link href="/ruang-kawan/assignments/" data-review={activity.review_status}>{reviewLabels[activity.review_status]}</Link> : null}{activity.feed_kind === 'assignment' ? <span>PIC · {activity.owner_name}</span> : null}{activity.output ? <span>{activity.feed_kind === 'pipeline' ? 'Stage' : activity.feed_kind === 'content_plan' ? 'Format' : 'Output'} · {activity.output}</span> : null}{activity.next_action ? <span>Berikutnya · {activity.next_action}</span> : null}{activity.linked_kpi ? <span>KPI · {activity.linked_kpi}</span> : null}{activity.evidence_url ? <a href={activity.evidence_url} target="_blank" rel="noreferrer"><FiExternalLink /> Bukti</a> : null}</footer></div>{canEditDirectly(activity) ? <button type="button" aria-label={`Ubah ${activity.title}`} onClick={() => startEdit(activity)}><FiEdit3 /></button> : <Link className="rk-feed-open" href={activity.module_route ?? '/ruang-kawan/assignments/'} aria-label={`Buka ${feedKindLabels[activity.feed_kind]}`}><FiExternalLink /></Link>}</article>) : <div className="rk-activity-empty"><FiClock /><strong>Feed masih kosong</strong><p>Aktivitas manual, assignment, Content Plan, dan Pipeline BD akan muncul di sini.</p></div>}</div>
        </section>
      </section>

      {formOpen ? <div className="rk-activity-modal" role="dialog" aria-modal="true" aria-label="Form aktivitas"><form onSubmit={saveActivity}><header><div><small>{form.id ? 'Ubah aktivitas' : 'Aktivitas baru'}</small><h2>{form.id ? form.title : 'Catat pekerjaan'}</h2></div><button type="button" aria-label="Tutup" onClick={() => setFormOpen(false)}><FiX /></button></header><div className="rk-activity-form-grid">
        <label>Sumber kerja<select value={form.sourceId} onChange={(event) => setForm({ ...form, sourceId: event.target.value, customData: {} })} required><option value="">Pilih sumber</option>{manualSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
        <label className="rk-form-wide">Judul aktivitas<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={180} required /></label>
        <label>Tanggal<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label>
        <label>Jenis aktivitas<input value={form.activityType} onChange={(event) => setForm({ ...form, activityType: event.target.value })} placeholder="Meeting, follow-up, produksi..." /></label>
        <label>Jam mulai<input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label>
        <label>Jam selesai<input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} disabled={!form.startTime} /></label>
        <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Activity['status'] })}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Prioritas<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Activity['priority'] })}>{Object.entries(priorityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Progress ({form.status === 'done' ? 100 : form.progress}%)<input type="range" min="0" max="100" step="5" value={form.status === 'done' ? 100 : form.progress} onChange={(event) => setForm({ ...form, progress: Number(event.target.value) })} disabled={form.status === 'done'} /></label>
        <label>KPI terkait<input value={form.linkedKpi} onChange={(event) => setForm({ ...form, linkedKpi: event.target.value })} placeholder="Opsional" /></label>
        {selectedSource?.field_schema?.map((field) => field.type === 'checkbox' ? <label key={field.key}><input type="checkbox" checked={Boolean(form.customData[field.key])} onChange={(event) => setForm({ ...form, customData: { ...form.customData, [field.key]: event.target.checked } })} />{field.label}</label> : <label key={field.key} className={field.type === 'textarea' ? 'rk-form-wide' : ''}>{field.label}{field.type === 'textarea' ? <textarea value={String(form.customData[field.key] ?? '')} onChange={(event) => setForm({ ...form, customData: { ...form.customData, [field.key]: event.target.value } })} /> : field.type === 'select' ? <select value={String(form.customData[field.key] ?? '')} onChange={(event) => setForm({ ...form, customData: { ...form.customData, [field.key]: event.target.value } })}><option value="">Belum dipilih</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : <input type={field.type} value={String(form.customData[field.key] ?? '')} onChange={(event) => setForm({ ...form, customData: { ...form.customData, [field.key]: event.target.value } })} />}</label>)}
        <label className="rk-form-wide">Detail<textarea value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} /></label>
        <label className="rk-form-wide">Output<textarea value={form.output} onChange={(event) => setForm({ ...form, output: event.target.value })} /></label>
        <label className="rk-form-wide">Blocker / risiko<textarea value={form.blockerRisk} onChange={(event) => setForm({ ...form, blockerRisk: event.target.value })} /></label>
        <label className="rk-form-wide">Next action / prioritas berikutnya<textarea value={form.nextAction} onChange={(event) => setForm({ ...form, nextAction: event.target.value })} /></label>
        <label className="rk-form-wide">URL bukti<input type="url" value={form.evidenceUrl} onChange={(event) => setForm({ ...form, evidenceUrl: event.target.value })} placeholder="https://..." /></label>
      </div>{error ? <p className="rk-modal-error">{error}</p> : null}<footer>{form.id ? <button type="button" data-danger onClick={() => void removeActivity()} disabled={saving}>Hapus</button> : <span />}<div><button type="button" onClick={() => setFormOpen(false)}>Batal</button><button type="submit" data-primary disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan aktivitas'}</button></div></footer></form></div> : null}
    </main>
  );
}
