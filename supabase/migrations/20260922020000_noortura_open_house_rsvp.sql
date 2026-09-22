create extension if not exists pgcrypto;

create table if not exists public.noortura_open_house_rsvps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_code text not null default 'NOORTURA_OH_2026',
  parent_name text not null check (char_length(parent_name) between 2 and 120),
  whatsapp text not null check (char_length(whatsapp) between 8 and 24),
  email text not null check (char_length(email) between 5 and 254),
  adult_count smallint not null check (adult_count between 1 and 4),
  child_count smallint not null check (child_count between 1 and 3),
  children jsonb not null check (jsonb_typeof(children) = 'array'),
  arrival_slot text not null check (arrival_slot in (
    '08.00','08.20','08.40','09.00','09.20','09.40',
    '10.00','10.20','10.40','11.00','11.20','11.40',
    '13.00','13.20','13.40','14.00','14.20','14.40'
  )),
  attendance_confidence smallint not null check (attendance_confidence in (50,75,100)),
  documentation_consent boolean not null,
  privacy_consent boolean not null,
  status text not null default 'confirmed' check (status in ('confirmed','tentative','attended','cancelled')),
  source text not null default 'campusinnovate.com/noortura',
  constraint noortura_rsvp_consent_required check (documentation_consent and privacy_consent),
  constraint noortura_rsvp_unique_whatsapp unique (event_code, whatsapp),
  constraint noortura_rsvp_unique_email unique (event_code, email)
);

alter table public.noortura_open_house_rsvps enable row level security;

revoke all on table public.noortura_open_house_rsvps from anon, authenticated;

create index if not exists idx_noortura_rsvp_slot_status
  on public.noortura_open_house_rsvps (event_code, arrival_slot, status);

create or replace function public.register_noortura_open_house_rsvp(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_whatsapp text;
  normalized_email text;
  active_count integer;
  new_id uuid;
  requested_slot text;
  requested_children jsonb;
  requested_child_count integer;
begin
  normalized_whatsapp := regexp_replace(coalesce(payload->>'whatsapp', ''), '[^0-9+]', '', 'g');
  normalized_email := lower(trim(coalesce(payload->>'email', '')));
  requested_slot := payload->>'slot';
  requested_children := coalesce(payload->'children', '[]'::jsonb);
  requested_child_count := coalesce((payload->>'childCount')::integer, 0);

  if char_length(trim(coalesce(payload->>'parentName', ''))) < 2 then
    raise exception using errcode = '22023', message = 'Nama orang tua atau pendamping belum valid.';
  end if;
  if normalized_whatsapp !~ '^\+?[0-9]{8,15}$' then
    raise exception using errcode = '22023', message = 'Nomor WhatsApp belum valid.';
  end if;
  if normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception using errcode = '22023', message = 'Alamat email belum valid.';
  end if;
  if requested_slot not in ('08.00','08.20','08.40','09.00','09.20','09.40','10.00','10.20','10.40','11.00','11.20','11.40','13.00','13.20','13.40','14.00','14.20','14.40') then
    raise exception using errcode = '22023', message = 'Slot kedatangan belum valid.';
  end if;
  if jsonb_typeof(requested_children) <> 'array' or jsonb_array_length(requested_children) <> requested_child_count then
    raise exception using errcode = '22023', message = 'Data anak belum lengkap.';
  end if;
  if payload->>'website' is not null and payload->>'website' <> '' then
    raise exception using errcode = '22023', message = 'Permintaan tidak valid.';
  end if;

  perform pg_advisory_xact_lock(hashtext('NOORTURA_OH_2026:' || requested_slot));

  select count(*)
    into active_count
    from public.noortura_open_house_rsvps
   where event_code = 'NOORTURA_OH_2026'
     and arrival_slot = requested_slot
     and status <> 'cancelled';

  if active_count >= 8 then
    raise exception using errcode = 'P0001', message = 'Slot ini sudah penuh. Silakan pilih waktu lain.';
  end if;

  insert into public.noortura_open_house_rsvps (
    parent_name, whatsapp, email, adult_count, child_count, children,
    arrival_slot, attendance_confidence, documentation_consent,
    privacy_consent, status
  ) values (
    trim(payload->>'parentName'), normalized_whatsapp, normalized_email,
    (payload->>'adultCount')::smallint, requested_child_count::smallint,
    requested_children, requested_slot, (payload->>'certainty')::smallint,
    coalesce((payload->>'documentation')::boolean, false),
    coalesce((payload->>'privacy')::boolean, false),
    case when (payload->>'certainty')::integer = 50 then 'tentative' else 'confirmed' end
  )
  returning id into new_id;

  return jsonb_build_object(
    'id', new_id,
    'slot', requested_slot,
    'remainingCapacity', 7 - active_count
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'WhatsApp atau email ini sudah terdaftar.';
end;
$$;

revoke all on function public.register_noortura_open_house_rsvp(jsonb) from public, anon, authenticated;
grant execute on function public.register_noortura_open_house_rsvp(jsonb) to service_role;

