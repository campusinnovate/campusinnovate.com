do $publication$
begin
 if not exists (
  select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename='chat_canva_links'
 ) then
  alter publication supabase_realtime add table public.chat_canva_links;
 end if;
end;
$publication$;
