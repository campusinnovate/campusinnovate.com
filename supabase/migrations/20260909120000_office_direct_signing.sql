-- Preserve existing approvals; direct use is recorded separately, never as owner consent.
alter table public.office_documents add column approval_mode text not null default 'required' check (approval_mode in ('required','direct'));

create or replace function public.create_office_document(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();doc_id uuid:=(payload->>'id')::uuid;p jsonb; sig public.office_signatures%rowtype; pages integer:=(payload->>'page_count')::integer; mode text:=coalesce(payload->>'approval_mode','required');
begin
 if mode not in ('required','direct') then raise exception 'Mode tanda tangan tidak valid.';end if;
 if actor is null then raise exception 'Keanggotaan aktif diperlukan.';end if;
 if not exists(select 1 from storage.objects where bucket_id='office-documents' and name=payload->>'source_path' and (storage.foldername(name))[1]=auth.uid()::text) then raise exception 'Dokumen sumber belum diunggah.';end if;
 if jsonb_typeof(payload->'signers') is distinct from 'array' or jsonb_array_length(payload->'signers') not between 1 and 20 then raise exception 'Pilih 1 sampai 20 penandatangan.';end if;
 insert into public.office_documents(id,title,creator_id,source_path,source_hash,page_count,approval_mode) values(doc_id,trim(payload->>'title'),actor,payload->>'source_path',payload->>'source_hash',pages,mode);
 for p in select value from jsonb_array_elements(payload->'signers') loop
  select * into sig from public.office_signatures where membership_id=(p->>'membership_id')::uuid and (shared or membership_id=actor);
  if sig.membership_id is null or not exists(select 1 from public.memberships where id=sig.membership_id and status='active') then raise exception 'Pemilik belum membagikan tanda tangan.';end if;
  if p->>'page' is null or p->>'x' is null or p->>'y' is null or p->>'width' is null or p->>'height' is null or
    (p->>'page')::integer not between 1 and pages or (p->>'x')::numeric<0 or (p->>'y')::numeric<0 or
    (p->>'width')::numeric not between .05 and 1 or (p->>'height')::numeric not between .03 and 1 or
    (p->>'x')::numeric+(p->>'width')::numeric>1 or (p->>'y')::numeric+(p->>'height')::numeric>1 then raise exception 'Lokasi tanda tangan tidak valid.';end if;
  insert into public.office_signers(document_id,membership_id,signature_path,page,x,y,width,height) values(doc_id,sig.membership_id,sig.path,(p->>'page')::integer,(p->>'x')::numeric,(p->>'y')::numeric,(p->>'width')::numeric,(p->>'height')::numeric);
  if sig.membership_id<>actor then
   insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority)
   values(sig.membership_id,actor,case when mode='direct' then 'office.signature_used' else 'office.signature_requested' end,case when mode='direct' then 'Tanda tangan digunakan tanpa approval' else 'Permintaan tanda tangan' end,payload->>'title','office_document',doc_id::text,'/ruang-kawan/digital-office/?document='||doc_id,'normal');
  end if;
 end loop;
 insert into public.office_events(document_id,actor_id,action) values(doc_id,actor,case when mode='direct' then 'created_direct' else 'created' end);
 return doc_id;
end;$$;

create or replace function public.respond_office_document(target uuid, approve boolean)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();d public.office_documents%rowtype;
begin
 select * into d from public.office_documents where id=target for update;
 if d.approval_mode='direct' then raise exception 'Dokumen ini memakai mode tanpa approval.';end if;
 if actor is null or d.status is distinct from 'pending' or not exists(select 1 from public.office_signers where document_id=target and membership_id=actor) then raise exception 'Permintaan tanda tangan tidak tersedia.';end if;
 if exists(select 1 from public.office_signers where document_id=target and membership_id=actor and (approved_at is not null or rejected_at is not null)) then raise exception 'Respons sudah disimpan.';end if;
 update public.office_signers set approved_at=case when approve then now() end,rejected_at=case when not approve then now() end where document_id=target and membership_id=actor;
 if not approve then update public.office_documents set status='cancelled' where id=target;end if;
 insert into public.office_events(document_id,actor_id,action) values(target,actor,case when approve then 'approved' else 'rejected' end);
 insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority)
 values(d.creator_id,actor,'office.signature_response',case when approve then 'Tanda tangan disetujui' else 'Tanda tangan ditolak' end,d.title,'office_document',target::text,'/ruang-kawan/digital-office/?document='||target,'normal');
end;$$;

create or replace function public.complete_office_document(target uuid, file_path text, file_hash text)
returns void language plpgsql security definer set search_path=public as $$
declare d public.office_documents%rowtype;actor uuid;owner_user uuid;r record;
begin
 select * into d from public.office_documents where id=target for update;
 actor:=d.creator_id;select user_id into owner_user from public.memberships where id=actor and status='active';
 if owner_user is null or d.status is distinct from 'pending' then raise exception 'Dokumen tidak dapat difinalisasi.';end if;
 if file_hash is null or file_hash !~ '^[a-f0-9]{64}$' then raise exception 'Hash hasil tidak valid.';end if;
 if not exists(select 1 from public.office_signers where document_id=target) or exists(select 1 from public.office_signers where document_id=target and (rejected_at is not null or (d.approval_mode='required' and approved_at is null))) then raise exception 'Semua pemilik tanda tangan harus menyetujui dokumen.';end if;
 if not exists(select 1 from storage.objects where bucket_id='office-documents' and name=file_path and (storage.foldername(name))[1]=owner_user::text) then raise exception 'PDF hasil belum diunggah.';end if;
 update public.office_documents set output_path=file_path,output_hash=file_hash,status='completed',completed_at=now() where id=target;
 insert into public.office_events(document_id,actor_id,action) values(target,actor,'completed');
 for r in select membership_id from public.office_signers where document_id=target loop
  insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority)
  values(r.membership_id,actor,'office.completed','Dokumen selesai ditandatangani',d.title,'office_document',target::text,'/ruang-kawan/digital-office/?document='||target,'normal');
 end loop;
end;$$;
