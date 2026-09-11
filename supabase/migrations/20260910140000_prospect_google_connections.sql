-- OAuth secrets are encrypted by prospect-google and never exposed through client grants.
create table public.prospect_google_connections (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  google_subject text not null,
  email text not null,
  encrypted_tokens text not null,
  granted_scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, google_subject)
);
create table public.prospect_google_oauth_states (
  state_hash text primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  code_verifier text not null,
  expires_at timestamptz not null
);
alter table public.prospect_google_connections enable row level security;
alter table public.prospect_google_oauth_states enable row level security;
revoke all on public.prospect_google_connections, public.prospect_google_oauth_states from public, anon, authenticated;
grant select, insert, update, delete on public.prospect_google_connections, public.prospect_google_oauth_states to service_role;

-- One failed candidate rolls back the whole import; retrying cannot leave a half-imported batch.
create or replace function public.import_google_prospect_candidates(candidates jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare candidate jsonb; ids uuid[] := '{}'; prospect_id uuid;
begin
  if public.current_membership_id() is null or not public.current_user_has_permission('pipeline.manage_self') then
    raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501';
  end if;
  if jsonb_typeof(candidates) is distinct from 'array' then raise exception 'Data impor tidak valid.'; end if;
  if jsonb_array_length(candidates) not between 1 and 100 then raise exception 'Pilih 1 sampai 100 prospect.'; end if;
  for candidate in select value from jsonb_array_elements(candidates) loop
    if candidate->>'provider' is distinct from 'Google Sheets' then raise exception 'Sumber impor harus Google Sheets.'; end if;
    prospect_id := public.ingest_prospect_candidate(candidate);
    if not prospect_id = any(ids) then ids := array_append(ids, prospect_id); end if;
  end loop;
  return jsonb_build_object('processed',jsonb_array_length(candidates),'prospects',cardinality(ids));
end; $$;
revoke all on function public.import_google_prospect_candidates(jsonb) from public, anon;
grant execute on function public.import_google_prospect_candidates(jsonb) to authenticated;
notify pgrst, 'reload schema';
