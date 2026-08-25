-- My Activity: persistent completion checkbox for every feed item.
-- Only the activity PIC may change completion; related module records stay aligned.

create or replace function public.set_activity_completion(target_activity uuid, completed boolean)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid:=public.current_membership_id();
  target public.activities%rowtype;
  next_status text:=case when completed then 'done' else 'in_progress' end;
  next_progress smallint:=case when completed then 100 else 0 end;
begin
  if actor is null or not public.current_user_has_permission('activity.view_self') then
    raise exception 'Akses My Activity diperlukan.' using errcode='42501';
  end if;

  select * into target from public.activities where id=target_activity;
  if target.id is null then
    raise exception 'Aktivitas tidak ditemukan.';
  end if;
  if target.owner_membership_id<>actor then
    raise exception 'Hanya PIC aktivitas yang dapat mengubah status selesai.' using errcode='42501';
  end if;

  if target.status=next_status and target.progress=next_progress then
    return jsonb_build_object('id',target.id,'status',target.status,'progress',target.progress);
  end if;

  update public.activities
  set status=next_status,progress=next_progress,updated_by=auth.uid(),updated_at=now()
  where id=target.id;

  update public.project_tasks
  set status=next_status,progress=next_progress,updated_at=now()
  where activity_id=target.id and deleted_at is null;

  update public.content_items
  set production_status=case when completed then 'done' else 'in_progress' end,updated_at=now()
  where activity_id=target.id;

  update public.report_action_items
  set status=case when completed then 'done' else 'in_progress' end,updated_at=now()
  where activity_id=target.id;

  insert into public.activity_history(activity_id,actor_membership_id,event_type,before_data,after_data)
  values(target.id,actor,case when completed then 'completion_checked' else 'completion_unchecked' end,
    jsonb_build_object('status',target.status,'progress',target.progress),
    jsonb_build_object('status',next_status,'progress',next_progress));

  return jsonb_build_object('id',target.id,'status',next_status,'progress',next_progress);
end;
$$;

revoke all on function public.set_activity_completion(uuid,boolean) from public,anon;
grant execute on function public.set_activity_completion(uuid,boolean) to authenticated;
