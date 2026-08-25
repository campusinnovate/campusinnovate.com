'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiEdit3, FiLayers, FiPlus, FiRefreshCw, FiShield, FiUsers } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';

type ReferenceItem = { id?: string; key: string; name: string; description?: string | null; default_department_id?: string | null };
type AccessReference = { departments: ReferenceItem[]; positions: ReferenceItem[]; roles: ReferenceItem[]; permissions: ReferenceItem[] };
type Member = {
  id: string;
  email: string;
  full_name: string | null;
  position_id: string | null;
  position_name: string | null;
  department_id: string | null;
  department_name: string | null;
  engagement_type: string;
  status: string;
  user_id: string | null;
  role_keys: string[];
  permission_overrides: Record<string, 'allow' | 'deny'>;
  created_at: string;
  updated_at: string;
};
type AccessLog = { id: number; action: string; actor_email: string | null; after_data: { email?: string } | null; reason: string | null; created_at: string };
type FormState = {
  id: string | null;
  email: string;
  fullName: string;
  positionId: string;
  departmentId: string;
  engagementType: string;
  status: string;
  roleKeys: string[];
  overrides: Record<string, '' | 'allow' | 'deny'>;
  reason: string;
};

const emptyForm: FormState = {
  id: null,
  email: '',
  fullName: '',
  positionId: '',
  departmentId: '',
  engagementType: 'employee',
  status: 'invited',
  roleKeys: ['staff'],
  overrides: {},
  reason: '',
};

const statusLabels: Record<string, string> = { invited: 'Terdaftar', active: 'Aktif', suspended: 'Ditangguhkan', inactive: 'Nonaktif' };
const engagementLabels: Record<string, string> = { employee: 'Karyawan', freelance: 'Freelance', contractor: 'Kontraktor', intern: 'Magang' };
const permissionModuleLabels: Record<string, string> = {
  access: 'Akses & Administrasi', activity: 'My Activity & Assignment', assignments: 'Assignment', calendar: 'Calendar',
  content_plan: 'Content Plan', documents: 'Document Center', employee_profile: 'Profil Pegawai', finance: 'Finance', kpi: 'KPI', marketing: 'Marketing',
  mood: 'Mood Check-in', notes: 'Coret-coret', notifications: 'Notifikasi', people: 'People & HR', performance: 'Performance',
  pipeline: 'Pipeline BD', profile: 'Profil Pegawai', projects: 'Project', report: 'Report & Analysis', reports: 'Report & Analysis', vendors: 'Vendor', work_sources: 'Sumber Kerja',
};

