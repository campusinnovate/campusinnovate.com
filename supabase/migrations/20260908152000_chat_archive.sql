alter table public.chat_meetings add column if not exists google_connection_id uuid references public.google_calendar_connections(id) on delete set null;
create or replace function public.chat_archive(target_conversation_id uuid, page_offset integer default 0, search_text text default '')
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.is_chat_member(target_conversation_id) then raise exception 'Percakapan tidak dapat diakses.' using errcode='42501';end if;
 return jsonb_build_object('messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at desc,m.id) from (
 select msg.id,msg.body,msg.created_at,coalesce(mem.full_name,mem.email::text) sender_name,
 coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.file_name,'url',a.file_url,'mime_type',a.mime_type)) from public.chat_attachments a where a.message_id=msg.id),'[]'::jsonb) attachments
 from public.chat_messages msg join public.memberships mem on mem.id=msg.sender_membership_id
 where msg.conversation_id=target_conversation_id and msg.deleted_at is null
 and (msg.body ~* '(https?://|www\.)' or exists(select 1 from public.chat_attachments a where a.message_id=msg.id))
 and (search_text='' or msg.body ilike '%'||search_text||'%' or exists(select 1 from public.chat_attachments a where a.message_id=msg.id and a.file_name ilike '%'||search_text||'%'))
 order by msg.created_at desc,msg.id limit 50 offset greatest(0,page_offset)
 )m),'[]'::jsonb),
 'relations',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.chat_relations r where r.conversation_id=target_conversation_id),'[]'::jsonb));
end;$$;
revoke all on function public.chat_archive(uuid,integer,text) from public,anon;
grant execute on function public.chat_archive(uuid,integer,text) to authenticated;
