-- Ruang Kawan: idempotent KPI assignment and safe period edit/delete.

create table if not exists public.kpi_admin_audits(
 id uuid primary key default extensions.gen_random_uuid(),
 actor_membership_id uuid not null references public.memberships(id),
 action text not null,
 target_type text not null,
 target_id uuid,
 before_data jsonb,
 after_data jsonb,
 impact jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.kpi_admin_audits enable row level security;

create or replace function public.kpi_period_impact(target_period_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare target public.kpi_periods%rowtype;
begin
 if not public.current_user_has_permission('kpi.manage') then raise exception 'Akses pengelola KPI diperlukan.' using errcode='42501';end if;
 select * into target from public.kpi_periods where id=target_period_id;
 if target.id is null then raise exception 'Periode KPI tidak ditemukan.';end if;
 return jsonb_build_object(
  'period_id',target.id,'period_name',target.name,
  'assignment_count',(select count(*) from public.kpi_assignments where period_id=target.id),
  'result_count',(select count(*) from public.kpi_results r join public.kpi_assignments a on a.id=r.assignment_id where a.period_id=target.id),
  'weekly_update_count',(select count(*) from public.kpi_weekly_updates u join public.kpi_results r on r.id=u.result_id join public.kpi_assignments a on a.id=r.assignment_id where a.period_id=target.id),
  'evidence_count',(
   (select count(*) from public.kpi_results r join public.kpi_assignments a on a.id=r.assignment_id where a.period_id=target.id and nullif(r.evidence_url,'') is not null)+
   (select count(*) from public.kpi_weekly_updates u join public.kpi_results r on r.id=u.result_id join public.kpi_assignments a on a.id=r.assignment_id where a.period_id=target.id and nullif(u.evidence_url,'') is not null)
  )
 );
end;$$;

create or replace function public.save_kpi_period(period_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
 actor uuid:=public.current_membership_id();saved uuid;before_row jsonb;after_row jsonb;
 new_status text:=coalesce(nullif(payload->>'status',''),'draft');
 start_value date:=(payload->>'start_date')::date;end_value date:=(payload->>'end_date')::date;
begin
 if not public.current_user_has_permission('kpi.manage') then raise exception 'Akses pengelola KPI diperlukan.' using errcode='42501';end if;
 if nullif(trim(payload->>'name'),'') is null then raise exception 'Nama periode wajib diisi.';end if;
 if end_value<start_value then raise exception 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.';end if;
 if new_status not in('draft','open','review','locked') then raise exception 'Status periode tidak valid.';end if;
 if exists(select 1 from public.kpi_periods p where p.id is distinct from period_id and daterange(p.start_date,p.end_date,'[]') && daterange(start_value,end_value,'[]')) then
  raise exception 'Rentang tanggal bertumpang-tindih dengan periode KPI lain.' using errcode='23505';
 end if;
 if period_id is null then
  insert into public.kpi_periods(name,start_date,end_date,status,created_by_membership_id)
  values(trim(payload->>'name'),start_value,end_value,new_status,actor) returning id,to_jsonb(kpi_periods) into saved,after_row;
  insert into public.kpi_admin_audits(actor_membership_id,action,target_type,target_id,after_data) values(actor,'period.created','period',saved,after_row);
 else
  select to_jsonb(p) into before_row from public.kpi_periods p where p.id=period_id for update;
  if before_row is null then raise exception 'Periode KPI tidak ditemukan.';end if;
  if new_status='locked' and exists(select 1 from public.kpi_assignments where public.kpi_assignments.period_id=$1 and status not in('reviewed','cancelled','locked')) then raise exception 'Semua assignment harus selesai direview sebelum periode dikunci.';end if;
  update public.kpi_periods set name=trim(payload->>'name'),start_date=start_value,end_date=end_value,status=new_status,
   locked_at=case when new_status='locked' then now() else null end,locked_by_membership_id=case when new_status='locked' then actor else null end
  where id=period_id returning id,to_jsonb(kpi_periods) into saved,after_row;
  update public.kpi_assignments set status=case when new_status='locked' and status='reviewed' then 'locked' when new_status<>'locked' and status='locked' then 'active' else status end,
   locked_at=case when new_status='locked' then now() else null end where public.kpi_assignments.period_id=$1;
  insert into public.kpi_admin_audits(actor_membership_id,action,target_type,target_id,before_data,after_data,impact)
  values(actor,'period.updated','period',saved,before_row,after_row,public.kpi_period_impact(saved));
 end if;
 return saved;
end;$$;

create or replace function public.delete_kpi_period(target_period_id uuid,confirmation_name text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();target public.kpi_periods%rowtype;impact_value jsonb;snapshot_value jsonb;audit_id uuid;
begin
 if not public.current_user_has_permission('kpi.manage') then raise exception 'Akses pengelola KPI diperlukan.' using errcode='42501';end if;
 select * into target from public.kpi_periods where id=target_period_id for update;
 if target.id is null then raise exception 'Periode KPI tidak ditemukan.';end if;
 if confirmation_name is distinct from target.name then raise exception 'Nama konfirmasi tidak cocok.';end if;
 impact_value:=public.kpi_period_impact(target.id);
 snapshot_value:=jsonb_build_object(
  'period',to_jsonb(target),
  'assignments',coalesce((select jsonb_agg(to_jsonb(a)) from public.kpi_assignments a where a.period_id=target.id),'[]'::jsonb),
  'results',coalesce((select jsonb_agg(to_jsonb(r)) from public.kpi_results r join public.kpi_assignments a on a.id=r.assignment_id where a.period_id=target.id),'[]'::jsonb),
  'weekly_updates',coalesce((select jsonb_agg(to_jsonb(u)) from public.kpi_weekly_updates u join public.kpi_results r on r.id=u.result_id join public.kpi_assignments a on a.id=r.assignment_id where a.period_id=target.id),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(e)) from public.kpi_events e join public.kpi_assignments a on a.id=e.assignment_id where a.period_id=target.id),'[]'::jsonb)
 );
 insert into public.kpi_admin_audits(actor_membership_id,action,target_type,target_id,before_data,impact)
 values(actor,'period.deleted','period',target.id,snapshot_value,impact_value) returning id into audit_id;
 delete from public.kpi_periods where id=target.id;
 return impact_value||jsonb_build_object('audit_id',audit_id);
end;$$;

create or replace function public.assign_kpi(assignment_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
 actor uuid:=public.current_membership_id();saved uuid;existing public.kpi_assignments%rowtype;
 role_uuid uuid:=(payload->>'kpi_role_id')::uuid;member_uuid uuid:=(payload->>'membership_id')::uuid;period_uuid uuid:=(payload->>'period_id')::uuid;
begin
 if not public.current_user_has_permission('kpi.manage') then raise exception 'Akses pengelola KPI diperlukan.' using errcode='42501';end if;
 if not exists(select 1 from public.memberships where id=member_uuid and status='active') then raise exception 'Anggota KPI tidak aktif atau tidak ditemukan.';end if;
 if not exists(select 1 from public.kpi_periods where id=period_uuid and status<>'locked') then raise exception 'Periode KPI tidak tersedia atau sudah dikunci.';end if;
 if not exists(select 1 from public.kpi_roles where id=role_uuid and is_active) then raise exception 'Role KPI tidak tersedia.';end if;
 if assignment_id is null then
  select * into existing from public.kpi_assignments where period_id=period_uuid and membership_id=member_uuid for update;
  if existing.id is not null then
   if existing.kpi_role_id<>role_uuid then raise exception 'Assignment anggota pada periode ini sudah ada dengan role berbeda. Edit assignment existing; jangan membuat duplikat.' using errcode='23505';end if;
   update public.kpi_assignments set reviewer_membership_id=coalesce(nullif(payload->>'reviewer_membership_id','')::uuid,existing.reviewer_membership_id),updated_at=now() where id=existing.id returning id into saved;
   insert into public.kpi_events(assignment_id,actor_membership_id,action,before_data,after_data)
   values(saved,actor,'assignment.reused',to_jsonb(existing),jsonb_build_object('reviewer_membership_id',coalesce(nullif(payload->>'reviewer_membership_id','')::uuid,existing.reviewer_membership_id)));
   return saved;
  end if;
  if exists(select 1 from public.kpi_roles where id=role_uuid and scoring_model='category_weighted') and coalesce((select sum(weight) from public.kpi_categories where kpi_role_id=role_uuid and is_active),0)<>100 then raise exception 'Total bobot kategori wajib tepat 100%%.';end if;
  insert into public.kpi_assignments(period_id,membership_id,kpi_role_id,reviewer_membership_id,role_snapshot,created_by_membership_id)
  select period_uuid,member_uuid,role_uuid,nullif(payload->>'reviewer_membership_id','')::uuid,jsonb_build_object('role_name',name,'scoring_model',scoring_model),actor from public.kpi_roles where id=role_uuid returning id into saved;
  insert into public.kpi_results(assignment_id,template_id,category_id,code,name,category_name,category_weight,formula_type,target_value,unit,item_weight,evidence_required,aggregation_method,sort_order)
  select saved,t.id,t.category_id,t.code,t.name,c.name,c.weight,t.formula_type,t.target_value,t.unit,t.item_weight,t.evidence_required,t.aggregation_method,t.sort_order from public.kpi_templates t left join public.kpi_categories c on c.id=t.category_id where t.kpi_role_id=role_uuid and t.is_active order by t.sort_order;
 else
  update public.kpi_assignments set reviewer_membership_id=nullif(payload->>'reviewer_membership_id','')::uuid,updated_at=now() where id=assignment_id returning id into saved;
 end if;
 perform public.recalculate_kpi_assignment(saved);
 return saved;
end;$$;

revoke all on function public.kpi_period_impact(uuid),public.delete_kpi_period(uuid,text) from anon,public;
grant execute on function public.kpi_period_impact(uuid),public.delete_kpi_period(uuid,text) to authenticated;
