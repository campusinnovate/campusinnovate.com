-- Count a recorded LinkedIn interaction as a verified contact channel for imported prospects.
create or replace function public.promote_ready_inbox_prospect(target_prospect_id uuid,target_source_id uuid,target_owner_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare p public.prospects%rowtype; lead_id uuid; entry_path text:=payload->>'entry_path'; due_on date;
begin
  if public.current_membership_id() is null or not public.current_user_has_permission('pipeline.manage_self') then
    raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501';
  end if;
  select * into p from public.prospects where id=target_prospect_id for update;
  if p.id is null then raise exception 'Prospect tidak ditemukan.'; end if;
  if p.promoted_lead_id is not null then return p.promoted_lead_id; end if;
  if p.inbox_status in ('junk','duplicate','replace_pic','new','needs_review') then
    raise exception 'Tandai prospect Potential dan pastikan bukan junk, duplicate, atau perlu ganti PIC.';
  end if;
  if nullif(trim(p.account_name),'') is null or nullif(trim(coalesce(p.contact_name,'')),'') is null
    or nullif(trim(coalesce(p.recommended_service,'')),'') is null
    or (nullif(trim(coalesce(p.linkedin_url,'')),'') is null and nullif(trim(coalesce(p.phone,'')),'') is null and nullif(trim(coalesce(p.email,'')),'') is null
      and not exists(select 1 from public.prospect_interactions i where i.prospect_id=p.id and i.channel='linkedin')) then
    raise exception 'Lengkapi account, PIC, layanan, dan minimal satu kanal kontak di review terlebih dahulu.';
  end if;
  if payload->>'fit_confirmed' is distinct from 'true' or payload->>'pic_confirmed' is distinct from 'true'
    or payload->>'service_confirmed' is distinct from 'true' then
    raise exception 'Konfirmasi fit, PIC, dan layanan sebelum masuk Pipeline.';
  end if;
  if entry_path not in ('active_outreach','opportunity') or length(trim(coalesce(payload->>'reason','')))<12
    or length(trim(coalesce(payload->>'next_action','')))<5 then
    raise exception 'Pilih jalur masuk, tulis alasan minimal 12 karakter, dan next action yang jelas.';
  end if;
  due_on:=nullif(payload->>'due_date','')::date;
  if due_on is null or due_on<(now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Tanggal next action harus hari ini atau setelahnya.';
  end if;
  if entry_path='opportunity' and not exists (
    select 1 from public.prospect_interactions i where i.prospect_id=p.id and i.outcome in ('interested','meeting_agreed')
  ) then raise exception 'Jalur peluang konkret memerlukan interaksi Tertarik atau Meeting disepakati.'; end if;
  if target_owner_id is not null and not exists(select 1 from public.memberships m where m.id=target_owner_id and m.status='active') then
    raise exception 'Owner harus staf aktif.';
  end if;
  update public.prospects set pipeline_entry_path=entry_path,pipeline_entry_reason=trim(payload->>'reason'),
    pipeline_next_action=trim(payload->>'next_action'),pipeline_due_date=due_on,updated_at=now() where id=p.id;
  lead_id:=public.promote_inbox_prospect_to_pipeline(target_prospect_id,target_source_id,target_owner_id);
  -- The existing Harvester/Pipeline promotion function stays unchanged. Enrich only
  -- this newly promoted lead, including its paired My Activity record.
  update public.pipeline_leads pl set
    next_action=trim(payload->>'next_action'),due_date=due_on,
    extra_data=pl.extra_data||jsonb_build_object(
      'pipeline_entry_path',entry_path,'pipeline_entry_reason',trim(payload->>'reason'),
      'inbox_interactions',(select coalesce(jsonb_agg(jsonb_build_object(
        'channel',i.channel,'outcome',i.outcome,'occurred_at',i.occurred_at,
        'note',i.note,'follow_up_date',i.follow_up_date) order by i.occurred_at),'[]'::jsonb)
        from (select * from public.prospect_interactions where prospect_id=p.id order by occurred_at desc limit 100) i)),
    updated_at=now()
  where pl.id=lead_id;
  update public.activities a set
    title=trim(payload->>'next_action')||' · '||p.account_name,
    activity_date=due_on,next_action=trim(payload->>'next_action'),
    updated_by=auth.uid(),updated_at=now()
  where a.id=(select pl.activity_id from public.pipeline_leads pl where pl.id=lead_id);
  return lead_id;
end; $$;
