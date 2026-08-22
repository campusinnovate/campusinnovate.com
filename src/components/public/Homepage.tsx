'use client';

import Image from 'next/image';
import Script from 'next/script';
import { type FormEvent, type MouseEvent, useCallback, useEffect, useState } from 'react';
import { BrandLogo } from '@/components/public/BrandLogo';
import {
  FiArrowRight,
  FiBriefcase,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiCode,
  FiCompass,
  FiExternalLink,
  FiInstagram,
  FiLayers,
  FiLock,
  FiMail,
  FiMapPin,
  FiMessageCircle,
  FiStar,
  FiUsers,
  FiZap,
  FiX,
} from 'react-icons/fi';
import {
  approach,
  clientMarks,
  clientStories,
  communities,
  type Community,
  corevaLaunch,
  employeeStories,
  kawanLife,
  kawanPrinciples,
  serviceDetails,
  solutions,
  type WorkfolioProject,
  workfolioProjects,
  vacancies,
} from '@/data/homepage';

const pages = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'services', label: 'Our Service' },
  { id: 'workfolio', label: 'Workfolio' },
  { id: 'kawan-inovasi', label: 'Kawan Inovasi' },
  { id: 'community', label: 'Community' },
  { id: 'contact', label: 'Contact' },
] as const;

// Keep this strip deliberately curated. Workfolio logos often come from older
// client decks and can include baked-in white rectangles or low-resolution
// thumbnails; the normalized marks below are prepared specifically for this UI.
const trustedMarks = clientMarks;

const solutionIcons = [FiCompass, FiUsers, FiCode, FiLayers, FiZap];
const serviceDetailIds = solutions.map((solution) => solution.id);

const serviceNeeds = [
  { title: 'Run an Event', category: solutions[0].title, id: solutions[0].id, description: 'Plan and deliver professional events from concept to on-site execution.', examples: ['Seminars & conferences', 'Expo & awarding', 'Outbound & capacity building'] },
  { title: 'Build an Educational Program', category: solutions[1].title, id: solutions[1].id, description: 'Develop structured educational programs with clear objectives, journeys, and outcomes.', examples: ['Leadership development', 'Student programs', 'Institutional programs'] },
  { title: 'Create a Website or Digital System', category: solutions[2].title, id: solutions[2].id, description: 'Build digital platforms that make programs and organizational workflows easier to manage.', examples: ['Websites & landing pages', 'Registration & portals', 'Dashboards & custom systems'] },
  { title: 'Organize a Training Program', category: solutions[3].title, id: solutions[3].id, description: 'Deliver practical learning experiences that strengthen people, teams, and institutions.', examples: ['Leadership & communication', 'Team development', 'Customized training'] },
  { title: 'Produce Creative and Media Assets', category: solutions[4].title, id: solutions[4].id, description: 'Create the identity, communication materials, and media needed to strengthen an initiative.', examples: ['Branding & design', 'Content & campaigns', 'Documentation & video'] },
] as const;

const whatWeDo = [
  { title: 'Our work focuses on helping institutions', copy: 'Turning educational ideas into solutions that can be implemented, measured, and improved.', icon: FiCompass },
  { title: 'Develop impactful student programs', copy: 'Designing relevant programs that connect student potential with meaningful learning outcomes.', icon: FiUsers },
  { title: 'Build structured organizational systems', copy: 'Creating clearer workflows, practical tools, and systems that strengthen execution.', icon: FiLayers },
  { title: 'Deliver engaging educational events', copy: 'Producing educational experiences that are purposeful, engaging, and professionally managed.', icon: FiStar },
  { title: 'Strengthen leadership and personal development', copy: 'Helping young leaders build practical capabilities, confidence, and a continuous growth mindset.', icon: FiZap },
] as const;

type ServiceDetailProps = {
  detail: (typeof serviceDetails)[number];
  icon: (typeof solutionIcons)[number];
};

