export function dayKey(value: string | number) {
  return new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

export function dayLabel(value: string, now = Date.now()) {
  if (dayKey(value) === dayKey(now)) return 'Hari ini';
  if (dayKey(value) === dayKey(now - 86_400_000)) return 'Kemarin';
  return new Date(value).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function meetingActive(meeting: { status: string; ends_at: string }, now: number) {
  return meeting.status === 'scheduled' && new Date(meeting.ends_at).getTime() > now;
}

export function safeUrl(value: string) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}

export function linkParts(body: string): { text: string; href?: string }[] {
  return body.split(/((?:https?:\/\/|www\.)[^\s<>]+)/gi).flatMap((text) => {
    if (!/^(https?:\/\/|www\.)/i.test(text)) return [{ text }];
    let trimmed = text.replace(/[.,!?;:]+$/, '');
    while (trimmed.endsWith(')') && (trimmed.match(/\)/g)?.length ?? 0) > (trimmed.match(/\(/g)?.length ?? 0)) trimmed = trimmed.slice(0, -1);
    const href = safeUrl(/^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed);
    return href ? [{ text: trimmed, href }, { text: text.slice(trimmed.length) }] : [{ text }];
  });
}

export function driveFileId(value: string) {
  const safe = safeUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  if (!['drive.google.com', 'docs.google.com'].includes(url.hostname)) return null;
  const id = url.pathname.match(/\/d\/([\w-]+)/)?.[1] ?? url.searchParams.get('id');
  return id && /^[\w-]+$/.test(id) ? id : null;
}
