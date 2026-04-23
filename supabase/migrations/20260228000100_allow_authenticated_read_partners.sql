-- Allow any authenticated user to read active/approved partners.
-- This is required for:
--   1. Customers browsing stores and viewing partner profiles
--   2. Cart screen loading store pickup address and shipping config
--   3. Order detail screen showing store address for "Retiro en tienda" orders
--
-- The existing "Users can view their own partner profiles" policy only allows
-- partner owners to read their own record, blocking all customer-facing reads.

CREATE POLICY "Authenticated users can read active partners"
ON public.partners
FOR SELECT
TO authenticated
USING (is_active = true);
