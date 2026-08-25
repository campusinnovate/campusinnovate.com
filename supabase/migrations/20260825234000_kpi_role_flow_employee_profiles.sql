-- Ruang Kawan: role-complete KPI workflow, weekly updates, and employee directory/profile.
-- Additive migration: existing KPI assignments, results, memberships, and private profiles remain intact.

insert into public.permissions(key,name,description) values
 ('kpi.create_self','Tambah KPI sendiri','Menambahkan KPI personal pada assignment milik sendiri.'),
 ('employee_profile.view_directory','Lihat direktori pegawai','Melihat profil kerja dan rekening anggota internal aktif.')
on conflict(key) do update set name=excluded.name,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key in ('system_admin','executive','project_lead','finance_manager','people_hr_manager','staff','freelancer')
  and p.key in ('kpi.create_self','employee_profile.view_directory','employee_profile.view_sensitive')
on conflict do nothing;

alter table public.kpi_assignments drop constraint if exists kpi_assignments_status_check;
alter table public.kpi_assignments add constraint kpi_assignments_status_check
 check(status in ('active','submitted','revision_requested','reviewed','locked','cancelled'));
alter table public.kpi_assignments add column if not exists review_note text;
alter table public.kpi_assignments add column if not exists submitted_at timestamptz;

alter table public.kpi_templates add column if not exists aggregation_method text not null default 'sum';
alter table public.kpi_templates drop constraint if exists kpi_templates_aggregation_method_check;
alter table public.kpi_templates add constraint kpi_templates_aggregation_method_check check(aggregation_method in ('sum','average','latest'));
alter table public.kpi_results add column if not exists aggregation_method text not null default 'sum';
alter table public.kpi_results drop constraint if exists kpi_results_aggregation_method_check;
alter table public.kpi_results add constraint kpi_results_aggregation_method_check check(aggregation_method in ('sum','average','latest'));

create table public.kpi_weekly_updates(
 id uuid primary key default extensions.gen_random_uuid(),
 result_id uuid not null references public.kpi_results(id) on delete cascade,
 week_start date not null,
 week_end date not null check(week_end>=week_start and week_end-week_start<=6),
 actual_value numeric(18,4),
 evidence_url text,
 progress text,
 problem text,
 plan text,
 priority text,
 justification text,
 updated_by_membership_id uuid not null references public.memberships(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(result_id,week_start,week_end)
);
create index kpi_weekly_updates_result_week_idx on public.kpi_weekly_updates(result_id,week_start);

create table public.kpi_events(
 id bigint generated always as identity primary key,
 assignment_id uuid not null references public.kpi_assignments(id) on delete cascade,
 result_id uuid references public.kpi_results(id) on delete cascade,
 actor_membership_id uuid references public.memberships(id),
 action text not null,
 before_data jsonb,
 after_data jsonb,
 reason text,
 created_at timestamptz not null default now()
);
create index kpi_events_assignment_created_idx on public.kpi_events(assignment_id,created_at desc);

create or replace function public.kpi_assignment_detail(target_assignment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();target public.kpi_assignments%rowtype;
begin
 select * into target from public.kpi_assignments where id=target_assignment_id;
 if target.id is null or not(target.membership_id=actor or target.reviewer_membership_id=actor or public.current_user_has_permission('kpi.view_all') or public.current_user_has_permission('kpi.manage')) then raise exception 'KPI tidak dapat diakses.' using errcode='42501';end if;
 return jsonb_build_object(
  'results',coalesce((select jsonb_agg(to_jsonb(r) order by r.sort_order,r.name) from public.kpi_results r where r.assignment_id=target.id),'[]'::jsonb),
  'weeks',coalesce((select jsonb_agg(jsonb_build_object('week_start',greatest(g::date,p.start_date),'week_end',least((g+interval '6 days')::date,p.end_date),'label',to_char(greatest(g::date,p.start_date),'DD Mon')||' - '||to_char(least((g+interval '6 days')::date,p.end_date),'DD Mon YYYY')) order by g) from public.kpi_periods p cross join lateral generate_series(date_trunc('week',p.start_date)::date,p.end_date,interval '7 days') g where p.id=target.period_id),'[]'::jsonb),
  'updates',coalesce((select jsonb_agg(to_jsonb(u) order by u.week_start,r.sort_order) from public.kpi_weekly_updates u join public.kpi_results r on r.id=u.result_id where r.assignment_id=target.id),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select * from public.kpi_events where assignment_id=target.id order by created_at desc limit 30)e),'[]'::jsonb)
 );
