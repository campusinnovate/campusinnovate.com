-- Forward a snapshot; never move the original message or its attachments.
create or replace function public.forward_chat_message(source_message_id uuid, target_conversation_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  actor uuid := public.current_membership_id();
  source public.chat_messages%rowtype;
  copied_attachment_ids uuid[] := '{}';
  saved uuid;
begin
  select * into source from public.chat_messages where id = source_message_id for share;
  if source.id is null or source.deleted_at is not null
    or not public.is_chat_member(source.conversation_id, actor)
    or not public.is_chat_member(target_conversation_id, actor) then
    raise exception 'Pesan atau percakapan tidak dapat diakses.' using errcode = '42501';
  end if;

  -- Preserve Drive permissions: forwarding does not grant file access.
  with copied as (
    insert into public.chat_attachments
      (conversation_id, uploader_membership_id, drive_file_id, file_name, file_url, mime_type, size_bytes)
    select target_conversation_id, actor, drive_file_id, file_name, file_url, mime_type, size_bytes
    from public.chat_attachments where message_id = source.id
    returning id
  ) select coalesce(array_agg(id), '{}'::uuid[]) into copied_attachment_ids from copied;

  saved := public.send_chat_message(target_conversation_id,
    '↪ Diteruskan' || E'\n' || source.body, null, copied_attachment_ids, '{}'::uuid[]);
  return saved;
end;
$$;
revoke all on function public.forward_chat_message(uuid, uuid) from public, anon;
grant execute on function public.forward_chat_message(uuid, uuid) to authenticated;
