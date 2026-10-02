-- Source: Database Project Campus_Innovate / Database, rows 5–18.
-- Only projects absent from the active Pipeline are inserted. CI-007/008/009/010/011/013
-- map to existing records with conflicting values or dates and are left untouched.
do $$
declare item record; owner_id uuid; actor_user uuid; source_uuid uuid; activity_uuid uuid; lead_uuid uuid;
begin
  select id,user_id into owner_id,actor_user from public.memberships
  where full_name='Campus Innovate Admin' and status='active' limit 1;
  if owner_id is null or actor_user is null then raise exception 'Active historical import owner not found'; end if;
  for item in select * from (values
    -- code, account/project, source key, stage, year, month, known deal day,
    -- proposal value, confirmed CI deal value, source note
    ('CI-001','KLHK — Capacity Building (arsip awal)','pipeline_bd','Won',2024,null::integer,null::date,null::numeric,6300000::numeric,'Tahun sumber 2024, catatan 2024–2025 belum pasti; bulan dan tanggal deal belum diketahui.'),
    ('CI-002','WMK Mandiri 2024 — IPB','pipeline_program','Proposal',2024,null,null,51200000,null,'Anggaran proyek Rp1.625.525.000 bukan omzet CI. Penawaran CI Rp51.200.000; deal perlu konfirmasi.'),
    ('CI-003','Kunjungan OVOC / UCAM ke IPB','pipeline_bd','Proposal',2025,7,null,12000000,null,'Kunjungan 10–12 Juli 2025. Deal belum terbaca pada sumber; perlu konfirmasi.'),
    ('CI-004','Blasting LP2AI','creative_media_production','Won',2026,4,null,null,3080000,'April adalah bulan pembayaran; tanggal deal aktual belum diketahui.'),
    ('CI-005','Proposal dan deck VK Penta','creative_media_production','Won',2026,5,'2026-05-15'::date,3000000,2000000,'SPK 15 Mei 2026; pembayaran Mei dan Juli. Tanggal proposal belum diketahui.'),
    ('CI-006','WUNPROQ 2026 — Unit Wakaf IPB','pipeline_program','Won',2026,6,'2026-06-06'::date,50000000,45900000,'SPK 3–6 Juni 2026; tanggal deal memakai akhir rentang SPK, bukan tanggal proposal.'),
    ('CI-012','Gunung Luhur Private Trip','pipeline_stripmate','Won',2026,9,null,null,3490000,'Hanya bulan September 2026 diketahui; hari deal belum diketahui.'),
    ('CI-014','Employee Meeting DPPKHA 2025','pipeline_bd','Won',2025,null,null,13000000,13000000,'Deal 2025 dikonfirmasi pada sumber; bulan/tanggal akhir tahun belum pasti.')
  ) as t(code,account,source_key,stage,yr,mo,deal_day,offer_value,deal_value,source_note)
  loop
    if exists(select 1 from public.pipeline_leads where lead_code='HIST-'||item.code) then continue; end if;
    select id into source_uuid from public.work_sources where key=item.source_key and module_type='pipeline' and is_active limit 1;
    if source_uuid is null then raise exception 'Missing Pipeline source %',item.source_key; end if;
    insert into public.activities(owner_membership_id,assigned_by_membership_id,source_id,title,activity_date,
      activity_type,status,progress,priority,detail,output,next_action,created_by,updated_by,custom_data)
    values(owner_id,owner_id,source_uuid,'Arsip proyek · '||item.account,current_date,
      'Other','done',100,'medium',item.source_note,item.stage,'Arsip proyek historis',actor_user,actor_user,
      jsonb_build_object('historical_import',item.code)) returning id into activity_uuid;
    insert into public.pipeline_leads(activity_id,source_id,lead_code,date_added,account_name,
      lead_source,priority,stage,activity_type,next_action,due_date,notes,proposal_date,
      proposal_value,won_value,won_at,extra_data)
    values(activity_uuid,source_uuid,'HIST-'||item.code,make_date(item.yr,coalesce(item.mo,1),1),item.account,
      'Database Project Campus_Innovate','Medium',item.stage,'Other','Arsip proyek historis',current_date,
      item.source_note,null,item.offer_value,item.deal_value,item.deal_day,
      jsonb_build_object('historical_project_code',item.code,'historical_source_sheet','Database',
        'historical_date_precision',case when item.mo is null then 'year' else 'month' end,
        'historical_year',item.yr,'historical_month',item.mo,'source_note',item.source_note,
        'proposal_value',item.offer_value,'won_value',item.deal_value,
        'proposal_year',case when item.offer_value is not null then item.yr end,
        'proposal_month',case when item.offer_value is not null then item.mo end,
        'won_year',case when item.deal_value is not null then item.yr end,
        'won_month',case when item.deal_value is not null then item.mo end,
        'won_date',item.deal_day)) returning id into lead_uuid;
    update public.activities set source_record_id=lead_uuid::text,
      custom_data=custom_data||jsonb_build_object('pipeline_lead_id',lead_uuid,'lead_code','HIST-'||item.code)
    where id=activity_uuid;
  end loop;
end $$;