end;$$;

create or replace function public.save_kpi_weekly_update(target_result_id uuid,target_week_start date,target_week_end date,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();result_row public.kpi_results%rowtype;assignment public.kpi_assignments%rowtype;period public.kpi_periods%rowtype;saved uuid;before_row jsonb;aggregated numeric;latest_evidence text;latest_note text;
begin
 select * into result_row from public.kpi_results where id=target_result_id;
 select * into assignment from public.kpi_assignments where id=result_row.assignment_id;
 select * into period from public.kpi_periods where id=assignment.period_id;
 if actor is null or actor<>assignment.membership_id or not public.current_user_has_permission('kpi.update_self') then raise exception 'Hanya pemilik KPI yang dapat mengisi pembaruan mingguan.' using errcode='42501';end if;
 if assignment.status not in ('active','revision_requested') or period.status not in ('open','draft') then raise exception 'KPI tidak sedang terbuka untuk pembaruan.';end if;
 if target_week_start<period.start_date or target_week_end>period.end_date or target_week_end-target_week_start>6 then raise exception 'Rentang minggu berada di luar periode KPI.';end if;
 select to_jsonb(u) into before_row from public.kpi_weekly_updates u where u.result_id=target_result_id and u.week_start=target_week_start and u.week_end=target_week_end;
 insert into public.kpi_weekly_updates(result_id,week_start,week_end,actual_value,evidence_url,progress,problem,plan,priority,justification,updated_by_membership_id)
 values(target_result_id,target_week_start,target_week_end,nullif(payload->>'actual_value','')::numeric,nullif(payload->>'evidence_url',''),nullif(payload->>'progress',''),nullif(payload->>'problem',''),nullif(payload->>'plan',''),nullif(payload->>'priority',''),nullif(payload->>'justification',''),actor)
 on conflict(result_id,week_start,week_end) do update set actual_value=excluded.actual_value,evidence_url=excluded.evidence_url,progress=excluded.progress,problem=excluded.problem,plan=excluded.plan,priority=excluded.priority,justification=excluded.justification,updated_by_membership_id=actor,updated_at=now() returning id into saved;
 select case result_row.aggregation_method when 'average' then avg(u.actual_value) when 'latest' then (array_agg(u.actual_value order by u.week_end desc) filter(where u.actual_value is not null))[1] else sum(u.actual_value) end,
   (array_agg(u.evidence_url order by u.week_end desc) filter(where u.evidence_url is not null))[1],
   (array_agg(concat_ws(E'\n',u.progress,u.problem,u.plan,u.priority,u.justification) order by u.week_end desc))[1]
 into aggregated,latest_evidence,latest_note from public.kpi_weekly_updates u where u.result_id=target_result_id;
 update public.kpi_results set actual_value=aggregated,evidence_url=latest_evidence,note=latest_note,raw_achievement=public.kpi_score_item(formula_type,target_value,aggregated),score=case when public.kpi_score_item(formula_type,target_value,aggregated) is null then null else least(public.kpi_score_item(formula_type,target_value,aggregated),100) end,updated_at=now() where id=target_result_id;
 perform public.recalculate_kpi_assignment(assignment.id);
 insert into public.kpi_events(assignment_id,result_id,actor_membership_id,action,before_data,after_data) values(assignment.id,target_result_id,actor,'weekly_update.saved',before_row,payload||jsonb_build_object('week_start',target_week_start,'week_end',target_week_end));
 return saved;
end;$$;

create or replace function public.create_my_kpi_item(target_assignment_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();assignment public.kpi_assignments%rowtype;saved uuid;category public.kpi_categories%rowtype;code_value text;
begin
 select * into assignment from public.kpi_assignments where id=target_assignment_id;
 if assignment.id is null or assignment.membership_id<>actor or not public.current_user_has_permission('kpi.create_self') then raise exception 'KPI personal tidak dapat ditambahkan.' using errcode='42501';end if;
 if assignment.status not in ('active','revision_requested') then raise exception 'Assignment KPI tidak terbuka.';end if;
 if nullif(payload->>'category_id','') is not null then select * into category from public.kpi_categories where id=(payload->>'category_id')::uuid and kpi_role_id=assignment.kpi_role_id and is_active;end if;
 code_value:='USR-'||upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,8));
 insert into public.kpi_results(assignment_id,category_id,code,name,category_name,category_weight,formula_type,target_value,unit,item_weight,evidence_required,aggregation_method,sort_order)
 values(assignment.id,category.id,code_value,trim(payload->>'name'),category.name,category.weight,coalesce(nullif(payload->>'formula_type',''),'higher_better'),(payload->>'target_value')::numeric,coalesce(nullif(payload->>'unit',''),'unit'),nullif(payload->>'item_weight','')::numeric,coalesce((payload->>'evidence_required')::boolean,true),coalesce(nullif(payload->>'aggregation_method',''),'sum'),1000+(select count(*) from public.kpi_results where assignment_id=assignment.id)) returning id into saved;
 insert into public.kpi_events(assignment_id,result_id,actor_membership_id,action,after_data) values(assignment.id,saved,actor,'personal_kpi.created',payload);
 return saved;
