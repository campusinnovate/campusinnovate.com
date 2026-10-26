drop function public.marketing_canva_library();
create function public.marketing_canva_library()
returns table (
 id uuid,url text,preview_url text,normalized_url text,title_hint text,shared_at timestamptz,
 sender_name text,conversation_name text,share_count bigint,last_shared_at timestamptz
)
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
  select distinct on(c.normalized_url) c.id,c.url,c.preview_url,c.normalized_url,c.title_hint,c.shared_at,
   coalesce(mem.full_name,'Anggota Kawan') as sender_name,coalesce(conv.name,'Ruang Kawan') as conversation_name
  from public.chat_canva_links c join public.chat_messages m on m.id=c.source_message_id and m.deleted_at is null
  left join public.memberships mem on mem.id=c.sender_membership_id
  left join public.chat_conversations conv on conv.id=c.conversation_id
  order by c.normalized_url,c.shared_at desc
 )
 select l.id,l.url,coalesce(l.preview_url,(
   select c2.preview_url from public.chat_canva_links c2 join public.chat_messages m2 on m2.id=c2.source_message_id and m2.deleted_at is null
   where c2.normalized_url=l.normalized_url and c2.preview_url is not null order by c2.shared_at desc limit 1
  )),l.normalized_url,l.title_hint,l.shared_at,l.sender_name,l.conversation_name,g.share_count,g.last_shared_at
 from latest l join grouped g using(normalized_url) order by g.last_shared_at desc;
end;
$function$;
grant execute on function public.marketing_canva_library() to authenticated;
