-- Harden role-sensitive access that was left open by early baseline policies.
-- The app may still keep client-side guards for UX, but RLS must be the source of truth.

UPDATE public.profiles
SET is_admin = true
WHERE lower(email) = 'admin@dogcatify.com';

-- Partners: remove broad authenticated/public policies. Owner/admin policies remain active.
DROP POLICY IF EXISTS "Authenticated users can delete partners" ON public.partners;
DROP POLICY IF EXISTS "Authenticated users can insert partners" ON public.partners;
DROP POLICY IF EXISTS "Authenticated users can read partners" ON public.partners;
DROP POLICY IF EXISTS "Authenticated users can update partners" ON public.partners;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.partners;

-- Orders: do not expose every order publicly. Recreate explicit read paths.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.orders;

DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
CREATE POLICY "Customers can view their own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Partners can view their own orders" ON public.orders;
CREATE POLICY "Partners can view their own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.partners p
    WHERE p.user_id = auth.uid()
      AND (
        orders.partner_id = p.id
        OR ((orders.partner_breakdown -> 'partners') ? (p.id)::text)
      )
  )
);
