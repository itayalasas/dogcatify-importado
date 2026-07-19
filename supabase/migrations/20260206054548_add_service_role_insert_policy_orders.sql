/*
  Ajustar politica INSERT de orders
  para permitir clientes, partners y administradores.
*/

drop policy if exists
  "Customers can insert their own orders"
on public.orders;

drop policy if exists
  "Allow customers, partners, and service role to insert orders"
on public.orders;

create policy "Allow customers, partners, and service role to insert orders"
  on public.orders
  for insert
  to authenticated
  with check (
    orders.customer_id = auth.uid()

    or exists (
      select 1
      from public.partners
      where partners.id = orders.partner_id
        and partners.user_id = auth.uid()
    )

    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );