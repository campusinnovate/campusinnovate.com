-- Ruang Kawan: fix ambiguous period identifier when locking or reopening KPI periods.

create or replace function public.save_kpi_period(period_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); saved uuid; new_status text:=coalesce(nullif(payload->>'status',''),'draft');
begin
  if not public.current_user_has_permission('kpi.manage') then raise exception 'Akses pengelola KPI diperlukan.' using errcode='42501'; end if;
  if period_id is null then
    insert into public.kpi_periods(name,start_date,end_date,status,created_by_membership_id)
    values(trim(payload->>'name'),(payload->>'start_date')::date,(payload->>'end_date')::date,new_status,actor)
    returning id into saved;
  else
    update public.kpi_periods
    set name=trim(payload->>'name'),start_date=(payload->>'start_date')::date,end_date=(payload->>'end_date')::date,status=new_status,
        locked_at=case when new_status='locked' then now() else null end,
        locked_by_membership_id=case when new_status='locked' then actor else null end
    where id=period_id returning id into saved;

    update public.kpi_assignments
    set status=case when new_status='locked' then 'locked' when status='locked' then 'active' else status end,
        locked_at=case when new_status='locked' then now() else null end
    where public.kpi_assignments.period_id=$1;
  end if;
  return saved;
end; $$;

revoke execute on function public.save_kpi_period(uuid,jsonb) from anon,public;
grant execute on function public.save_kpi_period(uuid,jsonb) to authenticated;
