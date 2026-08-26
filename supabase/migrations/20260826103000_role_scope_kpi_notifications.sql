-- Ruang Kawan production handover: position-scoped modules, protected employee directory,
-- cross-owner module visibility, and KPI notifications. Additive and Finance-neutral.

insert into public.permissions(key,name,description) values
 ('kpi.create_self','Tambah KPI sendiri','Menambahkan KPI pada assignment sendiri.'),
 ('employee_profile.view_directory','Lihat direktori pegawai','Melihat direktori pegawai internal.')
on conflict(key) do update set name=excluded.name,description=excluded.description;

-- Module access follows position. Cross-functional access remains possible through an
-- explicit member permission override instead of a broad staff role.
delete from public.role_permissions rp
using public.roles r,public.permissions p
where rp.role_id=r.id and rp.permission_id=p.id
  and r.key in('staff','freelancer','project_lead','finance_manager','people_hr_manager')
  and (p.key like 'content_plan.%' or p.key like 'pipeline.%');

delete from public.position_permissions pp
using public.positions pos,public.permissions p
where pp.position_id=pos.id and pp.permission_id=p.id
  and ((pos.key='business_development_staff' and p.key like 'content_plan.%')
    or (pos.key in('social_media_staff','growth_marketing_staff') and p.key like 'pipeline.%'));

insert into public.position_permissions(position_id,permission_id)
select pos.id,p.id from public.positions pos cross join public.permissions p
where (pos.key='business_development_staff' and p.key in('marketing.view','marketing.overview.view','pipeline.view','pipeline.manage_self'))
   or (pos.key in('social_media_staff','growth_marketing_staff') and p.key in('marketing.view','marketing.overview.view','content_plan.view','content_plan.manage_self'))
   or (pos.key in('ceo','coo','cto') and (p.key like 'content_plan.%' or p.key like 'pipeline.%'))
on conflict do nothing;

-- Every normal system role can operate its own KPI. Directory/sensitive access is
-- limited to System Admin, Executive, and C-Level positions unless explicitly overridden.
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key in('system_admin','executive','finance_manager','people_hr_manager','project_lead','staff','freelancer')
  and p.key in('kpi.view_self','kpi.update_self','kpi.create_self')
on conflict do nothing;

delete from public.role_permissions rp
using public.roles r,public.permissions p
where rp.role_id=r.id and rp.permission_id=p.id
  and r.key not in('system_admin','executive')
  and p.key in('employee_profile.view_directory','employee_profile.view_sensitive');

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key in('system_admin','executive') and p.key in('employee_profile.view_directory','employee_profile.view_sensitive')
on conflict do nothing;

insert into public.position_permissions(position_id,permission_id)
select pos.id,p.id from public.positions pos cross join public.permissions p
where pos.key in('ceo','coo','cto') and p.key in('employee_profile.view_directory','employee_profile.view_sensitive')
on conflict do nothing;

create or replace function public.list_content_items()
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(
    to_jsonb(ci)||jsonb_build_object(
      'owner_membership_id',a.owner_membership_id,'reviewer_membership_id',a.reviewer_membership_id,
      'assigned_by_membership_id',a.assigned_by_membership_id,'workflow_status',a.status,
      'progress',a.progress,'priority',a.priority,'linked_kpi',a.linked_kpi,
      'review_status',a.review_status,'review_note',a.review_note,
      'owner_name',coalesce(owner_m.full_name,owner_m.email::text),
      'reviewer_name',coalesce(reviewer_m.full_name,reviewer_m.email::text),
      'source_name',ws.name,'source_color',ws.color
    ) order by coalesce(ci.publish_date,ci.deadline) desc,ci.created_at desc
  ),'[]'::jsonb)
  from public.content_items ci
  join public.activities a on a.id=ci.activity_id
  join public.work_sources ws on ws.id=ci.source_id
  join public.memberships owner_m on owner_m.id=a.owner_membership_id
  left join public.memberships reviewer_m on reviewer_m.id=a.reviewer_membership_id
  where public.current_user_has_permission('content_plan.view') and public.can_access_work_source(ci.source_id);
$$;

create or replace function public.list_pipeline_leads()
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(
    to_jsonb(pl)||jsonb_build_object(
      'weighted_value',round(coalesce(pl.deal_value,0)*coalesce(pl.probability,0),2),
      'potential_revenue',round(coalesce(pl.seats,0)*coalesce(pl.price_per_person,0),2),
      'owner_membership_id',a.owner_membership_id,'assigned_by_membership_id',a.assigned_by_membership_id,
      'workflow_status',a.status,'progress',a.progress,'linked_kpi',a.linked_kpi,
      'owner_name',coalesce(owner_m.full_name,owner_m.email::text),
      'source_name',ws.name,'source_color',ws.color,'source_config',ws.module_config
    ) order by pl.due_date,pl.created_at desc
  ),'[]'::jsonb)
  from public.pipeline_leads pl
  join public.activities a on a.id=pl.activity_id
  join public.work_sources ws on ws.id=pl.source_id
  join public.memberships owner_m on owner_m.id=a.owner_membership_id
  where public.current_user_has_permission('pipeline.view') and public.can_access_work_source(pl.source_id);
$$;

create or replace function public.notify_kpi_weekly_update()
returns trigger language plpgsql security definer set search_path=public as $$
declare assignment public.kpi_assignments%rowtype;actor uuid:=new.updated_by_membership_id;recipient uuid;
begin
 select a.* into assignment from public.kpi_results r join public.kpi_assignments a on a.id=r.assignment_id where r.id=new.result_id;
 foreach recipient in array array_remove(array[assignment.membership_id,assignment.reviewer_membership_id],null) loop
  if recipient<>actor then
   insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority,dedupe_key)
   values(recipient,actor,'kpi.weekly_update','Pembaruan KPI','Pembaruan mingguan KPI telah disimpan.','kpi_assignment',assignment.id::text,'/ruang-kawan/kpi/','normal','kpi-week:'||new.id::text||':'||recipient::text)
   on conflict(recipient_membership_id,dedupe_key) where dedupe_key is not null do update set message=excluded.message,read_at=null,dismissed_at=null,created_at=now();
  end if;
 end loop;
 return new;
end;$$;

drop trigger if exists kpi_assignment_status_notification on public.kpi_assignments;
create trigger kpi_assignment_status_notification after update of status on public.kpi_assignments
for each row execute function public.notify_kpi_event();

drop trigger if exists kpi_weekly_update_notification on public.kpi_weekly_updates;
create trigger kpi_weekly_update_notification after insert or update on public.kpi_weekly_updates
for each row execute function public.notify_kpi_weekly_update();

revoke all on function public.list_content_items(),public.list_pipeline_leads() from anon,public;
grant execute on function public.list_content_items(),public.list_pipeline_leads() to authenticated;
