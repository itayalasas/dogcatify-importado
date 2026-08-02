-- =============================================================
-- Verify Delivery Workflow (v2)
-- Expected flow: preparing -> ready_for_delivery -> shipped -> delivered
-- =============================================================

-- 1) Verify schema changes on orders
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name IN ('delivery_user_id', 'delivery_started_at', 'delivered_at')
ORDER BY column_name;

-- 2) Verify status constraint includes ready_for_delivery
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'orders'
  AND c.conname = 'orders_status_check';

-- 3) Verify delivery tables exist
SELECT to_regclass('public.delivery_profiles') AS delivery_profiles_table;
SELECT to_regclass('public.delivery_profile_stores') AS delivery_profile_stores_table;

-- 4) Verify delivery policies exist on orders
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'orders'
  AND policyname IN (
    'delivery_orders_select_associated_stores',
    'delivery_orders_update_associated_stores'
  )
ORDER BY policyname;

-- 5) Verify trigger/function guard are active
SELECT
  t.tgname AS trigger_name,
  p.proname AS function_name,
  pg_get_triggerdef(t.oid) AS trigger_def
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'orders'
  AND t.tgname = 'trg_guard_order_delivery_transitions';

-- 6) View latest orders with delivery fields
SELECT
  id,
  order_number,
  partner_id,
  status,
  delivery_user_id,
  delivery_started_at,
  delivered_at,
  updated_at
FROM public.orders
ORDER BY created_at DESC
LIMIT 30;

-- 7) View current delivery profiles + store links
SELECT
  dp.id AS delivery_profile_id,
  dp.user_id,
  dp.delivery_mode,
  dp.approval_status,
  dp.is_active,
  dps.partner_id,
  p.business_name,
  p.business_type
FROM public.delivery_profiles dp
LEFT JOIN public.delivery_profile_stores dps ON dps.delivery_profile_id = dp.id
LEFT JOIN public.partners p ON p.id = dps.partner_id
ORDER BY dp.created_at DESC, p.business_name;

-- =============================================================
-- Optional manual E2E test (replace IDs before running)
-- =============================================================
-- 1) Put order ready for delivery (partner flow)
-- UPDATE public.orders
-- SET status = 'ready_for_delivery', updated_at = now()
-- WHERE id = 'REPLACE_ORDER_ID';

-- 2) Courier takes order (in delivery)
-- UPDATE public.orders
-- SET status = 'shipped',
--     delivery_user_id = 'REPLACE_COURIER_USER_ID',
--     updated_at = now()
-- WHERE id = 'REPLACE_ORDER_ID';

-- 3) Courier completes delivery
-- UPDATE public.orders
-- SET status = 'delivered',
--     delivery_user_id = 'REPLACE_COURIER_USER_ID',
--     updated_at = now()
-- WHERE id = 'REPLACE_ORDER_ID';

-- 4) This should FAIL (direct jump to delivered)
-- UPDATE public.orders
-- SET status = 'delivered',
--     delivery_user_id = 'REPLACE_COURIER_USER_ID',
--     updated_at = now()
-- WHERE id = 'REPLACE_ORDER_ID_NOT_SHIPPED';
