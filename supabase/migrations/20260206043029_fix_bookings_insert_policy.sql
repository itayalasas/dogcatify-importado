/*
  Ajustar politica INSERT de bookings
  para permitir clientes, partners y administradores.
*/

drop policy if exists
  "Customers can insert their own bookings"
on public.bookings;

drop policy if exists
  "Customers, partners and admins can insert bookings"
on public.bookings;

create policy "Customers, partners and admins can insert bookings"
  on public.bookings
  for insert
  to authenticated
  with check (
    bookings.customer_id = auth.uid()

    or exists (
      select 1
      from public.partners
      where partners.id = bookings.partner_id
        and partners.user_id = auth.uid()
    )

    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );