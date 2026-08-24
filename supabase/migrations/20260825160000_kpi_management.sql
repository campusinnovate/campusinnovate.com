-- Ruang Kawan: configurable KPI management, scoring, review, and period locking.

insert into public.permissions(key,name,description) values
  ('kpi.view_self','Lihat KPI sendiri','Melihat KPI, realisasi, bukti, dan nilai pribadi.'),
  ('kpi.update_self','Update KPI sendiri','Mengisi realisasi dan bukti KPI pribadi.'),
  ('kpi.review','Review KPI','Memeriksa dan mengoreksi realisasi KPI anggota.'),
  ('kpi.manage','Kelola KPI','Mengatur role KPI, template, periode, dan assignment.'),
  ('kpi.view_all','Lihat seluruh KPI','Melihat dashboard KPI seluruh organisasi.')
on conflict(key) do update set name=excluded.name,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on
  r.key='system_admin'
  or (r.key='executive' and p.key in ('kpi.view_self','kpi.update_self','kpi.review','kpi.view_all'))
  or (r.key='people_hr_manager' and p.key in ('kpi.view_self','kpi.update_self','kpi.review','kpi.manage','kpi.view_all'))
  or (r.key in ('staff','freelancer','project_lead','finance_manager') and p.key in ('kpi.view_self','kpi.update_self'))
on conflict do nothing;

