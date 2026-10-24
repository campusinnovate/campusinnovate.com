create or replace function public.ticketing_pipeline_lead_prefill(target_pipeline_lead_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_data jsonb;
begin
  if not public.current_user_has_permission('ticketing.manage') then
    raise exception 'Hanya BD atau CEO yang dapat membuat ticket.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'client_name', pl.account_name,
    'service_name', coalesce(
      nullif(trim(pl.business_unit), ''),
      nullif(trim(pl.extra_data->>'service_name'), ''),
      nullif(trim(pl.extra_data->>'service'), ''),
      ''
    ),
    'client_type', case
      when pl.extra_data->>'client_type' in ('new_client','repeat_order') then pl.extra_data->>'client_type'
      else 'new_client'
    end,
    'requirements', concat_ws(E'\n\n',
      nullif(trim(pl.notes), ''),
      case when nullif(trim(pl.qualification_reason), '') is not null
        then 'Catatan qualification: ' || trim(pl.qualification_reason)
        else null
      end
    ),
    'target_proposal_date', coalesce(pl.proposal_date::text, ''),
    'project_plan', coalesce(
      nullif(trim(pl.extra_data->>'project_plan'), ''),
      nullif(trim(pl.extra_data->>'implementation_plan'), ''),
      ''
    ),
    'rru_status', case
      when pl.extra_data->>'rru_status' in ('ready','response','unreachable') then pl.extra_data->>'rru_status'
      else 'ready'
    end
  )
  into lead_data
  from public.pipeline_leads pl
  join public.activities a on a.id = pl.activity_id
  where pl.id = target_pipeline_lead_id
    and public.can_access_activity(a.id);

  if lead_data is null then
    raise exception 'Lead Pipeline tidak ditemukan atau tidak dapat diakses.' using errcode = '42501';
  end if;

  return lead_data;
end;
$$;

revoke all on function public.ticketing_pipeline_lead_prefill(uuid) from public, anon;
grant execute on function public.ticketing_pipeline_lead_prefill(uuid) to authenticated;
