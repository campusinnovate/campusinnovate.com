-- Review-only recovery: preserve DEV data, revoke endpoints and Storage through the enabled flag.
begin;
update finance_pilot_dev_private.settings set enabled=false;
do $$ declare f record; begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'finance_pilot_dev_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.sig);
 end loop;
end $$;
commit;
