export type ToastNotice = { id?: string; title: string; message?: string | null; url?: string | null; kind?: 'info' | 'success' | 'error' };
export function notify(notice: ToastNotice) {
  window.dispatchEvent(new CustomEvent('kawan-toast', { detail: notice }));
}
export function workspaceUrl(value?: string | null) {
  if (!value || !value.startsWith('/ruang-kawan/') || value.startsWith('//') || value.includes('\\')) return '/ruang-kawan/notifications/';
  return value;
}
