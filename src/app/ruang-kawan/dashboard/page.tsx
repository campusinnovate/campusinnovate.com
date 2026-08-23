'use client';

import { useEffect, useState } from 'react';
import { FiLock, FiShield, FiUser } from 'react-icons/fi';
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
      </section>
    </main>
  );
}
