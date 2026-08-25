-- Allow authorized Marketing users to add and update brand profiles without
-- requiring a backend release for every new brand.

create or replace function public.save_marketing_brand_profile(target uuid, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid := public.current_membership_id();
  saved uuid;
  before_row jsonb;
  normalized_key text;
begin
  if actor is null or not public.current_user_has_permission('marketing.brand.manage') then
    raise exception 'Izin kelola Brand Config diperlukan.' using errcode='42501';
  end if;

  normalized_key := lower(regexp_replace(trim(payload->>'brand_key'), '[^a-zA-Z0-9]+', '_', 'g'));
  normalized_key := trim(both '_' from normalized_key);
  if normalized_key = '' or nullif(trim(payload->>'name'), '') is null then
    raise exception 'Nama dan kode brand wajib diisi.' using errcode='22023';
  end if;

  if target is null then
    insert into public.marketing_brand_profiles(
      brand_key,name,description,voice_tone,primary_colors,secondary_colors,font_notes,
      logo_url,asset_folder_url,guideline_url,notes,updated_by_membership_id
    ) values (
      normalized_key,trim(payload->>'name'),nullif(trim(payload->>'description'),''),nullif(trim(payload->>'voice_tone'),''),
      coalesce(array(select jsonb_array_elements_text(coalesce(payload->'primary_colors','[]'::jsonb))),'{}'::text[]),
      coalesce(array(select jsonb_array_elements_text(coalesce(payload->'secondary_colors','[]'::jsonb))),'{}'::text[]),
      nullif(trim(payload->>'font_notes'),''),nullif(trim(payload->>'logo_url'),''),
      nullif(trim(payload->>'asset_folder_url'),''),nullif(trim(payload->>'guideline_url'),''),
      nullif(trim(payload->>'notes'),''),actor
    ) returning id into saved;
  else
    select to_jsonb(b) into before_row from public.marketing_brand_profiles b where b.id=target;
    update public.marketing_brand_profiles set
      name=trim(payload->>'name'),description=nullif(trim(payload->>'description'),''),
      voice_tone=nullif(trim(payload->>'voice_tone'),''),
      primary_colors=coalesce(array(select jsonb_array_elements_text(coalesce(payload->'primary_colors','[]'::jsonb))),'{}'::text[]),
      secondary_colors=coalesce(array(select jsonb_array_elements_text(coalesce(payload->'secondary_colors','[]'::jsonb))),'{}'::text[]),
      font_notes=nullif(trim(payload->>'font_notes'),''),logo_url=nullif(trim(payload->>'logo_url'),''),
      asset_folder_url=nullif(trim(payload->>'asset_folder_url'),''),guideline_url=nullif(trim(payload->>'guideline_url'),''),
      notes=nullif(trim(payload->>'notes'),''),updated_by_membership_id=actor,updated_at=now()
    where id=target returning id into saved;
  end if;

  if saved is null then raise exception 'Brand tidak ditemukan.' using errcode='P0002'; end if;
  insert into public.marketing_events(entity_type,entity_id,actor_membership_id,action,before_data,after_data)
  values('brand_profile',saved,actor,case when target is null then 'create' else 'update' end,before_row,payload);
  return saved;
end;
$$;

revoke all on function public.save_marketing_brand_profile(uuid,jsonb) from anon,public;
grant execute on function public.save_marketing_brand_profile(uuid,jsonb) to authenticated;
