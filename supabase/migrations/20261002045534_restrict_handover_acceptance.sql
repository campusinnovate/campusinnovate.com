-- Only the named COO/CTO assignee can accept an open handover ticket.
do $migration$
declare definition text;
  old_gate text := 'if actor_id is null or (t.assignee_membership_id<>actor_id and not public.current_user_has_permission(''projects.create'')) then';
  new_gate text := 'if actor_id is null or t.assignee_membership_id is distinct from actor_id then';
  project_gate text := 'if t.project_id is not null then return t.project_id; end if;';
begin
  select pg_get_functiondef('public.accept_handover_ticket(uuid)'::regprocedure) into definition;
  if position(old_gate in definition)=0 or position(project_gate in definition)=0 then
    raise exception 'Unexpected handover function definition';
  end if;
  definition:=replace(definition,old_gate,new_gate);
  definition:=replace(definition,project_gate,project_gate||E'\n  if t.status not in (''open'',''in_progress'') then raise exception ''Handover tidak dapat diterima pada status ini.''; end if;');
  execute definition;
end;
$migration$;

do $migration$
declare definition text;
begin
  select pg_get_functiondef('public.pipeline_ticket_workspace()'::regprocedure) into definition;
  if position('or public.current_user_has_permission(''projects.create'')' in definition)=0 then
    raise exception 'Unexpected ticket workspace definition';
  end if;
  definition:=replace(definition,' or public.current_user_has_permission(''projects.create'')','');
  execute definition;
end;
$migration$;
