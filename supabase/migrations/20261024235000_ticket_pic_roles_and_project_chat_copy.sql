-- Expand ticket PIC roles, show the full commercial ticket card in its PIC room,
-- mirror ticket files/links into that room, and reserve the next numbers requested.
alter table public.commercial_ticket_records
  add column if not exists discussion_message_id uuid references public.chat_messages(id) on delete set null;

alter table public.commercial_ticket_record_pics
  drop constraint if exists commercial_ticket_record_pics_pic_role_check;
alter table public.commercial_ticket_record_pics
  add constraint commercial_ticket_record_pics_pic_role_check
  check (pic_role in ('account_manager','operations','sales','marketing','social_media_specialist','coo','cto','hr','other','business_development','project_leader','content_marketing'));

-- Backfill the ticket announcement message id for existing PIC rooms.
update public.commercial_ticket_records t
set discussion_message_id = (
  select m.id
  from public.chat_messages m
  where m.conversation_id=t.discussion_conversation_id
    and m.parent_message_id is null
    and m.sender_membership_id=t.created_by_membership_id
    and (m.body like '🛠️ RUANG DISKUSI TIKET%' or m.body like '🎫 TICKET BARU%')
  order by m.created_at asc
  limit 1
)
where t.discussion_message_id is null
  and t.discussion_conversation_id is not null
  and t.deleted_at is null;

-- Align the PIC room's opening message to the same structured card as Commercial.
update public.chat_messages dm
set body=replace(cm.body,
  'Balas pada thread pengumuman ini untuk memulai chat teknis bersama PIC.',
  'Percakapan teknis dan handover berlangsung di ruang ini.'),
  updated_at=now()
from public.commercial_ticket_records t
join public.chat_messages cm on cm.id=t.chat_message_id
where dm.id=t.discussion_message_id and t.deleted_at is null;

-- Copy existing uploaded files to the matching PIC room so the file archive can find them there.
insert into public.chat_attachments(conversation_id,message_id,uploader_membership_id,document_id,drive_file_id,file_name,file_url,mime_type,size_bytes)
select t.discussion_conversation_id,t.discussion_message_id,a.uploader_membership_id,a.document_id,a.drive_file_id,a.file_name,a.file_url,a.mime_type,a.size_bytes
from public.commercial_ticket_records t
join public.chat_attachments a on a.message_id=t.chat_message_id
where t.deleted_at is null and t.discussion_message_id is not null
  and not exists(
    select 1 from public.chat_attachments existing
    where existing.message_id=t.discussion_message_id and existing.file_url=a.file_url and existing.file_name=a.file_name
  );

-- Ticket codes are renumbered by client name so internal IDs and links remain unchanged.
do $$
declare feriul uuid; finku uuid; old_fer text; old_finku text;
begin
  select id,ticket_code into feriul,old_fer
  from public.commercial_ticket_records
  where deleted_at is null and client_name='Feriulhadiiii (@feriulhadi_)';
  select id,ticket_code into finku,old_finku
  from public.commercial_ticket_records
  where deleted_at is null and client_name='Finku';
  if feriul is null or finku is null then raise exception 'Ticket Feriulhadi atau Finku tidak ditemukan; nomor tidak diubah.'; end if;
  if (select count(*) from public.commercial_ticket_records where deleted_at is null and client_name='Feriulhadiiii (@feriulhadi_)')<>1
     or (select count(*) from public.commercial_ticket_records where deleted_at is null and client_name='Finku')<>1 then
    raise exception 'Nama client tidak unik; nomor tiket tidak diubah.';
  end if;
  if exists(select 1 from public.commercial_ticket_records where ticket_code in ('CI-TKT-2026-000020','CI-TKT-2026-000021') and id not in (feriul,finku)) then
    raise exception 'Nomor 000020 atau 000021 sudah dipakai tiket lain.';
  end if;
  update public.commercial_ticket_records set ticket_code='CI-TKT-2026-000020' where id=feriul;
  update public.commercial_ticket_records set ticket_code='CI-TKT-2026-000021' where id=finku;

  update public.chat_conversations set name=replace(name,old_fer,'CI-TKT-2026-000020') where id=(select discussion_conversation_id from public.commercial_ticket_records where id=feriul);
  update public.chat_conversations set name=replace(name,old_finku,'CI-TKT-2026-000021') where id=(select discussion_conversation_id from public.commercial_ticket_records where id=finku);

  update public.chat_messages set body=replace(body,old_fer,'CI-TKT-2026-000020') where body like '%'||old_fer||'%';
  update public.chat_messages set body=replace(body,old_finku,'CI-TKT-2026-000021') where body like '%'||old_finku||'%';

  update public.chat_relations set title='CI-TKT-2026-000020',metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{ticket_code}','"CI-TKT-2026-000020"'::jsonb,true)
    where relation_id=feriul;
  update public.chat_relations set title='CI-TKT-2026-000021',metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{ticket_code}','"CI-TKT-2026-000021"'::jsonb,true)
    where relation_id=finku;
end $$;

-- Preserve the requested sequence: Finku is 21, so the next issued ticket is 22.
select setval(
  'public.commercial_ticket_record_seq',
  greatest(21, (select coalesce(max(right(ticket_code,6)::bigint),0) from public.commercial_ticket_records)),
  true
);