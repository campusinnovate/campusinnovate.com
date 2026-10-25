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
  pipeline_lead_id?: string;
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
type PersonalNote = { id: string; title: string | null; content: string; tags: string[]; is_pinned: boolean; updated_at: string };
type ActivityView = 'overview' | 'pipeline' | 'todo' | 'notes' | 'agenda' | 'history';
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
function agendaCategory(value: string) {
  const text = value.toLowerCase();
  if (/deep.?work|focus|blok fokus|kerja fokus/.test(text)) return 'deep-work';
  if (/visit|kunjungan|survey|survei|site visit/.test(text)) return 'visit';
  if (/client|klien|prospek/.test(text)) return 'client';
  if (/meeting|rapat|sync|call|presentasi/.test(text)) return 'meeting';
  if (/event|acara|workshop|training|gathering/.test(text)) return 'event';
  return 'activity';
}
function agendaCategoryLabel(value: string) {
  return ({ 'deep-work': 'Deep work', visit: 'Visit', client: 'Client', meeting: 'Meeting', event: 'Event', activity: 'Kegiatan' } as Record<string,string>)[value] ?? 'Kegiatan';
}
function activityPipelineUrl(activity: Activity) {
  if (activity.pipeline_lead_id) return '/ruang-kawan/pipeline/?lead=' + encodeURIComponent(activity.pipeline_lead_id);
  const parts = activity.title.split(' · ');
  const search = parts.length > 1 ? parts[parts.length - 1].trim() : activity.title.trim();
  return '/ruang-kawan/pipeline/?q=' + encodeURIComponent(search);
}

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
  const [activeView, setActiveView] = useState<ActivityView>('overview');
  const [moduleDates, setModuleDates] = useState(() => { const yesterday = new Date(today() + 'T12:00:00'); yesterday.setDate(yesterday.getDate() - 1); return { pipeline: today(), todo: today(), notes: today(), agenda: today(), history: yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) }; });
  const [notes, setNotes] = useState<PersonalNote[]>([]);
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

    const [accessResult, membershipResult, sourcesResult, feedResult, calendarResult, pipelineLeadsResult] = await Promise.all([
      supabase.rpc('get_my_access'),
      supabase.rpc('current_membership_id'),
      supabase.rpc('list_my_work_sources'),
      supabase.rpc('list_my_activity_feed'),
      supabase.rpc('get_my_calendar_status'),
      supabase.rpc('list_pipeline_leads'),
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
    const pipelineLeadIds = new Map(((pipelineLeadsResult.data ?? []) as { id: string; activity_id?: string }[]).filter((lead) => Boolean(lead.activity_id)).map((lead) => [lead.activity_id as string, lead.id]));
    setActivities(((feedResult.data ?? []) as Activity[]).map((activity) => activity.feed_kind === 'pipeline' ? { ...activity, pipeline_lead_id: pipelineLeadIds.get(activity.id) } : activity));
    if (access.permissions?.includes('notes.manage_self')) {
      const notesResult = await supabase.from('personal_notes').select('id,title,content,tags,is_pinned,updated_at').eq('owner_membership_id', memberId).is('archived_at', null).order('is_pinned', { ascending: false }).order('updated_at', { ascending: false });
      setNotes(notesResult.error ? [] : (notesResult.data ?? []) as PersonalNote[]);
    } else setNotes([]);
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
  const pipelineActivities = useMemo(() => filteredActivities.filter((activity) => activity.feed_kind === 'pipeline'), [filteredActivities]);
  const todoActivities = useMemo(() => filteredActivities.filter((activity) => activity.feed_kind !== 'pipeline'), [filteredActivities]);
  const calendarActivities = useMemo(() => filteredActivities.filter((activity) => Boolean(activity.start_at) && /deep.?work|focus|meeting|rapat|sync|call|presentasi|client|klien|prospek|visit|kunjungan|survey|survei|event|acara|workshop|training|gathering/i.test((activity.activity_type ?? '') + ' ' + activity.title)), [filteredActivities]);
  function changeModuleDate(view: 'pipeline' | 'todo' | 'notes' | 'agenda' | 'history', value: string) { setModuleDates((current) => ({ ...current, [view]: value })); }
  function stepModuleDate(view: 'pipeline' | 'todo' | 'notes' | 'agenda' | 'history', step: number) {
    const date = new Date(moduleDates[view] + 'T12:00:00'); date.setDate(date.getDate() + step);
    changeModuleDate(view, date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }));
  }
  function dayLabel(date: string, includeYear = true) {
    return new Date(date + 'T12:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', ...(includeYear ? { year: 'numeric' } : {}) });
  }
  function agendaEventsFor(date: string) {
    const work = calendarActivities.filter((activity) => activity.activity_date === date).map((activity) => ({
      id: activity.id, title: activity.title, time: activity.start_at ? timeFromIso(activity.start_at) : 'Seharian',
      category: agendaCategory((activity.activity_type ?? '') + ' ' + activity.title), href: activity.module_route ?? '/ruang-kawan/assignments/', source: 'activity',
    }));
    const google = googleEvents.filter((event) => googleEventDate(event) === date).map((event) => ({
      id: event.calendarType + '-' + event.id, title: event.title, time: googleEventTime(event),
      category: agendaCategory(event.title), href: event.htmlLink ?? '#', source: event.calendarType,
    }));
    return [...work, ...google].sort((a, b) => a.time.localeCompare(b.time));
  }
  function renderActivityCard(activity: Activity, kind: 'pipeline' | 'todo' | 'history') {
    const deadline = dayLabel(activity.activity_date, false);
    const time = activity.end_at ? timeFromIso(activity.end_at) : activity.start_at ? timeFromIso(activity.start_at) : '';
    const isPipeline = kind === 'pipeline';
    return <article className="ma2-work-card" key={activity.id} data-done={activity.status === 'done'}>
      <button className="ma2-check" type="button" role="checkbox" aria-checked={activity.status === 'done'} aria-label={(activity.status === 'done' ? 'Buka kembali: ' : 'Tandai selesai: ') + activity.title} disabled={!canToggleCompletion(activity) || checkingId === activity.id} onClick={() => void toggleCompletion(activity)}><FiCheck /></button>
      <div className="ma2-work-copy">
        <div className="ma2-meta"><span className={isPipeline ? 'ma2-tag pipeline' : 'ma2-tag'}>{isPipeline ? 'Pipeline' : activity.feed_kind === 'assignment' ? 'Assignment' : activity.work_sources?.name ?? 'To-do'}</span><span>{activity.priority === 'urgent' ? priorityLabels.urgent : activity.priority === 'high' ? priorityLabels.high : ''}</span></div>
        <h3>{activity.title}</h3>
        {activity.detail ? <p>{activity.detail}</p> : null}
        <div className="ma2-work-details"><span><FiCalendar /> Deadline · {deadline}{time ? ' · ' + time : ''}</span><span><b className="ma2-mini-avatar">{activity.owner_name.split(' ').map((part) => part[0]).slice(0,2).join('').toUpperCase()}</b> PIC · {activity.owner_name}</span><em data-status={activity.status}>{statusLabels[activity.status]}</em></div>
        {activity.next_action && isPipeline ? <small className="ma2-next-action">Next action · {activity.next_action}</small> : null}
      </div>
      {isPipeline ? <Link className="ma2-open-pipeline" href={activityPipelineUrl(activity)}><span>Buka lead di Pipeline</span><FiExternalLink /></Link> : activity.module_route ? <Link className="ma2-open-task" href={activity.module_route} aria-label="Buka sumber pekerjaan"><FiExternalLink /></Link> : null}
    </article>;
  }
  function renderAgendaCard(item: ReturnType<typeof agendaEventsFor>[number]) {
    return <a className="ma2-agenda-item" href={item.href} target={item.source === 'activity' ? undefined : '_blank'} rel={item.source === 'activity' ? undefined : 'noreferrer'} data-category={item.category} key={item.id}>
      <span className="ma2-agenda-time">{item.time}</span><i className="ma2-agenda-rail" /><span className="ma2-agenda-copy"><small>{agendaCategoryLabel(item.category)}{item.source === 'company' ? ' · Calendar perusahaan' : item.source === 'personal' ? ' · Calendar pribadi' : ''}</small><strong>{item.title}</strong></span>
    </a>;
  }
  const dailyPipelineCount = pipelineActivities.filter((activity) => activity.activity_date === selectedDate).length;
  const dailyTodoCount = todoActivities.filter((activity) => activity.activity_date === selectedDate).length;
  const dailyAgendaCount = agendaEventsFor(selectedDate).length;
  const dailyNotesCount = notes.filter((note) => new Date(note.updated_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) === selectedDate).length;


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
    <main className="rk-activity-foundation rk-activity-v2">
      <section className="rk-activity-shell">
        <div className="ma2-eyebrow"><span>RUANG KAWAN <b>/</b> PERSONAL WORKSPACE</span><button type="button" onClick={() => void loadData()}><FiRefreshCw /> Muat ulang</button></div>
        <header className="ma2-heading">
          <div><small>WORKSPACE PRIBADI</small><h1>My Activity</h1><p>Kelola pekerjaan, follow-up, catatan, dan agenda tanpa mencampur alurnya.</p></div>
          {permissions.includes('activity.manage_self') && manualSources.length ? <button type="button" className="ma2-add" onClick={() => startCreate()}><FiPlus /> Tambah To-do</button> : null}
        </header>
        <nav className="ma2-tabs" aria-label="Bagian My Activity">
          {([
            ['overview','Ringkasan',null],['pipeline','Pipeline',dailyPipelineCount],['todo','To-do',dailyTodoCount],
            ['notes','Notes',dailyNotesCount],['agenda','Agenda',dailyAgendaCount],['history','Riwayat',null],
          ] as [ActivityView,string,number|null][]).map(([view,label,count]) => <button type="button" key={view} data-active={activeView === view} onClick={() => setActiveView(view)}>{label}{count !== null ? <i>{count}</i> : null}</button>)}
        </nav>
        {focusFilter ? <div className="rk-focus-filter"><span>Filter Dashboard: <strong>{focusFilter === 'today' ? 'Jatuh tempo hari ini' : focusFilter === 'overdue' ? 'Terlambat' : focusFilter === 'review' ? 'Perlu review' : 'Action item terbuka'}</strong></span><button type="button" onClick={() => { setFocusFilter(''); window.history.replaceState({}, '', '/ruang-kawan/activity/'); }}>Tampilkan semua</button></div> : null}
        {error ? <p className="rk-activity-alert" data-error>{error}</p> : null}
        {message ? <p className="rk-activity-alert">{message}</p> : null}

        {activeView === 'overview' ? <section className="ma2-view">
          <div className="ma2-datebar"><div><small>RINGKASAN HARIAN</small><h2>{dayLabel(selectedDate)}</h2></div><div className="ma2-date-controls"><button type="button" aria-label="Hari sebelumnya" onClick={() => { const d=new Date(selectedDate+'T12:00:00'); d.setDate(d.getDate()-1); const v=d.toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'}); setSelectedDate(v); setModuleDates((x)=>({...x,agenda:v})); }}>‹</button><input aria-label="Pilih tanggal ringkasan" type="date" value={selectedDate} onChange={(event)=>{setSelectedDate(event.target.value);setModuleDates((x)=>({...x,agenda:event.target.value}));}}/><button type="button" aria-label="Hari berikutnya" onClick={() => { const d=new Date(selectedDate+'T12:00:00'); d.setDate(d.getDate()+1); const v=d.toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'}); setSelectedDate(v); setModuleDates((x)=>({...x,agenda:v})); }}>›</button><button type="button" onClick={() => {setSelectedDate(today());setModuleDates((x)=>({...x,agenda:today()}));}}>Hari ini</button></div></div>
          <div className="ma2-stats">
            <article><i className="ma2-stat-icon todo"><FiCheck /></i><span><small>To-do</small><strong>{dailyTodoCount}</strong><em>pekerjaan hari ini</em></span></article>
            <article><i className="ma2-stat-icon pipeline"><FiActivity /></i><span><small>Pipeline</small><strong>{dailyPipelineCount}</strong><em>follow-up hari ini</em></span></article>
            <article><i className="ma2-stat-icon agenda"><FiCalendar /></i><span><small>Agenda</small><strong>{dailyAgendaCount}</strong><em>kegiatan terjadwal</em></span></article>
            <article><i className="ma2-stat-icon notes"><FiEdit3 /></i><span><small>Notes</small><strong>{dailyNotesCount}</strong><em>catatan diperbarui</em></span></article>
          </div>
          <div className="ma2-calendar-layout">
            <section className="ma2-calendar-card">
              <header className="ma2-card-head"><div><small>KALENDER KEGIATAN</small><h3>{monthLabels[monthCursor.getMonth()]} {monthCursor.getFullYear()}</h3></div><div className="ma2-calendar-tools"><button type="button" aria-label="Bulan sebelumnya" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth()-1,1))}><FiChevronLeft /></button><button type="button" onClick={() => {setMonthCursor(new Date(today()+'T12:00:00'));setSelectedDate(today());setModuleDates((x)=>({...x,agenda:today()}));}}>Hari ini</button><button type="button" aria-label="Bulan berikutnya" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth()+1,1))}><FiChevronRight /></button></div></header>
              <div className="ma2-month-grid"><div className="ma2-weekdays">{['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map((day)=><b key={day}>{day}</b>)}</div><div className="ma2-days">{monthDays.map((date,index)=>date ? <button type="button" key={date} data-selected={date===selectedDate} data-today={date===today()} onClick={()=>{setSelectedDate(date);setModuleDates((x)=>({...x,agenda:date}));}}><span className="ma2-date-number">{Number(date.slice(-2))}</span><div className="ma2-event-chips">{agendaEventsFor(date).slice(0,2).map((item)=><span key={item.id} data-category={item.category} title={item.title}>{item.time!=='Seharian'?item.time+' ':''}{item.title}</span>)}</div>{agendaEventsFor(date).length>2?<small className="ma2-more-events">+{agendaEventsFor(date).length-2} lagi</small>:null}</button>:<i key={'blank-'+index} />)}</div></div>
              <footer className="ma2-legend"><span data-category="meeting">Meeting</span><span data-category="client">Client</span><span data-category="visit">Visit</span><span data-category="deep-work">Deep work</span><span data-category="event">Event</span></footer>
            </section>
            <aside className="ma2-agenda-card"><header className="ma2-card-head"><div><small>AGENDA HARIAN</small><h3>{dayLabel(selectedDate,false)}</h3></div><span className="ma2-calendar-connected"><i />Google Calendar</span></header><div className="ma2-agenda-list">{agendaEventsFor(selectedDate).length ? agendaEventsFor(selectedDate).map(renderAgendaCard) : <div className="rk-activity-empty"><FiCalendar /><strong>Belum ada agenda</strong><p>Pilih tanggal lain atau tambahkan kegiatan di Calendar.</p></div>}</div>
              <details className="ma2-calendar-accounts"><summary>Pengaturan koneksi kalender</summary><div className="rk-calendar-connections" id="calendar-connect"><article><span><FiCalendar/><i>Perusahaan</i></span><strong>Campus Innovate</strong><small>{calendarStatus.company ? 'Terhubung · '+calendarStatus.company.email : 'Belum terhubung'}</small><b data-connected={Boolean(calendarStatus.company)}>{calendarStatus.company?'Terhubung':'Belum aktif'}</b></article><article><span><FiCalendar/><i>Pribadi</i></span><strong>Google Calendar saya</strong><small>{calendarStatus.personal ? 'Terhubung · '+calendarStatus.personal.email : 'Belum terhubung'}</small><b data-connected={Boolean(calendarStatus.personal)}>{calendarStatus.personal?'Terhubung':'Belum aktif'}</b></article><Link href="/ruang-kawan/profile/#google-integrations">Kelola koneksi kalender</Link></div></details>
            </aside>
          </div>
          <div className="ma2-section-heading"><div><small>PEKERJAAN HARI INI</small><h3>Area kerja terpisah</h3></div><span>{dailyTodoCount+dailyPipelineCount} item perlu dilihat</span></div>
          <div className="ma2-summary-grid">
            <section className="ma2-summary-card"><header><div><i className="todo"><FiCheck /></i><span><strong>To-do</strong><small>Checklist dan task operasional</small></span></div><button type="button" onClick={()=>setActiveView('todo')}>Lihat semua <FiChevronRight /></button></header><div className="ma2-summary-list">{todoActivities.filter((a)=>a.activity_date===selectedDate).slice(0,3).map((activity)=>renderActivityCard(activity,'todo'))}{!todoActivities.some((a)=>a.activity_date===selectedDate)?<p className="ma2-empty">Tidak ada To-do pada tanggal ini.</p>:null}</div></section>
            <section className="ma2-summary-card"><header><div><i className="pipeline"><FiActivity /></i><span><strong>Pipeline</strong><small>Follow-up yang melekat ke lead</small></span></div><button type="button" onClick={()=>setActiveView('pipeline')}>Lihat semua <FiChevronRight /></button></header><div className="ma2-summary-list">{pipelineActivities.filter((a)=>a.activity_date===selectedDate).slice(0,3).map((activity)=>renderActivityCard(activity,'pipeline'))}{!pipelineActivities.some((a)=>a.activity_date===selectedDate)?<p className="ma2-empty">Tidak ada follow-up pada tanggal ini.</p>:null}</div></section>
            <section className="ma2-summary-card ma2-notes-summary"><header><div><i className="notes"><FiEdit3 /></i><span><strong>Notes</strong><small>Catatan pada tanggal ini</small></span></div><Link href="/ruang-kawan/notes/">Buka Notes <FiExternalLink /></Link></header><div className="ma2-summary-list">{notes.filter((note)=>new Date(note.updated_at).toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'})===selectedDate).slice(0,2).map((note)=><article className="ma2-note-card" key={note.id}><strong>{note.title||'Tanpa judul'}</strong><p>{note.content}</p><small>{new Date(note.updated_at).toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'})} · {note.is_pinned?'Disematkan':'Diperbarui'}</small></article>)}{!notes.some((note)=>new Date(note.updated_at).toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'})===selectedDate)?<p className="ma2-empty">Tidak ada catatan pada tanggal ini.</p>:null}</div></section>
          </div>
        </section> : null}

        {activeView === 'todo' || activeView === 'pipeline' || activeView === 'history' ? <section className="ma2-view">
          <div className="ma2-datebar"><div><small>{activeView==='todo'?'DAFTAR PEKERJAAN':activeView==='pipeline'?'FOLLOW-UP PIPELINE':'RIWAYAT AKTIVITAS'}</small><h2>{dayLabel(moduleDates[activeView])}</h2><p>{activeView==='todo'?'Task operasional tetap berupa checklist dan tidak masuk Google Calendar.':activeView==='pipeline'?'Setiap follow-up menunjukkan deadline dan PIC yang bertanggung jawab.':'Aktivitas lama tersimpan di riwayat terpisah.'}</p></div><div className="ma2-date-controls"><button type="button" onClick={()=>stepModuleDate(activeView,-1)} aria-label="Hari sebelumnya"><FiChevronLeft /></button><input aria-label="Filter tanggal" type="date" value={moduleDates[activeView]} onChange={(event)=>changeModuleDate(activeView,event.target.value)}/><button type="button" onClick={()=>stepModuleDate(activeView,1)} aria-label="Hari berikutnya"><FiChevronRight /></button><button type="button" onClick={()=>changeModuleDate(activeView,today())}>Hari ini</button></div></div>
          {activeView==='todo' && permissions.includes('activity.assign_team') ? <Link className="ma2-open-pipeline" href="/ruang-kawan/assignments/"><FiPlus/> Tugaskan ke anggota</Link> : null}<div className="ma2-list-card">{(activeView==='pipeline'?pipelineActivities:activeView==='todo'?todoActivities:filteredActivities.filter((activity)=>activity.activity_date===moduleDates.history)).filter((activity)=>activity.activity_date===moduleDates[activeView]).map((activity)=>renderActivityCard(activity,activeView==='pipeline'?'pipeline':activeView==='history'?'history':'todo'))}
          {(activeView==='pipeline'?pipelineActivities:activeView==='todo'?todoActivities:filteredActivities.filter((activity)=>activity.activity_date===moduleDates.history)).every((activity)=>activity.activity_date!==moduleDates[activeView])?<div className="rk-activity-empty"><FiClock/><strong>Tidak ada item pada tanggal ini</strong><p>Pilih tanggal lain untuk melihat aktivitasnya.</p></div>:null}</div>
        </section> : null}

        {activeView === 'agenda' ? <section className="ma2-view">
          <div className="ma2-datebar"><div><small>AGENDA & KEGIATAN</small><h2>{dayLabel(moduleDates.agenda)}</h2><p>Meeting, kunjungan, deep work, dan kegiatan. Checklist task tidak ditambahkan ke Google Calendar.</p></div><div className="ma2-date-controls"><button type="button" onClick={()=>stepModuleDate('agenda',-1)} aria-label="Hari sebelumnya"><FiChevronLeft/></button><input aria-label="Filter tanggal agenda" type="date" value={moduleDates.agenda} onChange={(event)=>changeModuleDate('agenda',event.target.value)}/><button type="button" onClick={()=>stepModuleDate('agenda',1)} aria-label="Hari berikutnya"><FiChevronRight/></button><button type="button" onClick={()=>changeModuleDate('agenda',today())}>Hari ini</button></div></div>
          <div className="ma2-calendar-layout"><section className="ma2-calendar-card"><header className="ma2-card-head"><div><small>KALENDER KEGIATAN</small><h3>{monthLabels[monthCursor.getMonth()]} {monthCursor.getFullYear()}</h3></div><div className="ma2-calendar-tools"><button type="button" aria-label="Bulan sebelumnya" onClick={()=>setMonthCursor(new Date(monthCursor.getFullYear(),monthCursor.getMonth()-1,1))}><FiChevronLeft/></button><button type="button" onClick={()=>{setMonthCursor(new Date(today()+'T12:00:00'));changeModuleDate('agenda',today());}}>Hari ini</button><button type="button" aria-label="Bulan berikutnya" onClick={()=>setMonthCursor(new Date(monthCursor.getFullYear(),monthCursor.getMonth()+1,1))}><FiChevronRight/></button></div></header><div className="ma2-month-grid"><div className="ma2-weekdays">{['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map((day)=><b key={day}>{day}</b>)}</div><div className="ma2-days">{monthDays.map((date,index)=>date?<button type="button" key={date} data-selected={date===moduleDates.agenda} data-today={date===today()} onClick={()=>changeModuleDate('agenda',date)}><span className="ma2-date-number">{Number(date.slice(-2))}</span><div className="ma2-event-chips">{agendaEventsFor(date).slice(0,2).map((item)=><span key={item.id} data-category={item.category} title={item.title}>{item.time!=='Seharian'?item.time+' ':''}{item.title}</span>)}</div>{agendaEventsFor(date).length>2?<small className="ma2-more-events">+{agendaEventsFor(date).length-2} lagi</small>:null}</button>:<i key={'agenda-blank-'+index}/>)}</div></div><footer className="ma2-legend"><span data-category="meeting">Meeting</span><span data-category="client">Client</span><span data-category="visit">Visit</span><span data-category="deep-work">Deep work</span><span data-category="event">Event</span></footer></section><aside className="ma2-agenda-card"><header className="ma2-card-head"><div><small>JADWAL PADA TANGGAL INI</small><h3>{dayLabel(moduleDates.agenda,false)}</h3></div><span className="ma2-calendar-connected"><i/>Calendar</span></header><div className="ma2-agenda-list">{agendaEventsFor(moduleDates.agenda).length?agendaEventsFor(moduleDates.agenda).map(renderAgendaCard):<div className="rk-activity-empty"><FiCalendar/><strong>Belum ada agenda</strong><p>Pilih tanggal lain atau tambahkan kegiatan di Calendar.</p></div>}</div><Link className="ma2-calendar-settings" href="/ruang-kawan/profile/#google-integrations">Kelola koneksi Google Calendar <FiExternalLink/></Link></aside></div>
        </section> : null}

        {activeView === 'notes' ? <section className="ma2-view">
          <div className="ma2-datebar"><div><small>CATATAN</small><h2>{dayLabel(moduleDates.notes)}</h2><p>Daftar notes pribadi berdasarkan tanggal diperbarui.</p></div><div className="ma2-date-controls"><button type="button" onClick={()=>stepModuleDate('notes',-1)} aria-label="Hari sebelumnya"><FiChevronLeft/></button><input aria-label="Filter tanggal notes" type="date" value={moduleDates.notes} onChange={(event)=>changeModuleDate('notes',event.target.value)}/><button type="button" onClick={()=>stepModuleDate('notes',1)} aria-label="Hari berikutnya"><FiChevronRight/></button><button type="button" onClick={()=>changeModuleDate('notes',today())}>Hari ini</button></div></div>
          <div className="ma2-notes-toolbar"><span>{notes.filter((note)=>new Date(note.updated_at).toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'})===moduleDates.notes).length} notes diperbarui pada tanggal ini</span><Link href="/ruang-kawan/notes/">Buka semua Notes <FiExternalLink/></Link></div>
          <div className="ma2-notes-grid">{notes.filter((note)=>new Date(note.updated_at).toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'})===moduleDates.notes).map((note)=><article className="ma2-note-card" key={note.id}><header><strong>{note.title||'Tanpa judul'}</strong>{note.is_pinned?<span>Disematkan</span>:null}</header><p>{note.content}</p><footer><small>Diperbarui {new Date(note.updated_at).toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'})}{note.tags?.length?' · '+note.tags.slice(0,3).map((tag)=>'#'+tag).join(' '):''}</small><Link href="/ruang-kawan/notes/">Buka <FiExternalLink/></Link></footer></article>)}{!notes.some((note)=>new Date(note.updated_at).toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'})===moduleDates.notes)?<div className="rk-activity-empty"><FiEdit3/><strong>Tidak ada Notes pada tanggal ini</strong><p>Pilih hari lain atau buat catatan di ruang Notes.</p><Link href="/ruang-kawan/notes/">Buka Notes</Link></div>:null}</div>
        </section> : null}
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
