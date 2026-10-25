'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiBell, FiCheck, FiHome, FiMoon, FiSave, FiSun, FiMonitor, FiUser } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';
import PushNotificationControl from '@/components/ruang-kawan/PushNotificationControl';
import styles from './settings.module.css';

type Theme = 'light' | 'dark' | 'system';
type WorkspaceSettings = { theme: Theme; home_path: string };
type Access = { membership_status: string; permissions: string[]; full_name?: string | null; position_name?: string | null; roles?: string[] };

const defaults: WorkspaceSettings = { theme: 'system', home_path: '/ruang-kawan/dashboard/' };
const destinations = [
  { label: 'Dashboard', path: '/ruang-kawan/dashboard/', any: [] },
  { label: 'Kawan Chat', path: '/ruang-kawan/chat/', any: [] },
  { label: 'My Activity', path: '/ruang-kawan/activity/', any: ['activity.view_self'] },
  { label: 'Marketing', path: '/ruang-kawan/marketing/', any: ['marketing.view', 'content_plan.view', 'pipeline.view', 'ticketing.view'] },
  { label: 'Project', path: '/ruang-kawan/projects/', any: ['projects.view'] },
  { label: 'KPI', path: '/ruang-kawan/kpi/', any: ['kpi.view_self'] },
  { label: 'Finance', path: '/ruang-kawan/finance/', any: ['finance.view'] },
  { label: 'Finance Pilot', path: '/ruang-kawan/finance-pilot/', any: ['finance_next.view'] },
];

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.rkTheme = dark ? 'dark' : 'light';
}

export default function WorkspaceSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState<Access | null>(null);
  const [settings, setSettings] = useState<WorkspaceSettings>(defaults);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.replace('/ruang-kawan/'); return; }
      const stored = session.user.user_metadata?.rk_workspace_settings as Partial<WorkspaceSettings> | undefined;
      const next = { ...defaults, ...stored };
      const { data } = await supabase.rpc('get_my_access');
      const member = (Array.isArray(data) ? data[0] : data) as Access | null;
      if (!active) return;
      setEmail(session.user.email ?? '');
      setAccess(member);
      setSettings(next);
      applyTheme(next.theme);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (settings.theme !== 'system') { applyTheme(settings.theme); return; }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme('system');
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [settings.theme]);

  const homeOptions = useMemo(() => destinations.filter(item =>
    !item.any.length || item.any.some(permission => access?.permissions?.includes(permission))
  ), [access]);

  async function save() {
    setSaving(true); setNotice(''); setError('');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.replace('/ruang-kawan/'); return; }
    const { error: updateError } = await supabase.auth.updateUser({
      data: { rk_workspace_settings: settings },
    });
    setSaving(false);
    if (updateError) { setError('Pengaturan belum tersimpan. Coba lagi.'); return; }
    applyTheme(settings.theme);
    setNotice('Pengaturan berhasil disimpan.');
  }

  if (loading) return <main className={styles.page}><section className={styles.loading}>Menyiapkan pengaturan...</section></main>;

  const themeOptions: { id: Theme; label: string; hint: string; icon: typeof FiSun }[] = [
    { id: 'light', label: 'Light', hint: 'Tampilan terang', icon: FiSun },
    { id: 'dark', label: 'Dark', hint: 'Tampilan gelap', icon: FiMoon },
    { id: 'system', label: 'Ikuti sistem', hint: 'Sesuaikan dengan perangkat', icon: FiMonitor },
  ];

  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.nav}><Link href="/ruang-kawan/dashboard/"><FiArrowLeft /> Kembali ke Dashboard</Link></nav>
      <header className={styles.hero}>
        <div><span>RUANG KAWAN · PREFERENSI</span><h1>Pengaturan</h1><p>Atur pengalaman kerja di akunmu. Preferensi ini tidak mengubah tampilan akun staf lain.</p></div>
        <FiSave aria-hidden="true" />
      </header>

      {error ? <p className={styles.alert} role="alert">{error}</p> : null}
      {notice ? <p className={styles.success} role="status"><FiCheck /> {notice}</p> : null}

      <section className={styles.card}>
        <div className={styles.sectionHeading}><span><FiSun /></span><div><h2>Tampilan</h2><p>Pilihan tema berlaku di Kawan Innovate dan seluruh Ruang Kawan, termasuk chat.</p></div></div>
        <div className={styles.themeChoices} role="radiogroup" aria-label="Tema aplikasi">
          {themeOptions.map(option => { const Icon = option.icon; return <button type="button" key={option.id} role="radio" aria-checked={settings.theme === option.id} data-selected={settings.theme === option.id} onClick={() => setSettings(current => ({ ...current, theme: option.id }))}>
            <Icon /><span><strong>{option.label}</strong><small>{option.hint}</small></span>{settings.theme === option.id ? <FiCheck className={styles.choiceCheck} /> : null}
          </button>; })}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeading}><span><FiBell /></span><div><h2>Notifikasi</h2><p>Aktifkan notifikasi perangkat untuk mention, pesan, dan pekerjaan yang perlu ditindaklanjuti.</p></div></div>
        <PushNotificationControl />
        <p className={styles.helper}>Notifikasi di dalam Kawan Chat dan pusat notifikasi tetap tersedia meskipun push perangkat dimatikan.</p>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeading}><span><FiUser /></span><div><h2>Akun & profil</h2><p>Informasi identitas kerja dan akses akunmu.</p></div></div>
        <div className={styles.account}>
          <div className={styles.avatar}>{(access?.full_name || email || 'K').split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase()}</div>
          <div className={styles.accountInfo}><strong>{access?.full_name || 'Nama staf'}</strong><span>{email}</span><small>{[access?.position_name, access?.roles?.join(', ')].filter(Boolean).join(' · ') || 'Anggota Ruang Kawan'}</small></div>
          <Link href="/ruang-kawan/profile/"><FiUser /> Kelola profil</Link>
        </div>
        <p className={styles.helper}>Data kepegawaian dan penggantian password dikelola dari halaman Profil.</p>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeading}><span><FiHome /></span><div><h2>Preferensi kerja</h2><p>Pilih halaman yang dibuka setelah kamu masuk ke Ruang Kawan.</p></div></div>
        <label className={styles.selectLabel} htmlFor="rk-home-path">Halaman awal</label>
        <select id="rk-home-path" value={settings.home_path} onChange={event => setSettings(current => ({ ...current, home_path: event.target.value }))}>
          {homeOptions.map(item => <option key={item.path} value={item.path}>{item.label}</option>)}
        </select>
        <p className={styles.helper}>Pilihan halaman awal diterapkan saat login berikutnya.</p>
      </section>

      <footer className={styles.footer}><span>Pengaturan disimpan untuk akun ini.</span><button type="button" onClick={() => void save()} disabled={saving}>{saving ? 'Menyimpan...' : <><FiSave /> Simpan pengaturan</>}</button></footer>
    </div>
  </main>;
}
