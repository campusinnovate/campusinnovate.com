import { redirect } from 'next/navigation';
import { FiLock, FiShield, FiUser } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/server';

type AccessSummary = {
  membership_status: string;
  full_name: string | null;
  position_name: string | null;
  department_name: string | null;
  engagement_type: string | null;
  roles: string[];
  permissions: string[];
};

export const metadata = { title: 'Ruang Kawan', robots: { index: false, follow: false } };

export default async function RuangKawanDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/ruang-kawan');

  const { data, error } = await supabase.rpc('get_my_access');
  const access = (Array.isArray(data) ? data[0] : data) as AccessSummary | null;

  if (error || !access || access.membership_status !== 'active') {
    return (
      <main className="rk-dashboard-foundation">
        <section className="rk-access-denied">
          <span className="ruang-kawan-mark"><FiLock /></span>
          <small>Akses belum tersedia</small>
          <h1>Email belum terdaftar</h1>
          <p>Akun berhasil dikenali, tetapi email ini belum memiliki keanggotaan aktif di Ruang Kawan.</p>
          <form action="/auth/signout" method="post"><button type="submit">Keluar</button></form>
        </section>
      </main>
    );
  }

  return (
    <main className="rk-dashboard-foundation">
      <section className="rk-dashboard-shell">
        <header>
          <div>
            <small>Ruang Kawan</small>
            <h1>Selamat datang, {access.full_name || user.email}</h1>
            <p>Fondasi akses sudah aktif. Workflow Management System akan dibangun di atas ruang yang aman ini.</p>
          </div>
          <form action="/auth/signout" method="post"><button type="submit">Keluar</button></form>
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
