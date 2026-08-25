-- Preserve immutable generated files by rotating a new Document Center version.

create or replace function public.register_report_artifact(
  target_snapshot uuid,kind text,url_value text,status_value text default 'ready'
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid:=public.current_membership_id();
  s public.report_snapshots%rowtype;
  saved uuid;
  doc uuid;
  key text;
  current_url text;
  next_version integer;
begin
  select * into s from public.report_snapshots where id=target_snapshot and owner_membership_id=actor;
  if s.id is null then raise exception 'Snapshot tidak dapat diakses.' using errcode='42501'; end if;
  if kind not in ('document','presentation','pdf') then raise exception 'Jenis output tidak valid.' using errcode='22023'; end if;
  key:=s.id::text||':'||kind;

  insert into public.report_artifacts(snapshot_id,artifact_type,url,status,idempotency_key,generated_at,generated_by_membership_id,error_message)
  values(s.id,kind,url_value,status_value,key,case when status_value='ready' then now() end,actor,null)
  on conflict(idempotency_key) do update set
    url=excluded.url,status=excluded.status,generated_at=excluded.generated_at,
    generated_by_membership_id=excluded.generated_by_membership_id,error_message=null
  returning id into saved;

  if status_value='ready' and nullif(url_value,'') is not null then
    insert into public.documents(
      document_id,title,document_type,category,owner_membership_id,source_module,
      linked_record_id,linked_record_name,status,classification,valid_from,
      created_by_membership_id,updated_by_membership_id
    ) values(
      'DOC-RPT-'||substr(replace(s.id::text,'-',''),1,12)||'-'||upper(substr(kind,1,3)),
      'Campus Innovate - '||initcap(s.report_type)||' 3P+Priority - '||s.period_start||' to '||s.period_end,
      case kind when 'document' then 'KPI Report' when 'presentation' then 'KPI Presentation' else 'KPI Report PDF' end,
      'Reports',actor,'reports',s.id::text,'Report Snapshot','effective','internal',s.period_start,actor,actor
    ) on conflict(document_id) do update set
      title=excluded.title,document_type=excluded.document_type,status='effective',
      updated_by_membership_id=actor,updated_at=now()
    returning id into doc;

    select v.drive_file_url into current_url
    from public.document_versions v where v.document_id=doc and v.is_current limit 1;

    if current_url is null then
      select coalesce(max(v.version_number),0)+1 into next_version from public.document_versions v where v.document_id=doc;
      insert into public.document_versions(
        document_id,version_number,file_name,drive_file_url,file_type,source_kind,
        revision_reason,revision_summary,is_current,immutable_at,created_by_membership_id
      ) values(
        doc,next_version,'Campus Innovate Report',url_value,kind,'generated',
        'Generated from report snapshot','Generated from immutable report snapshot',true,now(),actor
      );
    elsif current_url is distinct from url_value then
      update public.document_versions set is_current=false where document_id=doc and is_current;
      select coalesce(max(v.version_number),0)+1 into next_version from public.document_versions v where v.document_id=doc;
      insert into public.document_versions(
        document_id,version_number,file_name,drive_file_url,file_type,source_kind,
        revision_reason,revision_summary,is_current,immutable_at,created_by_membership_id
      ) values(
        doc,next_version,'Campus Innovate Report',url_value,kind,'generated',
        'Regenerated from report snapshot','Generated from immutable report snapshot',true,now(),actor
      );
    else
      select active_version into next_version from public.documents where id=doc;
    end if;

    update public.documents set active_version=coalesce(next_version,active_version),status='effective',updated_at=now() where id=doc;
    update public.report_artifacts set document_id=doc where id=saved;
    update public.report_drafts set status='published',updated_at=now() where id=s.report_id;
  end if;

  insert into public.report_usage_events(owner_membership_id,event_name,report_id,metadata)
  values(actor,'artifact_registered',s.report_id,jsonb_build_object('artifact_type',kind,'status',status_value));
  return saved;
end;
$$;

grant execute on function public.register_report_artifact(uuid,text,text,text) to authenticated;
revoke execute on function public.register_report_artifact(uuid,text,text,text) from anon,public;
