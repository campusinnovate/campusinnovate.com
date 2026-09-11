-- Extend the existing prospect staging model; Pipeline remains authoritative after promotion.
alter table public.prospects add column review_notes text not null default '' check(char_length(review_notes)<=5000);
create table public.prospect_review_events (
 id uuid primary key default gen_random_uuid(),
 prospect_id uuid not null references public.prospects(id) on delete cascade,
 actor_membership_id uuid references public.memberships(id) on delete set null,
 event_type text not null check(event_type in ('details_updated','status_changed')),
 changed_fields text[] not null,
 previous_status text,
 new_status text,
 created_at timestamptz not null default now()
);
create index prospect_review_events_recent on public.prospect_review_events(prospect_id,created_at desc);
alter table public.prospect_review_events enable row level security;
revoke all on public.prospect_review_events from anon,authenticated;
grant select on public.prospect_review_events to authenticated;
create policy prospect_review_history_view on public.prospect_review_events for select to authenticated using(public.current_user_has_permission('pipeline.view'));

create function public.update_prospect_details(target_prospect_id uuid, expected_updated_at timestamptz, payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare p public.prospects; k text; v text; changed text[]:='{}';
 allowed text[]:=array['account_name','account_type','industry','city','address','website','phone','email','contact_name','contact_role','recommended_service','review_notes'];
begin
 if public.current_membership_id() is null or not public.current_user_has_permission('pipeline.view') or not public.current_user_has_permission('pipeline.manage_self') then raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501'; end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Data prospect tidak valid.'; end if;
 select * into p from public.prospects where id=target_prospect_id for update;
 if not found then raise exception 'Prospect tidak ditemukan.'; end if;
 if p.updated_at is distinct from expected_updated_at then raise exception 'Prospect telah berubah. Muat ulang detail sebelum menyimpan.' using errcode='40001'; end if;
 if p.promoted_lead_id is not null or p.status='promoted' then raise exception 'Prospect sudah dipromosikan. Perbarui data melalui Pipeline BD.'; end if;
 for k,v in select key,value from jsonb_each_text(payload) loop
  if not k=any(allowed) then raise exception 'Field prospect tidak diizinkan: %',k; end if;
  if jsonb_typeof(payload->k) not in ('string','null') then raise exception 'Field % harus berupa teks.',k; end if;
  v:=trim(coalesce(v,''));
  if k='account_name' and (char_length(v)<1 or char_length(v)>180) then raise exception 'Nama account wajib diisi (maksimal 180 karakter).'; end if;
  if char_length(v)>(case when k='review_notes' then 5000 when k in ('website','address') then 2000 else 180 end) then raise exception 'Field % terlalu panjang.',k; end if;
  if k='website' and v<>'' and (v !~* '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$' or v ~ '[<>]') then raise exception 'Website harus berupa URL http/https yang valid tanpa kredensial.'; end if;
  if k='email' and v<>'' and v !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Format email tidak valid.'; end if;
  if k='phone' and v<>'' then
   v:=regexp_replace(v,'[[:space:]()+.\-]','','g');
   if left(v,1)='0' then v:='62'||substr(v,2); end if;
   if v !~ '^[1-9][0-9]{6,14}$' then raise exception 'Nomor telepon tidak valid. Gunakan kode negara.'; end if;
  end if;
  if k in ('account_name','review_notes') then payload:=jsonb_set(payload,array[k],to_jsonb(v));
  else payload:=jsonb_set(payload,array[k],coalesce(to_jsonb(nullif(v,'')),'null'::jsonb)); end if;
  if coalesce(to_jsonb(p)->>k,'') is distinct from coalesce(payload->>k,'') then changed:=array_append(changed,k); end if;
 end loop;
 if cardinality(changed)=0 then return; end if;
 update public.prospects set
 account_name=case when payload?'account_name' then payload->>'account_name' else account_name end,
 account_type=case when payload?'account_type' then payload->>'account_type' else account_type end,
 industry=case when payload?'industry' then payload->>'industry' else industry end,
 city=case when payload?'city' then payload->>'city' else city end,
 address=case when payload?'address' then payload->>'address' else address end,
 website=case when payload?'website' then payload->>'website' else website end,
 phone=case when payload?'phone' then payload->>'phone' else phone end,
 email=case when payload?'email' then payload->>'email' else email end,
 contact_name=case when payload?'contact_name' then payload->>'contact_name' else contact_name end,
 contact_role=case when payload?'contact_role' then payload->>'contact_role' else contact_role end,
 recommended_service=case when payload?'recommended_service' then payload->>'recommended_service' else recommended_service end,
 review_notes=case when payload?'review_notes' then payload->>'review_notes' else review_notes end,
 updated_at=clock_timestamp() where id=p.id;
 insert into public.prospect_review_events(prospect_id,actor_membership_id,event_type,changed_fields)
 values(p.id,public.current_membership_id(),'details_updated',changed);
end $$;

-- Keep the existing status RPC signature; add history and prevent no-op events.
create or replace function public.set_prospect_status(target_prospect_id uuid,target_status text)
returns void language plpgsql security definer set search_path=public as $$
declare p public.prospects;
begin
 if public.current_membership_id() is null or not public.current_user_has_permission('pipeline.view') or not public.current_user_has_permission('pipeline.manage_self') then raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501'; end if;
 if target_status is null or target_status not in ('new','reviewed','archived') then raise exception 'Status prospect tidak valid.'; end if;
 select * into p from public.prospects where id=target_prospect_id for update;
 if not found then raise exception 'Prospect tidak ditemukan.'; end if;
 if p.promoted_lead_id is not null or p.status='promoted' then raise exception 'Prospect sudah masuk Pipeline BD.'; end if;
 if p.status=target_status then return; end if;
 update public.prospects set status=target_status,updated_at=clock_timestamp() where id=p.id;
 insert into public.prospect_review_events(prospect_id,actor_membership_id,event_type,changed_fields,previous_status,new_status)
 values(p.id,public.current_membership_id(),'status_changed',array['status'],p.status,target_status);
end $$;
-- Optional concurrency-aware entrypoint, preserving existing callers of set_prospect_status.
create function public.review_prospect_status(target_prospect_id uuid,expected_updated_at timestamptz,target_status text)
returns void language plpgsql security definer set search_path=public as $$
declare current_version timestamptz;
begin
 if not public.current_user_has_permission('pipeline.view') or not public.current_user_has_permission('pipeline.manage_self') then raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501'; end if;
 select updated_at into current_version from public.prospects where id=target_prospect_id for update;
 if not found then raise exception 'Prospect tidak ditemukan.'; end if;
 if current_version is distinct from expected_updated_at then raise exception 'Prospect telah berubah. Muat ulang detail sebelum menyimpan.' using errcode='40001'; end if;
 perform public.set_prospect_status(target_prospect_id,target_status);
end $$;
revoke all on function public.update_prospect_details(uuid,timestamptz,jsonb),public.review_prospect_status(uuid,timestamptz,text),public.set_prospect_status(uuid,text) from public,anon;
grant execute on function public.update_prospect_details(uuid,timestamptz,jsonb),public.review_prospect_status(uuid,timestamptz,text),public.set_prospect_status(uuid,text) to authenticated;
