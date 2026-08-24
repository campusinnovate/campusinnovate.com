'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { FiActivity, FiCheckSquare, FiDollarSign, FiEdit3, FiLayers, FiLock, FiSettings, FiShield, FiTrendingUp, FiUser } from 'react-icons/fi';
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
  | { status: 'ready'; access: AccessSummary; email: string };

export default function RuangKawanDashboardPage() {
  const [state, setState] = useState<DashboardState>({ status: 'loading' });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    const supabase = createClient();

    async function loadAccess() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.replace('/ruang-kawan/');
        return;
      }

      const { data, error } = await supabase.rpc('get_my_access');
      const access = (Array.isArray(data) ? data[0] : data) as AccessSummary | null;
      if (error || !access || access.membership_status !== 'active') {
        setState({ status: 'denied' });
        return;
      }

      setState({ status: 'ready', access, email: session.user.email ?? '' });
    }

    void loadAccess();
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    window.location.replace('/ruang-kawan/');
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

  const { access, email } = state;
  return (
    <main className="rk-dashboard-foundation">
      <section className="rk-dashboard-shell">
        <header>
          <div>
            <small>Ruang Kawan</small>
            <h1>Selamat datang, {access.full_name || email}</h1>
            <p>Fondasi akses sudah aktif. Workflow Management System akan dibangun di atas ruang yang aman ini.</p>
          </div>
          <button type="button" onClick={signOut}>Keluar</button>
        </header>

        <div className="rk-foundation-grid">
          <article><FiUser /><span>Posisi</span><strong>{access.position_name || 'Belum ditetapkan'}</strong></article>
          <article><FiShield /><span>Status kerja</span><strong>{access.engagement_type || 'Belum ditetapkan'}</strong></article>
          <article><FiLock /><span>Akses</span><strong>{access.roles.length ? access.roles.join(', ') : 'Akses dasar'}</strong></article>
        </div>

        {access.permissions.includes('activity.view_self') ? (
          <Link className="rk-admin-entry rk-activity-entry" href="/ruang-kawan/activity/">
            <FiActivity />
            <span><strong>Buka My Activity</strong><small>Kelola feed kerja, agenda harian, dan kalender terpadu.</small></span>
          </Link>
        ) : null}

        <div className="rk-dashboard-module-grid">
          {access.permissions.includes('notes.manage_self') ? <Link className="rk-admin-entry" href="/ruang-kawan/notes/"><FiEdit3 /><span><strong>Coret-coret</strong><small>Brainstorm dan catatan penting yang hanya dapat kamu lihat.</small></span></Link> : null}
          {access.permissions.includes('activity.view_self') ? <Link className="rk-admin-entry" href="/ruang-kawan/assignments/"><FiCheckSquare /><span><strong>Assignment</strong><small>Pekerjaan tim, diskusi, pengajuan hasil, dan review.</small></span></Link> : null}
          {access.permissions.includes('content_plan.view') ? <Link className="rk-admin-entry" href="/ruang-kawan/content-plan/"><FiLayers /><span><strong>Content Plan</strong><small>Ide, brief, produksi, review, dan jadwal publikasi.</small></span></Link> : null}
          {access.permissions.includes('pipeline.view') ? <Link className="rk-admin-entry" href="/ruang-kawan/pipeline/"><FiTrendingUp /><span><strong>Pipeline BD</strong><small>Lead, follow-up, meeting, proposal, dan closing.</small></span></Link> : null}
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