end;$$;

create or replace function public.transition_kpi_assignment(target_assignment_id uuid,new_status text,reason text default null)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();target public.kpi_assignments%rowtype;before_status text;
begin
 select * into target from public.kpi_assignments where id=target_assignment_id;before_status:=target.status;
 if target.id is null then raise exception 'Assignment KPI tidak ditemukan.';end if;
 if new_status='submitted' then
  if actor<>target.membership_id or target.status not in ('active','revision_requested') then raise exception 'KPI tidak dapat diajukan.' using errcode='42501';end if;
  if not exists(select 1 from public.kpi_results where assignment_id=target.id and is_applicable) then raise exception 'Tambahkan minimal satu KPI sebelum diajukan.';end if;
  if exists(select 1 from public.kpi_results where assignment_id=target.id and is_applicable and (actual_value is null or (evidence_required and nullif(evidence_url,'') is null))) then raise exception 'Lengkapi aktual dan evidence seluruh KPI yang berlaku.';end if;
  update public.kpi_assignments set status='submitted',submitted_at=now(),review_note=null,updated_at=now() where id=target.id;
 elsif new_status='revision_requested' then
  if not(actor=target.reviewer_membership_id or public.current_user_has_permission('kpi.review')) or target.status<>'submitted' or nullif(trim(reason),'') is null then raise exception 'Alasan revisi wajib diisi oleh reviewer.' using errcode='42501';end if;
  update public.kpi_assignments set status='revision_requested',review_note=trim(reason),updated_at=now() where id=target.id;
 elsif new_status='reviewed' then
  if not(actor=target.reviewer_membership_id or public.current_user_has_permission('kpi.review')) or target.status<>'submitted' then raise exception 'Review KPI tidak diizinkan.' using errcode='42501';end if;
  update public.kpi_assignments set status='reviewed',review_note=nullif(trim(reason),''),reviewed_at=now(),updated_at=now() where id=target.id;
 else raise exception 'Transisi status KPI tidak valid.';
 end if;
 insert into public.kpi_events(assignment_id,actor_membership_id,action,before_data,after_data,reason) values(target.id,actor,'assignment.'||new_status,jsonb_build_object('status',before_status),jsonb_build_object('status',new_status),reason);
end;$$;

create or replace function public.set_kpi_assignment_status(target_assignment_id uuid,new_status text)
returns void language plpgsql security definer set search_path=public as $$begin perform public.transition_kpi_assignment(target_assignment_id,new_status,null);end;$$;

