-- Delivery workflow v2:
-- preparing -> ready_for_delivery -> shipped (en reparto) -> delivered
-- and track which courier delivered each order.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'payment_failed'::text,
        'confirmed'::text,
        'preparing'::text,
        'ready_for_delivery'::text,
        'processing'::text,
        'shipped'::text,
        'delivered'::text,
        'cancelled'::text,
        'insufficient_stock'::text,
        'reserved'::text
      ]
    )
  ) NOT VALID;

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
      AND (
        (status = 'shipped' AND delivery_user_id = auth.uid())
        OR
        (status = 'delivered' AND delivery_user_id = auth.uid())
      )
    );

  ELSE
    RAISE NOTICE 'Skipping delivery_orders_update_associated_stores policy update: delivery tables are missing.';
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

  IF NEW.status = 'shipped' THEN
    IF OLD.status <> 'ready_for_delivery' THEN
      RAISE EXCEPTION 'Invalid order status transition: % -> %', OLD.status, NEW.status;
    END IF;

    IF NEW.delivery_user_id IS NULL THEN
      RAISE EXCEPTION 'delivery_user_id is required when moving to shipped';
    END IF;

    IF NEW.delivery_started_at IS NULL THEN
      NEW.delivery_started_at := now();
    END IF;
  END IF;

  IF NEW.status = 'delivered' THEN
    IF OLD.status <> 'shipped' THEN
      RAISE EXCEPTION 'Invalid order status transition: % -> %', OLD.status, NEW.status;
    END IF;

    IF OLD.delivery_user_id IS NULL THEN
      RAISE EXCEPTION 'Cannot deliver order without assigned courier';
    END IF;

    IF NEW.delivery_user_id IS DISTINCT FROM OLD.delivery_user_id THEN
      RAISE EXCEPTION 'Assigned courier cannot be changed when delivering order';
    END IF;

    IF NEW.delivered_at IS NULL THEN
      NEW.delivered_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_delivery_transitions ON public.orders;
CREATE TRIGGER trg_guard_order_delivery_transitions
BEFORE UPDATE OF status, delivery_user_id ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.guard_order_delivery_transitions();
