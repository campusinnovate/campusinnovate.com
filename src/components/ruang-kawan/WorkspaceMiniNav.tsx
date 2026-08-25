'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  FiActivity, FiBarChart2, FiBookOpen, FiBriefcase, FiDollarSign,
  FiBell, FiFileText, FiGrid, FiTrendingUp,
  FiUser,
} from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';

type Access = { membership_status: string; permissions: string[] };

const items = [
  { label: 'Dashboard', href: '/ruang-kawan/dashboard/', icon: FiGrid, any: [] },
  { label: 'My Activity', href: '/ruang-kawan/activity/', icon: FiActivity, any: ['activity.view_self'] },
  { label: 'Marketing', href: '/ruang-kawan/marketing/', icon: FiTrendingUp, any: ['marketing.view', 'content_plan.view', 'pipeline.view'] },
  { label: 'Project', href: '/ruang-kawan/projects/', icon: FiBriefcase, any: ['projects.view'] },
  { label: 'KPI', href: '/ruang-kawan/kpi/', icon: FiBarChart2, any: ['kpi.view_self'] },
  { label: 'Profil', href: '/ruang-kawan/profile/', icon: FiUser, any: ['employee_profile.view_directory'] },
  { label: 'Documents', href: '/ruang-kawan/documents/', icon: FiBookOpen, any: ['documents.view'] },
  { label: 'Reports', href: '/ruang-kawan/reports/', icon: FiFileText, any: ['reports.view_self'] },
  { label: 'Finance', href: '/ruang-kawan/finance/', icon: FiDollarSign, any: ['finance.view'] },
  { label: 'Notifikasi', href: '/ruang-kawan/notifications/', icon: FiBell, any: ['notifications.view_self'] },
];

export default function WorkspaceMiniNav() {
  const pathname = usePathname();
  const [access, setAccess] = useState<Access | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.rpc('get_my_access');
      const value = (Array.isArray(data) ? data[0] : data) as Access | null;
      if (active && value?.membership_status === 'active') setAccess(value);
    }
    void load();
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => items.filter((item) =>
    item.any.length === 0 || item.any.some((permission) => access?.permissions?.includes(permission))
  ), [access]);

  if (!access || pathname === '/ruang-kawan' || pathname.startsWith('/ruang-kawan/callback')) return null;

  return (
    <nav className="rk-mini-nav" aria-label="Navigasi utama Ruang Kawan">
      <div>
        {visible.map((item) => {
          const Icon = item.icon;
          const active = item.href === '/ruang-kawan/dashboard/'
            ? pathname.startsWith('/ruang-kawan/dashboard')
            : item.href === '/ruang-kawan/marketing/'
              ? ['/ruang-kawan/marketing', '/ruang-kawan/content-plan', '/ruang-kawan/pipeline'].some((route) => pathname.startsWith(route))
              : pathname.startsWith(item.href.slice(0, -1));
          return <Link key={item.href} href={item.href} data-active={active}><Icon /><span>{item.label}</span></Link>;
        })}
      </div>
    </nav>
  );
}
