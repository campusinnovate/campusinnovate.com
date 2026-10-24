-- Keep ticket source documents on the original announcement and suppress thread text previews.
create or replace function public.attach_commercial_ticket_documents(
  target_ticket_id uuid,
  target_attachment_ids uuid[],
  target_document_links jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_membership_id();
  ticket public.commercial_ticket_records%rowtype;
  announcement public.chat_messages%rowtype;
  link_lines text;
  attached_count integer := 0;
begin
  if not public.current_user_has_permission('ticketing.manage') then
    raise exception 'Hanya BD atau CEO yang dapat melampirkan dokumen ticket.' using errcode='42501';
  end if;
  select * into ticket from public.commercial_ticket_records
    where id=target_ticket_id and deleted_at is null for update;
  if ticket.id is null or ticket.chat_message_id is null then
    raise exception 'Pengumuman ticket tidak ditemukan.';
  end if;
  select * into announcement from public.chat_messages where id=ticket.chat_message_id for update;
  if announcement.id is null or not public.is_chat_member(announcement.conversation_id,actor) then
    raise exception 'Percakapan Commercial tidak dapat diakses.' using errcode='42501';
  end if;

  if coalesce(cardinality(target_attachment_ids),0)>0 then
    select count(*) into attached_count from public.chat_attachments
      where id=any(target_attachment_ids)
        and conversation_id=announcement.conversation_id
        and uploader_membership_id=actor
        and message_id is null;
    if attached_count<>cardinality(target_attachment_ids) then
      raise exception 'Ada file yang tidak valid atau sudah dilampirkan.';
    end if;
    update public.chat_attachments set message_id=announcement.id
      where id=any(target_attachment_ids)
        and conversation_id=announcement.conversation_id
        and uploader_membership_id=actor
        and message_id is null;
  end if;

  if target_document_links is not null and jsonb_typeof(target_document_links) is distinct from 'array' then
    raise exception 'Format link dokumen tidak valid.';
  end if;
  select string_agg(
    coalesce(nullif(trim(value->>'label'),''),trim(value->>'url'))||': '||trim(value->>'url'),
    E'\n'
  ) into link_lines
  from jsonb_array_elements(coalesce(target_document_links,'[]'::jsonb)) value
  where coalesce(trim(value->>'url'),'') ~* '^https?://';

  if exists(
    select 1 from jsonb_array_elements(coalesce(target_document_links,'[]'::jsonb)) value
    where coalesce(trim(value->>'url'),'') !~* '^https?://'
  ) then
    raise exception 'Link dokumen harus menggunakan http atau https.';
  end if;

  if link_lines is not null then
    update public.chat_messages
      set body=concat_ws(E'\n\n',nullif(body,''),'📎 DOKUMEN PENDUKUNG'||E'\n'||link_lines),
          updated_at=now()
      where id=announcement.id;
  end if;
end;
$$;

create or replace function public.send_chat_message(
  target_conversation_id uuid,
  message_body text,
  reply_to_message_id uuid default null,
  attachment_ids uuid[] default '{}'::uuid[],
  mention_membership_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_membership_id();
  saved uuid;
  recipient uuid;
  effective_mentions uuid[] := coalesce(mention_membership_ids,'{}');
  mention_all boolean := lower(coalesce(message_body,'')) ~ '(^|[[:space:]])@all([[:space:][:punct:]]|$)';
  ticket_code_value text;
  is_ticket_thread boolean := false;
  notification_title text;
  notification_message text;
begin
  if not public.is_chat_member(target_conversation_id,me) then
    raise exception 'Percakapan tidak dapat diakses.' using errcode='42501';
  end if;
  if reply_to_message_id is not null and not exists(
    select 1 from public.chat_messages
    where id=reply_to_message_id and conversation_id=target_conversation_id and parent_message_id is null
  ) then
    raise exception 'Thread tidak valid.';
  end if;
  if reply_to_message_id is not null then
    select ticket_code into ticket_code_value
    from public.commercial_ticket_records
    where chat_message_id=reply_to_message_id and deleted_at is null
    limit 1;
    is_ticket_thread := ticket_code_value is not null;
  end if;
  if nullif(trim(message_body),'') is null and cardinality(coalesce(attachment_ids,'{}'))=0 then
    raise exception 'Pesan atau lampiran wajib diisi.';
  end if;
  if mention_all then
    select coalesce(array_agg(membership_id),'{}') into effective_mentions
    from public.chat_conversation_members
    where conversation_id=target_conversation_id and left_at is null and membership_id<>me;
  end if;
  insert into public.chat_messages(conversation_id,sender_membership_id,parent_message_id,body)
  values(target_conversation_id,me,reply_to_message_id,coalesce(trim(message_body),'')) returning id into saved;
  update public.chat_attachments set message_id=saved
    where id=any(coalesce(attachment_ids,'{}'))
      and conversation_id=target_conversation_id
      and uploader_membership_id=me
      and message_id is null;
  insert into public.chat_message_mentions(message_id,membership_id)
  select saved,cm.membership_id
  from public.chat_conversation_members cm
  where cm.conversation_id=target_conversation_id and cm.left_at is null
    and cm.membership_id=any(effective_mentions) and cm.membership_id<>me
  on conflict do nothing;

  for recipient in
    select cm.membership_id
    from public.chat_conversation_members cm
    where cm.conversation_id=target_conversation_id and cm.left_at is null
      and cm.membership_id<>me
      and (cm.notification_level='all' or cm.membership_id=any(effective_mentions))
  loop
    notification_title := case
      when is_ticket_thread and recipient=any(effective_mentions) then 'Kamu disebut pada thread ticket'
      when is_ticket_thread then 'Balasan baru di thread ticket'
      when recipient=any(effective_mentions) then
        case when mention_all then 'Semua anggota disebut di Kawan Chat' else 'Kamu disebut di Kawan Chat' end
      when reply_to_message_id is not null then 'Balasan baru di thread'
      else 'Pesan baru di Kawan Chat'
    end;
    notification_message := case
      when is_ticket_thread then 'Ada pesan baru pada ticket '||ticket_code_value
      else left(coalesce(nullif(trim(message_body),''),'Mengirim lampiran'),240)
    end;
    insert into public.notifications(
      recipient_membership_id,actor_membership_id,notification_type,title,message,
      entity_type,entity_id,action_url,priority,dedupe_key
    )
    values(
      recipient,me,
      case
        when recipient=any(effective_mentions) then
          case when mention_all then 'chat.mention_all' else 'chat.mention' end
        when reply_to_message_id is not null then 'chat.thread'
        else 'chat.message'
      end,
      notification_title,notification_message,'chat_conversation',target_conversation_id::text,
      '/ruang-kawan/chat/?conversation='||target_conversation_id,'normal',
      'chat-message:'||saved::text||':'||recipient::text
    )
    on conflict(recipient_membership_id,dedupe_key) where dedupe_key is not null do nothing;
  end loop;
  update public.chat_conversations set updated_at=now() where id=target_conversation_id;
  update public.chat_conversation_members set last_read_at=now()
    where conversation_id=target_conversation_id and membership_id=me;
  if reply_to_message_id is not null then
    insert into public.chat_thread_reads(parent_message_id,membership_id,last_read_at)
    values(reply_to_message_id,me,now())
    on conflict(parent_message_id,membership_id) do update set last_read_at=excluded.last_read_at;
  end if;
  return saved;
end;
$$;

revoke all on function public.attach_commercial_ticket_documents(uuid,uuid[],jsonb) from public,anon;
grant execute on function public.attach_commercial_ticket_documents(uuid,uuid[],jsonb) to authenticated;
revoke all on function public.send_chat_message(uuid,text,uuid,uuid[],uuid[]) from public,anon;
grant execute on function public.send_chat_message(uuid,text,uuid,uuid[],uuid[]) to authenticated;
