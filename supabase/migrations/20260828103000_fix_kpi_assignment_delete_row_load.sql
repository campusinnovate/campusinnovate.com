begin;

create or replace function public.delete_kpi_assignment(
  target_assignment_id uuid,
  confirmation_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_membership_id();
  target public.kpi_assignments%rowtype;
  member_name text;
  role_name text;
  period_name text;
  snapshot jsonb;
  impact_value jsonb;
begin
  if not public.current_user_has_permission('kpi.manage') then
    raise exception 'Izin kelola KPI diperlukan.' using errcode = '42501';
  end if;

  select a.*
  into target
  from public.kpi_assignments a
  where a.id = target_assignment_id
  for update;

  if target.id is null then
    raise exception 'Assignment KPI tidak ditemukan.';
  end if;

  select coalesce(m.full_name, m.email::text), r.name, p.name
  into member_name, role_name, period_name
  from public.memberships m
  join public.kpi_roles r on r.id = target.kpi_role_id
  join public.kpi_periods p on p.id = target.period_id
  where m.id = target.membership_id;

  if trim(coalesce(confirmation_name, '')) <> member_name then
    raise exception 'Konfirmasi nama anggota tidak sesuai.';
  end if;

  select public.kpi_assignment_impact(target.id) into impact_value;

  select jsonb_build_object(
    'assignment', to_jsonb(target),
    'member_name', member_name,
    'role_name', role_name,
    'period_name', period_name,
    'results', coalesce((
      select jsonb_agg(to_jsonb(x))
      from public.kpi_results x
      where x.assignment_id = target.id
    ), '[]'::jsonb),
    'updates', coalesce((
      select jsonb_agg(to_jsonb(u))
      from public.kpi_weekly_updates u
      join public.kpi_results x on x.id = u.result_id
      where x.assignment_id = target.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e))
      from public.kpi_events e
      where e.assignment_id = target.id
    ), '[]'::jsonb)
  )
  into snapshot;

  insert into public.kpi_admin_audits(
    actor_membership_id,
    action,
    target_type,
    target_id,
    before_data,
    impact
  )
  values(
    actor,
    'assignment.deleted',
    'assignment',
    target.id,
    snapshot,
    coalesce(impact_value, '{}'::jsonb)
  );

  delete from public.kpi_assignments where id = target.id;
end
$$;

revoke all on function public.delete_kpi_assignment(uuid, text) from anon, public;
grant execute on function public.delete_kpi_assignment(uuid, text) to authenticated;

commit;
