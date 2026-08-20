'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FiArrowRight, FiCheck, FiCompass, FiLayers, FiTrendingUp, FiUsers } from 'react-icons/fi';

const services = [
  { icon: FiUsers, eyebrow: 'People', title: 'Leadership & Mentoring', description: 'Program pengembangan pemimpin muda yang praktis, reflektif, dan relevan dengan tantangan organisasi.' },
  { icon: FiLayers, eyebrow: 'Organization', title: 'Organization Development', description: 'Pendampingan untuk membangun tim, sistem kerja, dan budaya organisasi yang lebih sehat dan terukur.' },
  { icon: FiCompass, eyebrow: 'Experience', title: 'Event & Capacity Building', description: 'Pengalaman belajar, outbound, dan kegiatan kolaboratif yang dirancang sesuai tujuan setiap organisasi.' },
];

const impact = [
  { value: '360°', label: 'pendekatan pengembangan individu dan organisasi' },
  { value: '5+', label: 'format program yang dapat disesuaikan' },
  { value: '1:1', label: 'pendampingan dari kebutuhan hingga evaluasi' },
];

export default function HomePage() {
  return (
    <main className="public-home">
      <section className="hero-shell">
        <div className="hero-grid" aria-hidden="true" />
        <div className="page-container hero-layout">
          <div className="hero-copy">
            <span className="eyebrow-pill"><span /> Learning partner for growing teams</span>
            <h1>Tumbuh sebagai pemimpin. <em>Bergerak</em> sebagai tim.</h1>
            <p>Campus Innovate membantu individu dan organisasi berkembang melalui pengalaman belajar yang terarah, relevan, dan benar-benar bisa diterapkan.</p>
            <div className="hero-actions">
              <a className="button-primary" href="https://wa.me/6285882514394" target="_blank" rel="noreferrer">Diskusikan kebutuhan <FiArrowRight /></a>
              <Link className="button-quiet" href="/services">Jelajahi program</Link>
            </div>
            <div className="hero-proof">
              <div className="avatar-stack"><span>CI</span><span>IPB</span><span>KLHK</span></div>
              <p>Dipercaya untuk menghadirkan pengalaman belajar yang bermakna.</p>
            </div>
          </div>

          <div className="hero-visual">
            <div className="image-frame"><Image src="/assets/images/fullteam.JPG" alt="Tim Campus Innovate" fill priority sizes="(max-width: 900px) 90vw, 46vw" /></div>
            <div className="floating-note note-top"><span className="note-icon"><FiTrendingUp /></span><div><strong>Belajar terarah</strong><small>Dari insight menjadi aksi</small></div></div>
            <div className="floating-note note-bottom"><span className="note-check"><FiCheck /></span><div><strong>Program kontekstual</strong><small>Disesuaikan dengan kebutuhan tim</small></div></div>
          </div>
        </div>
      </section>

      <section className="page-container impact-strip" aria-label="Dampak program">
        {impact.map((item) => <div key={item.value} className="impact-item"><strong>{item.value}</strong><span>{item.label}</span></div>)}
      </section>

      <section className="page-container section-block">
        <div className="section-heading">
          <div><span className="section-kicker">Cara kami membantu</span><h2>Program yang bergerak bersama kebutuhanmu.</h2></div>
          <p>Kami tidak memulai dari paket. Kami memulai dari tantangan, tujuan, dan konteks orang-orang di dalamnya.</p>
        </div>
        <div className="service-grid">
          {services.map((service, index) => {
            const Icon = service.icon;
            return <article className="service-card" key={service.title}>
              <div className="service-card-top"><span className="service-icon"><Icon /></span><small>0{index + 1}</small></div>
              <span className="service-eyebrow">{service.eyebrow}</span><h3>{service.title}</h3><p>{service.description}</p>
              <Link href="/services">Lihat program <FiArrowRight /></Link>
            </article>;
          })}
        </div>
      </section>

      <section className="page-container story-section">
        <div className="story-image"><Image src="/assets/images/campus-innovate-team.png" alt="Kolaborasi tim Campus Innovate" fill sizes="(max-width: 900px) 90vw, 45vw" /></div>
        <div className="story-copy">
          <span className="section-kicker">Mengapa Campus Innovate</span><h2>Bukan sekadar sesi. Kami merancang perjalanan belajar.</h2>
          <p>Setiap program dibangun agar peserta memahami, mencoba, merefleksikan, lalu membawa pembelajaran ke cara mereka bekerja sehari-hari.</p>
          <ul><li><FiCheck /> Berangkat dari kebutuhan nyata peserta dan organisasi</li><li><FiCheck /> Difasilitasi dengan metode aktif dan kolaboratif</li><li><FiCheck /> Memiliki hasil dan tindak lanjut yang jelas</li></ul>
          <Link className="text-link" href="/about">Kenali kami lebih dekat <FiArrowRight /></Link>
        </div>
      </section>

      <section className="page-container cta-panel">
        <div><span>Mulai dari percakapan sederhana</span><h2>Apa tantangan yang sedang timmu hadapi?</h2></div>
        <a className="button-light" href="https://wa.me/6285882514394" target="_blank" rel="noreferrer">Ceritakan kepada kami <FiArrowRight /></a>
      </section>
    </main>
  );
}
