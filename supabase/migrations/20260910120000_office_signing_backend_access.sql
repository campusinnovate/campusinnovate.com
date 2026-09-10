-- The renderer reads these tables directly before calling the completion RPC.
-- BYPASSRLS does not replace table-level SELECT privileges.
grant select on public.office_documents, public.office_signers to service_role;

revoke all on function public.complete_office_document(uuid,text,text) from public, anon, authenticated;
grant execute on function public.complete_office_document(uuid,text,text) to service_role;

notify pgrst, 'reload schema';
