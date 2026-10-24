-- Keep chat membership and history intact while giving each member sidebar-only archive/delete controls.
alter table public.chat_conversation_members
  add column if not exists archived_at timestamptz,
  add column if not exists hidden_at timestamptz;

-- Wrap the existing workspace payload so legacy unread/mention calculations remain intact.
alter function public.chat_workspace() rename to chat_workspace_legacy;

create or replace function public.chat_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  payload jsonb;
  conversations_value jsonb;
  unread_value integer;
  mentions_value integer;
begin
  payload:=public.chat_workspace_legacy();
  select coalesce(jsonb_agg(
    item || jsonb_build_object('archived',(cm.archived_at is not null or c.archived_at is not null))
    order by (cm.archived_at is not null or c.archived_at is not null), ordinal
  ),'[]'::jsonb)
  into conversations_value
  from jsonb_array_elements(coalesce(payload->'conversations','[]'::jsonb)) with ordinality as items(item,ordinal)
  join public.chat_conversations c on c.id=(item->>'id')::uuid
  join public.chat_conversation_members cm on cm.conversation_id=c.id and cm.membership_id=public.current_membership_id() and cm.left_at is null
  where cm.hidden_at is null
    and not (c.archived_at is not null and c.name ~ ' - CI-TKT-[0-9]{4}-[0-9]{6}$');

  select coalesce(sum((item->>'unread_count')::integer),0),
         coalesce(sum((item->>'mention_count')::integer),0)
  into unread_value,mentions_value
  from jsonb_array_elements(conversations_value) as listed(item)
  where coalesce((item->>'archived')::boolean,false)=false;

  payload:=jsonb_set(payload,'{conversations}',conversations_value,true);
  payload:=jsonb_set(payload,'{unread_total}',to_jsonb(unread_value),true);
  payload:=jsonb_set(payload,'{mentions_total}',to_jsonb(mentions_value),true);
  return payload;
end;
$$;

create or replace function public.set_chat_conversation_archived(target_conversation_id uuid,should_archive boolean)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare me uuid:=public.current_membership_id();
begin
  if not public.is_chat_member(target_conversation_id,me) then
    raise exception 'Percakapan tidak dapat diakses.' using errcode='42501';
  end if;
  update public.chat_conversation_members
  set archived_at=case when should_archive then now() else null end,
      hidden_at=null
  where conversation_id=target_conversation_id and membership_id=me and left_at is null;
end;
$$;

create or replace function public.hide_chat_conversation_for_me(target_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare me uuid:=public.current_membership_id();
begin
  if not public.is_chat_member(target_conversation_id,me) then
    raise exception 'Percakapan tidak dapat diakses.' using errcode='42501';
  end if;
  update public.chat_conversation_members
  set hidden_at=now(),archived_at=null
  where conversation_id=target_conversation_id and membership_id=me and left_at is null;
end;
$$;

-- Apply the new client-first room name to all existing ticket rooms.
update public.chat_conversations c
set name=t.client_name||' - '||t.ticket_code
from public.commercial_ticket_records t
where c.id=t.discussion_conversation_id;

-- New tickets use the same name while keeping the PIC room hidden until a ticket thread is answered.
create or replace function public.create_commercial_ticket_record(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  result jsonb;
  ticket_id uuid;
  discussion_id uuid;
  client_value text;
  ticket_code_value text;
begin
  result:=public.create_commercial_ticket_record_legacy(payload);
  ticket_id:=nullif(result->>'ticket_id','')::uuid;
  discussion_id:=nullif(result->>'discussion_conversation_id','')::uuid;
  select client_name,ticket_code into client_value,ticket_code_value
  from public.commercial_ticket_records where id=ticket_id;
  if discussion_id is not null then
    update public.chat_conversations
    set name=client_value||' - '||ticket_code_value,archived_at=now()
    where id=discussion_id;
  end if;
  return result;
end;
$$;

-- Edited PICs stay visible as actual mention records, join the announcement room, and get notified.
alter function public.update_commercial_ticket_record(uuid,jsonb) rename to update_commercial_ticket_record_legacy;

create or replace function public.update_commercial_ticket_record(target_ticket_id uuid,payload jsonb)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid:=public.current_membership_id();
  ticket public.commercial_ticket_records%rowtype;
  announcement_room uuid;
  mention_ids uuid[];
  pic_id uuid;
begin
  perform public.update_commercial_ticket_record_legacy(target_ticket_id,payload);
  select * into ticket from public.commercial_ticket_records where id=target_ticket_id and deleted_at is null;
  if ticket.id is null or ticket.chat_message_id is null then return; end if;
  select conversation_id into announcement_room from public.chat_messages where id=ticket.chat_message_id;

  delete from public.chat_message_mentions where message_id=ticket.chat_message_id;
  select coalesce(array_agg(distinct membership_id),'{}'::uuid[])
  into mention_ids from public.commercial_ticket_record_pics where ticket_id=ticket.id;

  foreach pic_id in array mention_ids loop
    insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level,last_read_at)
    values(announcement_room,pic_id,'member','mentions',now())
    on conflict(conversation_id,membership_id) do update set left_at=null,joined_at=now(),notification_level='mentions';
    insert into public.chat_message_mentions(message_id,membership_id)
    values(ticket.chat_message_id,pic_id) on conflict do nothing;

    if pic_id<>actor then
      insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority,dedupe_key)
      values(pic_id,actor,'chat.mention','Kamu disebut di Kawan Chat',
        left('Kamu ditag sebagai PIC ticket '||ticket.ticket_code||' · '||ticket.client_name,240),
        'chat_conversation',announcement_room::text,
        '/ruang-kawan/chat/?conversation='||announcement_room::text||'&thread='||ticket.chat_message_id::text,
        'normal','chat-message:'||ticket.chat_message_id::text||':'||pic_id::text)
      on conflict(recipient_membership_id,dedupe_key) where dedupe_key is not null do nothing;
    end if;
  end loop;
end;
$$;

revoke all on function public.chat_workspace_legacy() from public,anon,authenticated;
revoke all on function public.update_commercial_ticket_record_legacy(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.create_commercial_ticket_record_legacy(jsonb) from public,anon,authenticated;
revoke all on function public.chat_workspace() from public,anon;
grant execute on function public.chat_workspace() to authenticated;
revoke all on function public.set_chat_conversation_archived(uuid,boolean) from public,anon;
grant execute on function public.set_chat_conversation_archived(uuid,boolean) to authenticated;
revoke all on function public.hide_chat_conversation_for_me(uuid) from public,anon;
grant execute on function public.hide_chat_conversation_for_me(uuid) to authenticated;
revoke all on function public.update_commercial_ticket_record(uuid,jsonb) from public,anon;
grant execute on function public.update_commercial_ticket_record(uuid,jsonb) to authenticated;
revoke all on function public.create_commercial_ticket_record(jsonb) from public,anon;
grant execute on function public.create_commercial_ticket_record(jsonb) to authenticated;
