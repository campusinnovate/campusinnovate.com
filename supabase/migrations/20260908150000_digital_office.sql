-- Private signature assets, per-document consent, immutable placement and audit trail.
create table public.office_signatures (
 membership_id uuid primary key references public.memberships(id),
 path text not null, shared boolean not null default false, updated_at timestamptz not null default now()
);
create table public.office_documents (
 id uuid primary key, title text not null check(length(title) between 1 and 160),
 creator_id uuid not null references public.memberships(id), source_path text not null,
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'), page_count integer not null check(page_count between 1 and 200),
 status text not null default 'pending' check(status in ('pending','completed','cancelled')),
 credential uuid not null unique default extensions.gen_random_uuid(),
 output_path text, output_hash text check(output_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(), completed_at timestamptz
);
create table public.office_signers (
 document_id uuid not null references public.office_documents(id), membership_id uuid not null references public.memberships(id),
 signature_path text not null, page integer not null, x numeric not null, y numeric not null, width numeric not null, height numeric not null,
 approved_at timestamptz, rejected_at timestamptz, primary key(document_id,membership_id)
);
create table public.office_events (
 id bigint generated always as identity primary key, document_id uuid not null references public.office_documents(id),
 actor_id uuid not null references public.memberships(id), action text not null, created_at timestamptz not null default now()
);
create or replace function public.office_can_read(target uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select public.current_membership_id() is not null and exists(select 1 from public.office_documents d where d.id=target and
 (d.creator_id=public.current_membership_id() or exists(select 1 from public.office_signers s where s.document_id=d.id and s.membership_id=public.current_membership_id())));
$$;
alter table public.office_signatures enable row level security;
alter table public.office_documents enable row level security;
alter table public.office_signers enable row level security;
alter table public.office_events enable row level security;
create policy office_signature_read on public.office_signatures for select to authenticated using(public.current_membership_id() is not null and (membership_id=public.current_membership_id() or shared));
create policy office_document_read on public.office_documents for select to authenticated using(public.office_can_read(id));
create policy office_signer_read on public.office_signers for select to authenticated using(public.office_can_read(document_id));
create policy office_event_read on public.office_events for select to authenticated using(public.office_can_read(document_id));
revoke all on public.office_signatures,public.office_documents,public.office_signers,public.office_events from public,anon,authenticated;
grant select on public.office_signatures,public.office_documents,public.office_signers,public.office_events to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('office-signatures','office-signatures',false,1048576,array['image/png']),
 ('office-documents','office-documents',false,26214400,array['application/pdf']) on conflict(id) do nothing;
create policy office_signature_upload on storage.objects for insert to authenticated with check(bucket_id='office-signatures' and (storage.foldername(name))[1]=auth.uid()::text and public.current_membership_id() is not null);
create policy office_signature_download on storage.objects for select to authenticated using(bucket_id='office-signatures' and public.current_membership_id() is not null and
 ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.office_signatures s where s.path=name and s.shared) or exists(select 1 from public.office_signers s where s.signature_path=name and s.approved_at is not null and public.office_can_read(s.document_id))));
create policy office_pdf_upload on storage.objects for insert to authenticated with check(bucket_id='office-documents' and (storage.foldername(name))[1]=auth.uid()::text and public.current_membership_id() is not null);
create policy office_pdf_download on storage.objects for select to authenticated using(bucket_id='office-documents' and public.current_membership_id() is not null and
 ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.office_documents d where (d.source_path=name or d.output_path=name) and public.office_can_read(d.id))));

create or replace function public.save_office_signature(asset_path text, allow_shared boolean)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();
begin
 if actor is null or not exists(select 1 from storage.objects where bucket_id='office-signatures' and name=asset_path and (storage.foldername(name))[1]=auth.uid()::text) then raise exception 'Unggah tanda tangan PNG milikmu terlebih dahulu.';end if;
 insert into public.office_signatures(membership_id,path,shared) values(actor,asset_path,allow_shared)
 on conflict(membership_id) do update set path=excluded.path,shared=excluded.shared,updated_at=now();
end;$$;

create or replace function public.office_workspace()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if public.current_membership_id() is null then raise exception 'Keanggotaan aktif diperlukan.' using errcode='42501';end if;
 return jsonb_build_object('me',public.current_membership_id(),
 'signatures',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('name',coalesce(m.full_name,m.email::text))) from public.office_signatures s join public.memberships m on m.id=s.membership_id where m.status='active' and (s.shared or s.membership_id=public.current_membership_id())),'[]'::jsonb),
 'documents',coalesce((select jsonb_agg(to_jsonb(d)||jsonb_build_object('signers',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('name',coalesce(m.full_name,m.email::text))) from public.office_signers s join public.memberships m on m.id=s.membership_id where s.document_id=d.id),'[]'::jsonb)) order by d.created_at desc) from public.office_documents d where public.office_can_read(d.id)),'[]'::jsonb));
