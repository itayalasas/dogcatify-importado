drop policy if exists
  "Partners can update orders for their business"
on public.orders;

drop policy if exists
  "Partners and admins can update orders"
on public.orders;

create policy "Partners and admins can update orders"
  on public.orders
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.partners
      where partners.id = orders.partner_id
        and partners.user_id = auth.uid()
    )
    or orders.customer_id = auth.uid()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );