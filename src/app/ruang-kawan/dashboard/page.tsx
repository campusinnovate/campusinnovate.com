'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { FiActivity, FiBarChart2, FiBookOpen, FiBriefcase, FiDollarSign, FiFileText, FiLock, FiSettings, FiShield, FiTrendingUp, FiUser } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';

type AccessSummary = {
  membership_status: string;
  full_name: string | null;
  position_name: string | null;
  department_name: string | null;
  engagement_type: string | null;
  roles: string[];
  permissions: string[];
};

type DashboardState =
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'ready'; access: AccessSummary; email: string; workspace: DashboardWorkspace | null };

type DashboardWorkspace = {
  mood: { score: number } | null;
  notifications: { id: string; title: string; message: string | null; route: string | null; read_at: string | null }[];
  work: { overdue: number; due_today: number; reviews: number; open_actions: number };
  kpi: { score: number | null; status: string | null; period: string } | null;
};

export default function RuangKawanDashboardPage() {
  const [state, setState] = useState<DashboardState>({ status: 'loading' });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [moodBusy, setMoodBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function loadAccess() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.replace('/ruang-kawan/');
        return;
      }

      const [{ data, error }, workspaceResult] = await Promise.all([
        supabase.rpc('get_my_access'), supabase.rpc('dashboard_workspace'),
      ]);
      const access = (Array.isArray(data) ? data[0] : data) as AccessSummary | null;
      if (error || !access || access.membership_status !== 'active') {
        setState({ status: 'denied' });
        return;
      }

      setState({ status: 'ready', access, email: session.user.email ?? '', workspace: workspaceResult.error ? null : workspaceResult.data as DashboardWorkspace });
    }

    void loadAccess();
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    window.location.replace('/ruang-kawan/');
  }

  async function saveMood(score: number) {
    setMoodBusy(true);
    const { error } = await createClient().rpc('save_mood_checkin', { score_value: score, note_value: null });
    setMoodBusy(false);
    if (!error && state.status === 'ready') setState({ ...state, workspace: state.workspace ? { ...state.workspace, mood: { score } } : state.workspace });
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    if (newPassword.length < 8) {
      setPasswordError('Password minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi password belum sama.');
      return;
    }

    setPasswordBusy(true);
    const { error } = await createClient().auth.updateUser({ password: newPassword });
    setPasswordBusy(false);

    if (error) {
      setPasswordError('Password belum berhasil disimpan. Silakan coba kembali.');
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage('Password berhasil disimpan. Sekarang kamu juga bisa masuk menggunakan email dan password.');
  }

  if (state.status === 'loading') {
    return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><p>Memeriksa akses...</p></section></main>;
  }

  if (state.status === 'denied') {
    return (
      <main className="rk-dashboard-foundation">
        <section className="rk-access-denied">
          <span className="ruang-kawan-mark"><FiLock /></span>
          <small>Akses belum tersedia</small>
          <h1>Email belum terdaftar</h1>
          <p>Akun berhasil dikenali, tetapi email ini belum memiliki keanggotaan aktif di Ruang Kawan.</p>
          <button type="button" onClick={signOut}>Keluar</button>
        </section>
      </main>
    );
  }

  const { access, email, workspace } = state;
  const attention = (workspace?.work.overdue ?? 0) + (workspace?.work.reviews ?? 0) + (workspace?.work.open_actions ?? 0);
  const performanceLabel = attention === 0 ? 'Good' : attention <= 3 ? 'Needs Attention' : 'Not Good';
  return (
    <main className="rk-dashboard-foundation">
      <section className="rk-dashboard-shell">
        <header>
          <div>
            <small>Ruang Kawan</small>
            <h1>Selamat datang, {access.full_name || email}</h1>
            <p>Semua pekerjaan, keputusan, dokumen, dan laporan tim dalam satu ruang kerja.</p>
          </div>
          <button type="button" onClick={signOut}>Keluar</button>
        </header>

        <div className="rk-foundation-grid">
          <article><FiUser /><span>Posisi</span><strong>{access.position_name || 'Belum ditetapkan'}</strong></article>
          <article><FiShield /><span>Status kerja</span><strong>{access.engagement_type || 'Belum ditetapkan'}</strong></article>
          <article><FiLock /><span>Akses</span><strong>{access.roles.length ? access.roles.join(', ') : 'Akses dasar'}</strong></article>
        </div>

        <section className="rk-dashboard-summary">
          <article className="rk-mood-card">
            <small>Mood Check-in · pribadi</small><h2>{workspace?.mood ? `Mood hari ini: ${workspace.mood.score}/10` : 'Apa kabar hari ini?'}</h2>
            <div>{[1,2,3,4,5,6,7,8,9,10].map(score => <button key={score} type="button" disabled={moodBusy} data-selected={workspace?.mood?.score===score} onClick={()=>void saveMood(score)}>{score}</button>)}</div>
            <p>Opsional, tidak memengaruhi KPI, dan tren perusahaan hanya anonim.</p>
          </article>
          <article className="rk-performance-card"><small>Status kinerja</small><h2 data-status={performanceLabel}>{performanceLabel}</h2><div><span><b>{workspace?.work.due_today ?? 0}</b> hari ini</span><span><b>{workspace?.work.overdue ?? 0}</b> terlambat</span><span><b>{workspace?.work.reviews ?? 0}</b> review</span><span><b>{workspace?.work.open_actions ?? 0}</b> action item</span></div><p>{workspace?.kpi ? `${workspace.kpi.period} · KPI ${workspace.kpi.score?.toFixed(1) ?? '—'}%` : 'Ringkasan KPI akan muncul setelah assignment aktif.'}</p></article>
          <article className="rk-notification-card"><small>Notifikasi</small><h2>{workspace?.notifications.filter(item=>!item.read_at).length ?? 0} belum dibaca</h2>{workspace?.notifications.slice(0,3).map(item => item.route ? <Link key={item.id} href={item.route}><strong>{item.title}</strong><span>{item.message}</span></Link> : <div key={item.id}><strong>{item.title}</strong><span>{item.message}</span></div>)}{!workspace?.notifications.length?<p>Belum ada notifikasi baru.</p>:null}</article>
        </section>

        <div className="rk-dashboard-module-grid">
          {access.permissions.includes('activity.view_self') ? <Link className="rk-admin-entry rk-activity-entry" href="/ruang-kawan/activity/"><FiActivity /><span><strong>My Activity</strong><small>Feed kerja, coret-coret, assignment, dan kalender pribadi.</small></span></Link> : null}
          {['marketing.view', 'content_plan.view', 'pipeline.view'].some((key) => access.permissions.includes(key)) ? <Link className="rk-admin-entry" href="/ruang-kawan/marketing/"><FiTrendingUp /><span><strong>Marketing</strong><small>Content, brand, pipeline, layanan, proposal, dan vendor sesuai izin.</small></span></Link> : null}
          {access.permissions.includes('projects.view') ? <Link className="rk-admin-entry" href="/ruang-kawan/projects/"><FiBriefcase /><span><strong>Project Management</strong><small>Handover, Project Lead, planning, execution, deliverable, dan closing.</small></span></Link> : null}
          {access.permissions.includes('kpi.view_self') ? <Link className="rk-admin-entry" href="/ruang-kawan/kpi/"><FiBarChart2 /><span><strong>KPI Management</strong><small>Target, realisasi, evidence, review, dan penilaian bulanan.</small></span></Link> : null}
          {access.permissions.includes('documents.view') ? <Link className="rk-admin-entry" href="/ruang-kawan/documents/"><FiBookOpen /><span><strong>Document Center</strong><small>Dokumen terkendali, template, versi, request, dan tautan Google Drive.</small></span></Link> : null}
          {access.permissions.includes('reports.view_self') ? <Link className="rk-admin-entry" href="/ruang-kawan/reports/"><FiFileText /><span><strong>Report &amp; Analysis</strong><small>Report personal 3P + Priority dari KPI dan aktivitas.</small></span></Link> : null}
          {access.permissions.includes('finance.view') ? <Link className="rk-admin-entry" href="/ruang-kawan/finance/"><FiDollarSign /><span><strong>Finance</strong><small>Transaksi, dokumen, piutang, budget, dan aset.</small></span></Link> : null}
        </div>

        {access.permissions.includes('access.manage') ? (
          <Link className="rk-admin-entry" href="/ruang-kawan/admin/">
            <FiSettings />
            <span><strong>Kelola Anggota & Hak Akses</strong><small>Daftarkan email, tetapkan peran, dan atur izin khusus.</small></span>
          </Link>
        ) : null}

        <section className="rk-password-setup">
          <div>
            <small>Keamanan akun</small>
            <h2>Buat atau ubah password</h2>
            <p>Setelah disimpan, akun ini tetap bisa masuk dengan Google maupun dengan email dan password.</p>
          </div>
          <form onSubmit={savePassword}>
            <label htmlFor="rk-new-password">Password baru</label>
            <input
              id="rk-new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            <label htmlFor="rk-confirm-password">Ulangi password</label>
            <input
              id="rk-confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            {passwordError ? <p className="rk-password-error" role="alert">{passwordError}</p> : null}
            {passwordMessage ? <p className="rk-password-success">{passwordMessage}</p> : null}
            <button type="submit" disabled={passwordBusy}>{passwordBusy ? 'Menyimpan...' : 'Simpan password'}</button>
          </form>
        </section>
      </section>
    </main>
  );
}
