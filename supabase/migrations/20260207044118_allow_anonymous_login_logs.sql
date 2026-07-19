/*
  Permitir logs de login fallidos sin autenticacion.
*/

drop policy if exists
  "Anonymous users can insert login failure logs"
on public.audit_logs;

create policy "Anonymous users can insert login failure logs"
  on public.audit_logs
  for insert
  to anon
  with check (
    action in (
      'LOGIN_FAILED',
      'LOGIN_ERROR',
      'LOGIN_ATTEMPT'
    )
  );