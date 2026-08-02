/*
  Politica temporal de debugging para audit_logs.
*/

drop policy if exists
  "Authenticated users can view audit logs (TEMP DEBUG)"
on public.audit_logs;

create policy "Authenticated users can view audit logs (TEMP DEBUG)"
  on public.audit_logs
  for select
  to authenticated
  using (true);