create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.capture_canva_links_from_chat()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
 v_match text[];
 v_url text;
 v_normalized text;
 v_title text;
begin
 if tg_op = 'UPDATE' then
  delete from public.chat_canva_links where source_message_id = new.id;
 end if;
 if new.deleted_at is not null or new.body is null or btrim(new.body) = '' then return new; end if;
 v_title := nullif(left(btrim(regexp_replace(
  regexp_replace(new.body,'https?://(www\.)?(canva\.com/design/[^[:space:]<>"'']+|canva\.link/[^[:space:]<>"'']+)','','gi'),
  '[[:space:]]+',' ','g'
 )),140),'');
 for v_match in select regexp_matches(new.body,'(https?://(www\.)?(canva\.com/design/[^[:space:]<>"'']+|canva\.link/[^[:space:]<>"'']+))','gi') loop
  v_url := rtrim(v_match[1], '.,;!?)]}');
  v_normalized := lower(regexp_replace(split_part(split_part(v_url,'?',1),'#',1),'/(edit|view)/?$',''));
  if v_normalized like 'https://www.canva.com/%' then v_normalized := replace(v_normalized,'https://www.canva.com/','https://canva.com/'); end if;
  if v_normalized <> '' then
   insert into public.chat_canva_links(source_message_id,conversation_id,sender_membership_id,url,normalized_url,title_hint,shared_at)
   values(new.id,new.conversation_id,new.sender_membership_id,v_url,v_normalized,v_title,new.created_at)
   on conflict(source_message_id,normalized_url) do update set url=excluded.url,title_hint=coalesce(excluded.title_hint,public.chat_canva_links.title_hint),shared_at=excluded.shared_at;
  end if;
 end loop;
 return new;
end;
$function$;
revoke all on function private.capture_canva_links_from_chat() from public,anon,authenticated;
drop trigger if exists capture_canva_links_from_chat on public.chat_messages;
create trigger capture_canva_links_from_chat after insert or update of body,deleted_at on public.chat_messages
 for each row execute function private.capture_canva_links_from_chat();
