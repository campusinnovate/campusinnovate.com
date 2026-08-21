'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiMenu, FiX } from 'react-icons/fi';
import { BrandLogo } from '@/components/public/BrandLogo';
import { navigation } from '@/data/homepage';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [activeHash, setActiveHash] = useState('home');

  useEffect(() => {
    const sync = () => setActiveHash(window.location.hash.replace('#', '') || 'home');
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const navigate = (event: React.MouseEvent, id: string) => {
    setOpen(false);
    setActiveHash(id);
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    window.history.replaceState(null, '', `${window.location.pathname}#${id}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  return <header className="site-header"><nav className="site-container nav-shell" aria-label="Main navigation">
    <Link href="/home#home" className="nav-brand" onClick={(event) => navigate(event, 'home')} aria-label="Campus Innovate home"><BrandLogo className="nav-official-logo" priority /></Link>
    <button className="mobile-nav-toggle" type="button" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="main-menu">{open ? <FiX /> : <FiMenu />}</button>
    <div id="main-menu" className={`nav-links ${open ? 'is-open' : ''}`}>
      {navigation.map((item) => {
        const id = item.href.split('#')[1] || 'home';
        return <Link className={activeHash === id ? 'is-active' : ''} key={item.label} href={item.href} onClick={(event) => navigate(event, id)}>{item.label}</Link>;
      })}
    </div>
  </nav></header>;
}
