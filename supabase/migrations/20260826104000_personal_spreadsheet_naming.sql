-- Name the private Coret-coret spreadsheet without changing its owner-only policy.

alter table public.personal_spreadsheets add column if not exists name text;

update public.personal_spreadsheets
set name=coalesce(nullif(trim(name),''),'Coret-coret '||to_char(created_at at time zone 'Asia/Jakarta','YYYY'))
where name is null or trim(name)='';

alter table public.personal_spreadsheets alter column name set default 'Coret-coret Pribadi';
alter table public.personal_spreadsheets alter column name set not null;

create or replace function public.rename_personal_spreadsheet(sheet_name text)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();clean_name text:=left(trim(sheet_name),120);
begin
 if actor is null or not public.current_user_has_permission('notes.manage_self') then raise exception 'Akses Coret-coret diperlukan.' using errcode='42501';end if;
 if clean_name='' then raise exception 'Nama spreadsheet wajib diisi.';end if;
 update public.personal_spreadsheets set name=clean_name,updated_at=now() where owner_membership_id=actor;
 if not found then raise exception 'Spreadsheet pribadi belum tersedia.';end if;
end;$$;

revoke all on function public.rename_personal_spreadsheet(text) from anon,public;
grant execute on function public.rename_personal_spreadsheet(text) to authenticated;
