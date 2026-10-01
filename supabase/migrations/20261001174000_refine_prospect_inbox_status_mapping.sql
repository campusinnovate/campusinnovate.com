-- Preserve the source's review intent when Lead Research rows enter Prospect Inbox.
-- Replace-PIC work takes priority over potential status because the contact must be
-- corrected before the prospect can be treated as outreach-ready.

do $migration$
declare
  function_definition text;
  old_mapping text := $old$mapped_status:=case
      when canonical_id is not null then 'duplicate'
      when coalesce(payload->>'status','') ilike '%potential lead%' then 'potential'
      when coalesce(payload->>'position_status','') ilike '%unverified%' then 'replace_pic'
      else 'needs_review'
    end;$old$;
  new_mapping text := $new$mapped_status:=case
      when canonical_id is not null then 'duplicate'
      when coalesce(payload->>'status','') ilike '%replace pic%'
        or coalesce(payload->>'position_status','') ilike '%unverified%' then 'replace_pic'
      when coalesce(payload->>'status','') ilike '%potential%' then 'potential'
      else 'needs_review'
    end;$new$;
begin
  select pg_get_functiondef(
    'public.import_prospect_research_row(uuid,integer,jsonb)'::regprocedure
  ) into function_definition;

  if position(old_mapping in function_definition)=0 then
    raise exception 'Expected Prospect Inbox status mapping was not found.';
  end if;

  execute replace(function_definition,old_mapping,new_mapping);
end;
$migration$;