create table public.kpi_roles(
  id uuid primary key default extensions.gen_random_uuid(),
  key text not null unique,
  name text not null check(char_length(trim(name)) between 2 and 100),
  scoring_model text not null default 'staff_equal' check(scoring_model in ('staff_equal','category_weighted')),
  description text,
  is_active boolean not null default true,
  created_by_membership_id uuid not null references public.memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.kpi_categories(
  id uuid primary key default extensions.gen_random_uuid(),
  kpi_role_id uuid not null references public.kpi_roles(id) on delete cascade,
  name text not null,
  weight numeric(7,4) not null check(weight>0 and weight<=100),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  unique(kpi_role_id,name)
);

create table public.kpi_templates(
  id uuid primary key default extensions.gen_random_uuid(),
  kpi_role_id uuid not null references public.kpi_roles(id) on delete cascade,
  category_id uuid references public.kpi_categories(id) on delete set null,
  code text not null,
  name text not null check(char_length(trim(name)) between 2 and 180),
  description text,
  formula_type text not null default 'higher_better' check(formula_type in ('higher_better','lower_better','percentage','derived_ratio','compliance','binary','milestone_progress')),
  target_value numeric(18,4) not null,
  unit text not null default 'unit',
  item_weight numeric(7,4),
  evidence_required boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(kpi_role_id,code),
  check(item_weight is null or item_weight>0),
  check(formula_type in ('binary','milestone_progress') or target_value>0)
);

create table public.kpi_periods(
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null check(end_date>=start_date),
  status text not null default 'draft' check(status in ('draft','open','review','locked')),
  locked_at timestamptz,
  locked_by_membership_id uuid references public.memberships(id),
  created_by_membership_id uuid not null references public.memberships(id),
  created_at timestamptz not null default now(),
  unique(start_date,end_date)
);

create table public.kpi_assignments(
  id uuid primary key default extensions.gen_random_uuid(),
  period_id uuid not null references public.kpi_periods(id) on delete cascade,
  membership_id uuid not null references public.memberships(id),
  kpi_role_id uuid not null references public.kpi_roles(id),
  reviewer_membership_id uuid references public.memberships(id),
  status text not null default 'active' check(status in ('active','submitted','reviewed','locked','cancelled')),
  role_snapshot jsonb not null default '{}'::jsonb,
  final_score numeric(8,4),
  raw_score numeric(8,4),
  coverage numeric(8,4),
  score_status text,
  reviewed_at timestamptz,
  locked_at timestamptz,
  created_by_membership_id uuid not null references public.memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(period_id,membership_id)
);

create table public.kpi_results(
  id uuid primary key default extensions.gen_random_uuid(),
  assignment_id uuid not null references public.kpi_assignments(id) on delete cascade,
  template_id uuid references public.kpi_templates(id) on delete set null,
  category_id uuid references public.kpi_categories(id) on delete set null,
  code text not null,
  name text not null,
  category_name text,
  category_weight numeric(7,4),
  formula_type text not null,
  target_value numeric(18,4) not null,
  unit text not null,
  item_weight numeric(7,4),
  evidence_required boolean not null default true,
  is_applicable boolean not null default true,
  actual_value numeric(18,4),
  evidence_url text,
  note text,
  raw_achievement numeric(12,4),
  score numeric(8,4),
  reviewer_score numeric(8,4),
  review_note text,
  reviewed_by_membership_id uuid references public.memberships(id),
  reviewed_at timestamptz,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now(),
  unique(assignment_id,code)
);

create index kpi_assignments_member_period_idx on public.kpi_assignments(membership_id,period_id);
create index kpi_results_assignment_idx on public.kpi_results(assignment_id,sort_order);
create index kpi_templates_role_idx on public.kpi_templates(kpi_role_id,sort_order) where is_active;

create or replace function public.kpi_score_item(formula text,target numeric,actual numeric)
returns numeric language sql immutable as $$
  select case
    when actual is null then null
    when formula='higher_better' then case when target>0 then actual/target*100 end
    when formula='lower_better' then case when actual=0 then 100 when target>0 then target/actual*100 end
    when formula in ('percentage','derived_ratio','compliance') then case when target>0 then actual/target*100 end
    when formula='binary' then case when actual>=1 then 100 else 0 end
    when formula='milestone_progress' then greatest(0,actual)
  end;
$$;

create or replace function public.recalculate_kpi_assignment(target_assignment_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare model text; calculated_raw numeric; calculated_score numeric; calculated_coverage numeric;
begin
  select kr.scoring_model into model from public.kpi_assignments ka join public.kpi_roles kr on kr.id=ka.kpi_role_id where ka.id=target_assignment_id;
  if model='category_weighted' then
    with evaluated as (
      select category_name,category_weight,item_weight,coalesce(reviewer_score,score) effective_score
      from public.kpi_results where assignment_id=target_assignment_id and is_applicable
    ), category_scores as (
      select category_name,max(category_weight) category_weight,
        sum(effective_score*coalesce(item_weight,1))/nullif(sum(coalesce(item_weight,1)) filter(where effective_score is not null),0) category_score
      from evaluated group by category_name
    )
    select sum(category_score*category_weight)/nullif(sum(category_weight) filter(where category_score is not null),0),
      sum(least(category_score,100)*category_weight)/nullif(sum(category_weight) filter(where category_score is not null),0)
    into calculated_raw,calculated_score from category_scores;
  else
    select sum(coalesce(reviewer_score,score)*coalesce(item_weight,1))/nullif(sum(coalesce(item_weight,1)) filter(where coalesce(reviewer_score,score) is not null),0),
      sum(least(coalesce(reviewer_score,score),100)*coalesce(item_weight,1))/nullif(sum(coalesce(item_weight,1)) filter(where coalesce(reviewer_score,score) is not null),0)
    into calculated_raw,calculated_score from public.kpi_results where assignment_id=target_assignment_id and is_applicable;
  end if;
  select 100.0*count(*) filter(where coalesce(reviewer_score,score) is not null)/nullif(count(*),0)
    into calculated_coverage from public.kpi_results where assignment_id=target_assignment_id and is_applicable;

  update public.kpi_assignments set raw_score=calculated_raw,final_score=least(calculated_score,100),coverage=calculated_coverage,
    score_status=case when calculated_score is null then 'Belum Dinilai' when calculated_score>=100 then 'Exceeded' when calculated_score>=80 then 'On Track' when calculated_score>=70 then 'Needs Attention' else 'At Risk' end,
    updated_at=now() where id=target_assignment_id;
end; $$;

create or replace function public.list_kpi_workspace()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); can_all boolean:=public.current_user_has_permission('kpi.view_all') or public.current_user_has_permission('kpi.manage') or public.current_user_has_permission('kpi.review');
begin
  if actor is null or not public.current_user_has_permission('kpi.view_self') then raise exception 'Akses KPI diperlukan.' using errcode='42501'; end if;
  return jsonb_build_object(
    'periods',coalesce((select jsonb_agg(to_jsonb(kp) order by kp.start_date desc) from public.kpi_periods kp),'[]'::jsonb),
    'roles',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'key',r.key,'name',r.name,'scoring_model',r.scoring_model,'description',r.description,'is_active',r.is_active,'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order) from public.kpi_categories c where c.kpi_role_id=r.id and c.is_active),'[]'::jsonb),'templates',coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order) from public.kpi_templates t where t.kpi_role_id=r.id and t.is_active),'[]'::jsonb)) order by r.name) from public.kpi_roles r where r.is_active),'[]'::jsonb),
    'members',case when can_all then coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(m.full_name,m.email::text),'email',m.email::text) order by coalesce(m.full_name,m.email::text)) from public.memberships m where m.status='active'),'[]'::jsonb) else '[]'::jsonb end,
    'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'period_id',a.period_id,'membership_id',a.membership_id,'member_name',coalesce(m.full_name,m.email::text),'kpi_role_id',a.kpi_role_id,'role_name',r.name,'scoring_model',r.scoring_model,'reviewer_membership_id',a.reviewer_membership_id,'status',a.status,'final_score',a.final_score,'raw_score',a.raw_score,'coverage',a.coverage,'score_status',a.score_status,'updated_at',a.updated_at) order by p.start_date desc,coalesce(m.full_name,m.email::text)) from public.kpi_assignments a join public.kpi_periods p on p.id=a.period_id join public.memberships m on m.id=a.membership_id join public.kpi_roles r on r.id=a.kpi_role_id where can_all or a.membership_id=actor or a.reviewer_membership_id=actor),'[]'::jsonb)
  );
