-- The source sheet lists project or payment months, not proposal dates.
update public.pipeline_leads
set extra_data=jsonb_set(extra_data,'{proposal_month}','null'::jsonb,true)
where lead_code in ('HIST-CI-002','HIST-CI-003','HIST-CI-005','HIST-CI-006','HIST-CI-014')
  and extra_data->>'historical_source_sheet'='Database';

-- WUNPROQ's SPK spans 3–6 June; the exact signature date is not known.
update public.pipeline_leads
set won_at=null,extra_data=jsonb_set(extra_data,'{won_date}','null'::jsonb,true)
where lead_code='HIST-CI-006' and extra_data->>'historical_source_sheet'='Database';