end;$$;

create or replace function public.create_office_document(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();doc_id uuid:=(payload->>'id')::uuid;p jsonb; sig public.office_signatures%rowtype; pages integer:=(payload->>'page_count')::integer;
begin
 if actor is null then raise exception 'Keanggotaan aktif diperlukan.';end if;
 if not exists(select 1 from storage.objects where bucket_id='office-documents' and name=payload->>'source_path' and (storage.foldername(name))[1]=auth.uid()::text) then raise exception 'Dokumen sumber belum diunggah.';end if;
 if jsonb_typeof(payload->'signers') is distinct from 'array' or jsonb_array_length(payload->'signers') not between 1 and 20 then raise exception 'Pilih 1 sampai 20 penandatangan.';end if;
 insert into public.office_documents(id,title,creator_id,source_path,source_hash,page_count) values(doc_id,trim(payload->>'title'),actor,payload->>'source_path',payload->>'source_hash',pages);
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
   values(sig.membership_id,actor,'office.signature_requested','Permintaan tanda tangan',payload->>'title','office_document',doc_id::text,'/ruang-kawan/digital-office/?document='||doc_id,'normal');
  end if;
 end loop;
 insert into public.office_events(document_id,actor_id,action) values(doc_id,actor,'created');
 return doc_id;
end;$$;

create or replace function public.respond_office_document(target uuid, approve boolean)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();d public.office_documents%rowtype;
begin
 select * into d from public.office_documents where id=target for update;
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
 if not exists(select 1 from public.office_signers where document_id=target) or exists(select 1 from public.office_signers where document_id=target and approved_at is null) then raise exception 'Semua pemilik tanda tangan harus menyetujui dokumen.';end if;
 if not exists(select 1 from storage.objects where bucket_id='office-documents' and name=file_path and (storage.foldername(name))[1]=owner_user::text) then raise exception 'PDF hasil belum diunggah.';end if;
 update public.office_documents set output_path=file_path,output_hash=file_hash,status='completed',completed_at=now() where id=target;
 insert into public.office_events(document_id,actor_id,action) values(target,actor,'completed');
 for r in select membership_id from public.office_signers where document_id=target loop
  insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority)
  values(r.membership_id,actor,'office.completed','Dokumen selesai ditandatangani',d.title,'office_document',target::text,'/ruang-kawan/digital-office/?document='||target,'normal');
 end loop;
end;$$;

create or replace function public.verify_office_credential(token uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare d public.office_documents%rowtype;
begin
 select * into d from public.office_documents where credential=token;
 if d.id is null or not public.office_can_read(d.id) then raise exception 'Masuk sebagai peserta dokumen untuk memverifikasi kredensial.' using errcode='42501';end if;
 return jsonb_build_object('document',to_jsonb(d),'signers',(select jsonb_agg(jsonb_build_object('name',coalesce(m.full_name,m.email::text),'approved_at',s.approved_at)) from public.office_signers s join public.memberships m on m.id=s.membership_id where s.document_id=d.id));
end;$$;
revoke all on function public.office_can_read(uuid),public.save_office_signature(text,boolean),public.office_workspace(),public.create_office_document(jsonb),public.respond_office_document(uuid,boolean),public.complete_office_document(uuid,text,text),public.verify_office_credential(uuid) from public,anon;
grant execute on function public.office_can_read(uuid),public.save_office_signature(text,boolean),public.office_workspace(),public.create_office_document(jsonb),public.respond_office_document(uuid,boolean),public.complete_office_document(uuid,text,text),public.verify_office_credential(uuid) to authenticated;

-- Only the trusted PDF renderer may register a final file/hash.
revoke all on function public.complete_office_document(uuid,text,text) from authenticated;
grant execute on function public.complete_office_document(uuid,text,text) to service_role;

create or replace function public.cancel_office_document(target uuid)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();d public.office_documents%rowtype;r record;
begin
 select * into d from public.office_documents where id=target for update;
 if actor is null or d.creator_id is distinct from actor or d.status is distinct from 'pending' then raise exception 'Hanya pembuat dapat membatalkan pengajuan yang belum selesai.' using errcode='42501';end if;
 update public.office_documents set status='cancelled' where id=target;
 insert into public.office_events(document_id,actor_id,action) values(target,actor,'cancelled');
 for r in select membership_id from public.office_signers where document_id=target and membership_id<>actor loop
  insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority)
  values(r.membership_id,actor,'office.cancelled','Pengajuan tanda tangan dibatalkan',d.title,'office_document',target::text,'/ruang-kawan/digital-office/?document='||target,'normal');
 end loop;
end;$$;
revoke all on function public.cancel_office_document(uuid) from public,anon;
grant execute on function public.cancel_office_document(uuid) to authenticated;