create or replace function public.save_kpi_template(template_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare saved uuid;
begin
 if not public.current_user_has_permission('kpi.manage') then raise exception 'Akses pengelola KPI diperlukan.' using errcode='42501';end if;
 if template_id is null then
  insert into public.kpi_templates(kpi_role_id,category_id,code,name,description,formula_type,target_value,unit,item_weight,evidence_required,aggregation_method,sort_order)
  values((payload->>'kpi_role_id')::uuid,nullif(payload->>'category_id','')::uuid,upper(trim(payload->>'code')),trim(payload->>'name'),nullif(payload->>'description',''),payload->>'formula_type',(payload->>'target_value')::numeric,coalesce(nullif(payload->>'unit',''),'unit'),nullif(payload->>'item_weight','')::numeric,coalesce((payload->>'evidence_required')::boolean,true),coalesce(nullif(payload->>'aggregation_method',''),'sum'),coalesce((payload->>'sort_order')::int,100)) returning id into saved;
 else
  update public.kpi_templates set category_id=nullif(payload->>'category_id','')::uuid,code=upper(trim(payload->>'code')),name=trim(payload->>'name'),description=nullif(payload->>'description',''),formula_type=payload->>'formula_type',target_value=(payload->>'target_value')::numeric,unit=coalesce(nullif(payload->>'unit',''),'unit'),item_weight=nullif(payload->>'item_weight','')::numeric,evidence_required=coalesce((payload->>'evidence_required')::boolean,true),aggregation_method=coalesce(nullif(payload->>'aggregation_method',''),'sum'),sort_order=coalesce((payload->>'sort_order')::int,100),updated_at=now() where id=template_id returning id into saved;
 end if;return saved;
end;$$;

create or replace function public.save_kpi_result(result_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();target public.kpi_results%rowtype;assignment public.kpi_assignments%rowtype;period_status text;raw numeric;reviewing boolean;before_row jsonb;
begin
 select * into target from public.kpi_results where id=result_id;select * into assignment from public.kpi_assignments where id=target.assignment_id;select status into period_status from public.kpi_periods where id=assignment.period_id;
 reviewing:=actor=assignment.reviewer_membership_id or public.current_user_has_permission('kpi.review') or public.current_user_has_permission('kpi.manage');
 if target.id is null or period_status='locked' or assignment.status='locked' then raise exception 'Periode KPI sudah dikunci.';end if;
 select to_jsonb(target) into before_row;
 if actor=assignment.membership_id then
  if assignment.status not in ('active','revision_requested') or not public.current_user_has_permission('kpi.update_self') then raise exception 'KPI tidak terbuka untuk diperbarui.' using errcode='42501';end if;
  raw:=public.kpi_score_item(target.formula_type,target.target_value,nullif(payload->>'actual_value','')::numeric);
  update public.kpi_results set actual_value=nullif(payload->>'actual_value','')::numeric,evidence_url=nullif(payload->>'evidence_url',''),note=nullif(payload->>'note',''),is_applicable=coalesce((payload->>'is_applicable')::boolean,true),raw_achievement=raw,score=case when raw is null then null else least(raw,100) end,updated_at=now() where id=result_id;
 elsif reviewing then
  if assignment.status<>'submitted' then raise exception 'Penilaian reviewer hanya dapat diisi saat Menunggu Review.';end if;
  update public.kpi_results set reviewer_score=nullif(payload->>'reviewer_score','')::numeric,review_note=nullif(payload->>'review_note',''),reviewed_by_membership_id=case when nullif(payload->>'reviewer_score','') is not null then actor else reviewed_by_membership_id end,reviewed_at=case when nullif(payload->>'reviewer_score','') is not null then now() else reviewed_at end,updated_at=now() where id=result_id;
 else raise exception 'KPI tidak dapat diperbarui.' using errcode='42501';
 end if;
 perform public.recalculate_kpi_assignment(target.assignment_id);
 insert into public.kpi_events(assignment_id,result_id,actor_membership_id,action,before_data,after_data) values(assignment.id,result_id,actor,case when actor=assignment.membership_id then 'result.updated' else 'result.reviewed' end,before_row,payload);
 return result_id;
end;$$;

create or replace function public.save_kpi_period(period_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();saved uuid;new_status text:=coalesce(nullif(payload->>'status',''),'draft');start_value date:=(payload->>'start_date')::date;end_value date:=(payload->>'end_date')::date;
begin
 if not public.current_user_has_permission('kpi.manage') then raise exception 'Akses pengelola KPI diperlukan.' using errcode='42501';end if;
 if end_value<start_value then raise exception 'Tanggal selesai harus setelah tanggal mulai.';end if;
 if period_id is null then insert into public.kpi_periods(name,start_date,end_date,status,created_by_membership_id) values(trim(payload->>'name'),start_value,end_value,new_status,actor) returning id into saved;
 else
  if new_status='locked' and exists(select 1 from public.kpi_assignments where public.kpi_assignments.period_id=$1 and status not in ('reviewed','cancelled','locked')) then raise exception 'Semua assignment harus selesai direview sebelum periode dikunci.';end if;
  update public.kpi_periods set name=trim(payload->>'name'),start_date=start_value,end_date=end_value,status=new_status,locked_at=case when new_status='locked' then now() else null end,locked_by_membership_id=case when new_status='locked' then actor else null end where id=period_id returning id into saved;
  update public.kpi_assignments set status=case when new_status='locked' and status='reviewed' then 'locked' when new_status<>'locked' and status='locked' then 'active' else status end,locked_at=case when new_status='locked' then now() else null end where public.kpi_assignments.period_id=$1;
 end if;return saved;
end;$$;

create or replace function public.kpi_role_access_matrix()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.current_user_has_permission('kpi.manage') then raise exception 'Akses pengelola KPI diperlukan.' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('role_key',r.key,'role_name',r.name,'permissions',coalesce((select jsonb_agg(p.key order by p.key) from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=r.id and p.key like 'kpi.%'),'[]'::jsonb)) order by r.name) from public.roles r),'[]'::jsonb);
end;$$;

