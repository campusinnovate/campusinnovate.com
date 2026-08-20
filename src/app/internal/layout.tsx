'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { FiBarChart2, FiCalendar, FiChevronLeft, FiClipboard, FiFileText, FiGrid, FiHelpCircle, FiMenu, FiSettings, FiUsers, FiX } from 'react-icons/fi';

const menu = [
  { label: 'Ringkasan', icon: FiGrid, href: '/internal' },
  { label: 'KPI & OKR', icon: FiBarChart2, href: '/internal#kpi' },
  { label: 'Proyek', icon: FiClipboard, href: '/internal#projects' },
  { label: 'Tim', icon: FiUsers, href: '/internal#team' },
  { label: 'Kalender', icon: FiCalendar, href: '/internal#calendar' },
  { label: 'Laporan', icon: FiFileText, href: '/internal#reports' },
];

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return <div className="internal-shell">
    <aside className={`internal-sidebar ${open ? 'is-open' : ''}`}>
      <div className="internal-brand"><Image src="/assets/logos/logo-campus-innovate.png" width={42} height={42} alt="Campus Innovate" /><div><strong>Campus Innovate</strong><span>Workspace</span></div><button onClick={() => setOpen(false)} aria-label="Tutup menu"><FiX /></button></div>
      <nav aria-label="Menu portal internal">
        <span className="nav-section-label">WORKSPACE</span>
        {menu.map((item, index) => { const Icon = item.icon; return <Link key={item.label} href={item.href} className={index === 0 && pathname === '/internal' ? 'active' : ''} onClick={() => setOpen(false)}><Icon /> {item.label}</Link>; })}
      </nav>
      <div className="sidebar-lower"><Link href="/internal#settings"><FiSettings /> Pengaturan</Link><Link href="/internal#help"><FiHelpCircle /> Bantuan</Link></div>
      <div className="sidebar-profile"><div className="profile-avatar">AR</div><div><strong>Admin Operasional</strong><span>admin@campusinnovate.id</span></div></div>
    </aside>
    {open && <button className="sidebar-overlay" aria-label="Tutup menu" onClick={() => setOpen(false)} />}
    <div className="internal-main">
      <header className="internal-topbar"><button className="sidebar-trigger" onClick={() => setOpen(true)} aria-label="Buka menu"><FiMenu /></button><Link href="/home"><FiChevronLeft /> Kembali ke website</Link><div className="topbar-actions"><button aria-label="Bantuan"><FiHelpCircle /></button><div className="profile-avatar small">AR</div></div></header>
      {children}
    </div>
  </div>;
}
