'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    ruangKawanDesktop?: {
      isDesktop: boolean;
      platform: string;
      chooseFile: () => Promise<string | null>;
      revealFile: (filePath: string) => Promise<boolean>;
      openExternal: (url: string) => Promise<boolean>;
      notify: (title: string, body?: string) => Promise<boolean>;
    };
  }
}

/** Bridges explicit app events to the sandboxed macOS shell when installed. */
export default function DesktopBridge() {
  useEffect(() => {
    if (!window.ruangKawanDesktop) return;
    document.documentElement.dataset.desktopApp = 'true';
    const notify = (event: Event) => {
      const detail = (event as CustomEvent<{ title?: string; body?: string }>).detail;
      if (detail?.title) void window.ruangKawanDesktop?.notify(detail.title, detail.body ?? '');
    };
    window.addEventListener('ruang-kawan-desktop-notification', notify);
    return () => {
      delete document.documentElement.dataset.desktopApp;
      window.removeEventListener('ruang-kawan-desktop-notification', notify);
    };
  }, []);
  return null;
}
