'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function RuangKawanCallbackPage() {
  const [error, setError] = useState('');

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) {
      setError('Kode login Google tidak ditemukan. Silakan mulai kembali dari halaman login.');
      return;
    }

    const supabase = createClient();
    void (async () => {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Sesi Google tidak dapat diselesaikan. Silakan coba kembali.');
          return;
        }
      }
      window.location.replace('/ruang-kawan/dashboard/');
    })();
  }, []);

  return (
    <main className="rk-dashboard-foundation">
      <section className="rk-access-denied">
        {error ? <><h1>Login belum berhasil</h1><p>{error}</p><Link href="/ruang-kawan/">Kembali ke login</Link></> : <p>Menyelesaikan login Google...</p>}
      </section>
    </main>
  );
}
