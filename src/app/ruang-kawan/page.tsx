import Link from 'next/link';
import { FiArrowLeft, FiLock } from 'react-icons/fi';

export const metadata = {
  title: 'Ruang Kawan',
  description: 'Akses internal untuk Kawan Inovasi.',
  robots: { index: false, follow: false },
};

export default function RuangKawanPage() {
  return (
    <main className="ruang-kawan-foundation">
      <section className="ruang-kawan-card" aria-labelledby="ruang-kawan-title">
        <span className="ruang-kawan-mark"><FiLock /></span>
        <small>Area internal Campus Innovate</small>
        <h1 id="ruang-kawan-title">Ruang Kawan</h1>
        <p>Ruang Kawan sedang dipersiapkan. Akses internal belum dibuka sebelum autentikasi resmi diaktifkan, sehingga tidak ada data atau workspace internal yang ditampilkan di halaman ini.</p>
        <Link href="/home#kawan-inovasi"><FiArrowLeft /> Kembali ke Kawan Inovasi</Link>
      </section>
    </main>
  );
}
