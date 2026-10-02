-- Manual entries use the same canonical prospect and research format as Lead Research imports.
create or replace function public.create_manual_inbox_prospect(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  actor_id uuid:=public.current_membership_id(); saved_id uuid; account_value text;
  pic_value text; phone_value text; research jsonb; source_key text;
begin
  if actor_id is null or not public.current_user_has_permission('pipeline.manage_self') then
    raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501';
  end if;
  if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Data prospect tidak valid.'; end if;
  research:=coalesce(payload->'research','{}'::jsonb);
  if jsonb_typeof(research)<>'object' then raise exception 'Data riset tidak valid.'; end if;
  account_value:=trim(coalesce(payload->>'account_name',''));
  pic_value:=nullif(trim(payload->>'contact_name'),'');
  if char_length(account_value) not between 1 and 180 then raise exception 'Nama account wajib diisi (maksimal 180 karakter).'; end if;
  if char_length(coalesce(pic_value,''))>180 then raise exception 'Nama PIC maksimal 180 karakter.'; end if;
  if char_length(coalesce(payload->>'review_notes',''))>5000 then raise exception 'Catatan maksimal 5000 karakter.'; end if;
  if nullif(trim(payload->>'email'),'') is not null and trim(payload->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Format email tidak valid.'; end if;
  if nullif(trim(payload->>'website'),'') is not null and (trim(payload->>'website') !~* '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$' or trim(payload->>'website') ~ '[<>]') then raise exception 'Website harus berupa URL http/https yang valid.'; end if;
  phone_value:=trim(coalesce(payload->>'phone',''));
  if phone_value<>'' then
    phone_value:=regexp_replace(phone_value,'[[:space:]()+.\-]','','g');
    if left(phone_value,1)='0' then phone_value:='62'||substr(phone_value,2); end if;
    if phone_value !~ '^[1-9][0-9]{6,14}$' then raise exception 'Nomor telepon tidak valid. Gunakan kode negara.'; end if;
  end if;
  -- Serialize identical account/PIC submissions so two staff cannot create the same row at once.
  perform pg_advisory_xact_lock(hashtextextended(lower(account_value)||'|'||lower(coalesce(pic_value,'')),0));
  if exists(select 1 from public.prospects p where lower(trim(p.account_name))=lower(account_value)
    and lower(trim(coalesce(p.contact_name,'')))=lower(coalesce(pic_value,''))) then
    raise exception 'Account dan PIC ini sudah ada di Prospect Inbox. Cari dan buka record yang ada.' using errcode='23505';
  end if;
  insert into public.prospects(
    account_name,account_type,industry,city,website,phone,email,linkedin_url,primary_source,
    contact_name,contact_role,recommended_service,recommended_pipeline,recommended_business_unit,
    review_notes,inbox_status,raw_data,created_by_membership_id
  ) values (
    account_value,nullif(trim(payload->>'account_type'),''),nullif(trim(payload->>'industry'),''),
    nullif(trim(payload->>'city'),''),nullif(trim(payload->>'website'),''),nullif(phone_value,''),
    nullif(trim(payload->>'email'),''),nullif(trim(payload->>'linkedin_url'),''),'Manual',
    pic_value,nullif(trim(payload->>'contact_role'),''),nullif(trim(payload->>'recommended_service'),''),
    nullif(trim(payload->>'recommended_pipeline'),''),nullif(trim(payload->>'recommended_business_unit'),''),
    coalesce(payload->>'review_notes',''),'new',jsonb_build_object('origin','manual_prospect_inbox'),actor_id
  ) returning id into saved_id;
  source_key:='manual:'||saved_id::text;
  insert into public.prospect_research_records(
    prospect_id,source_file_id,source_sheet_name,source_row_number,source_status,
    company_institution,pic,position,pipeline_category,description,context_findings,
    potential_problem_opportunity,recommended_solution,budget,authority,need,timeline,
    confidence,evidence_sources,suggested_outreach_angle,next_action,linkedin_saved_lead,
    research_date,position_status,verified_current_position,verified_current_organization,
    position_verification_source,company_website_social_media,review_manual_bd_ceo,
    review_manual_cto_digital_system,raw_snapshot
  ) values (
    saved_id,source_key,'Manual',1,'New',account_value,pic_value,nullif(trim(payload->>'contact_role'),''),
    nullif(trim(payload->>'recommended_pipeline'),''),nullif(trim(research->>'description'),''),
    nullif(trim(research->>'context_findings'),''),nullif(trim(research->>'potential_problem_opportunity'),''),
    nullif(trim(research->>'recommended_solution'),''),nullif(trim(research->>'budget'),''),
    nullif(trim(research->>'authority'),''),nullif(trim(research->>'need'),''),
    nullif(trim(research->>'timeline'),''),nullif(trim(research->>'confidence'),''),
    nullif(trim(research->>'evidence_sources'),''),nullif(trim(research->>'suggested_outreach_angle'),''),
    nullif(trim(research->>'next_action'),''),nullif(trim(research->>'linkedin_saved_lead'),''),
    nullif(trim(research->>'research_date'),''),nullif(trim(research->>'position_status'),''),
    nullif(trim(research->>'verified_current_position'),''),nullif(trim(research->>'verified_current_organization'),''),
    nullif(trim(research->>'position_verification_source'),''),nullif(trim(research->>'company_website_social_media'),''),
    nullif(trim(research->>'review_manual_bd_ceo'),''),nullif(trim(research->>'review_manual_cto_digital_system'),''),
    research||jsonb_build_object('company_institution',account_value,'pic',coalesce(pic_value,''),'source','Manual')
  );
  insert into public.prospect_review_events(prospect_id,actor_membership_id,event_type,changed_fields,previous_status,new_status)
  values(saved_id,actor_id,'details_updated',array['manual_create'],null,'new');
  return saved_id;
end; $$;

revoke all on function public.create_manual_inbox_prospect(jsonb) from public,anon;
grant execute on function public.create_manual_inbox_prospect(jsonb) to authenticated;
