-- Preserve per-thread unread state in workspace counts and notify Commercial members without exposing thread text.
create or replace function public.chat_workspace_legacy()
returns jsonb language sql stable security definer set search_path=public as $$
with me as(select public.current_membership_id() id), accessible as(
 select c.*,cm.starred_at,cm.last_read_at,
  case when c.kind='direct' then coalesce((select coalesce(m.full_name,m.email::text) from public.chat_conversation_members peer join public.memberships m on m.id=peer.membership_id where peer.conversation_id=c.id and peer.membership_id<>me.id and peer.left_at is null limit 1),c.name,'Pesan langsung') else c.name end display_name,
  case when c.kind='direct' then (select p.avatar_url from public.chat_conversation_members peer join public.memberships m on m.id=peer.membership_id left join public.profiles p on p.user_id=m.user_id where peer.conversation_id=c.id and peer.membership_id<>me.id and peer.left_at is null limit 1) else c.avatar_url end display_avatar
 from public.chat_conversations c join public.chat_conversation_members cm on cm.conversation_id=c.id cross join me
 where cm.membership_id=me.id and cm.left_at is null and c.deleted_at is null
), rows as(
 select a.id,a.display_name name,a.kind,a.display_avatar avatar_url,a.starred_at is not null starred,
  (select count(*) from public.chat_conversation_members x where x.conversation_id=a.id and x.left_at is null) member_count,
  lm.body last_message,lm.created_at last_message_at,
  (select count(*) from public.chat_messages um
   left join public.chat_thread_reads utr on utr.parent_message_id=um.parent_message_id and utr.membership_id=(select id from me)
   where um.conversation_id=a.id and um.deleted_at is null and um.sender_membership_id<>(select id from me)
     and ((um.parent_message_id is null and um.created_at>coalesce(a.last_read_at,'epoch'::timestamptz))
       or (um.parent_message_id is not null and um.created_at>coalesce(utr.last_read_at,'epoch'::timestamptz)))) unread_count,
  (select count(*) from public.chat_message_mentions mn join public.chat_messages mm on mm.id=mn.message_id where mm.conversation_id=a.id and mn.membership_id=(select id from me) and mm.deleted_at is null and mm.created_at>coalesce(a.last_read_at,'epoch'::timestamptz)) mention_count
 from accessible a left join lateral(select body,created_at from public.chat_messages where conversation_id=a.id and deleted_at is null order by created_at desc limit 1) lm on true
)
select jsonb_build_object(
 'conversations',coalesce((select jsonb_agg(to_jsonb(rows) order by starred desc,last_message_at desc nulls last) from rows),'[]'::jsonb),
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(m.full_name,m.email::text),'email',m.email,'avatar_url',p.avatar_url,'position_name',pos.name) order by coalesce(m.full_name,m.email::text)) from public.memberships m left join public.profiles p on p.user_id=m.user_id left join public.positions pos on pos.id=m.position_id where m.status='active'),'[]'::jsonb),
 'me',(select jsonb_build_object('id',m.id,'name',coalesce(m.full_name,m.email::text),'email',m.email,'avatar_url',p.avatar_url) from public.memberships m left join public.profiles p on p.user_id=m.user_id where m.id=(select id from me)),
 'unread_total',coalesce((select sum(unread_count) from rows),0),
 'mentions_total',coalesce((select sum(mention_count) from rows),0)
);
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
  is_commercial_room boolean := false;
  notification_title text;
  notification_message text;
begin
  if not public.is_chat_member(target_conversation_id,me) then
    raise exception 'Percakapan tidak dapat diakses.' using errcode='42501';
  end if;
  select exists(select 1 from public.chat_conversations c where c.id=target_conversation_id and lower(trim(c.name))='commercial & handover') into is_commercial_room;
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
      and (cm.notification_level='all' or cm.membership_id=any(effective_mentions) or is_commercial_room)
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
      when is_commercial_room and reply_to_message_id is not null then 'Percakapan ticket diperbarui'
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
