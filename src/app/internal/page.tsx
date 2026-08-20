'use client';

import { useMemo, useState } from 'react';
import { FiArrowRight, FiBarChart2, FiCalendar, FiCheckCircle, FiChevronDown, FiClock, FiExternalLink, FiFileText, FiMoreHorizontal, FiPlus, FiTarget, FiTrendingUp, FiUsers } from 'react-icons/fi';

const projects = [
  { name: 'Leadership Camp IPB', category: 'Event Program', status: 'On track', progress: 72, due: '28 Agu', tone: 'green' },
  { name: 'Capacity Building COREVA', category: 'Corporate', status: 'At risk', progress: 45, due: '02 Sep', tone: 'amber' },
  { name: 'Mentoring Campus Leader', category: 'Mentoring', status: 'On track', progress: 88, due: '30 Agu', tone: 'green' },
];

const tasks = [
  { title: 'Finalisasi rundown Leadership Camp', project: 'Leadership Camp IPB', due: 'Hari ini', urgent: true },
  { title: 'Review proposal fasilitator', project: 'Capacity Building COREVA', due: 'Besok', urgent: false },
  { title: 'Kirim laporan mentoring pekan 3', project: 'Mentoring Campus Leader', due: '23 Agu', urgent: false },
];

export default function InternalDashboard() {
  const [period, setPeriod] = useState('Minggu ini');
  const [completed, setCompleted] = useState<string[]>([]);
  const greeting = useMemo(() => new Date().getHours() < 12 ? 'Selamat pagi' : new Date().getHours() < 18 ? 'Selamat siang' : 'Selamat sore', []);
  return <main className="dashboard-page">
    <div className="dashboard-demo-note"><span>Pratinjau portal</span> Data di halaman ini masih berupa contoh desain dan belum terhubung ke sumber produksi.</div>
    <section className="dashboard-heading"><div><span>Kamis, 20 Agustus 2026</span><h1>{greeting}, Tim Operasional <span>👋</span></h1><p>Berikut ringkasan hal yang perlu diperhatikan hari ini.</p></div><button className="internal-primary"><FiPlus /> Tambah aktivitas</button></section>

    <section className="metric-grid" id="kpi">
      <article><div className="metric-top"><span className="metric-icon blue"><FiTarget /></span><span className="positive"><FiTrendingUp /> 8%</span></div><strong>84%</strong><p>Capaian KPI bulan ini</p><small>Target minimum 80%</small></article>
      <article><div className="metric-top"><span className="metric-icon gold"><FiBarChart2 /></span><span className="muted-label">Agustus</span></div><strong>12</strong><p>Proyek aktif</p><small>8 on track · 4 perlu perhatian</small></article>
      <article><div className="metric-top"><span className="metric-icon green"><FiCheckCircle /></span><span className="positive">+6 minggu ini</span></div><strong>31</strong><p>Task selesai</p><small>Dari total 42 task</small></article>
      <article><div className="metric-top"><span className="metric-icon purple"><FiUsers /></span><span className="muted-label">Aktif</span></div><strong>18</strong><p>Anggota tim</p><small>4 divisi operasional</small></article>
    </section>

    <div className="dashboard-grid-main">
      <section className="dashboard-card performance-card">
        <div className="card-heading"><div><h2>Performa mingguan</h2><p>Realisasi aktivitas dibanding target</p></div><button className="period-select" onClick={() => setPeriod(period === 'Minggu ini' ? 'Bulan ini' : 'Minggu ini')}>{period} <FiChevronDown /></button></div>
        <div className="chart-legend"><span><i className="legend-blue" />Realisasi</span><span><i className="legend-soft" />Target</span></div>
        <div className="bar-chart" aria-label="Grafik performa mingguan">
          {[68, 82, 58, 92, 76, 46, 36].map((height, index) => <div className="bar-column" key={index}><div className="bar-track"><span style={{ height: `${height}%` }} /></div><small>{['Sen','Sel','Rab','Kam','Jum','Sab','Min'][index]}</small></div>)}
        </div>
      </section>

      <section className="dashboard-card agenda-card" id="calendar">
        <div className="card-heading"><div><h2>Agenda terdekat</h2><p>Jadwal tim hari ini</p></div><button className="icon-button"><FiMoreHorizontal /></button></div>
        <div className="agenda-list">
          <article><div className="agenda-time"><strong>09:00</strong><span>10:00</span></div><div className="agenda-line blue-line" /><div><strong>Weekly C-Level</strong><span>Google Meet · Semua C-Level</span></div></article>
          <article><div className="agenda-time"><strong>13:30</strong><span>14:30</span></div><div className="agenda-line gold-line" /><div><strong>Review Proyek IPB</strong><span>Ruang Diskusi · Project Team</span></div></article>
          <article><div className="agenda-time"><strong>16:00</strong><span>17:00</span></div><div className="agenda-line green-line" /><div><strong>Finance Reconciliation</strong><span>Office · Finance Team</span></div></article>
        </div>
        <button className="card-link">Lihat kalender lengkap <FiArrowRight /></button>
      </section>
    </div>

    <div className="dashboard-grid-secondary">
      <section className="dashboard-card projects-card" id="projects">
        <div className="card-heading"><div><h2>Proyek aktif</h2><p>Progres proyek prioritas</p></div><button className="text-button">Lihat semua</button></div>
        <div className="project-table">
          <div className="project-row project-head"><span>PROYEK</span><span>STATUS</span><span>PROGRES</span><span>TENGGAT</span></div>
          {projects.map((project) => <div className="project-row" key={project.name}><div><strong>{project.name}</strong><small>{project.category}</small></div><span className={`status-pill ${project.tone}`}>{project.status}</span><div className="progress-cell"><div><span style={{ width: `${project.progress}%` }} /></div><small>{project.progress}%</small></div><span className="due-date">{project.due}</span></div>)}
        </div>
      </section>

      <section className="dashboard-card tasks-card">
        <div className="card-heading"><div><h2>Task saya</h2><p>{tasks.length - completed.length} perlu diselesaikan</p></div><button className="icon-button"><FiPlus /></button></div>
        <div className="task-list">
          {tasks.map((task) => <label className={completed.includes(task.title) ? 'completed' : ''} key={task.title}><input type="checkbox" checked={completed.includes(task.title)} onChange={() => setCompleted((items) => items.includes(task.title) ? items.filter((item) => item !== task.title) : [...items, task.title])} /><span className="custom-check"><FiCheckCircle /></span><span className="task-copy"><strong>{task.title}</strong><small>{task.project}</small></span><span className={task.urgent ? 'task-due urgent' : 'task-due'}><FiClock /> {task.due}</span></label>)}
        </div>
        <button className="card-link">Buka daftar task <FiArrowRight /></button>
      </section>
    </div>

    <section className="quick-actions" id="reports"><div><h2>Akses cepat</h2><p>Dokumen dan ruang kerja yang sering digunakan.</p></div><div className="quick-grid"><button><span><FiFileText /></span><div><strong>Laporan Mingguan</strong><small>Perbarui progress tim</small></div><FiExternalLink /></button><button><span><FiCalendar /></span><div><strong>Kalender Tim</strong><small>Lihat seluruh agenda</small></div><FiExternalLink /></button><button><span><FiBarChart2 /></span><div><strong>Dashboard KPI</strong><small>Analisis capaian</small></div><FiExternalLink /></button></div></section>
  </main>;
}