end; $$;

create or replace function public.list_kpi_results(target_assignment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); target public.kpi_assignments%rowtype;
begin
  select * into target from public.kpi_assignments where id=target_assignment_id;
  if target.id is null or not(target.membership_id=actor or target.reviewer_membership_id=actor or public.current_user_has_permission('kpi.view_all') or public.current_user_has_permission('kpi.manage')) then raise exception 'KPI tidak dapat diakses.' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.sort_order,r.name) from public.kpi_results r where r.assignment_id=target_assignment_id),'[]'::jsonb);
end; $$;

create or replace function public.save_kpi_role(role_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); saved uuid; role_key text:=lower(regexp_replace(trim(coalesce(payload->>'key',payload->>'name','')),'[^a-zA-Z0-9]+','_','g'));
begin
  if not public.current_user_has_permission('kpi.manage') then raise exception 'Akses pengelola KPI diperlukan.' using errcode='42501'; end if;
  if role_id is null then insert into public.kpi_roles(key,name,description,scoring_model,created_by_membership_id) values(role_key,trim(payload->>'name'),nullif(payload->>'description',''),coalesce(nullif(payload->>'scoring_model',''),'staff_equal'),actor) returning id into saved;
  else update public.kpi_roles set name=trim(payload->>'name'),description=nullif(payload->>'description',''),scoring_model=coalesce(nullif(payload->>'scoring_model',''),'staff_equal'),is_active=coalesce((payload->>'is_active')::boolean,true),updated_at=now() where id=role_id returning id into saved; end if;
  return saved;
end; $$;

