-- Report stale lead versions as HTTP 409 without triggering transaction retries.
do $migration$
declare
  definition text := pg_get_functiondef('public.save_pipeline_lead(uuid,jsonb)'::regprocedure);
  old_clause constant text := $old$raise exception 'Lead telah berubah. Muat ulang sebelum menyimpan.' using errcode='40001';$old$;
  new_clause constant text := $new$raise exception 'Lead telah berubah. Muat ulang sebelum menyimpan.' using errcode='PT409';$new$;
begin
  if position(old_clause in definition) = 0 and position(new_clause in definition) > 0 then
    return;
  end if;

  if (length(definition) - length(replace(definition, old_clause, ''))) <> length(old_clause) then
    raise exception 'Expected one stale-version guard in public.save_pipeline_lead(uuid,jsonb)';
  end if;

  perform set_config('lock_timeout', '5s', true);
  execute replace(definition, old_clause, new_clause);
end;
$migration$;
