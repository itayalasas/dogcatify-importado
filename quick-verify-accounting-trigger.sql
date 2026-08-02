-- ========================================
-- VERIFICACIÓN RÁPIDA: TRIGGER CONTABILIDAD
-- Ejecutar en Supabase SQL Editor
-- ========================================

-- 1) Ver función activa (buscar que NO use ELSIF para payment_status tras status)
SELECT
  p.proname,
  pg_get_functiondef(p.oid) AS function_sql
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'trigger_crm_and_accounting_webhook';

-- 2) Ver triggers activos en orders
SELECT
  tgname,
  tgenabled,
  pg_get_triggerdef(oid) AS trigger_def
FROM pg_trigger
WHERE tgrelid = 'public.orders'::regclass
  AND NOT tgisinternal;

-- 3) Últimas 20 órdenes de tienda pagadas
SELECT
  id,
  created_at,
  order_type,
  payment_status,
  status,
  total_amount
FROM orders
WHERE order_type = 'product_purchase'
  AND payment_status IN ('paid', 'approved')
ORDER BY created_at DESC
LIMIT 20;

-- 4) Logs de contabilidad de esas órdenes
SELECT
  l.created_at,
  l.order_id,
  l.attempt_number,
  l.success,
  l.response_status,
  left(coalesce(l.response_body, ''), 250) AS response_preview
FROM accounting_webhook_logs l
JOIN orders o ON o.id = l.order_id
WHERE o.order_type = 'product_purchase'
ORDER BY l.created_at DESC
LIMIT 50;

-- 5) Órdenes de tienda pagadas SIN log contable (si aparecen, el trigger no está disparando)
SELECT
  o.id,
  o.created_at,
  o.payment_status,
  o.status,
  o.total_amount
FROM orders o
LEFT JOIN accounting_webhook_logs l ON l.order_id = o.id
WHERE o.order_type = 'product_purchase'
  AND o.payment_status IN ('paid', 'approved')
  AND l.id IS NULL
ORDER BY o.created_at DESC
LIMIT 20;

-- 6) Reintentar manualmente para una orden específica (reemplazar ORDER_ID)
-- SELECT net.http_post(
--   url := 'https://hpvzjuionqvgxlvhyqgz.supabase.co/functions/v1/send-order-to-accounting',
--   headers := jsonb_build_object(
--     'Content-Type', 'application/json',
--     'Authorization', 'Bearer TU_SERVICE_ROLE_KEY_ACTIVA'
--   ),
--   body := jsonb_build_object('order_id', 'ORDER_ID_AQUI'),
--   timeout_milliseconds := 30000
-- );
