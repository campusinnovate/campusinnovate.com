-- Normalize existing PIC-room ticket cards to the clean structured announcement format.
update public.chat_messages dm
set body=regexp_replace(
  replace(
    replace(cm.body,
      'Update singkat bisa di thread pengumuman ini.',
      'Percakapan teknis dan handover berlangsung di ruang ini.'),
    'Balas pada thread pengumuman ini untuk memulai chat teknis bersama PIC.',
    'Percakapan teknis dan handover berlangsung di ruang ini.'),
  E'🛠️ DISKUSI TEKNIS & HANDOVER\n[^\n]+\n?','','g'),
  updated_at=now()
from public.commercial_ticket_records t
join public.chat_messages cm on cm.id=t.chat_message_id
where dm.id=t.discussion_message_id
  and t.deleted_at is null;