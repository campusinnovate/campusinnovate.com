alter table public.noortura_open_house_rsvps
  add column if not exists invited_guest_name text
  check (invited_guest_name is null or char_length(invited_guest_name) between 2 and 120);

create or replace function public.register_noortura_open_house_rsvp(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_whatsapp text;
  normalized_email text;
  normalized_invited_guest_name text;
  active_count integer;
  new_id uuid;
  requested_slot text;
  requested_children jsonb;
  requested_child_count integer;
begin
  normalized_whatsapp := regexp_replace(coalesce(payload->>'whatsapp', ''), '[^0-9+]', '', 'g');
  normalized_email := lower(trim(coalesce(payload->>'email', '')));
  normalized_invited_guest_name := nullif(trim(coalesce(payload->>'invitedGuestName', '')), '');
  requested_slot := payload->>'slot';
  requested_children := coalesce(payload->'children', '[]'::jsonb);
  requested_child_count := coalesce((payload->>'childCount')::integer, 0);

  if char_length(trim(coalesce(payload->>'parentName', ''))) < 2 then
    raise exception using errcode = '22023', message = 'Nama orang tua atau pendamping belum valid.';
  end if;
  if normalized_invited_guest_name is not null and char_length(normalized_invited_guest_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'Nama tamu undangan belum valid.';
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
    invited_guest_name, parent_name, whatsapp, email, adult_count, child_count,
    children, arrival_slot, attendance_confidence, documentation_consent,
    privacy_consent, status
  ) values (
    normalized_invited_guest_name, trim(payload->>'parentName'), normalized_whatsapp,
    normalized_email, (payload->>'adultCount')::smallint, requested_child_count::smallint,
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
