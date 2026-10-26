alter table public.chat_canva_links
  add column if not exists design_title text;

update public.chat_canva_links
set design_title = case substring(coalesce(preview_url, url) from '/design/([^/]+)')
  when 'DAHTX2iyRkk' then 'Coreva · Ekosistem Organisasi Mahasiswa IPB'
  when 'DAHUBiqfL3E' then 'IPB Connect · Product Flow & Experience Design'
  when 'DAHUnoAP0cY' then 'Noortura Open House 2026'
  when 'DAHUt6xP2xg' then 'Layout Podcast LPPOM'
  when 'DAHUZc3Lp7Q' then 'IPB Connect · Alumni Service Flow'
  when 'DAHV1dSy6l0' then 'Outing · 2 Hari 1 Malam'
  when 'DAHVoWF9PNQ' then 'Customer Service & Ticketing Transformation'
  when 'DAHVu0ZIiAg' then 'Optima ERP & Business Operating System'
  when 'DAHX9Z1Kdgk' then 'Campus Innovate Company Profile'
  when 'DAHXGgnvqvs' then 'Campus Activation Permit & Site Sourcing'
  when 'DAHXPWQCQrU' then 'B-Bright Invoice Management System'
  when 'DAHYD0KaHG4' then 'Noortura Attendance Management System'
  else design_title
end
where substring(coalesce(preview_url, url) from '/design/([^/]+)') in (
  'DAHTX2iyRkk','DAHUBiqfL3E','DAHUnoAP0cY','DAHUt6xP2xg','DAHUZc3Lp7Q','DAHV1dSy6l0',
  'DAHVoWF9PNQ','DAHVu0ZIiAg','DAHX9Z1Kdgk','DAHXGgnvqvs','DAHXPWQCQrU','DAHYD0KaHG4'
);

create or replace function public.marketing_canva_library()
returns table (
  id uuid,
  url text,
  preview_url text,
  design_title text,
  normalized_url text,
  title_hint text,
  shared_at timestamptz,
  sender_name text,
  conversation_name text,
  share_count bigint,
  last_shared_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.current_user_has_permission('marketing.proposal.view') then
    raise exception 'Not authorized to view the Canva library' using errcode = '42501';
  end if;

  return query
  with base as (
    select c.id, c.url, c.preview_url, c.design_title, c.normalized_url, c.title_hint, c.shared_at,
      coalesce(mem.full_name, 'Anggota Kawan') as sender_name,
      coalesce(conv.name, 'Ruang Kawan') as conversation_name,
      coalesce('design:' || substring(coalesce(c.preview_url, c.url) from '/design/([^/]+)'), c.normalized_url) as design_key
    from public.chat_canva_links c
    join public.chat_messages m on m.id = c.source_message_id and m.deleted_at is null
    left join public.memberships mem on mem.id = c.sender_membership_id
    left join public.chat_conversations conv on conv.id = c.conversation_id
  ), grouped as (
    select b.design_key, count(*)::bigint as share_count, max(b.shared_at) as last_shared_at
    from base b group by b.design_key
  ), latest as (
    select distinct on (b.design_key) b.id, b.url, b.preview_url, b.design_title, b.design_key,
      b.title_hint, b.shared_at, b.sender_name, b.conversation_name
    from base b order by b.design_key, b.shared_at desc
  )
  select l.id, l.url,
    coalesce(l.preview_url, (
      select b2.preview_url from base b2 where b2.design_key = l.design_key and b2.preview_url is not null
      order by b2.shared_at desc limit 1
    )),
    coalesce(l.design_title, (
      select b2.design_title from base b2 where b2.design_key = l.design_key and b2.design_title is not null
      order by b2.shared_at desc limit 1
    )),
    l.design_key, l.title_hint, l.shared_at, l.sender_name, l.conversation_name,
    g.share_count, g.last_shared_at
  from latest l join grouped g using (design_key)
  order by g.last_shared_at desc;
end;
$function$;

revoke all on function public.marketing_canva_library() from public, anon;
grant execute on function public.marketing_canva_library() to authenticated;
