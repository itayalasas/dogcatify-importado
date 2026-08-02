-- Allow couriers to view and update orders for stores associated to their delivery profile

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_orders_select_associated_stores" ON public.orders;
CREATE POLICY "delivery_orders_select_associated_stores"
ON public.orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.delivery_profiles dp
    JOIN public.delivery_profile_stores dps
      ON dps.delivery_profile_id = dp.id
    WHERE dp.user_id = auth.uid()
      AND dp.is_active = true
      AND dp.approval_status = 'approved'
      AND dps.partner_id = orders.partner_id
  )
);

DROP POLICY IF EXISTS "delivery_orders_update_associated_stores" ON public.orders;
CREATE POLICY "delivery_orders_update_associated_stores"
ON public.orders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.delivery_profiles dp
    JOIN public.delivery_profile_stores dps
      ON dps.delivery_profile_id = dp.id
    WHERE dp.user_id = auth.uid()
      AND dp.is_active = true
      AND dp.approval_status = 'approved'
      AND dps.partner_id = orders.partner_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.delivery_profiles dp
    JOIN public.delivery_profile_stores dps
      ON dps.delivery_profile_id = dp.id
    WHERE dp.user_id = auth.uid()
      AND dp.is_active = true
      AND dp.approval_status = 'approved'
      AND dps.partner_id = orders.partner_id
  )
);
