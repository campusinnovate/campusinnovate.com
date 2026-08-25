-- Ruang Kawan: Google Workspace template configuration and generated report registration.

alter table public.document_templates
  add column if not exists google_file_type text not null default 'document'
    check (google_file_type in ('document','presentation')),
  add column if not exists output_folder_url text,
  add column if not exists placeholder_map jsonb not null default '{}'::jsonb
    check (jsonb_typeof(placeholder_map) = 'object');

create or replace function public.list_workspace_generation_templates()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if public.current_membership_id() is null or not (
    public.current_user_has_permission('documents.view') or
    public.current_user_has_permission('reports.view_self')
  ) then
    raise exception 'Akses template Workspace diperlukan.' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',t.id,'template_code',t.template_code,'name',t.name,
      'document_type',t.document_type,'google_file_type',t.google_file_type,
      'drive_template_url',t.drive_template_url,'output_folder_url',t.output_folder_url,
      'required_fields',t.required_fields,'placeholder_map',t.placeholder_map,
      'active_version',t.active_version,'status',t.status
    ) order by t.name)
    from public.document_templates t
  ),'[]'::jsonb);
end;
$$;

create or replace function public.get_report_generation_payload(target_snapshot uuid,target_template uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare actor uuid:=public.current_membership_id();
begin
  if actor is null or not public.current_user_has_permission('reports.manage_self') then
    raise exception 'Akses generator report diperlukan.' using errcode='42501';
  end if;
  if not exists(select 1 from public.report_snapshots s where s.id=target_snapshot and s.owner_membership_id=actor) then
    raise exception 'Snapshot tidak dapat diakses.' using errcode='42501';
  end if;
  if not exists(select 1 from public.document_templates t where t.id=target_template and t.status='active') then
    raise exception 'Template aktif tidak ditemukan.' using errcode='22023';
  end if;
  return jsonb_build_object(
    'snapshot',(select jsonb_build_object(
      'id',s.id,'report_type',s.report_type,'period_start',s.period_start,
      'period_end',s.period_end,'score',s.score,'payload',s.payload_json,
      'owner_name',coalesce(m.full_name,m.email::text)
    ) from public.report_snapshots s join public.memberships m on m.id=s.owner_membership_id where s.id=target_snapshot),
    'kpis',coalesce((select jsonb_agg(to_jsonb(k) order by k.category) from public.report_snapshot_kpis k where k.snapshot_id=target_snapshot),'[]'::jsonb),
    'template',(select jsonb_build_object(
      'id',t.id,'name',t.name,'google_file_type',t.google_file_type,
      'drive_template_url',t.drive_template_url,'output_folder_url',t.output_folder_url,
      'placeholder_map',t.placeholder_map,'version',t.active_version
    ) from public.document_templates t where t.id=target_template)
  );
end;
$$;

create or replace function public.register_generated_report_artifact(
  target_snapshot uuid,kind text,url_value text,drive_id text,template_ver integer default null
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare saved uuid;
begin
  if kind not in ('document','presentation','pdf') then
    raise exception 'Jenis output tidak valid.' using errcode='22023';
  end if;
  saved:=public.register_report_artifact(target_snapshot,kind,url_value,'ready');
  update public.report_artifacts
  set drive_file_id=drive_id,template_version=template_ver,error_message=null
  where id=saved;
  update public.documents d set document_type=case kind when 'document' then 'KPI Report' when 'presentation' then 'KPI Presentation' else 'KPI Report PDF' end
  from public.report_artifacts a where a.id=saved and d.id=a.document_id;
  return saved;
end;
$$;

create or replace function public.save_document_template(template_id uuid,payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare actor uuid:=public.current_membership_id();saved uuid;
begin
  if not public.current_user_has_permission('documents.manage') then
    raise exception 'Akses pengelola template diperlukan.' using errcode='42501';
  end if;
  if template_id is null then
    insert into public.document_templates(
      template_code,name,document_type,description,owner_membership_id,status,
      effective_date,next_review_date,drive_template_url,required_fields,
      google_file_type,output_folder_url,placeholder_map,created_by_membership_id
    ) values(
      upper(trim(payload->>'template_code')),trim(payload->>'name'),trim(payload->>'document_type'),
      nullif(payload->>'description',''),coalesce(nullif(payload->>'owner_membership_id','')::uuid,actor),
      coalesce(nullif(payload->>'status',''),'draft'),nullif(payload->>'effective_date','')::date,
      nullif(payload->>'next_review_date','')::date,payload->>'drive_template_url',
      coalesce(payload->'required_fields','[]'::jsonb),coalesce(nullif(payload->>'google_file_type',''),'document'),
      nullif(payload->>'output_folder_url',''),coalesce(payload->'placeholder_map','{}'::jsonb),actor
    ) returning id into saved;
  else
    update public.document_templates set
      name=trim(payload->>'name'),document_type=trim(payload->>'document_type'),
      description=nullif(payload->>'description',''),
      owner_membership_id=coalesce(nullif(payload->>'owner_membership_id','')::uuid,owner_membership_id),
      status=payload->>'status',effective_date=nullif(payload->>'effective_date','')::date,
      next_review_date=nullif(payload->>'next_review_date','')::date,
      drive_template_url=payload->>'drive_template_url',required_fields=coalesce(payload->'required_fields',required_fields),
      google_file_type=coalesce(nullif(payload->>'google_file_type',''),google_file_type),
      output_folder_url=nullif(payload->>'output_folder_url',''),
      placeholder_map=coalesce(payload->'placeholder_map',placeholder_map),updated_at=now()
    where id=template_id returning id into saved;
  end if;
  return saved;
end;
$$;

grant execute on function public.list_workspace_generation_templates(),public.get_report_generation_payload(uuid,uuid),public.register_generated_report_artifact(uuid,text,text,text,integer) to authenticated;
revoke execute on function public.list_workspace_generation_templates(),public.get_report_generation_payload(uuid,uuid),public.register_generated_report_artifact(uuid,text,text,text,integer) from anon,public;
