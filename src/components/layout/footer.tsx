import Image from 'next/image';
import Link from 'next/link';
import { FiArrowUpRight, FiInstagram, FiLinkedin, FiMessageCircle } from 'react-icons/fi';

export default function Footer() {
  return <footer className="site-footer">
    <div className="page-container footer-main">
      <div className="footer-brand"><Link href="/home" className="brand-lockup brand-lockup-light"><Image src="/assets/logos/logo-campus-innovate.png" width={48} height={48} alt="Logo Campus Innovate" /><span><strong>Campus</strong> Innovate</span></Link><p>Mengembangkan pemimpin, memperkuat organisasi, dan menciptakan pengalaman belajar yang berdampak.</p></div>
      <div className="footer-column"><strong>Jelajahi</strong><Link href="/services">Program</Link><Link href="/about">Tentang kami</Link><Link href="/portofolio">Portofolio</Link></div>
      <div className="footer-column"><strong>Terhubung</strong><a href="https://www.instagram.com/campusinnovate" target="_blank" rel="noreferrer"><FiInstagram /> Instagram</a><a href="https://www.linkedin.com/company/104864849" target="_blank" rel="noreferrer"><FiLinkedin /> LinkedIn</a><a href="https://wa.me/6285882514394" target="_blank" rel="noreferrer"><FiMessageCircle /> WhatsApp</a></div>
      <div className="footer-column"><strong>Tim Campus Innovate</strong><Link href="/internal">Masuk portal internal <FiArrowUpRight /></Link></div>
    </div>
    <div className="page-container footer-bottom"><span>© {new Date().getFullYear()} Campus Innovate</span><span>Grow people. Strengthen teams.</span></div>
  </footer>;
}
