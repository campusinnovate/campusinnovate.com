import Link from 'next/link';
import { FiInstagram, FiLinkedin, FiMail, FiMapPin, FiMessageCircle } from 'react-icons/fi';
import { BrandLogo } from '@/components/public/BrandLogo';

export default function Footer() {
  return <footer className="site-footer">
    <div className="site-container footer-main">
      <div className="footer-brand"><Link href="/home" aria-label="Campus Innovate home"><BrandLogo /></Link><p></p></div>
      <div className="footer-column"><strong>Explore</strong><a href="#about">About</a><a href="#solutions">Solutions</a><a href="#work">Work</a><a href="#community">Community</a></div>
      <div className="footer-column"><strong>Connect</strong><a href="mailto:innovatecampus@gmail.com"><FiMail /> innovatecampus@gmail.com</a><a href="https://wa.me/6285882514394" target="_blank" rel="noreferrer"><FiMessageCircle /> +62 858-8251-4394</a><a href="https://www.instagram.com/campusinnovate" target="_blank" rel="noreferrer"><FiInstagram /> @campusinnovate</a><a href="https://www.linkedin.com/company/104864849" target="_blank" rel="noreferrer"><FiLinkedin /> LinkedIn</a></div>
      <div className="footer-column footer-address"><strong>Bogor, Indonesia</strong><span><FiMapPin /> Jl. Duta Pelita B2 No.5, Tanah Sareal, Kota Bogor, Jawa Barat 16164</span></div>
    </div>
    <div className="site-container footer-bottom"><span>© {new Date().getFullYear()} Campus Innovate</span><span>Building Systems. Developing Leaders.</span></div>
  </footer>;
}
