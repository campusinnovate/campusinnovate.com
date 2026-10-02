-- Preserve omitted fields on partial edits, including research/traveler data.
-- Merge against the locked server row, not a stale browser copy.
do $migration$
declare definition text; anchor text := '  owner_id:=coalesce(nullif(payload->>''owner_membership_id'','''')::uuid,actor_id);';
begin
  select pg_get_functiondef('public.save_pipeline_lead(uuid,jsonb)'::regprocedure) into definition;
  if position(anchor in definition)=0 then raise exception 'Unexpected save_pipeline_lead definition'; end if;
  definition:=replace(definition,anchor,$guard$
  if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Payload harus object.'; end if;
  if pipeline_lead_id is not null then
    select * into existing from public.pipeline_leads where id=pipeline_lead_id for update;
    if existing.id is null or not public.can_access_activity(existing.activity_id) then
      raise exception 'Lead tidak dapat diakses.' using errcode='42501';
    end if;
    if payload ? 'expected_updated_at' and (payload->>'expected_updated_at')::timestamptz is distinct from existing.updated_at then
      raise exception 'Lead telah berubah. Muat ulang sebelum menyimpan.' using errcode='40001';
    end if;
    payload:=to_jsonb(existing)||jsonb_build_object(
      'owner_membership_id',(select owner_membership_id from public.activities where id=existing.activity_id),
      'linked_kpi',(select linked_kpi from public.activities where id=existing.activity_id)
    )||payload||jsonb_build_object(
      'follow_up_count',existing.follow_up_count,'last_contact_date',existing.last_contact_date,
      'extra_data',existing.extra_data||coalesce(payload->'extra_data','{}'::jsonb)||
        case when payload->'extra_data' ? 'qualification' then jsonb_build_object(
          'qualification',coalesce(existing.extra_data->'qualification','{}'::jsonb)||(payload->'extra_data'->'qualification')
        ) else '{}'::jsonb end
    );
  end if;
$guard$||anchor);
  execute definition;
end;
$migration$;

-- Clearing a field is different from omitting it. Prevent fallback to stale values.
do $migration$
declare definition text; column_name text; cast_type text; old_expression text; new_expression text;
begin
  select pg_get_functiondef('public.pipeline_prepare_lead()'::regprocedure) into definition;
  foreach column_name in array array['proposal_value','won_value','expected_close_date','win_loss_reason','whatsapp_contact','email_contact','linkedin_contact'] loop
    cast_type:=case when column_name in ('proposal_value','won_value') then 'numeric' when column_name='expected_close_date' then 'date' else 'text' end;
    new_expression:=format('new.%1$I:=case when new.extra_data ? %1$L then nullif(trim(new.extra_data->>%1$L),'''')::%2$s else new.%1$I end;',column_name,cast_type);
    definition:=regexp_replace(definition,'new\.'||column_name||':=[^;]*;',new_expression);
  end loop;
  -- A won value must be explicitly recorded, never inferred from a proposal/GM.
  definition:=replace(definition,'new.won_value:=coalesce(new.won_value,new.proposal_value,new.deal_value,0);','');
  execute definition;
end;
$migration$;

revoke all on function public.pipeline_prepare_lead(),public.sync_pipeline_tickets(),public.refresh_pipeline_contact_metrics() from public,anon,authenticated;
