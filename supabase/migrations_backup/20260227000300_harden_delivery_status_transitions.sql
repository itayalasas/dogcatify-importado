-- Harden delivery updates: couriers can only move to shipped/delivered,
-- and no order can move to delivered unless it was previously shipped.

DO $$
BEGIN
  IF to_regclass('public.delivery_profiles') IS NOT NULL
     AND to_regclass('public.delivery_profile_stores') IS NOT NULL THEN

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
      AND status IN ('shipped', 'delivered')
    );

  ELSE
    RAISE NOTICE 'Skipping delivery_orders_update_associated_stores policy: delivery tables are missing.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_order_delivery_transitions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Rule: cannot jump directly to delivered without first being shipped.
  IF NEW.status = 'delivered' AND OLD.status <> 'shipped' THEN
    RAISE EXCEPTION 'Invalid order status transition: % -> %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_delivery_transitions ON public.orders;
CREATE TRIGGER trg_guard_order_delivery_transitions
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.guard_order_delivery_transitions();
