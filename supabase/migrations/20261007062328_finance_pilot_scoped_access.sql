-- Assigned-project/own-claim workflows. No expansion of operational finance rights.
alter table public.finance_next_requests drop constraint finance_next_requests_kind_check;
alter table public.finance_next_requests add constraint finance_next_requests_kind_check check(kind in ('journal','invoice','receipt','target','policy','funds','budget','reversal','project_closure','account','claim','estimate'));
create policy finance_pilot_own_requests on public.finance_next_requests for select to authenticated using(kind in ('claim','estimate') and prepared_by=public.current_membership_id());
create unique index finance_pilot_claim_once on public.finance_next_requests((payload->>'claim_id')) where kind='journal' and state in ('submitted','approved','posted') and payload->>'claim_id' is not null;

create policy finance_pilot_claim_evidence_upload on storage.objects for insert to authenticated with check(
 bucket_id='finance-pilot-evidence' and (storage.foldername(name))[1]=auth.uid()::text
 and public.current_membership_id() is not null);
create policy finance_pilot_own_evidence_read on storage.objects for select to authenticated using(
 bucket_id='finance-pilot-evidence' and (storage.foldername(name))[1]=auth.uid()::text and public.current_membership_id() is not null);

create or replace function public.finance_pilot_identity() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=public.current_membership_id(); pk text;
begin
 if actor is null then raise exception 'Keanggotaan aktif diperlukan.' using errcode='42501'; end if;
 select p.key into pk from public.memberships m left join public.positions p on p.id=m.position_id where m.id=actor;
 return jsonb_build_object('membership_id',actor,'position',pk,'finance_owner',pk='coo','approver',pk='ceo','scoped',coalesce(pk not in ('coo','ceo'),true));
end $$;

create or replace function public.finance_pilot_scoped_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=public.current_membership_id(); pk text;
begin
 if actor is null then raise exception 'Keanggotaan aktif diperlukan.' using errcode='42501'; end if;
 select p.key into pk from public.memberships m left join public.positions p on p.id=m.position_id where m.id=actor;
 return jsonb_build_object('position',pk,
 'requests',(select coalesce(jsonb_agg(to_jsonb(r) order by created_at desc),'[]'::jsonb) from public.finance_next_requests r where kind in ('claim','estimate') and prepared_by=actor),
 'projects',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'project_code',p.project_code,'name',p.name,'service_line_key',pc.service_line_key,'delivery_confirmed_at',pc.delivery_confirmed_at)),'[]'::jsonb) from public.projects p join public.project_members pm on pm.project_id=p.id and pm.membership_id=actor left join public.finance_next_project_controls pc on pc.project_id=p.id where p.deleted_at is null),
 'receivables',case when pk='business_development_staff' then (select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'invoice_number',d.document_number,'client',d.client,'project_id',d.pilot_project_id,'balance',d.balance,'due_date',d.due_date)),'[]'::jsonb) from public.finance_documents d where d.finance_pilot is true and d.document_type='invoice' and d.balance>0 and exists(select 1 from public.commercial_tickets ct join public.commercial_ticket_members tm on tm.ticket_id=ct.id where ct.project_id=d.pilot_project_id and tm.membership_id=actor)) else '[]'::jsonb end);
end $$;

create or replace function public.finance_pilot_submit_scoped(p_key uuid,p_kind text,p_project uuid,p_amount numeric,p_description text,p_evidence text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.current_membership_id(); pk text; r public.finance_next_requests%rowtype; payload jsonb; rid uuid;
begin
 if actor is null then raise exception 'Keanggotaan aktif diperlukan.' using errcode='42501'; end if;
 select p.key into pk from public.memberships m left join public.positions p on p.id=m.position_id where m.id=actor;
 if pk='ceo' or p_kind not in ('claim','estimate') or p_key is null or p_amount is null or p_amount<=0 or p_amount::text in ('NaN','Infinity','-Infinity') or nullif(trim(p_description),'') is null then raise exception 'Pengajuan tidak valid; CEO approver-only.'; end if;
 if p_project is not null and not exists(select 1 from public.project_members where project_id=p_project and membership_id=actor) then raise exception 'Project bukan penugasan pengguna.' using errcode='42501'; end if;
 if p_kind='estimate' and (pk is distinct from 'cto' or p_project is null) then raise exception 'Estimate hanya CTO pada project ditugaskan.' using errcode='42501'; end if;
 perform finance_pilot_private.evidence(p_evidence);
 if split_part(p_evidence,'/',1)<>auth.uid()::text then raise exception 'Bukti harus milik pemohon.' using errcode='42501'; end if;
 payload:=jsonb_build_object('project_id',p_project,'amount',p_amount,'description',p_description,'evidence_path',p_evidence);
 perform pg_advisory_xact_lock(hashtextextended('finance-request:'||p_key::text,0));
 select * into r from public.finance_next_requests where request_key=p_key;
 if r.id is not null then
   if r.prepared_by<>actor or r.kind<>p_kind or r.payload<>payload then raise exception 'Request key milik operasi berbeda.'; end if;
   return r.id;
 end if;
 insert into public.finance_next_requests(request_key,kind,state,payload,prepared_by,submitted_at) values(p_key,p_kind,'submitted',payload,actor,now()) returning id into rid;
 perform finance_pilot_private.audit(p_kind||'.submit',p_kind,rid::text,null,payload);
 return rid;
end $$;
-- Claims/estimates remain source requests; COO prepares a journal or budget, never automatic accounting.
create or replace function public.finance_pilot_review_scoped(p_id uuid,p_note text,p_accept boolean) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=finance_pilot_private.actor('manage'); r public.finance_next_requests%rowtype;
begin
 select * into r from public.finance_next_requests where id=p_id for update;
 if r.id is null or r.kind not in ('claim','estimate') or r.state<>'submitted' or nullif(trim(p_note),'') is null then raise exception 'Pengajuan tidak valid.'; end if;
 update public.finance_next_requests set state=case when p_accept then 'approved' else 'rejected' end,review_note=p_note,reviewed_at=now(),updated_at=now() where id=p_id;
 perform finance_pilot_private.audit(r.kind||'.triage',r.kind,p_id::text,to_jsonb(r),jsonb_build_object('accepted',p_accept),p_note);
end $$;
revoke all on function public.finance_pilot_identity(),public.finance_pilot_scoped_workspace(),public.finance_pilot_submit_scoped(uuid,text,uuid,numeric,text,text),public.finance_pilot_review_scoped(uuid,text,boolean) from public,anon;
grant execute on function public.finance_pilot_identity(),public.finance_pilot_scoped_workspace(),public.finance_pilot_submit_scoped(uuid,text,uuid,numeric,text,text),public.finance_pilot_review_scoped(uuid,text,boolean) to authenticated;
