-- Historical leads may belong to now-inactive staff. Preserve the owner on
-- normal edits; require an active staff account only for new assignments.
do $migration$
declare definition text;
  lookup text := '    select * into existing from public.pipeline_leads where id=pipeline_lead_id for update;';
  original_check text := 'if not exists(select 1 from public.memberships m where m.id=owner_id and m.status=''active'') then raise exception ''Owner Pipeline BD tidak valid.''; end if;';
begin
  select pg_get_functiondef('public.save_pipeline_lead(uuid,jsonb)'::regprocedure) into definition;
  if position(lookup in definition)=0 or position(original_check in definition)=0 then
    raise exception 'Unexpected save_pipeline_lead definition; migration not applied';
  end if;
  definition:=replace(definition,lookup,lookup||E'\n    select a.owner_membership_id into existing_owner_id from public.activities a where a.id=existing.activity_id;');
  definition:=replace(definition,original_check,
    'if (pipeline_lead_id is null or owner_id is distinct from existing_owner_id) and not exists(select 1 from public.memberships m where m.id=owner_id and m.status=''active'') then raise exception ''Owner Pipeline BD tidak valid.''; end if;');
  execute definition;
end;
$migration$;
