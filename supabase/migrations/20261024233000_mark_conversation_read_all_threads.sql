-- Opening a conversation marks both room messages and its hidden thread replies as read.
-- Keep the existing membership check and SECURITY DEFINER behavior.
create or replace function public.mark_chat_conversation_read(target_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_membership_id();
  read_at timestamptz := now();
begin
  if not public.is_chat_member(target_conversation_id, me) then
    raise exception 'Percakapan tidak dapat diakses.' using errcode = '42501';
  end if;

  update public.chat_conversation_members
  set last_read_at = read_at
  where conversation_id = target_conversation_id
    and membership_id = me;

  insert into public.chat_thread_reads(parent_message_id, membership_id, last_read_at)
  select parent.id, me, read_at
  from public.chat_messages parent
  where parent.conversation_id = target_conversation_id
    and parent.parent_message_id is null
    and exists (
      select 1
      from public.chat_messages reply
      where reply.parent_message_id = parent.id
        and reply.deleted_at is null
        and reply.sender_membership_id <> me
    )
  on conflict (parent_message_id, membership_id)
  do update set last_read_at = greatest(public.chat_thread_reads.last_read_at, excluded.last_read_at);
end;
$$;
