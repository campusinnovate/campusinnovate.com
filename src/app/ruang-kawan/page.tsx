import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FiArrowLeft, FiLock } from 'react-icons/fi';
import LoginPanel from './LoginPanel';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Masuk ke Ruang Kawan',
  description: 'Akses internal untuk tim Campus Innovate.',
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams?: Promise<{ error?: string; message?: string }>;
};

export default async function RuangKawanPage({ searchParams }: PageProps) {
  const query = await searchParams;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect('/ruang-kawan/dashboard');
  }

  return (
    <main className="ruang-kawan-foundation">
      <section className="ruang-kawan-auth-card" aria-labelledby="ruang-kawan-title">
        <div className="rk-intro">
          <span className="ruang-kawan-mark"><FiLock /></span>
          <small>Area internal Campus Innovate</small>
          <h1 id="ruang-kawan-title">Ruang Kawan</h1>
          <p>Satu ruang kerja untuk tim bertumbuh, berkolaborasi, dan menjalankan sistem Campus Innovate.</p>
          <div className="rk-security-note">
            <FiLock />
            <span>Hanya email yang sudah didaftarkan oleh administrator yang dapat masuk.</span>
          </div>
          <Link className="rk-back-link" href="/home#kawan-inovasi"><FiArrowLeft /> Kembali ke Kawan Inovasi</Link>
        </div>

        {isSupabaseConfigured() ? (
          <LoginPanel initialError={query?.error} initialMessage={query?.message} />
        ) : (
          <div className="rk-login-panel"><p className="rk-login-error">Konfigurasi login belum tersedia pada environment website.</p></div>
        )}
      </section>
    </main>
  );
}
