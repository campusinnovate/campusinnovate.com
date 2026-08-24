-- Protect effective documents, immutable versions, and report revision history.

create or replace function public.enforce_document_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status is distinct from new.status and not (
    (old.status = 'draft' and new.status in ('review', 'archived', 'void')) or
    (old.status = 'review' and new.status in ('draft', 'effective', 'archived', 'void')) or
    (old.status = 'effective' and new.status in ('revised', 'archived', 'void')) or
    (old.status = 'revised' and new.status in ('review', 'effective', 'archived', 'void')) or
    (old.status = 'superseded' and new.status = 'archived')
  ) then
    raise exception 'Transisi status dokumen % ke % tidak diizinkan.', old.status, new.status;
  end if;

  if old.status in ('effective', 'superseded', 'archived', 'void') and (
    old.title is distinct from new.title or
    old.document_type is distinct from new.document_type or
    old.category is distinct from new.category or
    old.description is distinct from new.description or
    old.owner_membership_id is distinct from new.owner_membership_id or
    old.source_module is distinct from new.source_module or
    old.linked_record_id is distinct from new.linked_record_id or
    old.linked_record_name is distinct from new.linked_record_name or
    old.classification is distinct from new.classification or
    old.tags is distinct from new.tags or
    old.official_number is distinct from new.official_number
  ) then
    raise exception 'Dokumen yang sudah berlaku tidak dapat ditimpa. Buat revisi baru.' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_lifecycle_guard on public.documents;
create trigger documents_lifecycle_guard
before update on public.documents
for each row execute function public.enforce_document_lifecycle();

create or replace function public.mark_effective_document_version_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'effective' and old.status is distinct from new.status then
    update public.document_versions
       set immutable_at = coalesce(immutable_at, now())
     where document_id = new.id and is_current;
  end if;
  return new;
end;
$$;

drop trigger if exists documents_effective_version_guard on public.documents;
create trigger documents_effective_version_guard
after update on public.documents
for each row execute function public.mark_effective_document_version_immutable();

create or replace function public.prevent_immutable_document_version_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.immutable_at is not null then
    raise exception 'Versi dokumen immutable tidak dapat diubah.' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists document_versions_immutable_guard on public.document_versions;
create trigger document_versions_immutable_guard
before update on public.document_versions
for each row execute function public.prevent_immutable_document_version_update();

update public.document_versions v
   set immutable_at = coalesce(v.immutable_at, now())
  from public.documents d
 where d.id = v.document_id
   and v.is_current
   and v.immutable_at is null
   and d.status in ('effective', 'superseded', 'archived', 'void');

create or replace function public.log_report_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_membership_id();
begin
  if new.revision > old.revision and actor is not null then
    insert into public.report_revision_logs(
      report_id, from_revision, to_revision, actor_membership_id,
      change_summary, changed_fields_json
    ) values (
      new.id, old.revision, new.revision, actor,
      'Report draft changed',
      jsonb_build_object('status_before', old.status, 'status_after', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists report_revision_audit on public.report_drafts;
create trigger report_revision_audit
after update of revision on public.report_drafts
for each row when (new.revision > old.revision)
execute function public.log_report_revision();

revoke all on function public.enforce_document_lifecycle(),
  public.mark_effective_document_version_immutable(),
  public.prevent_immutable_document_version_update(),
  public.log_report_revision()
from anon, authenticated, public;
