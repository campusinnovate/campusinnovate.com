import Link from 'next/link';

export const metadata = {
  title: 'Kebijakan Privasi | Campus Innovate',
  description: 'Kebijakan privasi untuk Ruang Kawan Campus Innovate.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050b22] px-5 py-20 text-white md:px-20">
      <article className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl md:p-10">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#ffc722]">Campus Innovate</p>
        <h1 className="text-3xl font-bold md:text-5xl">Kebijakan Privasi Ruang Kawan</h1>
        <p className="mt-4 text-sm leading-7 text-white/65">Terakhir diperbarui: 24 Agustus 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-white/80 md:text-base">
          <section>
            <h2 className="mb-2 text-xl font-semibold text-white">Data yang kami gunakan</h2>
            <p>Ruang Kawan menggunakan nama, alamat email, foto profil, serta informasi peran dan keanggotaan yang diperlukan untuk autentikasi, pemberian akses, dan pengoperasian workspace internal Campus Innovate.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-semibold text-white">Cara data digunakan</h2>
            <p>Data digunakan untuk memverifikasi identitas, membatasi akses hanya kepada anggota yang telah didaftarkan, menampilkan profil kerja, dan mencatat aktivitas penting demi keamanan serta akuntabilitas sistem.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-semibold text-white">Penyimpanan dan pembagian data</h2>
            <p>Data autentikasi dikelola melalui Google OAuth dan Supabase. Campus Innovate tidak menjual data pengguna. Data hanya dibagikan kepada penyedia layanan yang diperlukan untuk menjalankan dan mengamankan Ruang Kawan.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-semibold text-white">Kontrol dan penghapusan</h2>
            <p>Anggota dapat meminta koreksi, penonaktifan, atau penghapusan data akun dengan menghubungi pengelola Campus Innovate. Penyimpanan tertentu dapat tetap dilakukan apabila dibutuhkan untuk keamanan, audit, atau kewajiban hukum.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-semibold text-white">Kontak</h2>
            <p>Untuk pertanyaan privasi terkait Ruang Kawan, hubungi <a className="font-semibold text-[#ffc722] underline" href="mailto:kawanberinovasi@gmail.com">kawanberinovasi@gmail.com</a>.</p>
          </section>
        </div>

        <Link className="mt-10 inline-flex text-sm font-semibold text-[#ffc722] underline" href="/ruang-kawan">Kembali ke Ruang Kawan</Link>
      </article>
    </main>
  );
}
