import Link from 'next/link';

export const metadata = {
  title: 'Terima Kasih | Campus Innovate',
  description: 'Permintaan konsultasi Anda telah diterima oleh Campus Innovate.',
  robots: { index: false, follow: false },
};

export default function ThankYouEventPage() {
  return (
    <main className="min-h-screen bg-[#031831] px-5 py-16 text-white md:px-10">
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-white/15 bg-white/[0.07] p-7 text-center shadow-2xl backdrop-blur md:p-12">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#f6b51f]">Campus Innovate</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">Terima kasih.</h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-white/75 md:text-lg">
            Permintaan konsultasi Anda sudah kami terima. Tim Campus Innovate akan menghubungi Anda untuk membahas kebutuhan kegiatan dan langkah selanjutnya.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#f6b51f] px-6 font-bold text-[#031831]"
              href="https://wa.me/6285882514394?text=Halo%20Campus%20Innovate%2C%20saya%20sudah%20mengirimkan%20form%20konsultasi%20event."
              target="_blank"
              rel="noopener noreferrer"
            >
              Hubungi via WhatsApp
            </a>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 px-6 font-semibold text-white" href="/">
              Kembali ke Website
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
