-- Admin-managed Finance document templates. Text fields support safe placeholders
-- and are rendered by the Finance client for DOC / print-PDF export.

insert into public.permissions(key,name,description) values
  ('finance.template.manage','Kelola Template Finance','Mengubah identitas, tampilan, placeholder, rekening, syarat pembayaran, dan tanda tangan dokumen Finance.')
on conflict(key) do update set name=excluded.name,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key='system_admin' and p.key='finance.template.manage'
on conflict do nothing;

create table if not exists public.finance_document_templates (
  document_type text primary key check(document_type in ('quotation','invoice','receipt')),
  company_name text not null default 'Campus Innovate',
  company_tagline text not null default 'Empowering Innovation, Creating Impact',
  company_address text not null default '',
  company_email text not null default '',
  company_phone text not null default '',
  logo_url text not null default '',
  primary_color text not null default '#0b376f',
  accent_color text not null default '#ffd348',
  document_title text not null,
  intro_text text not null default '',
  payment_terms text not null default '',
  bank_details text not null default '',
  signature_name text not null default '',
  signature_title text not null default '',
  footer_text text not null default 'Dokumen dibuat dari Finance Workspace Campus Innovate.',
  show_client_address boolean not null default true,
  show_due_date boolean not null default true,
  show_bank_details boolean not null default true,
  show_signature boolean not null default true,
  show_notes boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by_membership_id uuid references public.memberships(id)
);

insert into public.finance_document_templates(document_type,document_title,intro_text,payment_terms,show_due_date,show_bank_details) values
  ('quotation','QUOTATION','Penawaran untuk {{client}} terkait {{proyek}}.','Penawaran berlaku sesuai periode yang tercantum pada dokumen.',false,false),
  ('invoice','INVOICE','Tagihan untuk {{client}} terkait {{proyek}}.','Mohon melakukan pembayaran paling lambat {{jatuh_tempo}}. Cantumkan {{nomor_dokumen}} pada berita transfer.',true,true),
  ('receipt','PAYMENT RECEIPT','Bukti penerimaan pembayaran dari {{client}}.','Pembayaran sebesar {{total}} telah diterima.',false,false)
on conflict(document_type) do nothing;

alter table public.finance_document_templates enable row level security;
drop policy if exists finance_document_templates_view on public.finance_document_templates;
create policy finance_document_templates_view on public.finance_document_templates for select to authenticated
using(public.current_user_has_permission('finance.view'));
grant select on public.finance_document_templates to authenticated;

create or replace function public.finance_save_document_template(
  template_document_type text,
  template_company_name text,
  template_company_tagline text,
  template_company_address text,
  template_company_email text,
  template_company_phone text,
  template_logo_url text,
  template_primary_color text,
  template_accent_color text,
  template_document_title text,
  template_intro_text text,
  template_payment_terms text,
  template_bank_details text,
  template_signature_name text,
  template_signature_title text,
  template_footer_text text,
  template_show_client_address boolean,
  template_show_due_date boolean,
  template_show_bank_details boolean,
  template_show_signature boolean,
  template_show_notes boolean
) returns void language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=public.current_membership_id(); before_row public.finance_document_templates%rowtype;
begin
  if not public.current_user_has_permission('finance.template.manage') then
    raise exception 'Hanya admin atau pemilik izin template yang dapat mengubah template Finance.' using errcode='42501';
  end if;
  if template_document_type not in ('quotation','invoice','receipt') then raise exception 'Tipe dokumen tidak valid.'; end if;
  if trim(coalesce(template_company_name,''))='' or trim(coalesce(template_document_title,''))='' then raise exception 'Nama perusahaan dan judul dokumen wajib diisi.'; end if;
  if coalesce(template_primary_color,'') !~ '^#[0-9A-Fa-f]{6}$' or coalesce(template_accent_color,'') !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Warna harus menggunakan format hex, contoh #0b376f.'; end if;
  if trim(coalesce(template_logo_url,''))<>'' and trim(template_logo_url) !~ '^https://' then raise exception 'Logo harus memakai URL HTTPS.'; end if;
  select * into before_row from public.finance_document_templates where document_type=template_document_type;
  insert into public.finance_document_templates(
    document_type,company_name,company_tagline,company_address,company_email,company_phone,logo_url,
    primary_color,accent_color,document_title,intro_text,payment_terms,bank_details,signature_name,
    signature_title,footer_text,show_client_address,show_due_date,show_bank_details,show_signature,
    show_notes,updated_at,updated_by_membership_id
  ) values (
    template_document_type,trim(template_company_name),trim(coalesce(template_company_tagline,'')),trim(coalesce(template_company_address,'')),
    trim(coalesce(template_company_email,'')),trim(coalesce(template_company_phone,'')),trim(coalesce(template_logo_url,'')),
    lower(template_primary_color),lower(template_accent_color),trim(template_document_title),coalesce(template_intro_text,''),
    coalesce(template_payment_terms,''),coalesce(template_bank_details,''),trim(coalesce(template_signature_name,'')),
    trim(coalesce(template_signature_title,'')),coalesce(template_footer_text,''),coalesce(template_show_client_address,true),
    coalesce(template_show_due_date,true),coalesce(template_show_bank_details,true),coalesce(template_show_signature,true),
    coalesce(template_show_notes,true),now(),actor_id
  ) on conflict(document_type) do update set
    company_name=excluded.company_name,company_tagline=excluded.company_tagline,company_address=excluded.company_address,
    company_email=excluded.company_email,company_phone=excluded.company_phone,logo_url=excluded.logo_url,
    primary_color=excluded.primary_color,accent_color=excluded.accent_color,document_title=excluded.document_title,
    intro_text=excluded.intro_text,payment_terms=excluded.payment_terms,bank_details=excluded.bank_details,
    signature_name=excluded.signature_name,signature_title=excluded.signature_title,footer_text=excluded.footer_text,
    show_client_address=excluded.show_client_address,show_due_date=excluded.show_due_date,
    show_bank_details=excluded.show_bank_details,show_signature=excluded.show_signature,show_notes=excluded.show_notes,
    updated_at=now(),updated_by_membership_id=actor_id;
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data)
  values(auth.uid(),'finance.document_template.update','finance_document_template',template_document_type,to_jsonb(before_row),
    (select to_jsonb(t) from public.finance_document_templates t where t.document_type=template_document_type));
end $$;

revoke all on function public.finance_save_document_template(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.finance_save_document_template(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,boolean,boolean,boolean,boolean) to authenticated;