-- Copy aggregation choices into future assignments while preserving the original RPC contract.
create or replace function public.assign_kpi(assignment_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();saved uuid;role_uuid uuid:=(payload->>'kpi_role_id')::uuid;member_uuid uuid:=(payload->>'membership_id')::uuid;
begin
 if not public.current_user_has_permission('kpi.manage') then raise exception 'Akses pengelola KPI diperlukan.' using errcode='42501';end if;
 if assignment_id is null then
  if exists(select 1 from public.kpi_roles where id=role_uuid and scoring_model='category_weighted') and coalesce((select sum(weight) from public.kpi_categories where kpi_role_id=role_uuid and is_active),0)<>100 then raise exception 'Total bobot kategori wajib tepat 100%%.';end if;
  insert into public.kpi_assignments(period_id,membership_id,kpi_role_id,reviewer_membership_id,role_snapshot,created_by_membership_id) select (payload->>'period_id')::uuid,member_uuid,role_uuid,nullif(payload->>'reviewer_membership_id','')::uuid,jsonb_build_object('role_name',name,'scoring_model',scoring_model),actor from public.kpi_roles where id=role_uuid returning id into saved;
  insert into public.kpi_results(assignment_id,template_id,category_id,code,name,category_name,category_weight,formula_type,target_value,unit,item_weight,evidence_required,aggregation_method,sort_order)
   select saved,t.id,t.category_id,t.code,t.name,c.name,c.weight,t.formula_type,t.target_value,t.unit,t.item_weight,t.evidence_required,t.aggregation_method,t.sort_order from public.kpi_templates t left join public.kpi_categories c on c.id=t.category_id where t.kpi_role_id=role_uuid and t.is_active order by t.sort_order;
 else update public.kpi_assignments set reviewer_membership_id=nullif(payload->>'reviewer_membership_id','')::uuid,updated_at=now() where id=assignment_id returning id into saved;end if;
 perform public.recalculate_kpi_assignment(saved);return saved;
end;$$;

-- Role choices used by the organization; legacy c_level remains available for old assignments.
do $$declare actor uuid;role_id uuid;role_key text;begin
 select id into actor from public.memberships where status='active' order by created_at limit 1;if actor is null then return;end if;
 insert into public.kpi_roles(key,name,scoring_model,description,created_by_membership_id) values
  ('ceo','CEO','category_weighted','KPI CEO: operasional, output, dan impact bisnis.',actor),
  ('coo','COO','category_weighted','KPI COO: operasional, output, dan impact bisnis.',actor),
  ('cto','CTO','category_weighted','KPI CTO: operasional, output, dan impact bisnis.',actor),
  ('project_lead','Project Lead','staff_equal','KPI Project Lead per periode.',actor),
  ('freelance','Freelance','staff_equal','KPI berbasis deliverable untuk tenaga freelance.',actor)
 on conflict(key) do update set name=excluded.name,description=excluded.description,is_active=true;
 foreach role_key in array array['ceo','coo','cto','c_level'] loop
  select id into role_id from public.kpi_roles where key=role_key;
  if role_id is not null then
   update public.kpi_categories set name='AKTIVITAS OPERASIONAL' where kpi_role_id=role_id and lower(name)='activity';
   update public.kpi_categories set name='OUTPUT / DELIVERABLES' where kpi_role_id=role_id and lower(name)='output';
   update public.kpi_categories set name='IMPACT BISNIS' where kpi_role_id=role_id and lower(name)='impact';
   insert into public.kpi_categories(kpi_role_id,name,weight,sort_order) values(role_id,'AKTIVITAS OPERASIONAL',35,10),(role_id,'OUTPUT / DELIVERABLES',35,20),(role_id,'IMPACT BISNIS',30,30) on conflict(kpi_role_id,name) do update set weight=excluded.weight,sort_order=excluded.sort_order,is_active=true;
  end if;
 end loop;
end$$;

alter table public.employee_private_profiles add column if not exists preferred_name text;
alter table public.employee_private_profiles add column if not exists city text;
alter table public.employee_private_profiles add column if not exists birth_date date;
alter table public.employee_private_profiles add column if not exists tax_id text;
alter table public.employee_private_profiles add column if not exists bank_branch text;
alter table public.employee_private_profiles add column if not exists employment_start_date date;

create table public.employee_profile_events(
 id bigint generated always as identity primary key,
 membership_id uuid not null references public.memberships(id) on delete cascade,
 actor_membership_id uuid not null references public.memberships(id),
 action text not null,
 before_data jsonb,
 after_data jsonb,
 created_at timestamptz not null default now()
);

create or replace function public.employee_directory()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();
begin
 if actor is null or not public.current_user_has_permission('employee_profile.view_directory') then raise exception 'Akses direktori pegawai diperlukan.' using errcode='42501';end if;
 return jsonb_build_object(
  'my_membership_id',actor,
  'can_manage',public.current_user_has_permission('employee_profile.manage_sensitive'),
  'members',coalesce((select jsonb_agg(jsonb_build_object('membership_id',m.id,'full_name',coalesce(m.full_name,pr.full_name,m.email::text),'email',m.email::text,'avatar_url',pr.avatar_url,'position_name',pos.name,'department_name',d.name,'engagement_type',m.engagement_type,'preferred_name',ep.preferred_name,'phone',ep.phone,'address',ep.address,'city',ep.city,'birth_date',ep.birth_date,'employment_start_date',ep.employment_start_date,'emergency_contact_name',ep.emergency_contact_name,'emergency_contact_phone',ep.emergency_contact_phone,'administrative_id',ep.administrative_id,'tax_id',ep.tax_id,'bank_name',ep.bank_name,'bank_branch',ep.bank_branch,'bank_account_number',ep.bank_account_number,'bank_account_holder',ep.bank_account_holder,'employee_document_urls',ep.employee_document_urls,'administrative_notes',ep.administrative_notes,'updated_at',ep.updated_at) order by coalesce(m.full_name,pr.full_name,m.email::text)) from public.memberships m left join public.profiles pr on pr.user_id=m.user_id left join public.positions pos on pos.id=m.position_id left join public.departments d on d.id=m.department_id left join public.employee_private_profiles ep on ep.membership_id=m.id where m.status='active'),'[]'::jsonb)
 );
end;$$;

create or replace function public.save_employee_profile(target_membership_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();before_row jsonb;saved uuid;can_manage boolean:=public.current_user_has_permission('employee_profile.manage_sensitive');account text:=nullif(trim(payload->>'bank_account_number'),'');
begin
 if actor is null or not(actor=target_membership_id or can_manage) then raise exception 'Profil pegawai tidak dapat diubah.' using errcode='42501';end if;
 if actor=target_membership_id and not public.current_user_has_permission('employee_profile.manage_self') then raise exception 'Izin mengubah profil diperlukan.' using errcode='42501';end if;
 select to_jsonb(ep) into before_row from public.employee_private_profiles ep where ep.membership_id=target_membership_id;
 insert into public.employee_private_profiles(membership_id,preferred_name,phone,address,city,birth_date,employment_start_date,emergency_contact_name,emergency_contact_phone,administrative_id,tax_id,bank_name,bank_branch,bank_account_number,bank_account_holder,employee_document_urls,administrative_notes,updated_by_membership_id)
 values(target_membership_id,nullif(trim(payload->>'preferred_name'),''),nullif(trim(payload->>'phone'),''),nullif(trim(payload->>'address'),''),nullif(trim(payload->>'city'),''),nullif(payload->>'birth_date','')::date,nullif(payload->>'employment_start_date','')::date,nullif(trim(payload->>'emergency_contact_name'),''),nullif(trim(payload->>'emergency_contact_phone'),''),nullif(trim(payload->>'administrative_id'),''),nullif(trim(payload->>'tax_id'),''),nullif(trim(payload->>'bank_name'),''),nullif(trim(payload->>'bank_branch'),''),account,nullif(trim(payload->>'bank_account_holder'),''),coalesce(payload->'employee_document_urls','[]'::jsonb),nullif(trim(payload->>'administrative_notes'),''),actor)
 on conflict(membership_id) do update set preferred_name=excluded.preferred_name,phone=excluded.phone,address=excluded.address,city=excluded.city,birth_date=excluded.birth_date,employment_start_date=excluded.employment_start_date,emergency_contact_name=excluded.emergency_contact_name,emergency_contact_phone=excluded.emergency_contact_phone,administrative_id=excluded.administrative_id,tax_id=excluded.tax_id,bank_name=excluded.bank_name,bank_branch=excluded.bank_branch,bank_account_number=excluded.bank_account_number,bank_account_holder=excluded.bank_account_holder,employee_document_urls=excluded.employee_document_urls,administrative_notes=excluded.administrative_notes,updated_by_membership_id=actor,updated_at=now() returning membership_id into saved;
 update public.memberships set full_name=coalesce(nullif(trim(payload->>'full_name'),''),full_name),updated_at=now() where id=target_membership_id;
 update public.profiles set full_name=coalesce(nullif(trim(payload->>'full_name'),''),full_name),updated_at=now() where user_id=(select user_id from public.memberships where id=target_membership_id);
 insert into public.employee_profile_events(membership_id,actor_membership_id,action,before_data,after_data) values(saved,actor,'profile.updated',case when before_row is null then null else before_row-'bank_account_number'||jsonb_build_object('bank_account_last4',right(coalesce(before_row->>'bank_account_number',''),4)) end,(payload-'bank_account_number')||jsonb_build_object('bank_account_last4',right(coalesce(account,''),4)));
 return saved;
end;$$;

alter table public.kpi_weekly_updates enable row level security;
alter table public.kpi_events enable row level security;
alter table public.employee_profile_events enable row level security;
revoke all on public.kpi_weekly_updates,public.kpi_events,public.employee_profile_events from anon,authenticated;
revoke all on function public.kpi_assignment_detail(uuid),public.save_kpi_weekly_update(uuid,date,date,jsonb),public.create_my_kpi_item(uuid,jsonb),public.transition_kpi_assignment(uuid,text,text),public.kpi_role_access_matrix(),public.employee_directory(),public.save_employee_profile(uuid,jsonb) from anon,public;
grant execute on function public.kpi_assignment_detail(uuid),public.save_kpi_weekly_update(uuid,date,date,jsonb),public.create_my_kpi_item(uuid,jsonb),public.transition_kpi_assignment(uuid,text,text),public.kpi_role_access_matrix(),public.employee_directory(),public.save_employee_profile(uuid,jsonb) to authenticated;
