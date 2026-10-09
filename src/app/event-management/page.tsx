import type { Metadata } from 'next';
import Image from 'next/image';
import { FiArrowRight, FiCheck, FiMapPin, FiMessageCircle, FiPlus } from 'react-icons/fi';
import { BrandLogo } from '@/components/public/BrandLogo';
import { workfolioProjects } from '@/data/homepage';
import styles from './event-management.module.css';

const title = 'Event Management untuk Kampus & Instansi';
const description = 'Kelola seminar, gathering, outbound, dan capacity building dari konsep hingga hari-H bersama Campus Innovate. Diskusikan kebutuhan event melalui WhatsApp.';
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/event-management/' },
  openGraph: { type: 'website', url: '/event-management/', siteName: 'Campus Innovate', title, description, locale: 'id_ID', images: [{ url: '/images/workfolio/wunproq/gallery-07.webp', width: 1800, height: 1202, alt: 'Konferensi WUNPROQ 2026' }] },
  twitter: { card: 'summary_large_image', title, description, images: ['/images/workfolio/wunproq/gallery-07.webp'] },
};

const whatsappMessage = 'Halo Campus Innovate, saya ingin konsultasi kebutuhan event. Jenis kegiatan: ____. Perkiraan peserta: ____. Waktu/tanggal: ____.';
const whatsappHref = `https://wa.me/6285882514394?text=${encodeURIComponent(whatsappMessage)}`;

function WhatsAppCTA({ placement, compact = false }: { placement: string; compact?: boolean }) {
  return <a className={`${styles.cta} ${compact ? styles.compact : ''}`} href={whatsappHref} target="_blank" rel="noopener noreferrer" data-cta-placement={placement} data-service="event-management"><FiMessageCircle aria-hidden="true" /><span>{compact ? 'Diskusikan Event' : 'Diskusikan Event via WhatsApp'}</span><FiArrowRight aria-hidden="true" /></a>;
}

const selectedProjects = [
  { slug: 'wunproq', format: 'Konferensi', role: 'Event management, pengalaman peserta, branding acara, dan materi komunikasi pendukung.', photo: '/images/workfolio/wunproq/gallery-07.webp', alt: 'Panggung dan peserta konferensi WUNPROQ 2026' },
  { slug: 'klhk-capacity-building', format: 'Capacity building & outbound', role: 'Rancangan aktivitas, engagement peserta, koordinasi operasional lapangan, dan pelaksanaan kegiatan.', photo: '/images/workfolio/klhk/cover.webp', alt: 'Peserta kegiatan capacity building KLHK bersama tim Campus Innovate' },
  { slug: 'see-ipb', format: 'Expo kampus', role: 'Event management, persiapan operasional, dan koordinasi pelaksanaan di lokasi.', photo: '/images/workfolio/see-ipb/gallery-01.webp', alt: 'Aktivitas peserta di area Student Entrepreneur Expo IPB' },
].map((item) => ({ ...item, project: workfolioProjects.find((project) => project.slug === item.slug)! }));

const scope = [
  ['Konsep & alur acara', 'Tujuan kegiatan, tema, format, rundown, dan alur pengalaman peserta.'],
  ['Venue & vendor', 'Koordinasi lokasi dan vendor sesuai kebutuhan serta ruang lingkup kegiatan.'],
  ['Registrasi & logistik', 'Alur registrasi, kebutuhan peserta, dan kesiapan logistik acara.'],
  ['Operasional hari-H', 'Koordinasi tim, jalannya rundown, dan kebutuhan pelaksanaan di lapangan.'],
  ['Produksi & teknis', 'Koordinasi kebutuhan produksi, perlengkapan teknis, dan materi acara.'],
  ['Dokumentasi', 'Kebutuhan foto, video, dan materi dokumentasi sesuai kesepakatan.'],
];
const steps = [
  ['Pahami kebutuhan', 'Bahas tujuan, peserta, jadwal, lokasi, dan area bantuan yang dibutuhkan.'],
  ['Rancang acara', 'Susun konsep, rencana kerja, ruang lingkup, dan penawaran.'],
  ['Siapkan bersama', 'Koordinasikan vendor, logistik, teknis, dan kesiapan tim.'],
  ['Jalankan acara', 'Dampingi pelaksanaan dan koordinasi operasional hari-H.'],
  ['Evaluasi & dokumentasi', 'Tutup kegiatan dengan evaluasi dan dokumentasi sesuai kesepakatan.'],
];
const faqs = [
  ['Acara apa yang bisa ditangani?', 'Seminar, konferensi, gathering, expo, awarding, capacity building, dan outbound untuk kampus, sekolah, instansi, serta organisasi/perusahaan yang mengadakan kegiatan institusional. Format dan kebutuhan teknis dibahas saat konsultasi.'],
  ['Bisa membantu sebagian kebutuhan acara saja?', 'Bisa. Ruang lingkup dapat disesuaikan, dari dukungan pada kebutuhan tertentu hingga pengelolaan acara dari perencanaan sampai pelaksanaan. Detail pekerjaan dituangkan dalam penawaran dan kesepakatan proyek.'],
  ['Apa yang perlu disiapkan sebelum chat?', 'Cukup ceritakan jenis kegiatan, perkiraan jumlah peserta, dan waktu pelaksanaan. Jika sudah ada, tambahkan lokasi serta gambaran anggaran. Informasi yang belum pasti dapat dibahas bersama.'],
  ['Bagaimana biaya event ditentukan?', 'Penawaran disusun berdasarkan jenis acara, jumlah peserta, lokasi, durasi, kebutuhan produksi, dan ruang lingkup bantuan. Ceritakan kebutuhan Anda agar tim dapat menyusun penawaran yang relevan.'],
  ['Campus Innovate berbasis di mana?', 'Kami berbasis di Kota Bogor. Untuk kegiatan di lokasi lain, sampaikan kota atau venue yang direncanakan agar tim dapat membahas kesiapan operasional dan kebutuhan perjalanan.'],
];