create or replace function public.save_kpi_category(category_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare saved uuid;
begin
  if not public.current_user_has_permission('kpi.manage') then raise exception 'Akses pengelola KPI diperlukan.' using errcode='42501'; end if;
  if category_id is null then insert into public.kpi_categories(kpi_role_id,name,weight,sort_order) values((payload->>'kpi_role_id')::uuid,trim(payload->>'name'),(payload->>'weight')::numeric,coalesce((payload->>'sort_order')::int,100)) returning id into saved;
  else update public.kpi_categories set name=trim(payload->>'name'),weight=(payload->>'weight')::numeric,sort_order=coalesce((payload->>'sort_order')::int,100) where id=category_id returning id into saved; end if;
  return saved;
end; $$;

create or replace function public.save_kpi_template(template_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare saved uuid;
begin
  if not public.current_user_has_permission('kpi.manage') then raise exception 'Akses pengelola KPI diperlukan.' using errcode='42501'; end if;
  if template_id is null then insert into public.kpi_templates(kpi_role_id,category_id,code,name,description,formula_type,target_value,unit,item_weight,evidence_required,sort_order) values((payload->>'kpi_role_id')::uuid,nullif(payload->>'category_id','')::uuid,upper(trim(payload->>'code')),trim(payload->>'name'),nullif(payload->>'description',''),payload->>'formula_type',(payload->>'target_value')::numeric,coalesce(nullif(payload->>'unit',''),'unit'),nullif(payload->>'item_weight','')::numeric,coalesce((payload->>'evidence_required')::boolean,true),coalesce((payload->>'sort_order')::int,100)) returning id into saved;
  else update public.kpi_templates set category_id=nullif(payload->>'category_id','')::uuid,code=upper(trim(payload->>'code')),name=trim(payload->>'name'),description=nullif(payload->>'description',''),formula_type=payload->>'formula_type',target_value=(payload->>'target_value')::numeric,unit=coalesce(nullif(payload->>'unit',''),'unit'),item_weight=nullif(payload->>'item_weight','')::numeric,evidence_required=coalesce((payload->>'evidence_required')::boolean,true),sort_order=coalesce((payload->>'sort_order')::int,100),updated_at=now() where id=template_id returning id into saved; end if;
  return saved;
end; $$;

create or replace function public.save_kpi_period(period_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); saved uuid; new_status text:=coalesce(nullif(payload->>'status',''),'draft');
begin
  if not public.current_user_has_permission('kpi.manage') then raise exception 'Akses pengelola KPI diperlukan.' using errcode='42501'; end if;
  if period_id is null then insert into public.kpi_periods(name,start_date,end_date,status,created_by_membership_id) values(trim(payload->>'name'),(payload->>'start_date')::date,(payload->>'end_date')::date,new_status,actor) returning id into saved;
  else update public.kpi_periods set name=trim(payload->>'name'),start_date=(payload->>'start_date')::date,end_date=(payload->>'end_date')::date,status=new_status,locked_at=case when new_status='locked' then now() else null end,locked_by_membership_id=case when new_status='locked' then actor else null end where id=period_id returning id into saved; update public.kpi_assignments set status=case when new_status='locked' then 'locked' when status='locked' then 'active' else status end,locked_at=case when new_status='locked' then now() else null end where public.kpi_assignments.period_id=period_id; end if;
  return saved;
end; $$;

create or replace function public.assign_kpi(assignment_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); saved uuid; role_uuid uuid:=(payload->>'kpi_role_id')::uuid; member_uuid uuid:=(payload->>'membership_id')::uuid;
begin
  if not public.current_user_has_permission('kpi.manage') then raise exception 'Akses pengelola KPI diperlukan.' using errcode='42501'; end if;
  if assignment_id is null then
    if not exists(select 1 from public.kpi_templates where kpi_role_id=role_uuid and is_active) then raise exception 'Role KPI belum mempunyai item KPI aktif.'; end if;
    if exists(select 1 from public.kpi_roles where id=role_uuid and scoring_model='category_weighted') and
       coalesce((select sum(weight) from public.kpi_categories where kpi_role_id=role_uuid and is_active),0)<>100 then raise exception 'Total bobot kategori wajib tepat 100%%.'; end if;
    insert into public.kpi_assignments(period_id,membership_id,kpi_role_id,reviewer_membership_id,role_snapshot,created_by_membership_id) select (payload->>'period_id')::uuid,member_uuid,role_uuid,nullif(payload->>'reviewer_membership_id','')::uuid,jsonb_build_object('role_name',name,'scoring_model',scoring_model),actor from public.kpi_roles where id=role_uuid returning id into saved;
    insert into public.kpi_results(assignment_id,template_id,category_id,code,name,category_name,category_weight,formula_type,target_value,unit,item_weight,evidence_required,sort_order)
      select saved,t.id,t.category_id,t.code,t.name,c.name,c.weight,t.formula_type,t.target_value,t.unit,t.item_weight,t.evidence_required,t.sort_order from public.kpi_templates t left join public.kpi_categories c on c.id=t.category_id where t.kpi_role_id=role_uuid and t.is_active order by t.sort_order;
  else
    update public.kpi_assignments set reviewer_membership_id=nullif(payload->>'reviewer_membership_id','')::uuid,updated_at=now() where id=assignment_id returning id into saved;
  end if;
  perform public.recalculate_kpi_assignment(saved); return saved;
end; $$;

create or replace function public.archive_kpi_config(config_type text,target_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.current_user_has_permission('kpi.manage') then raise exception 'Akses pengelola KPI diperlukan.' using errcode='42501'; end if;
  if config_type='role' then update public.kpi_roles set is_active=false,updated_at=now() where id=target_id;
  elsif config_type='category' then update public.kpi_categories set is_active=false where id=target_id;
  elsif config_type='template' then update public.kpi_templates set is_active=false,updated_at=now() where id=target_id;
  else raise exception 'Jenis konfigurasi tidak valid.'; end if;
end; $$;

create or replace function public.save_kpi_result(result_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); target public.kpi_results%rowtype; assignment public.kpi_assignments%rowtype; period_status text; raw numeric; reviewing boolean;
begin
  select * into target from public.kpi_results where id=result_id; select * into assignment from public.kpi_assignments where id=target.assignment_id; select status into period_status from public.kpi_periods where id=assignment.period_id;
  reviewing:=actor=assignment.reviewer_membership_id or public.current_user_has_permission('kpi.review') or public.current_user_has_permission('kpi.manage');
  if target.id is null or period_status='locked' or assignment.status='locked' then raise exception 'Periode KPI sudah dikunci.'; end if;
  if actor<>assignment.membership_id and not reviewing then raise exception 'KPI tidak dapat diperbarui.' using errcode='42501'; end if;
  raw:=public.kpi_score_item(target.formula_type,target.target_value,nullif(payload->>'actual_value','')::numeric);
  update public.kpi_results set actual_value=nullif(payload->>'actual_value','')::numeric,evidence_url=nullif(payload->>'evidence_url',''),note=nullif(payload->>'note',''),is_applicable=coalesce((payload->>'is_applicable')::boolean,true),raw_achievement=raw,score=case when raw is null then null else least(raw,100) end,
    reviewer_score=case when reviewing then nullif(payload->>'reviewer_score','')::numeric else reviewer_score end,review_note=case when reviewing then nullif(payload->>'review_note','') else review_note end,reviewed_by_membership_id=case when reviewing and nullif(payload->>'reviewer_score','') is not null then actor else reviewed_by_membership_id end,reviewed_at=case when reviewing and nullif(payload->>'reviewer_score','') is not null then now() else reviewed_at end,updated_at=now() where id=result_id;
  perform public.recalculate_kpi_assignment(target.assignment_id); return result_id;
end; $$;

create or replace function public.set_kpi_assignment_status(target_assignment_id uuid,new_status text)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); target public.kpi_assignments%rowtype;
begin
  select * into target from public.kpi_assignments where id=target_assignment_id;
  if new_status='submitted' and actor=target.membership_id then update public.kpi_assignments set status='submitted',updated_at=now() where id=target.id;
  elsif new_status='reviewed' and (actor=target.reviewer_membership_id or public.current_user_has_permission('kpi.review')) then update public.kpi_assignments set status='reviewed',reviewed_at=now(),updated_at=now() where id=target.id;
  else raise exception 'Perubahan status KPI tidak diizinkan.' using errcode='42501'; end if;
end; $$;

alter table public.kpi_roles enable row level security;
alter table public.kpi_categories enable row level security;
alter table public.kpi_templates enable row level security;
alter table public.kpi_periods enable row level security;
alter table public.kpi_assignments enable row level security;
alter table public.kpi_results enable row level security;
revoke all on public.kpi_roles,public.kpi_categories,public.kpi_templates,public.kpi_periods,public.kpi_assignments,public.kpi_results from anon,authenticated;
grant execute on function public.list_kpi_workspace(),public.list_kpi_results(uuid),public.save_kpi_role(uuid,jsonb),public.save_kpi_category(uuid,jsonb),public.save_kpi_template(uuid,jsonb),public.save_kpi_period(uuid,jsonb),public.assign_kpi(uuid,jsonb),public.save_kpi_result(uuid,jsonb),public.set_kpi_assignment_status(uuid,text),public.archive_kpi_config(text,uuid) to authenticated;
revoke execute on function public.list_kpi_workspace(),public.list_kpi_results(uuid),public.save_kpi_role(uuid,jsonb),public.save_kpi_category(uuid,jsonb),public.save_kpi_template(uuid,jsonb),public.save_kpi_period(uuid,jsonb),public.assign_kpi(uuid,jsonb),public.save_kpi_result(uuid,jsonb),public.set_kpi_assignment_status(uuid,text),public.archive_kpi_config(text,uuid) from anon,public;

-- Initial mappings are editable templates; new roles use the same staff formula without backend changes.
do $$ declare actor uuid; role_id uuid; begin
  select id into actor from public.memberships where status='active' order by created_at limit 1;
  if actor is null then return; end if;
  insert into public.kpi_roles(key,name,scoring_model,description,created_by_membership_id) values
    ('business_development','Business Development','staff_equal','KPI staf Business Development.',actor),
    ('growth_marketing','Growth Marketing','staff_equal','KPI staf Growth Marketing.',actor),
    ('social_media','Social Media Specialist','staff_equal','KPI staf Social Media.',actor),
    ('c_level','C-Level','category_weighted','Activity 35%, Output 35%, Impact 30%.',actor)
  on conflict(key) do nothing;
  select id into role_id from public.kpi_roles where key='c_level';
  insert into public.kpi_categories(kpi_role_id,name,weight,sort_order) values(role_id,'Activity',35,10),(role_id,'Output',35,20),(role_id,'Impact',30,30) on conflict(kpi_role_id,name) do update set weight=excluded.weight,sort_order=excluded.sort_order;
end $$;