function ServiceDetail({ detail, icon: Icon }: ServiceDetailProps) {
  return (
    <section className={`service-detail service-detail-${detail.variant}`} id={detail.id} aria-labelledby={`${detail.id}-title`}>
      <div className="service-detail-shell">
        <div className="service-detail-copy">
          <p className="service-kicker">{detail.number} / {detail.title}</p>
          <h2 id={`${detail.id}-title`}>{detail.headline}</h2>
          <p className="service-positioning">{detail.description}</p>
          <div className="service-capability-grid">
            {detail.capabilities.map((group) => (
              <article key={group.title}>
                <h3>{group.title}</h3>
                <ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>

        <div className="service-detail-visual">
          <div className="service-hero-image glossy-card">
            <Image src={detail.image} alt={detail.imageAlt} fill sizes="(max-width: 760px) 92vw, 42vw" />
            <div className="service-image-shade" />
            <span className="service-detail-icon"><Icon /></span>
            <div className="service-approach">
              <small>Typical collaboration flow</small>
              {detail.approach.map((step, index) => <span key={step}><b>0{index + 1}</b>{step}</span>)}
            </div>
          </div>

          <div className="service-proof-block">
            <div className="service-proof-heading"><span>Selected work</span><small>Verified Campus Innovate portfolio</small></div>
            <div className="service-proof-grid">
              {detail.projects.map((project) => (
                <article key={`${detail.id}-${project.client}`}>
                  <div className="service-proof-image"><Image src={project.image} alt={`${project.title} — ${project.client}`} fill sizes="(max-width: 760px) 86vw, 20vw" /></div>
                  <div className="service-proof-logo"><Image src={project.logo} alt={`${project.client} logo`} width={96} height={44} /></div>
                  <div><small>{project.service}</small><h3>{project.title}</h3><p>{project.client}</p></div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkfolioCard({ project, index, onOpen }: { project: WorkfolioProject; index: number; onOpen: () => void }) {
  const preserveFrame = project.services.some((service) => service === 'Digital System' || service === 'Creative & Media');
  return (
    <article className="workfolio-card" data-project-slug={project.slug}>
      <div className={`workfolio-card-media ${preserveFrame ? 'has-contain-media' : ''}`}>
        <Image src={project.image} alt={project.imageAlt} fill priority={index < 4} sizes="(max-width: 760px) 92vw, (max-width: 1100px) 46vw, 23vw" />
        <div className="workfolio-media-overlay" />
        <div className={`workfolio-logo-plate is-${project.logoSurface ?? 'light'}`}>
          {project.logo
            ? <Image src={project.logo} alt={`${project.client} project logo`} width={124} height={56} />
            : <span>{project.logoText}</span>}
        </div>
        <span className="workfolio-card-number">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="workfolio-card-body">
        <div className="workfolio-card-meta"><span>{project.year}</span></div>
        <h3>{project.title}</h3>
        <p className="workfolio-client">{project.client}</p>
        <div className="workfolio-tags">{project.services.map((service) => <span key={service}>{service}</span>)}</div>
        <p className="workfolio-description">{project.description}</p>
        <button className="workfolio-view" type="button" onClick={onOpen} aria-label={`View ${project.title}`}>View project <FiArrowRight /></button>
      </div>
    </article>
  );
}

type WorkfolioModalProps = {
  projects: readonly WorkfolioProject[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
};

function WorkfolioModal({ projects, index, onChange, onClose }: WorkfolioModalProps) {
  const project = projects[index];
  const preserveFrame = project.services.some((service) => service === 'Digital System' || service === 'Creative & Media');
  const gallery = project.gallery?.length ? project.gallery : [project.image];
  const [photoIndex, setPhotoIndex] = useState(0);
  const previousProject = () => onChange((index - 1 + projects.length) % projects.length);
  const nextProject = () => onChange((index + 1) % projects.length);
  const previousPhoto = () => setPhotoIndex((current) => (current - 1 + gallery.length) % gallery.length);
  const nextPhoto = () => setPhotoIndex((current) => (current + 1) % gallery.length);

  useEffect(() => setPhotoIndex(0), [index]);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') previousPhoto();
      if (event.key === 'ArrowRight') nextPhoto();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div className="workfolio-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="workfolio-modal-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="workfolio-modal-device">
        <div className="workfolio-modal-bar">
          <span>Project {String(index + 1).padStart(2, '0')} · Photo {photoIndex + 1}/{gallery.length}</span>
          <div className="workfolio-modal-notch" aria-hidden="true" />
          <button type="button" onClick={onClose} aria-label="Close project"><FiX /></button>
        </div>
        <div className="workfolio-modal-content" key={`${project.slug}-${photoIndex}`}>
          <div className={`workfolio-modal-media ${preserveFrame ? 'has-contain-media' : ''}`}>
            <Image src={gallery[photoIndex]} alt={`${project.imageAlt} — image ${photoIndex + 1}`} fill priority sizes="(max-width: 760px) 94vw, 62vw" />
            <div className="workfolio-modal-shade" />
            {gallery.length > 1 && <button className="workfolio-modal-arrow is-previous" type="button" onClick={previousPhoto} aria-label="Previous image"><FiChevronLeft /></button>}
            {gallery.length > 1 && <button className="workfolio-modal-arrow is-next" type="button" onClick={nextPhoto} aria-label="Next image"><FiChevronRight /></button>}
          </div>
          <div className="workfolio-modal-details">
            <div className={`workfolio-modal-logo is-${project.logoSurface ?? 'light'}`}>{project.logo ? <Image src={project.logo} alt={`${project.client} logo`} width={92} height={40} /> : <span>{project.logoText}</span>}</div>
            <p className="workfolio-modal-meta">{project.year} · {project.client}</p>
            <h2 id="workfolio-modal-title">{project.title}</h2>
            <div className="workfolio-modal-tags">{project.services.map((service) => <span key={service}>{service}</span>)}</div>
            <p>{project.description}</p>
            <div className="workfolio-modal-project-nav">
              <button type="button" onClick={previousProject}><FiChevronLeft /> Previous project</button>
              <button type="button" onClick={nextProject}>Next project <FiChevronRight /></button>
            </div>
          </div>
        </div>
        <div className="workfolio-modal-thumbnails" aria-label="Choose project image">
          {gallery.map((image, imageIndex) => <button className={imageIndex === photoIndex ? 'is-active' : ''} type="button" key={image} onClick={() => setPhotoIndex(imageIndex)} aria-label={`Open image ${imageIndex + 1}`}><Image src={image} alt="" fill sizes="96px" /></button>)}
        </div>
      </div>
    </div>
  );
}

function KawanEmptyStory({ type }: { type: 'employee' | 'client' }) {
  const isEmployee = type === 'employee';
  return (
    <article className="kawan-story-empty">
      <span className="kawan-quote-mark">“</span>
      <p>{isEmployee ? 'Employee testimonial placeholder' : 'Client testimonial placeholder'}</p>
      <small>{isEmployee
        ? 'Cerita asli Kawan Inovasi akan ditampilkan setelah materi resmi tersedia.'
        : 'Cerita dari mitra akan ditampilkan setelah kutipan dan identitas disetujui.'}</small>
      <span className="kawan-content-status"><FiCheckCircle /> Menunggu konten terverifikasi</span>
    </article>
  );
}

function CommunityDetail({ community }: { community: Community }) {
  const themeIcons = [FiCompass, FiUsers, FiLayers];
  const isStripmate = community.id === 'stripmate';
  return (
    <section className={`community-detail community-detail-${community.id}`} id={community.id} aria-labelledby={`${community.id}-title`}>
      <div className="community-page-shell">
        <div className="community-detail-grid">
          <div className="community-detail-copy">
            <p className="community-kicker">{community.number} / {community.category}</p>
            <div className={`community-detail-logo community-detail-logo-${community.id}`}><Image src={community.logo} alt={`${community.name} logo`} width={240} height={100} /></div>
            <h2 id={`${community.id}-title`}>{community.headline}</h2>
            <p className="community-detail-lead">{community.detailDescription}</p>
            <div className="community-theme-grid">
              {community.themes.map((theme, index) => {
                const Icon = themeIcons[index];
                return <article key={theme.title}><Icon /><span>0{index + 1}</span><h3>{theme.title}</h3><p>{theme.copy}</p></article>;
              })}
            </div>
            {!isStripmate && community.showJoinCTA && (community.joinUrl
              ? <a className="community-join-button" href={community.joinUrl} target="_blank" rel="noopener noreferrer">Gabung {community.name} <FiExternalLink /></a>
              : <div className="community-access-status" aria-disabled="true"><FiLock /> Akses Komunitas — Segera Hadir</div>)}
            {!isStripmate && community.websiteUrl && <a className="community-join-button" href={community.websiteUrl} target="_blank" rel="noopener noreferrer">Visit {community.name} <FiExternalLink /></a>}
          </div>
          <div className="community-detail-photos">
            <div className="community-detail-photo-main"><Image src={community.cover} alt={`Dokumentasi ${community.category} Campus Innovate`} fill sizes="(max-width: 760px) 92vw, 46vw" /></div>
            <div className="community-detail-photo-support"><Image src={community.supportImage} alt={`Aktivitas pembelajaran dan kolaborasi ${community.name}`} fill sizes="(max-width: 760px) 45vw, 20vw" /></div>
            <div className="community-detail-personality">{community.themes.map((theme) => <span key={theme.title}>{theme.title}</span>)}</div>
          </div>
        </div>
        {isStripmate && community.websiteUrl && community.joinUrl && <div className="stripmate-detail-actions"><div><span>Lanjutkan perjalanan bersama Stripmate</span><h3>Explore the experience. Join the community.</h3></div><div><a className="stripmate-website-button" href={community.websiteUrl} target="_blank" rel="noopener noreferrer">Explore Stripmate.id <FiExternalLink /></a><a className="stripmate-join-button" href={community.joinUrl} target="_blank" rel="noopener noreferrer">Gabung Stripmate <FiExternalLink /></a></div></div>}
      </div>
    </section>
  );
}

function CorevaLaunchSection() {
  return (
    <section className="home-follow-section coreva-launch-section" aria-labelledby="coreva-launch-title">
      <div className="home-section-shell coreva-launch-panel">
        <div className="coreva-launch-copy">
          <div className="coreva-status-badge"><span /> Now live</div>
          <h2 id="coreva-launch-title">Introducing <em>COREVA.</em></h2>
          <h3>A new digital product<br />by Campus Innovate.</h3>
          <p>COREVA adalah produk digital yang dikembangkan oleh Campus Innovate sebagai bagian dari kapabilitas Digital System Development.</p>
          <a className="coreva-launch-cta" href={corevaLaunch.url} target="_blank" rel="noopener noreferrer">Explore COREVA <FiExternalLink /></a>
          <div className="coreva-product-meta"><span>{corevaLaunch.category}</span>{corevaLaunch.tags.map((tag) => <small key={tag}>{tag}</small>)}</div>
        </div>
        <div className="coreva-browser" aria-label="Interactive preview of the COREVA digital platform by Campus Innovate">
          <div className="coreva-browser-bar"><span className="coreva-browser-controls"><i /><i /><i /></span><strong><FiLock /> {corevaLaunch.domain}</strong><a href={corevaLaunch.url} target="_blank" rel="noopener noreferrer" aria-label="Open COREVA in a new tab"><FiExternalLink /></a></div>
          <div className="coreva-browser-screen"><iframe src={corevaLaunch.url} title="Live preview of the COREVA digital platform by Campus Innovate" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" /><div className="coreva-browser-shine" /></div>
          <div className="coreva-browser-caption"><span>Live interactive preview</span><a href={corevaLaunch.url} target="_blank" rel="noopener noreferrer">Open full site <FiExternalLink /></a></div>
        </div>
      </div>
    </section>
  );
}

function ExtendedBottomPanel() {
  return (
    <footer className="extended-bottom-panel">
      <div className="extended-bottom-brand"><BrandLogo className="extended-bottom-logo" /><p>Building systems. Developing leaders.<br />Your educational transformation partner.</p></div>
      <nav className="extended-bottom-column" aria-label="Extended footer navigation"><strong>Explore</strong><a href="#services">Our Service</a><a href="#workfolio">Workfolio</a><a href="#contact">Contact</a></nav>
      <div className="extended-bottom-column"><strong>Connect</strong><a href="mailto:innovatecampus@gmail.com">innovatecampus@gmail.com</a><a href="https://wa.me/6285882514394" target="_blank" rel="noopener noreferrer">+62 858-8251-4394</a><a href="https://www.instagram.com/campusinnovate" target="_blank" rel="noopener noreferrer">@campusinnovate</a></div>
      <div className="extended-bottom-column extended-bottom-office"><strong>Campus Innovate</strong><p>Jl. Duta Pelita B2 No.5,<br />Tanah Sareal, Kota Bogor,<br />Jawa Barat 16164</p></div>
      <div className="extended-bottom-legal"><span>© {new Date().getFullYear()} Campus Innovate</span><span>Building Systems. Developing Leaders.</span></div>
    </footer>
  );
}

type ContactStatus = 'idle' | 'loading' | 'success' | 'error';

function ContactForm() {
  const [status, setStatus] = useState<ContactStatus>('idle');
  const [feedback, setFeedback] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submitInquiry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'loading') return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get('name') || '').trim();
    const organization = String(formData.get('organization') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const message = String(formData.get('message') || '').trim();
    const website = String(formData.get('website') || '').trim();
    const nextErrors: Record<string, string> = {};
    if (!name) nextErrors.name = 'Please enter your name.';
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = 'Please enter a valid email address.';
    if (!message) nextErrors.message = 'Please tell us a little about your inquiry.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus('loading');
    setFeedback('');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, organization, email, message, website }),
      });
      const result = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(result.message || 'Something went wrong. Please try again or contact us through WhatsApp.');
      setStatus('success');
      setFeedback('Your message has been received. Our team will get back to you soon.');
      form.reset();
    } catch (error) {
      setStatus('error');
      setFeedback(error instanceof Error ? error.message : 'Something went wrong. Please try again or contact us through WhatsApp.');
    }
  };

  return (
    <form className="quick-inquiry-form" id="quick-inquiry" onSubmit={submitInquiry} noValidate>
      <div className="quick-form-heading"><span>Quick inquiry</span><h3>Start the conversation.</h3><p>Share a little about what you would like to build together.</p></div>
      <div className="quick-form-grid">
        <label><span>Name <b>*</b></span><input name="name" type="text" placeholder="Your name" autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'contact-name-error' : undefined} />{errors.name && <small id="contact-name-error">{errors.name}</small>}</label>
        <label><span>Organization</span><input name="organization" type="text" placeholder="Company / Institution / Community" autoComplete="organization" /></label>
        <label className="quick-form-wide"><span>Email <b>*</b></span><input name="email" type="email" placeholder="your@email.com" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'contact-email-error' : undefined} />{errors.email && <small id="contact-email-error">{errors.email}</small>}</label>
        <label className="quick-form-wide"><span>Message <b>*</b></span><textarea name="message" rows={6} placeholder="Tell us a little about your idea, project, or collaboration." aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'contact-message-error' : undefined} />{errors.message && <small id="contact-message-error">{errors.message}</small>}</label>
        <label className="contact-honeypot" aria-hidden="true">Website<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <button className="quick-form-submit" type="submit" disabled={status === 'loading'}>{status === 'loading' ? 'Sending...' : 'Start the Conversation'} <FiArrowRight /></button>
      <div className={`quick-form-feedback is-${status}`} aria-live="polite">{status === 'success' && <strong>Thank you.</strong>}{feedback && <span>{feedback}</span>}{status === 'error' && <span className="quick-form-fallback"><a href="https://wa.me/6285882514394" target="_blank" rel="noopener noreferrer">WhatsApp</a><a href="mailto:innovatecampus@gmail.com">Email</a></span>}</div>
    </form>
  );
}

