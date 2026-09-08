'use client';
import { useEffect, useRef, useState } from 'react';
import type { Placement } from '@/lib/office/types';
export default function OfficePdfCanvas({ bytes, page, placements, selected, onSelect, onMove, names, images }: {
  bytes: ArrayBuffer; page: number; placements: Placement[]; selected?: string; onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void; names: Record<string, string>; images?: Record<string,string>;
}) {
  const ref = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(.707), [error, setError] = useState('');
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    let task: import('pdfjs-dist').PDFDocumentLoadingTask | undefined;
    void (async () => {
      try {
        setError('');
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        task = pdfjs.getDocument({ data: bytes.slice(0) });
        const pdf = await task.promise;
        if (cancelled) return;
        const current = await pdf.getPage(page);
        const viewport = current.getViewport({ scale: 1.4 });
        if (!ref.current || cancelled) return;
        const canvas = ref.current; canvas.width = viewport.width; canvas.height = viewport.height; setRatio(viewport.width / viewport.height);
        await current.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'PDF tidak dapat ditampilkan.'); }
    })();
    return () => { cancelled = true; void task?.destroy(); };
  }, [bytes, page]);
  return <><div ref={wrap} className="rk-office-paper" style={{ aspectRatio: ratio }}><canvas ref={ref} />{placements.filter(p => p.page === page).map(p => <button key={p.membership_id} type="button" className="rk-office-placement" data-selected={selected === p.membership_id} style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.width * 100}%`, height: `${p.height * 100}%`, touchAction: onMove ? 'none' : 'auto' }} onClick={() => onSelect?.(p.membership_id)} onPointerDown={event => {
    if (!onMove || !wrap.current) return;
    const rect = wrap.current.getBoundingClientRect(); drag.current = { id: p.membership_id, dx: event.clientX - rect.left - p.x * rect.width, dy: event.clientY - rect.top - p.y * rect.height }; event.currentTarget.setPointerCapture(event.pointerId); onSelect?.(p.membership_id);
  }} onPointerMove={event => {
    if (!drag.current || !wrap.current || drag.current.id !== p.membership_id) return;
    const rect = wrap.current.getBoundingClientRect(); onMove?.(p.membership_id, Math.max(0, Math.min(1 - p.width, (event.clientX - rect.left - drag.current.dx) / rect.width)), Math.max(0, Math.min(1 - p.height, (event.clientY - rect.top - drag.current.dy) / rect.height)));
  }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} aria-label={`Lokasi tanda tangan ${names[p.membership_id] ?? ''}`}>{images?.[p.membership_id]?<img src={images[p.membership_id]} alt={`Tanda tangan ${names[p.membership_id]}`} />:<span>{names[p.membership_id] ?? 'Tanda tangan'}</span>}</button>)}</div>{error ? <p className="rk-office-error" role="alert">{error}</p> : null}</>;
}
