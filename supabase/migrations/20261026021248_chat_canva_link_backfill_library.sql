insert into public.chat_canva_links(source_message_id,conversation_id,sender_membership_id,url,normalized_url,title_hint,shared_at)
select m.id,m.conversation_id,m.sender_membership_id,
 rtrim(link[1], '.,;!?)]}'),
 replace(lower(regexp_replace(split_part(split_part(rtrim(link[1], '.,;!?)]}'),'?',1),'#',1),'/(edit|view)/?$','')),'https://www.canva.com/','https://canva.com/'),
 nullif(left(btrim(regexp_replace(regexp_replace(m.body,'https?://(www\.)?(canva\.com/design/[^[:space:]<>"'']+|canva\.link/[^[:space:]<>"'']+)','','gi'),'[[:space:]]+',' ','g')),140),''),
 m.created_at
from public.chat_messages m
cross join lateral regexp_matches(m.body,'(https?://(www\.)?(canva\.com/design/[^[:space:]<>"'']+|canva\.link/[^[:space:]<>"'']+))','gi') as link
where m.deleted_at is null
on conflict(source_message_id,normalized_url) do nothing;

create or replace function public.marketing_canva_library()
returns table(id uuid,url text,normalized_url text,title_hint text,shared_at timestamptz,sender_name text,conversation_name text,share_count bigint,last_shared_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $function$
begin
 if auth.uid() is null or not public.current_user_has_permission('marketing.proposal.view') then
  raise exception 'Not authorized to view the Canva library' using errcode='42501';
 end if;
 return query
 with grouped as (
  select c.normalized_url,count(*)::bigint as share_count,max(c.shared_at) as last_shared_at
  from public.chat_canva_links c join public.chat_messages m on m.id=c.source_message_id and m.deleted_at is null
  group by c.normalized_url
 ), latest as (
  select distinct on(c.normalized_url) c.id,c.url,c.normalized_url,c.title_hint,c.shared_at,
   coalesce(mem.full_name,'Anggota Kawan') as sender_name,coalesce(conv.name,'Ruang Kawan') as conversation_name
  from public.chat_canva_links c join public.chat_messages m on m.id=c.source_message_id and m.deleted_at is null
  left join public.memberships mem on mem.id=c.sender_membership_id
  left join public.chat_conversations conv on conv.id=c.conversation_id
  order by c.normalized_url,c.shared_at desc
 )
 select l.id,l.url,l.normalized_url,l.title_hint,l.shared_at,l.sender_name,l.conversation_name,g.share_count,g.last_shared_at
 from latest l join grouped g using(normalized_url) order by g.last_shared_at desc;
end;
$function$;
revoke all on function public.marketing_canva_library() from public,anon;
grant execute on function public.marketing_canva_library() to authenticated;
