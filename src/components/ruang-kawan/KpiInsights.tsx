'use client';
import { ReactNode, useEffect, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
type Item = { id: string; name: string; score: number | null; reviewer_score: number | null; actual_value: number | null; target_value: number; unit: string; is_applicable: boolean };
type Update = { result_id: string; week_start: string; actual_value: number | null };
const defaults = ['summary', 'progress', 'trend'];
function Widget({ id, children, move, index, count }: { id: string; children: ReactNode; move: (id: string, offset: number) => void; index: number; count: number }) {
  const controls = useDragControls();
  return <Reorder.Item value={id} dragListener={false} dragControls={controls} className="rk-kpi-widget"><nav aria-label="Urutan grafik"><button style={{ touchAction: 'none' }} onPointerDown={event => controls.start(event)} aria-label="Geser grafik">⠿ Geser</button><button disabled={index === 0} onClick={() => move(id, -1)} aria-label="Pindah grafik ke atas">↑</button><button disabled={index === count - 1} onClick={() => move(id, 1)} aria-label="Pindah grafik ke bawah">↓</button></nav>{children}</Reorder.Item>;
}
export default function KpiInsights({ results, updates, storageKey }: { results: Item[]; updates: Update[]; storageKey: string }) {
  const [order, setOrder] = useState(defaults), [trendId, setTrendId] = useState(results[0]?.id ?? '');
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null'); setOrder(Array.isArray(saved) && saved.length === 3 && new Set(saved).size === 3 && saved.every(v => defaults.includes(v)) ? saved : defaults); } catch { setOrder(defaults); } }, [storageKey]);
  const persist = (values: string[]) => { setOrder(values); try { localStorage.setItem(storageKey, JSON.stringify(values)); } catch { /* Layout still works for this session. */ } };
  const move = (id: string, offset: number) => { const next = [...order], i = next.indexOf(id); [next[i], next[i + offset]] = [next[i + offset], next[i]]; persist(next); };
  const active = results.filter(r => r.is_applicable), filled = active.filter(r => r.actual_value !== null).length;
  const coverage = active.length ? Math.round(filled / active.length * 100) : 0;
  const trendItem = results.find(r => r.id === trendId) ?? results[0];
  const trend = updates.filter(u => u.result_id === trendItem?.id && u.actual_value !== null).sort((a, b) => a.week_start.localeCompare(b.week_start));
  const min = Math.min(0, ...trend.map(u => Number(u.actual_value))), max = Math.max(1, ...trend.map(u => Number(u.actual_value)));
  const point = (u: Update, i: number) => `${35 + i / Math.max(1, trend.length - 1) * 530},${150 - (Number(u.actual_value) - min) / (max - min) * 120}`;
  const widgets: Record<string, ReactNode> = {
    summary: <><h3>Kelengkapan aktual KPI</h3><div className="rk-kpi-coverage"><div role="img" aria-label={`${coverage}% KPI memiliki aktual`} style={{ background: `conic-gradient(#2266a3 ${coverage}%, #e4edf3 0)` }}><b>{coverage}%</b></div><p><strong>{filled} dari {active.length} KPI</strong> sudah memiliki nilai aktual.<br />{active.length - filled} KPI masih perlu diisi. Evidence tetap diperiksa saat pengajuan review.</p></div></>,
    progress: <><h3>Capaian per KPI</h3>{active.map(item => { const value = item.reviewer_score ?? item.score; return <div className="rk-kpi-bar" key={item.id}><span>{item.name}<b>{value == null ? 'Belum dinilai' : `${Number(value).toFixed(1)}%`}</b></span><progress value={Math.max(0, Math.min(100, Number(value ?? 0)))} max={100} aria-label={`Capaian ${item.name}`} /><small>Aktual {item.actual_value ?? '—'} / target {item.target_value} {item.unit}</small></div>; })}{!active.length ? <p>Belum ada KPI aktif.</p> : null}</>,
    trend: <><h3>Aktual mingguan</h3><select aria-label="KPI untuk grafik mingguan" value={trendItem?.id ?? ''} onChange={event => setTrendId(event.target.value)}>{results.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>{trend.length ? <><svg viewBox="0 0 600 190" role="img" aria-label={`Grafik aktual mingguan ${trendItem?.name}`}><line x1="35" y1="150" x2="565" y2="150" stroke="#b9cbd9" /><polyline points={trend.map(point).join(' ')} fill="none" stroke="#2266a3" strokeWidth="3" />{trend.map((u, i) => { const [x,y] = point(u,i).split(','); return <g key={u.week_start}><circle cx={x} cy={y} r="5" fill="#e89727"><title>{u.week_start}: {u.actual_value} {trendItem?.unit}</title></circle><text x={x} y={Number(y)-10} textAnchor="middle" fontSize="12">{u.actual_value}</text><text x={x} y="175" textAnchor="middle" fontSize="10">{u.week_start.slice(5)}</text></g>; })}</svg><details><summary>Data grafik ({trendItem?.unit})</summary>{trend.map(u => <p key={u.week_start}>{u.week_start}: {u.actual_value} {trendItem?.unit}</p>)}</details></> : <p>Isi aktual mingguan untuk menampilkan grafik.</p>}</>,
  };
  return <Reorder.Group axis="y" values={order} onReorder={persist} className="rk-kpi-insights">{order.map((id, index) => <Widget id={id} key={id} move={move} index={index} count={order.length}>{widgets[id]}</Widget>)}</Reorder.Group>;
}