export default function RuangKawanAdminPage() {
  const [reference, setReference] = useState<AccessReference | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [state, setState] = useState<'loading' | 'ready' | 'denied'>('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadData() {
    setError('');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.replace('/ruang-kawan/');
      return;
    }

    const { data: accessData } = await supabase.rpc('get_my_access');
    const access = Array.isArray(accessData) ? accessData[0] : accessData;
    if (!access?.permissions?.includes('access.manage')) {
      setState('denied');
      return;
    }

    const [referenceResult, membersResult, logsResult] = await Promise.all([
      supabase.rpc('admin_access_reference'),
      supabase.rpc('admin_list_members'),
      supabase.rpc('admin_list_access_logs', { log_limit: 30 }),
    ]);

    if (referenceResult.error || membersResult.error || logsResult.error) {
      setError('Data akses belum dapat dimuat. Pastikan pembaruan backend sudah diterapkan.');
      setState('ready');
      return;
    }

    setReference(referenceResult.data as AccessReference);
    setMembers((membersResult.data ?? []) as Member[]);
    setLogs((logsResult.data ?? []) as AccessLog[]);
    setState('ready');
  }

  useEffect(() => { void loadData(); }, []);

  const selectedPosition = useMemo(
    () => reference?.positions.find((position) => position.id === form.positionId),
    [reference, form.positionId],
  );
  const permissionGroups = useMemo(() => {
    const groups = new Map<string, ReferenceItem[]>();
    for (const permission of reference?.permissions ?? []) {
      const moduleKey = permission.key.split('.')[0];
      const label = permissionModuleLabels[moduleKey] ?? 'Lainnya';
      groups.set(label, [...(groups.get(label) ?? []), permission]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b, 'id'));
  }, [reference]);

  function startCreate() {
    setForm(emptyForm);
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startEdit(member: Member) {
    setForm({
      id: member.id,
      email: member.email,
      fullName: member.full_name ?? '',
      positionId: member.position_id ?? '',
      departmentId: member.department_id ?? '',
      engagementType: member.engagement_type,
      status: member.status,
      roleKeys: member.role_keys,
      overrides: member.permission_overrides ?? {},
      reason: '',
    });
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleRole(roleKey: string) {
    setForm((current) => ({
      ...current,
      roleKeys: current.roleKeys.includes(roleKey)
        ? current.roleKeys.filter((key) => key !== roleKey)
        : [...current.roleKeys, roleKey],
    }));
  }

  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const permissionOverrides = Object.fromEntries(Object.entries(form.overrides).filter(([, effect]) => effect));
    const { error: saveError } = await createClient().rpc('admin_save_member', {
      membership_id: form.id,
      member_email: form.email,
      member_full_name: form.fullName,
      member_position_id: form.positionId || null,
      member_department_id: form.departmentId || null,
      member_engagement_type: form.engagementType,
      member_status: form.status,
      member_role_keys: form.roleKeys,
      member_permission_overrides: permissionOverrides,
      change_reason: form.reason || null,
    });

    setSaving(false);
    if (saveError) {
      setError(saveError.message || 'Perubahan belum berhasil disimpan.');
      return;
    }

    setMessage(form.id ? 'Hak akses anggota berhasil diperbarui.' : 'Email berhasil didaftarkan. Anggota sekarang dapat masuk dengan Google.');
    setForm(emptyForm);
    await loadData();
  }

  if (state === 'loading') return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><p>Memeriksa akses administrator...</p></section></main>;
  if (state === 'denied') return <main className="rk-dashboard-foundation"><section className="rk-access-denied"><FiShield /><h1>Akses administrator diperlukan</h1><p>Akun ini tidak memiliki izin untuk mengelola anggota.</p><Link href="/ruang-kawan/dashboard/">Kembali ke dashboard</Link></section></main>;

  return (
    <main className="rk-dashboard-foundation">
      <section className="rk-admin-shell">
        <nav className="rk-admin-nav">
          <Link href="/ruang-kawan/dashboard/"><FiArrowLeft /> Dashboard</Link>
          <span><Link href="/ruang-kawan/admin/sources/"><FiLayers /> Sumber kerja</Link><button type="button" onClick={() => void loadData()}><FiRefreshCw /> Muat ulang</button></span>
        </nav>

        <header className="rk-admin-heading">
          <div><small>Administrasi Ruang Kawan</small><h1>Anggota & Hak Akses</h1><p>Daftarkan email terlebih dahulu, lalu atur posisi, peran, dan izin sesuai kebutuhan kerja.</p></div>
          <button type="button" onClick={startCreate}><FiPlus /> Anggota baru</button>
        </header>

        <section className="rk-admin-layout">
          <form className="rk-member-form" onSubmit={saveMember}>
            <div className="rk-admin-section-title"><FiShield /><div><small>{form.id ? 'Ubah anggota' : 'Daftarkan anggota'}</small><h2>{form.id ? form.email : 'Akses baru'}</h2></div></div>

            <div className="rk-form-grid">
              <label>Nama lengkap<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Nama anggota" /></label>
              <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} disabled={Boolean(form.id && members.find((member) => member.id === form.id)?.user_id)} required /></label>
              <label>Posisi<select value={form.positionId} onChange={(event) => {
                const position = reference?.positions.find((item) => item.id === event.target.value);
                setForm({ ...form, positionId: event.target.value, departmentId: position?.default_department_id ?? form.departmentId });
              }}><option value="">Belum ditetapkan</option>{reference?.positions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>Departemen<select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}><option value="">Belum ditetapkan</option>{reference?.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>Status kerja<select value={form.engagementType} onChange={(event) => setForm({ ...form, engagementType: event.target.value })}>{Object.entries(engagementLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label>Status akses<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} disabled={!form.id}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            </div>
            {selectedPosition ? <p className="rk-field-hint">Posisi terpilih: {selectedPosition.name}. Departemen tetap dapat disesuaikan.</p> : null}

            <fieldset><legend>Peran</legend><div className="rk-role-options">{reference?.roles.map((role) => <label key={role.key}><input type="checkbox" checked={form.roleKeys.includes(role.key)} onChange={() => toggleRole(role.key)} /><span><strong>{role.name}</strong><small>{role.description}</small></span></label>)}</div></fieldset>

            <fieldset><legend>Izin khusus</legend><p className="rk-field-hint">Gunakan “Ikuti peran” untuk aturan normal. Pilih Izinkan atau Tolak hanya sebagai pengecualian.</p><div className="rk-permission-groups">{permissionGroups.map(([moduleName, permissions]) => <section key={moduleName}><h3>{moduleName}<span>{permissions.length} izin</span></h3><div className="rk-permission-options">{permissions.map((permission) => <label key={permission.key}><span>{permission.name}<small>{permission.description}</small></span><select value={form.overrides[permission.key] ?? ''} onChange={(event) => setForm({ ...form, overrides: { ...form.overrides, [permission.key]: event.target.value as '' | 'allow' | 'deny' } })}><option value="">Ikuti peran</option><option value="allow">Izinkan</option><option value="deny">Tolak</option></select></label>)}</div></section>)}</div></fieldset>

            <label className="rk-reason-field">Catatan perubahan<textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Contoh: COO juga menangani HR dan Finance" /></label>
            {error ? <p className="rk-password-error" role="alert">{error}</p> : null}
            {message ? <p className="rk-password-success">{message}</p> : null}
            <button className="rk-primary-admin-button" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : form.id ? 'Simpan perubahan' : 'Daftarkan email'}</button>
          </form>

          <div className="rk-admin-side">
            <section className="rk-member-list"><div className="rk-admin-section-title"><FiUsers /><div><small>{members.length} anggota</small><h2>Daftar akses</h2></div></div>{members.map((member) => <article key={member.id}><div><strong>{member.full_name || member.email}</strong><span>{member.full_name ? member.email : 'Nama belum diisi'}</span><small>{member.position_name || 'Posisi belum ditetapkan'} · {engagementLabels[member.engagement_type]}</small><div className="rk-member-tags"><i data-status={member.status}>{statusLabels[member.status]}</i>{member.role_keys.map((role) => <i key={role}>{reference?.roles.find((item) => item.key === role)?.name ?? role}</i>)}</div></div><button type="button" onClick={() => startEdit(member)} aria-label={`Ubah ${member.email}`}><FiEdit3 /></button></article>)}</section>

            <section className="rk-access-log"><div className="rk-admin-section-title"><FiShield /><div><small>Jejak perubahan</small><h2>Audit log</h2></div></div>{logs.length ? logs.map((log) => <article key={log.id}><strong>{log.action === 'membership.created' ? 'Anggota didaftarkan' : 'Akses diperbarui'}</strong><span>{log.after_data?.email ?? 'Anggota'} oleh {log.actor_email ?? 'administrator'}</span>{log.reason ? <p>{log.reason}</p> : null}<time>{new Date(log.created_at).toLocaleString('id-ID')}</time></article>) : <p className="rk-empty-state">Belum ada perubahan yang tercatat.</p>}</section>
          </div>
        </section>
      </section>
    </main>
  );
}
