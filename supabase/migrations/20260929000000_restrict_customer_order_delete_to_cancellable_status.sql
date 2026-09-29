-- The existing customer branch of this policy let a customer delete ANY of
-- their own orders regardless of status — nothing stopped deleting a
-- confirmed/shipped/delivered order via a direct API call, it just happened
-- that no screen exposed a delete button. Scoping it here (not just hiding
-- the button client-side) is what actually protects confirmed orders: only
-- orders that never really went through (payment pending, payment failed, or
-- stock ran out before payment) can be deleted by their own customer.
-- Partner/admin deletion is unchanged.
DROP POLICY IF EXISTS "Partners, customers and admins can delete orders" ON public.orders;

CREATE POLICY "Partners, customers and admins can delete orders"
ON public.orders
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.partners
    WHERE partners.id = orders.partner_id AND partners.user_id = auth.uid()
  )
  OR (
    customer_id = auth.uid()
    AND status IN ('pending', 'payment_failed', 'insufficient_stock')
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);
