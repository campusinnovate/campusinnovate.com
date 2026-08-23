'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  FiArrowLeft, FiCalendar, FiChevronLeft, FiChevronRight, FiClock,
  FiEdit3, FiExternalLink, FiPlus, FiRefreshCw, FiX,
} from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';

type FieldSchema = { key: string; label: string; type: 'text' | 'number' | 'date' | 'url' | 'textarea' };
type WorkSource = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  source_kind: string;
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
  custom_data: Record<string, string | number>;
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
  customData: Record<string, string>;
};

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const emptyForm = (): ActivityForm => ({
  id: null, sourceId: '', title: '', date: today(), startTime: '', endTime: '', activityType: '', linkedKpi: '',
  status: 'not_started', progress: 0, priority: 'medium', detail: '', output: '', blockerRisk: '', nextAction: '', evidenceUrl: '', customData: {},
});
const statusLabels = { not_started: 'Belum Mulai', in_progress: 'Berjalan', done: 'Selesai', blocked: 'Terhambat' };
const priorityLabels = { low: 'Rendah', medium: 'Sedang', high: 'Tinggi', urgent: 'Mendesak' };
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
  const [sources, setSources] = useState<WorkSource[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>({ personal: null, company: null });
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([]);
  const [monthCursor, setMonthCursor] = useState(() => new Date(`${today()}T12:00:00`));
  const [selectedDate, setSelectedDate] = useState(today());
  const [sourceFilter, setSourceFilter] = useState('all');
  const [form, setForm] = useState<ActivityForm>(emptyForm());
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadData() {
    setError('');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.replace('/ruang-kawan/'); return; }

    const [accessResult, membershipResult, sourcesResult, calendarResult] = await Promise.all([
      supabase.rpc('get_my_access'),
      supabase.rpc('current_membership_id'),
      supabase.rpc('list_my_work_sources'),
      supabase.rpc('get_my_calendar_status'),
    ]);
    const access = Array.isArray(accessResult.data) ? accessResult.data[0] : accessResult.data;
    if (!access || access.membership_status !== 'active' || !access.permissions?.includes('activity.view_self')) {
      setState('denied'); return;
    }
    if (membershipResult.error || sourcesResult.error) {
      setError('My Activity belum dapat dimuat. Silakan muat ulang.');
      setState('ready'); return;
    }

    const memberId = membershipResult.data as string;
    const availableSources = (sourcesResult.data ?? []) as WorkSource[];
    const activityResult = await supabase
      .from('activities')
      .select('*, work_sources(*)')
      .eq('owner_membership_id', memberId)
      .order('activity_date', { ascending: false })
      .order('created_at', { ascending: false });

    setMembershipId(memberId);
    setSources(availableSources);
    setActivities((activityResult.data ?? []) as unknown as Activity[]);
    const connectedCalendars = (calendarResult.data ?? { personal: null, company: null }) as CalendarStatus;
    setCalendarStatus(connectedCalendars);
    if (connectedCalendars.personal || connectedCalendars.company) {
      const timeMin = new Date(Date.now() - 180 * 86_400_000).toISOString();
      const timeMax = new Date(Date.now() + 365 * 86_400_000).toISOString();
      try {
        const response = await fetch(`https://lxwqhtuhlddgwfxjtlas.supabase.co/functions/v1/ruang-kawan-calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        const body = await response.json();
        setGoogleEvents((body.events ?? []).filter((item: GoogleEvent) => !item.error));
      } catch { setGoogleEvents([]); }
    } else setGoogleEvents([]);
    setState('ready');
  }

  useEffect(() => { void loadData(); }, []);

  const selectedSource = useMemo(() => sources.find((source) => source.id === form.sourceId), [sources, form.sourceId]);
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

  const filteredActivities = useMemo(() => activities.filter((activity) => sourceFilter === 'all' || activity.source_id === sourceFilter), [activities, sourceFilter]);
  const selectedActivities = useMemo(() => filteredActivities.filter((activity) => activity.activity_date === selectedDate), [filteredActivities, selectedDate]);
  const selectedGoogleEvents = useMemo(() => googleEvents.filter((event) => googleEventDate(event) === selectedDate), [googleEvents, selectedDate]);
  const countByDate = useMemo(() => filteredActivities.reduce<Record<string, number>>((counts, activity) => ({ ...counts, [activity.activity_date]: (counts[activity.activity_date] ?? 0) + 1 }), {}), [filteredActivities]);

  function startCreate(date = selectedDate) {
    setForm({ ...emptyForm(), date, sourceId: sources[0]?.id ?? '' });
    setError(''); setMessage(''); setFormOpen(true);
  }

  function startEdit(activity: Activity) {
    setForm({
      id: activity.id, sourceId: activity.source_id, title: activity.title, date: activity.activity_date,
      startTime: timeFromIso(activity.start_at), endTime: timeFromIso(activity.end_at), activityType: activity.activity_type ?? '',
      linkedKpi: activity.linked_kpi ?? '', status: activity.status, progress: activity.progress, priority: activity.priority,
      detail: activity.detail ?? '', output: activity.output ?? '', blockerRisk: activity.blocker_risk ?? '', nextAction: activity.next_action ?? '',
      evidenceUrl: activity.evidence_url ?? '', customData: Object.fromEntries(Object.entries(activity.custom_data ?? {}).map(([key, value]) => [key, String(value)])),
    });
    setError(''); setMessage(''); setFormOpen(true);
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
    const { data: { session } } = await createClient().auth.getSession();
    if (!session) return;
    try {
      const response = await fetch('https://lxwqhtuhlddgwfxjtlas.supabase.co/functions/v1/ruang-kawan-calendar/authorize', {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionType, returnUrl: window.location.href }),
      });
      const body = await response.json();
      if (!response.ok || !body.url) throw new Error(body.error || 'Koneksi belum tersedia.');
      window.location.assign(body.url);
    } catch {
      setError('Layanan koneksi Calendar sedang disiapkan. Data My Activity tetap dapat digunakan.');
    }
  }

  if (state === 'loading') return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><p>Menyiapkan My Activity...</p></section></main>;
  if (state === 'denied') return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><h1>Akses My Activity belum tersedia</h1><p>Hubungi administrator untuk mengaktifkan izin aktivitas.</p><Link href="/ruang-kawan/dashboard/">Kembali ke dashboard</Link></section></main>;

  return (
    <main className="rk-activity-foundation">
      <section className="rk-activity-shell">
        <nav className="rk-activity-nav">
          <Link href="/ruang-kawan/dashboard/"><FiArrowLeft /> Dashboard</Link>
          <button type="button" onClick={() => void loadData()}><FiRefreshCw /> Muat ulang</button>
        </nav>

        <header className="rk-activity-heading">
          <div><small>Ruang Kawan · Pusat kerja personal</small><h1>My Activity</h1><p>Satu feed untuk aktivitas manual, Content Plan, Pipeline BD, Finance, HR, dan sumber kerja buatan admin.</p></div>
          <button type="button" onClick={() => startCreate()}><FiPlus /> Tambah aktivitas</button>
        </header>

        <section className="rk-calendar-connections">
          <article><span><FiCalendar /><i>Kalender Perusahaan</i></span><strong>Campus Innovate</strong><small>{calendarStatus.company ? `Terhubung melalui ${calendarStatus.company.email}` : 'Kalender utama innovatecampus@gmail.com'}</small>{calendarStatus.company ? <b data-connected>Terhubung</b> : <button type="button" onClick={() => void connectCalendar('company')}>Hubungkan bridge</button>}</article>
          <article><span><FiCalendar /><i>Kalender Pribadi</i></span><strong>Google Calendar saya</strong><small>{calendarStatus.personal ? `Terhubung sebagai ${calendarStatus.personal.email}` : 'Tampil bersama agenda kerja kamu'}</small>{calendarStatus.personal ? <b data-connected>Terhubung</b> : <button type="button" onClick={() => void connectCalendar('personal')}>Hubungkan kalender</button>}</article>
        </section>

        <div className="rk-source-filter" role="tablist" aria-label="Filter sumber kerja">
          <button type="button" data-active={sourceFilter === 'all'} onClick={() => setSourceFilter('all')}>Semua sumber <span>{activities.length}</span></button>
          {sources.map((source) => <button type="button" key={source.id} data-active={sourceFilter === source.id} onClick={() => setSourceFilter(source.id)}><i style={{ background: source.color }} />{source.name}<span>{activities.filter((activity) => activity.source_id === source.id).length}</span></button>)}
        </div>

        {error ? <p className="rk-activity-alert" data-error>{error}</p> : null}
        {message ? <p className="rk-activity-alert">{message}</p> : null}

        <section className="rk-activity-layout">
          <div className="rk-calendar-panel">
            <div className="rk-calendar-toolbar"><div><small>Kalender terpadu</small><h2>{monthLabels[monthCursor.getMonth()]} {monthCursor.getFullYear()}</h2></div><span><button type="button" aria-label="Bulan sebelumnya" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}><FiChevronLeft /></button><button type="button" onClick={() => { const current = new Date(`${today()}T12:00:00`); setMonthCursor(current); setSelectedDate(today()); }}>Hari ini</button><button type="button" aria-label="Bulan berikutnya" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}><FiChevronRight /></button></span></div>
            <div className="rk-calendar-grid rk-calendar-weekdays">{['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => <strong key={day}>{day}</strong>)}</div>
            <div className="rk-calendar-grid rk-calendar-days">{monthDays.map((date, index) => date ? <button type="button" key={date} data-selected={date === selectedDate} data-today={date === today()} onClick={() => setSelectedDate(date)}><span>{Number(date.slice(-2))}</span>{(countByDate[date] || googleEvents.some((event) => googleEventDate(event) === date)) ? <i>{(countByDate[date] ?? 0) + googleEvents.filter((event) => googleEventDate(event) === date).length}</i> : null}<div>{filteredActivities.filter((activity) => activity.activity_date === date).slice(0, 2).map((activity) => <b key={activity.id} style={{ background: activity.work_sources?.color ?? '#315c4f' }} />)}{googleEvents.filter((event) => googleEventDate(event) === date).slice(0, 2).map((event) => <b key={`${event.calendarType}-${event.id}`} data-google={event.calendarType} />)}</div></button> : <i key={`blank-${index}`} />)}</div>
          </div>

          <aside className="rk-day-panel">
            <div className="rk-day-heading"><div><small>Agenda harian</small><h2>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div><button type="button" onClick={() => startCreate(selectedDate)}><FiPlus /></button></div>
            <div className="rk-day-list">{selectedActivities.map((activity) => <button type="button" key={activity.id} onClick={() => startEdit(activity)}><i style={{ background: activity.work_sources?.color ?? '#315c4f' }} /><span><small>{activity.start_at ? timeFromIso(activity.start_at) : 'Seharian'} · {activity.work_sources?.name}</small><strong>{activity.title}</strong><em data-status={activity.status}>{statusLabels[activity.status]}</em></span></button>)}{selectedGoogleEvents.map((event) => <a key={`${event.calendarType}-${event.id}`} href={event.htmlLink} target="_blank" rel="noreferrer" data-calendar={event.calendarType}><i /><span><small>{googleEventTime(event)} · Google Calendar {event.calendarType === 'company' ? 'Perusahaan' : 'Pribadi'}</small><strong>{event.title}</strong><em>{event.calendarType === 'company' ? 'Company' : 'Personal'}</em></span><FiExternalLink /></a>)}{!selectedActivities.length && !selectedGoogleEvents.length ? <div className="rk-activity-empty"><FiCalendar /><strong>Belum ada aktivitas</strong><p>Tambahkan agenda kerja untuk tanggal ini.</p></div> : null}</div>
          </aside>
        </section>

        <section className="rk-feed-panel">
          <div className="rk-feed-heading"><div><small>Feed terpadu</small><h2>Aktivitas terbaru</h2></div><span>{filteredActivities.length} aktivitas</span></div>
          <div className="rk-feed-list">{filteredActivities.length ? filteredActivities.map((activity) => <article key={activity.id}><i style={{ background: activity.work_sources?.color ?? '#315c4f' }} /><div className="rk-feed-content"><div><small>{new Date(`${activity.activity_date}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} · {activity.work_sources?.name}</small><span data-priority={activity.priority}>{priorityLabels[activity.priority]}</span></div><h3>{activity.title}</h3>{activity.detail ? <p>{activity.detail}</p> : null}<footer><em data-status={activity.status}>{statusLabels[activity.status]}</em><b>{activity.progress}%</b>{activity.linked_kpi ? <span>KPI · {activity.linked_kpi}</span> : null}{activity.evidence_url ? <a href={activity.evidence_url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><FiExternalLink /> Bukti</a> : null}</footer></div><button type="button" aria-label={`Ubah ${activity.title}`} onClick={() => startEdit(activity)}><FiEdit3 /></button></article>) : <div className="rk-activity-empty"><FiClock /><strong>Feed masih kosong</strong><p>Aktivitas dari seluruh sumber kerja akan muncul di sini.</p></div>}</div>
        </section>
      </section>

      {formOpen ? <div className="rk-activity-modal" role="dialog" aria-modal="true" aria-label="Form aktivitas"><form onSubmit={saveActivity}><header><div><small>{form.id ? 'Ubah aktivitas' : 'Aktivitas baru'}</small><h2>{form.id ? form.title : 'Catat pekerjaan'}</h2></div><button type="button" aria-label="Tutup" onClick={() => setFormOpen(false)}><FiX /></button></header><div className="rk-activity-form-grid">
        <label>Sumber kerja<select value={form.sourceId} onChange={(event) => setForm({ ...form, sourceId: event.target.value, customData: {} })} required><option value="">Pilih sumber</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
        <label className="rk-form-wide">Judul aktivitas<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={180} required /></label>
        <label>Tanggal<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label>
        <label>Jenis aktivitas<input value={form.activityType} onChange={(event) => setForm({ ...form, activityType: event.target.value })} placeholder="Meeting, follow-up, produksi..." /></label>
        <label>Jam mulai<input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label>
        <label>Jam selesai<input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} disabled={!form.startTime} /></label>
        <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Activity['status'] })}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Prioritas<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Activity['priority'] })}>{Object.entries(priorityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Progress ({form.status === 'done' ? 100 : form.progress}%)<input type="range" min="0" max="100" step="5" value={form.status === 'done' ? 100 : form.progress} onChange={(event) => setForm({ ...form, progress: Number(event.target.value) })} disabled={form.status === 'done'} /></label>
        <label>KPI terkait<input value={form.linkedKpi} onChange={(event) => setForm({ ...form, linkedKpi: event.target.value })} placeholder="Opsional" /></label>
        {selectedSource?.field_schema?.map((field) => <label key={field.key} className={field.type === 'textarea' ? 'rk-form-wide' : ''}>{field.label}{field.type === 'textarea' ? <textarea value={form.customData[field.key] ?? ''} onChange={(event) => setForm({ ...form, customData: { ...form.customData, [field.key]: event.target.value } })} /> : <input type={field.type} value={form.customData[field.key] ?? ''} onChange={(event) => setForm({ ...form, customData: { ...form.customData, [field.key]: event.target.value } })} />}</label>)}
        <label className="rk-form-wide">Detail<textarea value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} /></label>
        <label className="rk-form-wide">Output<textarea value={form.output} onChange={(event) => setForm({ ...form, output: event.target.value })} /></label>
        <label className="rk-form-wide">Blocker / risiko<textarea value={form.blockerRisk} onChange={(event) => setForm({ ...form, blockerRisk: event.target.value })} /></label>
        <label className="rk-form-wide">Next action / prioritas berikutnya<textarea value={form.nextAction} onChange={(event) => setForm({ ...form, nextAction: event.target.value })} /></label>
        <label className="rk-form-wide">URL bukti<input type="url" value={form.evidenceUrl} onChange={(event) => setForm({ ...form, evidenceUrl: event.target.value })} placeholder="https://..." /></label>
      </div>{error ? <p className="rk-modal-error">{error}</p> : null}<footer>{form.id ? <button type="button" data-danger onClick={() => void removeActivity()} disabled={saving}>Hapus</button> : <span />}<div><button type="button" onClick={() => setFormOpen(false)}>Batal</button><button type="submit" data-primary disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan aktivitas'}</button></div></footer></form></div> : null}
    </main>
  );
}
