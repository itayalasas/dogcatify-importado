-- Bugfix: dev's live orders_status_check constraint is missing
-- 'ready_for_delivery', even though 20260227000400_delivery_workflow_ready_and_assignee.sql
-- already added it (with NOT VALID) back in February. Confirmed via
-- pg_get_constraintdef() that the currently-live constraint on dev only has
-- the 10 pre-delivery-workflow values — how it reverted isn't clear (manual
-- dashboard edit at some point is the most likely explanation), but
-- schema_migrations still shows that migration as applied, so a plain
-- re-run wouldn't fix it.
--
-- This matters beyond dev itself: Supabase Branching's merge-to-production
-- computes its diff from dev's *actual live* schema, not from the
-- migration files. With dev's constraint stuck on the old 10-value list,
-- the generated merge tried to push that stale definition onto production
-- — where it broke immediately, because production already has real orders
-- with status = 'ready_for_delivery'. Restoring the correct constraint here
-- fixes the source the diff is computed from.

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