export default function Homepage() {
  const [active, setActive] = useState(0);
  const [selectedWorkIndex, setSelectedWorkIndex] = useState<number | null>(null);

  const goTo = useCallback((next: number, updateUrl = true) => {
    const safeNext = Math.max(0, Math.min(pages.length - 1, next));
    setActive(safeNext);
    if (updateUrl) {
      const hash = `${window.location.pathname}#${pages[safeNext].id}`;
      window.history.replaceState(null, '', hash);
    }
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    window.requestAnimationFrame(() => document.getElementById(pages[safeNext].id)?.scrollTo({ top: 0 }));
  }, []);

  useEffect(() => {
    const syncFromHash = () => {
      const id = window.location.hash.replace('#', '') || 'home';
      if (serviceDetailIds.includes(id as (typeof serviceDetailIds)[number])) {
        const servicesIndex = pages.findIndex((page) => page.id === 'services');
        setActive(servicesIndex);
        window.requestAnimationFrame(() => {
          const slide = document.getElementById('services');
          const target = document.getElementById(id);
          if (slide && target) slide.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
        });
        return;
      }
      const index = pages.findIndex((page) => page.id === id);
      goTo(index < 0 ? 0 : index, false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    syncFromHash();
    const syncFromNavigation = (event: Event) => {
      const id = (event as CustomEvent<{ id: string }>).detail.id;
      const index = pages.findIndex((page) => page.id === id);
      if (index >= 0) goTo(index, false);
    };
    window.addEventListener('hashchange', syncFromHash);
    window.addEventListener('campus:navigate', syncFromNavigation);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('hashchange', syncFromHash);
      window.removeEventListener('campus:navigate', syncFromNavigation);
    };
  }, [goTo]);

  const scrollToServiceDetail = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    window.history.replaceState(null, '', `${window.location.pathname}#${id}`);
    const slide = document.getElementById('services');
    const target = document.getElementById(id);
    if (slide && target) slide.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
  };

  const scrollToKawanSection = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const slide = document.getElementById('kawan-inovasi');
    const target = document.getElementById(id);
    if (slide && target) slide.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
  };

  const scrollToCommunitySection = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const slide = document.getElementById('community');
    const target = document.getElementById(id);
    if (slide && target) slide.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
  };

  const scrollToContactForm = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const slide = document.getElementById('contact');
    const target = document.getElementById('quick-inquiry');
    if (slide && target) slide.scrollTo({ top: target.offsetTop - 30, behavior: 'smooth' });
  };

  return (
    <main className="horizontal-home" data-active-page={pages[active].id}>
      <Script src="https://elfsightcdn.com/platform.js" strategy="afterInteractive" />

      <div className="horizontal-track" style={{ width: `${pages.length * 100}vw`, transform: `translate3d(-${active * 100}vw, 0, 0)` }}>
        <section className="page-slide hero-slide" id="home" aria-labelledby="hero-title">
          <div className="glow glow-blue" aria-hidden="true" /><div className="glow glow-gold" aria-hidden="true" />
          <div className="slide-shell hero-shell">
            <div className="hero-copy-new">
              <p className="eyebrow hero-eyebrow">Educational Transformation Partner</p>
              <h1 id="hero-title"><span>Building <em>Systems.</em></span><span>Developing <strong>Leaders.</strong></span></h1>
              <p>Campus Innovate is an educational solutions partner that helps schools, universities, and educational organizations create impactful programs, efficient systems, and meaningful learning experiences.</p>
              <div className="hero-actions-new">
                <button className="gloss-button gold-button" onClick={() => goTo(2)}>Explore Our Service <FiArrowRight /></button>
                <button className="gloss-button clear-button" onClick={() => goTo(3)}>View Workfolio <FiArrowRight /></button>
              </div>
            </div>

            <div className="hero-stage">
              <div className="stage-orbit orbit-one" /><div className="stage-orbit orbit-two" />
              <div className="hero-frame">
                <Image src="/assets/site-2026/hero-team.jpg" alt="Campus Innovate team at a program event" fill priority sizes="(max-width: 900px) 88vw, 49vw" />
                <div className="frame-shine" />
              </div>
            </div>

            <div className="trust-glass glass-panel">
              <p>Trusted by<br /><strong>institutions & organizations</strong></p>
              <div className="trust-logo-viewport" aria-label="Institutions and organizations that have worked with Campus Innovate">
                <div className="trust-logo-track">
                  {[0, 1].map((setIndex) => (
                    <div className="trust-logo-set" key={setIndex} aria-hidden={setIndex === 1}>
                      {trustedMarks.map((client) => <div key={`${setIndex}-${client.logo}`}><Image src={client.logo} alt={setIndex === 0 ? client.name : ''} width={108} height={48} /></div>)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          <div className="home-follow-section home-transformation">
            <div className="home-section-shell">
              <div className="home-section-heading">
                <p className="eyebrow"><span /> Transformation in action</p>
                <h2>More than activities.<br /><em>We build lasting progress.</em></h2>
                <p>Campus Innovate connects programs, organizational systems, learning experiences, and continuous capability development into one transformation journey.</p>
              </div>
              <div className="home-approach-grid">
                {approach.map((item, index) => {
                  const Icon = [FiCompass, FiLayers, FiUsers, FiZap][index];
                  return <article key={item.number} className={`home-approach-card approach-${index + 1}`}><span className="home-approach-icon"><Icon /></span><small>{item.number}</small><h3>{item.title}</h3><p>{item.copy}</p></article>;
                })}
              </div>
              <button className="home-text-link" onClick={() => goTo(2)}>See how our services connect <FiArrowRight /></button>
            </div>
          </div>

          <CorevaLaunchSection />

          <div className="home-follow-section home-instagram-section">
            <div className="home-section-shell">
              <div className="home-instagram-heading">
                <div className="home-section-heading"><p className="eyebrow"><span /> Live from Instagram</p><h2>See what we are<br /><em>building right now.</em></h2></div>
                <a href="https://www.instagram.com/campusinnovate" target="_blank" rel="noreferrer"><FiInstagram /> Follow @campusinnovate <FiArrowRight /></a>
              </div>
              <div className="elfsight-home-frame glossy-card">
                <div className="elfsight-app-87190d09-35a6-4334-84ee-f753502e1e94" data-elfsight-app-lazy />
              </div>
              <p className="feed-status">Posting asli dari @campusinnovate · diperbarui melalui Elfsight.</p>
            </div>
          </div>

          <div className="home-follow-section home-location-section">
            <div className="home-section-shell home-location-grid">
              <div className="home-location-copy">
                <p className="eyebrow"><span /> Visit & connect</p>
                <h2>Let&apos;s meet in<br /><em>Bogor.</em></h2>
                <p>Visit our office, start a conversation, or follow our latest work through your preferred channel.</p>
                <div className="home-channel-grid">
                  <a href="mailto:innovatecampus@gmail.com"><FiMail /><span><small>Email us</small>innovatecampus@gmail.com</span></a>
                  <a href="https://wa.me/6285882514394" target="_blank" rel="noreferrer"><FiMessageCircle /><span><small>WhatsApp</small>+62 858-8251-4394</span></a>
                  <a href="https://www.instagram.com/campusinnovate" target="_blank" rel="noreferrer"><FiInstagram /><span><small>Instagram</small>@campusinnovate</span></a>
                  <a href="https://www.google.com/maps/search/?api=1&query=Campus+Innovate+Jl.+Duta+Pelita+B2+No.5+Bogor" target="_blank" rel="noreferrer"><FiStar /><span><small>Google Maps</small>View & review location</span></a>
                </div>
              </div>
              <div className="home-map-card glossy-card"><iframe title="Campus Innovate location" src="https://www.google.com/maps?q=Jl.%20Duta%20Pelita%20B2%20No.5%2C%20Tanah%20Sareal%2C%20Bogor&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /><div><FiMapPin /><span><strong>Campus Innovate</strong><small>Jl. Duta Pelita B2 No.5, Tanah Sareal, Kota Bogor, Jawa Barat 16164</small></span></div></div>
            </div>
          </div>
        </section>

        <section className="page-slide light-slide about-slide" id="about" aria-labelledby="about-title">
          <div className="light-aurora" aria-hidden="true" />
          <div className="slide-shell about-shell about-intro-shell">
            <div className="page-heading dark-heading">
              <p className="eyebrow"><span /> Who we are</p>
              <h2 id="about-title">We turn ideas into<br /><em>impactful solutions.</em></h2>
              <p>Campus Innovate combines education, programs, systems, events, digital solutions, and creative production to create real impact for institutions and future leaders.</p>
              <div className="about-intro-points">
                <article><FiCompass /><span><strong>Purpose-led</strong><small>Every solution starts from a real institutional need.</small></span></article>
                <article><FiLayers /><span><strong>Connected capabilities</strong><small>Programs, systems, events, and creative work move together.</small></span></article>
                <article><FiCheckCircle /><span><strong>Built for impact</strong><small>Designed to be implemented, measured, and strengthened.</small></span></article>
              </div>
            </div>
            <div className="about-photo glossy-card">
              <Image src="/assets/site-2026/cda-ipb-activity.jpg" alt="Campus Innovate learning activity" fill sizes="44vw" />
              <div className="photo-label"><span>10,000+</span> community members in Bogor and beyond</div>
            </div>
            <div className="about-scroll-cue"></div>
          </div>

          <div className="about-follow-section about-vision-section">
            <div className="about-section-shell">
              <div className="about-section-heading"><p className="eyebrow"><span /> Our Vision</p><h2><span>One direction.</span><span className="vision-title-accent">Long-term impact.</span></h2></div>
              <div className="vision-principle-row"><span><b>01</b> Partnership-led</span><span><b>02</b> System-oriented</span><span><b>03</b> Built to last</span></div>
              <div className="vision-layout">
                <div className="vision-photo-card glossy-card"><Image src="/assets/site-2026/cda-ipb-aerial.jpg" alt="Campus Innovate educational program with students" fill sizes="(max-width: 760px) 92vw, 40vw" /><div><span>Educational ecosystems</span><strong>Built through partnership.</strong></div></div>
                <article className="vision-statement-card glossy-card">
                  <span className="about-large-icon"><FiCompass /></span><small>Our shared direction</small>
                  <p>To become a strategic partner in building innovative and impactful education ecosystems that empower the next generation of leaders.</p>
                  <div className="vision-focus-list"><span>Innovative ecosystems</span><span>Strategic partnership</span><span>Future leaders</span></div>
                </article>
              </div>
            </div>
          </div>

          <div className="about-follow-section about-mission-section">
            <div className="about-section-shell about-mission-shell">
              <div className="about-section-heading dark-heading"><p className="eyebrow"><span /> Our Mission</p><h2>Clear commitments.<br /><em>Meaningful progress.</em></h2><p>Four commitments guide how Campus Innovate turns educational ideas into systems, programs, and experiences that work.</p><div className="mission-operating-pillars"><span><FiCompass />Purpose</span><span><FiLayers />Systems</span><span><FiUsers />People</span></div><div className="mission-note"><FiZap /><span><small>From strategy to delivery</small><strong>Programs, systems, experiences, and people move forward together.</strong></span></div></div>
              <div className="mission-large-grid">
                <article><span>01</span><strong>Develop innovative and relevant educational programs</strong></article>
                <article><span>02</span><strong>Build modern and effective organizational systems</strong></article>
                <article><span>03</span><strong>Support institutions in developing student potential</strong></article>
                <article><span>04</span><strong>Create meaningful learning experiences for young leaders</strong></article>
              </div>
            </div>
          </div>

          <div className="about-follow-section about-what-section">
            <div className="about-section-shell">
              <div className="about-section-heading about-what-heading"><p className="eyebrow"><span /> What we do</p><h2>What we build<br /><em>with institutions.</em></h2></div>
              <div className="what-we-do-grid">
                {whatWeDo.map((item, index) => { const Icon = item.icon; return <article key={item.title} className={`what-we-do-card what-card-${index + 1}`}><span className="what-card-icon"><Icon /></span><small>0{index + 1}</small><div><h3>{item.title}</h3><p>{item.copy}</p></div></article>; })}
              </div>
              <footer className="about-footer">
                <div className="about-footer-brand"><BrandLogo className="about-footer-logo" /><p>Building systems. Developing leaders.<br />Your educational transformation partner.</p></div>
                <div className="about-footer-links"><strong>Explore</strong><button onClick={() => goTo(2)}>Our Service</button><button onClick={() => goTo(3)}>Workfolio</button><button onClick={() => goTo(6)}>Contact</button></div>
                <div className="about-footer-contact"><strong>Connect</strong><a href="mailto:innovatecampus@gmail.com">innovatecampus@gmail.com</a><a href="https://wa.me/6285882514394" target="_blank" rel="noreferrer">+62 858-8251-4394</a><a href="https://www.instagram.com/campusinnovate" target="_blank" rel="noreferrer">@campusinnovate</a></div>
                <div className="about-footer-address"><strong>Campus Innovate</strong><p>Jl. Duta Pelita B2 No.5,<br />Tanah Sareal, Kota Bogor,<br />Jawa Barat 16164</p></div>
              </footer>
            </div>
          </div>
        </section>

        <section className="page-slide solutions-slide" id="services" aria-labelledby="solutions-title">
          <div className="service-overview">
            <div className="glow service-overview-glow" aria-hidden="true" />
            <div className="service-overview-shell">
              <header className="service-needs-hero">
                <div className="service-needs-heading">
                  <p className="eyebrow"><span /> Our service</p>
                  <h2 id="solutions-title">What do you need<br /><em>help bringing to life?</em></h2>
                </div>
                <div className="service-needs-intro">
                  <p>Campus Innovate helps institutions design programs, deliver events, develop digital systems, run capability-building initiatives, and produce the creative assets needed to make them work.</p>
                  <div className="service-needs-actions"><a href="#choose-service">Explore What We Can Do <FiArrowRight /></a><a href="https://wa.me/6285882514394?text=Halo%20Campus%20Innovate%2C%20saya%20ingin%20mendiskusikan%20project" target="_blank" rel="noopener noreferrer">Discuss Your Project <FiMessageCircle /></a></div>
                  <div className="service-choice-cue"><span>Choose what you need.</span><small>Explore one solution or combine several capabilities.</small></div>
                </div>
              </header>

              <div className="service-needs-grid" id="choose-service">
                {serviceNeeds.map((need, index) => {
                  const Icon = solutionIcons[index];
                  return <article className={`service-need-card service-need-${index + 1}`} key={need.id}>
                    <div className="service-need-top"><span className="service-need-icon"><Icon /></span><small>0{index + 1}</small></div>
                    <div className="service-need-copy"><span>{need.category}</span><h3>{need.title}</h3><p>{need.description}</p></div>
                    <div className="service-need-examples">{need.examples.map((example) => <span key={example}>{example}</span>)}</div>
                    <a href={`#${need.id}`} onClick={(event) => scrollToServiceDetail(event, need.id)}>Explore this solution <FiArrowRight /></a>
                  </article>;
                })}
              </div>
            </div>
          </div>

          <section className="service-connected" aria-labelledby="connected-services-title">
            <div className="service-connected-shell">
              <div className="service-connected-copy">
                <p className="service-kicker">Need an integrated partner?</p>
                <h2 id="connected-services-title">Or let us handle<br /><em>everything.</em></h2>
                <p>For initiatives involving multiple moving parts, Campus Innovate connects strategy, program design, digital systems, event operations, training, and creative production under one coordinated partnership.</p>
                <div className="service-connected-statement"><strong>One partner. One connected workflow.</strong><span>A stronger institutional outcome.</span></div>
                <a className="service-connected-cta" href="https://wa.me/6285882514394?text=Halo%20Campus%20Innovate%2C%20saya%20ingin%20mendiskusikan%20integrated%20project" target="_blank" rel="noopener noreferrer">Discuss an Integrated Project <FiArrowRight /></a>
              </div>
              <div className="service-connection-flow">
                {[
                  ['01', 'Understand', 'Objectives, audience, challenges, and expected outcomes.'],
                  ['02', 'Design', 'Concept, program journey, operational plan, and required system.'],
                  ['03', 'Build', 'Platforms, materials, communication assets, and resources.'],
                  ['04', 'Deliver', 'Execution, participants, stakeholders, vendors, and operations.'],
                  ['05', 'Evaluate & Improve', 'Results, documentation, insights, and continued development.'],
                ].map(([number, title, copy]) => <article key={number}><span>{number}</span><div><strong>{title}</strong><small>{copy}</small></div><FiArrowRight /></article>)}
              </div>
            </div>
          </section>

          {serviceDetails.map((detail, index) => <ServiceDetail key={detail.id} detail={detail} icon={solutionIcons[index]} />)}
          <ExtendedBottomPanel />
        </section>

        <section className="page-slide work-slide light-slide" id="workfolio" aria-labelledby="work-title">
          <div className="workfolio-ambient workfolio-ambient-blue" aria-hidden="true" />
          <div className="workfolio-ambient workfolio-ambient-gold" aria-hidden="true" />
          <div className="workfolio-page-shell">
            <header className="workfolio-intro">
              <div>
                <h2 id="work-title">Our <em>Workfolio.</em></h2>
                <p>A collection of programs, experiences, systems, and creative work built together with organizations, institutions, and communities.</p>
              </div>
            </header>
            <div className="workfolio-grid" aria-label="Campus Innovate selected projects">
              {workfolioProjects.map((project, index) => <WorkfolioCard key={project.slug} project={project} index={index} onOpen={() => setSelectedWorkIndex(index)} />)}
            </div>
          </div>
          <ExtendedBottomPanel />
        </section>

        <section className="page-slide kawan-slide light-slide" id="kawan-inovasi" aria-labelledby="kawan-title">
          <div className="kawan-page-ambient kawan-page-ambient-blue" aria-hidden="true" />
          <div className="kawan-page-ambient kawan-page-ambient-gold" aria-hidden="true" />

          <section className="kawan-hero kawan-section">
            <div className="kawan-page-shell kawan-hero-grid">
              <div className="kawan-hero-copy">
                <p className="kawan-kicker">Kawan Inovasi</p>
                <h2 id="kawan-title">Ruang bertumbuh bagi <em>Kawan Inovasi.</em></h2>
                <p className="kawan-lead">Kawan Inovasi adalah ruang bagi orang-orang yang tumbuh bersama Campus Innovate—berkolaborasi, belajar, memperbaiki cara kerja, dan menciptakan dampak melalui pekerjaan nyata.</p>
                <div className="kawan-principles" aria-label="Prinsip Kawan Inovasi">
                  {kawanPrinciples.map((principle) => <article key={principle.number}><span>{principle.number}</span><div><strong>{principle.title}</strong><small>{principle.copy}</small></div></article>)}
                </div>
                <a className="gloss-button gold-button kawan-button" href="#kawan-recruitment" onClick={(event) => scrollToKawanSection(event, 'kawan-recruitment')}>Lihat Kesempatan Bergabung <FiArrowRight /></a>
              </div>
              <div className="kawan-hero-photos" aria-label="Kegiatan tim Campus Innovate">
                <div className="kawan-photo kawan-photo-main"><Image src="/images/kawan-inovasi/team-hero.jpg" alt="Tim Campus Innovate bertumbuh dan bekerja bersama" fill priority sizes="(max-width: 760px) 92vw, 43vw" /></div>
                <div className="kawan-photo kawan-photo-support"><Image src="/images/kawan-inovasi/team-candid.jpg" alt="Momen kebersamaan tim Campus Innovate" fill sizes="(max-width: 760px) 45vw, 19vw" /></div>
                <div className="kawan-photo-caption"><span>People</span><span>Culture</span><span>Growth</span><span>Impact</span></div>
              </div>
            </div>
          </section>

          <section className="kawan-section kawan-about" aria-labelledby="kawan-about-title">
            <div className="kawan-page-shell kawan-about-grid">
              <div className="kawan-about-photo"><Image src="/images/kawan-inovasi/team-candid.jpg" alt="Kawan Inovasi dalam momen kerja bersama" fill sizes="(max-width: 760px) 92vw, 47vw" /></div>
              <div className="kawan-editorial-copy">
                <p className="kawan-kicker">Tentang Kawan Inovasi</p>
                <h2 id="kawan-about-title">Lebih dari sekadar tim.</h2>
                <p>Kawan Inovasi adalah sebutan bagi orang-orang yang tumbuh bersama Campus Innovate. Kami datang dari peran dan keahlian yang berbeda, tetapi berbagi semangat yang sama: belajar, memperbaiki cara kerja, berkolaborasi, dan menciptakan sesuatu yang bermakna.</p>
                <div className="kawan-about-note"><span>01</span><p>Kami percaya pekerjaan terbaik lahir dari ruang yang aman untuk bertanya, mencoba, dan bertumbuh bersama.</p></div>
              </div>
            </div>
          </section>

          <section className="kawan-section kawan-stories" aria-labelledby="kawan-stories-title">
            <div className="kawan-page-shell">
              <div className="kawan-section-heading"><p className="kawan-kicker">Cerita Kawan Inovasi</p><h2 id="kawan-stories-title">Bagaimana rasanya tumbuh<br /><em>di Campus Innovate?</em></h2></div>
              <div className="kawan-story-row">
                {employeeStories.length > 0 ? employeeStories.map((story) => <article className="kawan-story-card" key={story.name}><span className="kawan-quote-mark">“</span><blockquote>{story.quote}</blockquote><div><strong>{story.name}</strong><small>{story.role}</small></div></article>) : <KawanEmptyStory type="employee" />}
              </div>
            </div>
          </section>

          <section className="kawan-section kawan-life" aria-labelledby="kawan-life-title">
            <div className="kawan-page-shell">
              <div className="kawan-section-heading"><p className="kawan-kicker">Life at Campus Innovate</p><h2 id="kawan-life-title">Di balik setiap karya, ada<br /><em>proses dan kebersamaan.</em></h2></div>
              <div className="kawan-life-grid">{kawanLife.map((moment) => <article key={moment.title}><Image src={moment.image} alt={`${moment.title} bersama Kawan Inovasi`} fill sizes="(max-width: 760px) 72vw, 19vw" /><div><span /><h3>{moment.title}</h3><p>{moment.copy}</p></div></article>)}</div>
            </div>
          </section>

          <section className="kawan-section kawan-client-stories" aria-labelledby="kawan-client-title">
            <div className="kawan-page-shell kawan-client-grid">
              <div className="kawan-section-heading"><p className="kawan-kicker">Dari mereka yang bekerja bersama Kawan Inovasi</p><h2 id="kawan-client-title">Cerita dari mereka yang<br /><em>pernah bekerja bersama kami.</em></h2><p>Budaya kerja internal kami hadir dalam kolaborasi, respons, dan pengalaman yang diterima setiap mitra.</p></div>
              <div className="kawan-story-row">{clientStories.length > 0 ? clientStories.map((story) => <article className="kawan-story-card" key={`${story.name}-${story.institution}`}><span className="kawan-quote-mark">“</span><blockquote>{story.quote}</blockquote><div><strong>{story.name}</strong><small>{story.position} · {story.institution}</small></div></article>) : <KawanEmptyStory type="client" />}</div>
            </div>
          </section>

          <section className="kawan-section kawan-recruitment" id="kawan-recruitment" aria-labelledby="kawan-recruitment-title">
            <div className="kawan-page-shell">
              <div className="kawan-section-heading"><p className="kawan-kicker">Kesempatan Bergabung</p><h2 id="kawan-recruitment-title">Mungkin kamu,<br /><em>Kawan Inovasi berikutnya.</em></h2><p>Temukan kesempatan untuk tumbuh, berkarya, dan menciptakan dampak bersama Campus Innovate.</p></div>
              {vacancies.length > 0 ? <div className="kawan-vacancy-grid">{vacancies.map((vacancy) => <article key={vacancy.title}><FiBriefcase /><span>{vacancy.category}</span><h3>{vacancy.title}</h3><p>{vacancy.location} · {vacancy.type}</p><a href={vacancy.applyUrl}>Lihat posisi <FiArrowRight /></a></article>)}</div> : <div className="kawan-vacancy-empty"><div><FiBriefcase /></div><span>Belum ada posisi aktif</span><h3>Belum ada lowongan yang sedang dibuka.</h3><p>Kami hanya menampilkan kesempatan yang telah dikonfirmasi aktif oleh Campus Innovate.</p></div>}
              <div className="kawan-general-application"><div><span>General application</span><h3>Belum menemukan posisi yang tepat?</h3><p>Kirim profilmu dan mari tetap terhubung untuk kesempatan berikutnya.</p></div><a className="gloss-button gold-button" href="mailto:innovatecampus@gmail.com?subject=General%20Application%20-%20Kawan%20Inovasi">Kirim Profil <FiArrowRight /></a></div>
              <div className="kawan-internal-entry"><FiLock /><div><span>Sudah menjadi Kawan Inovasi?</span><a href="/ruang-kawan">Masuk ke Ruang Kawan <FiArrowRight /></a></div></div>
            </div>
          </section>
          <ExtendedBottomPanel />
        </section>

        <section className="page-slide community-slide" id="community" aria-labelledby="community-title">
          <section className="community-overview">
            <div className="community-overview-light community-overview-light-blue" aria-hidden="true" />
            <div className="community-overview-light community-overview-light-gold" aria-hidden="true" />
            <div className="community-page-shell community-overview-shell">
              <div className="community-topline">
                <div className="community-page-heading"><p className="community-kicker">Multi-community platform</p><h2 id="community-title">Communities that<br /><em>move together.</em></h2><p>Tiga karakter komunitas dalam satu ekosistem yang terhubung melalui pengalaman, pembelajaran, dan gerak bersama.</p></div>
                <div className="community-stat-inline"><strong>10,000+</strong><span>community members in Bogor</span></div>
              </div>
              <div className="community-card-grid">
                {communities.map((community) => {
                  const isStripmate = community.id === 'stripmate';
                  const primaryHref = isStripmate ? community.websiteUrl! : `#${community.id}`;
                  return <article className={`community-profile community-profile-${community.id}`} key={community.id}>
                    <a className="community-profile-main" href={primaryHref} target={isStripmate ? '_blank' : undefined} rel={isStripmate ? 'noopener noreferrer' : undefined} onClick={isStripmate ? undefined : (event) => scrollToCommunitySection(event, community.id)}>
                      <Image className="community-cover" src={community.cover} alt={`${community.name} community activity`} fill sizes="(max-width: 760px) 84vw, 31vw" />
                      <div className="community-cover-wash" />
                      <div className={`community-logo community-logo-${community.id}`}><Image src={community.logo} alt={`${community.name} logo`} width={220} height={92} /></div>
                      <div className="community-profile-copy"><span>{community.category}</span><h3>{community.name}</h3><p>{community.description}</p><strong>{isStripmate ? 'Explore Stripmate' : 'Explore'} {isStripmate ? <FiExternalLink /> : <FiArrowRight />}</strong></div>
                    </a>
                    {isStripmate && community.joinUrl && <a className="community-card-secondary" href={community.joinUrl} target="_blank" rel="noopener noreferrer">Gabung Stripmate <FiExternalLink /></a>}
                  </article>;
                })}
              </div>
            </div>
          </section>

          {communities.filter((community) => community.showDetail).map((community) => <CommunityDetail key={community.id} community={community} />)}

          <section className="community-closing" aria-labelledby="community-closing-title">
            <div className="community-page-shell community-closing-grid">
              <div><p className="community-kicker">One connected ecosystem</p><h2 id="community-closing-title">Different communities.<br /><em>One connected ecosystem.</em></h2><p>Community Campus Innovate hadir dalam bentuk dan pengalaman yang berbeda, tetapi bertemu dalam semangat yang sama untuk belajar, terhubung, berkembang, dan menciptakan pengalaman bermakna.</p></div>
              <div className="community-identity-row">{communities.map((community) => <article className={`community-identity-${community.id}`} key={community.id}><Image src={community.logo} alt={`${community.name} identity`} width={220} height={92} /><span>{community.themes.map((theme) => theme.title).join(' · ')}</span></article>)}</div>
            </div>
          </section>
          <ExtendedBottomPanel />
        </section>

        <section className="page-slide contact-slide" id="contact" aria-labelledby="contact-title">
          <div className="contact-page-light contact-page-light-blue" aria-hidden="true" />
          <div className="contact-page-light contact-page-light-gold" aria-hidden="true" />
          <div className="contact-page-shell">
            <header className="contact-intro">
              <div><p className="contact-kicker">Let&apos;s collaborate</p><h2 id="contact-title">Have an idea<br />worth <em>building?</em></h2></div>
              <div className="contact-intro-side"><p>Let&apos;s turn it into meaningful programs, effective systems, and experiences that move people forward.</p><div className="contact-primary-actions"><a className="contact-primary-button" href="#quick-inquiry" onClick={scrollToContactForm}>Start a Collaboration <FiArrowRight /></a><a href="https://wa.me/6285882514394" target="_blank" rel="noopener noreferrer"><FiMessageCircle /> WhatsApp</a><a href="mailto:innovatecampus@gmail.com"><FiMail /> Email</a></div></div>
            </header>

            <div className="contact-page-grid">
              <ContactForm />
              <aside className="contact-information" aria-label="Campus Innovate contact information">
                <div className="contact-map-panel">
                  <iframe title="Campus Innovate office map" src="https://www.google.com/maps?q=Jl.%20Duta%20Pelita%20B2%20No.5%2C%20Tanah%20Sareal%2C%20Bogor&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                  <a href="https://www.google.com/maps/search/?api=1&query=Campus+Innovate+Jl.+Duta+Pelita+B2+No.5+Bogor" target="_blank" rel="noopener noreferrer"><FiMapPin /> Open in Google Maps <FiExternalLink /></a>
                </div>
                <div className="contact-info-grid">
                  <a href="mailto:innovatecampus@gmail.com"><FiMail /><span><small>Email</small><strong>innovatecampus@gmail.com</strong></span></a>
                  <a href="https://wa.me/6285882514394" target="_blank" rel="noopener noreferrer"><FiMessageCircle /><span><small>WhatsApp</small><strong>+62 858-8251-4394</strong></span></a>
                  <a href="https://www.instagram.com/campusinnovate" target="_blank" rel="noopener noreferrer"><FiInstagram /><span><small>Instagram</small><strong>@campusinnovate</strong></span></a>
                  <div><FiMapPin /><span><small>Office</small><strong>Jl. Duta Pelita B2 No.5, Tanah Sareal, Bogor</strong></span></div>
                </div>
              </aside>
            </div>
            <footer className="contact-clean-end"><BrandLogo className="contact-end-logo" /><span>Building Systems. Developing Leaders.</span><small>© {new Date().getFullYear()} Campus Innovate</small></footer>
          </div>
        </section>
      </div>
      {selectedWorkIndex !== null && <WorkfolioModal projects={workfolioProjects} index={selectedWorkIndex} onChange={setSelectedWorkIndex} onClose={() => setSelectedWorkIndex(null)} />}
      <a className="whatsapp-widget" href="https://wa.me/6285882514394?text=Halo%20Campus%20Innovate%2C%20saya%20ingin%20bertanya" target="_blank" rel="noreferrer" aria-label="Chat with Campus Innovate on WhatsApp"><FiMessageCircle /><span><strong>WhatsApp</strong><small>Chat with our team</small></span></a>
    </main>
  );
}
