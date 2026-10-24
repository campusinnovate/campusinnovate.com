-- Keep ticket announcement threads and PIC room conversations in sync.
create table if not exists public.chat_ticket_message_mirrors (
  source_message_id uuid primary key references public.chat_messages(id) on delete cascade,
  mirror_message_id uuid not null unique references public.chat_messages(id) on delete cascade,
  ticket_id uuid not null references public.commercial_ticket_records(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.chat_ticket_message_mirrors enable row level security;
revoke all on public.chat_ticket_message_mirrors from public, anon, authenticated;

create or replace function public.ticket_discussion_parent(target_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  me uuid := public.current_membership_id();
begin
  if not public.is_chat_member(target_conversation_id,me) then
    raise exception 'Percakapan tidak dapat diakses.' using errcode='42501';
  end if;
  select jsonb_build_object('conversation_id',t.chat_message_conversation_id,'message_id',t.chat_message_id)
    into result
  from (
    select r.*,m.conversation_id as chat_message_conversation_id
    from public.commercial_ticket_records r
    join public.chat_messages m on m.id=r.chat_message_id
    where r.discussion_conversation_id=target_conversation_id and r.deleted_at is null
    limit 1
  ) t;
  return result;
end;
$$;

create or replace function public.ensure_ticket_discussion_for_thread_reply(target_reply_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_membership_id();
  parent_id uuid;
  group_id uuid;
  room_id uuid;
  mirror_id uuid;
  ticket public.commercial_ticket_records%rowtype;
  reply public.chat_messages%rowtype;
  mentions uuid[];
  attachment_text text;
begin
  select * into reply from public.chat_messages where id=target_reply_id and deleted_at is null;
  if reply.id is null or reply.sender_membership_id<>me or reply.parent_message_id is null then
    raise exception 'Balasan tiket tidak valid.' using errcode='42501';
  end if;
  parent_id := reply.parent_message_id;
  select conversation_id into group_id from public.chat_messages where id=parent_id and parent_message_id is null;
  if not public.is_chat_member(group_id,me) then
    raise exception 'Percakapan tidak dapat diakses.' using errcode='42501';
  end if;
  select t.* into ticket from public.commercial_ticket_records t
    where t.chat_message_id=parent_id and t.deleted_at is null for update;
  if ticket.id is null then return null; end if;
  select mirror_message_id into mirror_id from public.chat_ticket_message_mirrors where source_message_id=reply.id;
  if mirror_id is not null then return ticket.discussion_conversation_id; end if;

  room_id := ticket.discussion_conversation_id;
  if room_id is null then
    insert into public.chat_conversations(name,kind,created_by_membership_id)
    values('Ticket · '||ticket.ticket_code||' · '||left(ticket.client_name,72),'private',ticket.created_by_membership_id)
    returning id into room_id;
    insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level,last_read_at)
    values(room_id,ticket.created_by_membership_id,'owner','all',now())
    on conflict(conversation_id,membership_id) do update set left_at=null;
    insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level,last_read_at)
    select room_id,p.membership_id,'member','all',now()
    from public.commercial_ticket_record_pics p where p.ticket_id=ticket.id
    on conflict(conversation_id,membership_id) do update set left_at=null,notification_level='all';
    update public.commercial_ticket_records set discussion_conversation_id=room_id where id=ticket.id;
  end if;
  update public.chat_conversations set archived_at=null,deleted_at=null,updated_at=now() where id=room_id;
  insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level,last_read_at)
    values(room_id,me,'member','all',now())
    on conflict(conversation_id,membership_id) do update set left_at=null,notification_level='all';
  select coalesce(array_agg(membership_id),'{}'::uuid[]) into mentions
    from public.chat_message_mentions where message_id=reply.id;
  select string_agg('📎 '||a.file_name||': '||a.file_url,E'\n') into attachment_text
    from public.chat_attachments a where a.message_id=reply.id;
  mirror_id := public.send_chat_message(room_id,
    reply.body||case when attachment_text is null then '' else E'\n'||attachment_text end,
    null,'{}'::uuid[],mentions);
  insert into public.chat_ticket_message_mirrors(source_message_id,mirror_message_id,ticket_id)
    values(reply.id,mirror_id,ticket.id) on conflict(source_message_id) do nothing;
  return room_id;
end;
$$;

create or replace function public.mirror_ticket_discussion_message(target_message_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_membership_id();
  msg public.chat_messages%rowtype;
  ticket public.commercial_ticket_records%rowtype;
  mirror_id uuid;
  mentions uuid[];
  attachment_text text;
begin
  select * into msg from public.chat_messages where id=target_message_id and deleted_at is null;
  if msg.id is null or msg.sender_membership_id<>me then
    raise exception 'Pesan tidak valid.' using errcode='42501';
  end if;
  select * into ticket from public.commercial_ticket_records
    where discussion_conversation_id=msg.conversation_id and deleted_at is null limit 1;
  if ticket.id is null or not public.is_chat_member(msg.conversation_id,me) then
    raise exception 'Pesan bukan bagian dari ruang PIC ticket.' using errcode='42501';
  end if;
  select mirror_message_id into mirror_id from public.chat_ticket_message_mirrors where source_message_id=msg.id;
  if mirror_id is not null then return mirror_id; end if;
  select coalesce(array_agg(membership_id),'{}'::uuid[]) into mentions
    from public.chat_message_mentions where message_id=msg.id;
  select string_agg('📎 '||a.file_name||': '||a.file_url,E'\n') into attachment_text
    from public.chat_attachments a where a.message_id=msg.id;
  mirror_id := public.send_chat_message(
    (select conversation_id from public.chat_messages where id=ticket.chat_message_id),
    msg.body||case when attachment_text is null then '' else E'\n'||attachment_text end,
    ticket.chat_message_id,'{}'::uuid[],mentions);
  insert into public.chat_ticket_message_mirrors(source_message_id,mirror_message_id,ticket_id)
    values(msg.id,mirror_id,ticket.id) on conflict(source_message_id) do nothing;
  return mirror_id;
end;
$$;

revoke all on function public.ticket_discussion_parent(uuid) from public, anon;
revoke all on function public.mirror_ticket_discussion_message(uuid) from public, anon;
revoke all on function public.ensure_ticket_discussion_for_thread_reply(uuid) from public, anon;
grant execute on function public.ticket_discussion_parent(uuid) to authenticated;
grant execute on function public.mirror_ticket_discussion_message(uuid) to authenticated;
grant execute on function public.ensure_ticket_discussion_for_thread_reply(uuid) to authenticated;
