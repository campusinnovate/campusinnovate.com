'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { FiArrowUpRight, FiMenu, FiX } from 'react-icons/fi';

const navigation = [
  { title: 'Beranda', link: '/home' }, { title: 'Program', link: '/services' },
  { title: 'Tentang', link: '/about' }, { title: 'Portofolio', link: '/portofolio' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return <header className="site-header"><nav className="page-container nav-shell" aria-label="Navigasi utama">
    <Link href="/home" className="brand-lockup" onClick={() => setOpen(false)}><Image src="/assets/logos/logo-campus-innovate.png" width={46} height={46} alt="Logo Campus Innovate" /><span><strong>Campus</strong> Innovate</span></Link>
    <button className="mobile-nav-toggle" type="button" onClick={() => setOpen(!open)} aria-label={open ? 'Tutup menu' : 'Buka menu'} aria-expanded={open}>{open ? <FiX /> : <FiMenu />}</button>
    <div className={`nav-links ${open ? 'is-open' : ''}`}>
      {navigation.map((item) => <Link key={item.link} href={item.link} onClick={() => setOpen(false)} className={pathname === item.link ? 'active' : ''}>{item.title}</Link>)}
      <Link href="/internal" className="internal-link" onClick={() => setOpen(false)}>Portal Internal <FiArrowUpRight /></Link>
    </div>
  </nav></header>;
}