export default function EventManagementPage() {
  return <div className={styles.page} lang="id">
    <a href="#konten-event" className={styles.skip}>Lewati ke konten</a>
    <header className={styles.header}>
      <nav className={styles.nav} aria-label="Navigasi Event Management">
        <a href="/home/#home" aria-label="Campus Innovate — halaman utama"><BrandLogo priority /></a>
        <div className={styles.navLinks}><a href="#layanan">Layanan</a><a href="#portofolio">Portofolio</a><a href="#faq">FAQ</a></div>
        <WhatsAppCTA placement="header" compact />
      </nav>
    </header>
    <main id="konten-event">
      <section className={styles.hero} aria-labelledby="event-title">
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span /> EVENT MANAGEMENT · CAMPUS INNOVATE</p>
            <h1 id="event-title">Kelola event kampus dan instansi <em>dari konsep hingga hari-H.</em></h1>
            <p className={styles.lead}>Dari konsep, vendor, hingga produksi. Seminar, gathering, outbound, dan capacity building sesuai kebutuhan institusi Anda.</p>
            <div className={styles.heroActions}><WhatsAppCTA placement="hero" /><a href="#portofolio" className={styles.textLink}>Lihat pengalaman kami <FiArrowRight aria-hidden="true" /></a></div>
            <p className={styles.hint}>Ceritakan jenis kegiatan, jumlah peserta, dan jadwal.<br />Detail yang belum pasti bisa dibahas bersama.</p>
            <p className={styles.location}><FiMapPin aria-hidden="true" /> Berbasis di Bogor · Untuk kampus, sekolah & instansi</p>
          </div>
          <figure className={styles.heroPhoto}>
            <Image src="/images/workfolio/wunproq/gallery-07.webp" alt="Suasana konferensi WUNPROQ 2026 dengan panggung dan peserta acara" fill priority sizes="(max-width: 800px) 100vw, 48vw" />
            <div className={styles.photoLabel}><span>DOKUMENTASI PROYEK</span><strong>WUNPROQ 2026</strong><p>Event management · Pengalaman peserta · Branding</p></div>
            <a href="#portofolio" className={styles.photoBadge} aria-label="Lihat portofolio event"><FiArrowRight aria-hidden="true" /></a>
          </figure>
        </div>
      </section>
      <section className={styles.trust} aria-label="Proyek event terpilih">
        <div className={`${styles.container} ${styles.trustInner}`}><p>Pengalaman nyata.<br /><strong>Kegiatan institusi yang beragam.</strong></p><div className={styles.marks}>{selectedProjects.map(({ project }) => <div key={project.slug}><Image src={project.logo!} width={100} height={60} alt={`Logo ${project.client}`} /><span>{project.client === 'Kementerian Lingkungan Hidup dan Kehutanan' ? 'KLHK' : project.client}</span></div>)}</div></div>
      </section>
      <section className={`${styles.section} ${styles.problem}`} aria-labelledby="problem-title">
        <div className={`${styles.container} ${styles.problemGrid}`}>
          <div><p className={styles.eyebrow}>TANTANGAN DI BALIK SETIAP ACARA</p><h2 id="problem-title">Banyak detail.<br /><em>Satu acara yang harus berjalan selaras.</em></h2></div>
          <div><p>Konsep, peserta, venue, vendor, rundown, dan tim perlu bergerak dengan informasi yang sama.</p><ul className={styles.painList}><li>Rundown berubah, kebutuhan teknis ikut menyesuaikan.</li><li>Vendor dan tim membutuhkan arahan yang konsisten.</li><li>Alur peserta perlu dipikirkan sebelum hari pelaksanaan.</li></ul><p className={styles.problemNote}>Saat koordinasi terpisah, detail mudah terlewat dan keputusan mendadak bertambah. Hal ini dapat memengaruhi pelaksanaan serta pengalaman peserta.</p></div>
        </div>
      </section>
      <section id="layanan" className={styles.section} aria-labelledby="scope-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}><div><p className={styles.eyebrow}>RUANG LINGKUP BANTUAN</p><h2 id="scope-title">Dari rencana<br />ke <em>pelaksanaan.</em></h2></div><p>Campus Innovate membantu mengelola event dari perencanaan hingga pelaksanaan. Pilih dukungan yang dibutuhkan; ruang lingkup disesuaikan dengan kegiatan Anda.</p></div>
          <div className={styles.scopeGrid}>{scope.map(([name, copy], index) => <article key={name}><span className={styles.number}>0{index + 1}</span><div><h3>{name}</h3><p>{copy}</p></div></article>)}</div>
          <div className={styles.scopeFoot}><FiCheck aria-hidden="true" /><p>Dukungan kebutuhan tertentu atau pengelolaan menyeluruh — disepakati sejak awal dalam penawaran proyek.</p></div>
        </div>
      </section>
      <section id="portofolio" className={`${styles.section} ${styles.portfolio}`} aria-labelledby="portfolio-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}><div><p className={styles.eyebrow}>BUKTI KERJA</p><h2 id="portfolio-title">Lihat kegiatan<br />yang <em>kami bantu kelola.</em></h2></div><p>Konferensi, capacity building, hingga expo kampus. Berikut dokumentasi dan peran Campus Innovate pada proyek terpilih.</p></div>
          <div className={styles.projectGrid}>{selectedProjects.map(({ project, format, role, photo, alt }) => <article key={project.slug} className={styles.project}>
            <div className={styles.projectPhoto}><Image src={photo} alt={alt} fill sizes="(max-width: 700px) 100vw, (max-width: 1000px) 45vw, 32vw" /><span>{format}</span></div>
            <div className={styles.projectBody}><div className={styles.projectMeta}><span>{project.client === 'Kementerian Lingkungan Hidup dan Kehutanan' ? 'KLHK' : project.client}</span><span>{project.year}</span></div><h3>{project.title}</h3><p><strong>Peran Campus Innovate</strong>{role}</p></div>
          </article>)}</div>
          <div className={styles.proofCTA}><div><strong>Ada kegiatan serupa yang sedang Anda siapkan?</strong><p>Diskusikan kebutuhan dan area bantuan yang paling relevan.</p></div><WhatsAppCTA placement="portfolio" /></div>
        </div>
      </section>
      <section className={styles.section} aria-labelledby="process-title">
        <div className={styles.container}><p className={styles.eyebrow}>CARA KITA BEKERJA</p><h2 id="process-title">Mulai dari percakapan.<br /><em>Lanjut dengan rencana yang jelas.</em></h2><ol className={styles.steps}>{steps.map(([name, copy], index) => <li key={name}><span>0{index + 1}</span><h3>{name}</h3><p>{copy}</p></li>)}</ol><div className={styles.budget}><div><p className={styles.eyebrow}>PENAWARAN SESUAI KEBUTUHAN</p><h3>Setiap acara punya kebutuhan berbeda.</h3></div><p>Jenis acara, peserta, lokasi, durasi, dan cakupan bantuan menjadi dasar penawaran. Jika sudah ada gambaran anggaran, ceritakan saat konsultasi agar kebutuhan dan prioritas bisa dibahas bersama.</p></div></div>
      </section>
      <section id="faq" className={`${styles.section} ${styles.faq}`} aria-labelledby="faq-title"><div className={`${styles.container} ${styles.faqGrid}`}><div><p className={styles.eyebrow}>SEBELUM MULAI</p><h2 id="faq-title">Yang sering<br /><em>ditanyakan.</em></h2><p>Belum punya brief lengkap?<br />Mulai dari gambaran kegiatan Anda.</p></div><div className={styles.faqList}>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<FiPlus aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></div></section>
      <section className={styles.closing} aria-labelledby="closing-title"><div className={styles.container}><p className={styles.eyebrow}>MARI SIAPKAN ACARA ANDA</p><h2 id="closing-title">Ceritakan rencananya.<br /><em>Kita bahas kebutuhan event Anda.</em></h2><p>Jenis kegiatan, perkiraan peserta, dan waktu pelaksanaan.<br />Tiga informasi sederhana untuk memulai percakapan.</p><WhatsAppCTA placement="closing" /><small>Anda bisa mengedit pesan awal sebelum mengirimnya.</small></div></section>
    </main>
    <footer className={styles.footer}><div className={`${styles.container} ${styles.footerGrid}`}><div><a href="/home/#home" aria-label="Campus Innovate — halaman utama"><BrandLogo /></a><p>Building Systems. Developing Leaders.</p></div><div><strong>Campus Innovate</strong><p>Jl. Duta Pelita B2 No.5, Tanah Sareal<br />Kota Bogor, Jawa Barat 16164</p></div><div><strong>Hubungi kami</strong><a href={whatsappHref} target="_blank" rel="noopener noreferrer" data-cta-placement="footer" data-service="event-management">+62 858-8251-4394</a><a href="mailto:innovatecampus@gmail.com">innovatecampus@gmail.com</a><a href="/privacy/">Kebijakan privasi</a></div></div><div className={`${styles.container} ${styles.copyright}`}>© {new Date().getFullYear()} Campus Innovate</div></footer>
    <div className={styles.mobileCTA}><WhatsAppCTA placement="sticky-mobile" /></div>
  </div>;
}
