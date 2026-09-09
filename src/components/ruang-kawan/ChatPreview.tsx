'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiFile, FiX } from 'react-icons/fi';
import { driveFileId, linkParts, safeUrl } from '@/lib/chat/presentation';

export type PreviewAttachment = { id: string; name: string; url: string; mime_type?: string | null; size_label?: string | null };

export function LinkedText({ body }: { body: string }) {
  return <>{linkParts(body).map((part, index) => part.href ? <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className="rk-chat-text-link">{part.text}</a> : part.text)}</>;
}

export function ChatDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => previous?.focus();
  }, []);
  return createPortal(<div className="rk-chat-modal" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    if (event.key === 'Tab') {
      const items = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, textarea, iframe');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
    }
  }}><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button autoFocus onClick={onClose} aria-label="Tutup"><FiX /></button></header><div className="rk-chat-dialog-body">{children}</div></section></div>, document.body);
}

export function AttachmentPreview({ file }: { file: PreviewAttachment }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const url = safeUrl(file.url);
  const driveId = driveFileId(file.url);
  const isImage = /^image\/(png|jpeg|gif|webp|avif|bmp)$/i.test(file.mime_type ?? '') || /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(file.name);
  const preview = driveId ? `https://drive.google.com/file/d/${driveId}/preview` : file.mime_type === 'application/pdf' || /\.pdf$/i.test(file.name) ? url : null;
  useEffect(() => { setFailed(false); }, [file.url]);
  return <div className="rk-chat-attachment"><button type="button" className="rk-chat-file" onClick={() => setOpen(true)} aria-label={`Preview ${file.name}`}>
    {(isImage || driveId) && url && !failed ? <img loading="lazy" src={driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w320` : url} alt={file.name} onError={() => setFailed(true)} /> : <FiFile />}
    <span><strong>{file.name}</strong><small>{file.mime_type || 'Dokumen'}{file.size_label ? ` · ${file.size_label}` : ''} · Lihat preview</small></span>
  </button>{open ? <ChatDialog title={file.name} onClose={() => setOpen(false)}>
    {driveId || preview ? <iframe className="rk-chat-file-frame" src={preview!} title={`Preview ${file.name}`} allow="fullscreen" referrerPolicy="no-referrer" /> : isImage && url && !failed ? <img className="rk-chat-full-image" src={url} alt={file.name} onError={() => setFailed(true)} /> : url && file.mime_type?.startsWith('video/') ? <video controls preload="metadata" src={url} /> : url && file.mime_type?.startsWith('audio/') ? <audio controls preload="metadata" src={url} /> : <p>Preview untuk format ini belum tersedia.</p>}
    <p className="rk-chat-preview-note">Jika preview tidak tampil, buka file asli. File Google Drive memerlukan akun yang memiliki akses.</p>
    {url ? <a href={url} target="_blank" rel="noopener noreferrer">Buka / unduh file asli</a> : <p>Alamat file tidak valid.</p>}
  </ChatDialog> : null}</div>;
}
