-- Allow an immutable current version to become historical during a controlled revision.
create or replace function public.prevent_immutable_document_version_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.immutable_at is not null and not (
    old.is_current
    and not new.is_current
    and (to_jsonb(new) - 'is_current') = (to_jsonb(old) - 'is_current')
  ) then
    raise exception 'Versi dokumen immutable tidak dapat diubah.' using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_immutable_document_version_update()
from anon, authenticated, public;
