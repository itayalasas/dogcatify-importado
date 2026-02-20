-- Diagnóstico rápido de webhooks CRM/Contabilidad
-- Ejecutar en Supabase SQL Editor

-- 1) Trigger function actual
SELECT
  p.proname,
  pg_get_functiondef(p.oid) AS function_sql
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'trigger_crm_and_accounting_webhook';

-- 2) Triggers activos en orders
SELECT
  tgname,
  tgenabled,
  pg_get_triggerdef(oid) AS trigger_def
FROM pg_trigger
WHERE tgrelid = 'public.orders'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- 3) Últimas órdenes pagadas y su estado
SELECT
  id,
  created_at,
  updated_at,
  order_type,
  payment_method,
  payment_status,
  status,
  total_amount
FROM orders
WHERE created_at > now() - interval '3 days'
ORDER BY created_at DESC
LIMIT 30;

-- 4) Últimos logs contables
SELECT
  created_at,
  order_id,
  attempt_number,
  success,
  response_status,
  left(coalesce(response_body, ''), 300) AS response_preview
FROM accounting_webhook_logs
ORDER BY created_at DESC
LIMIT 30;

-- 5) Órdenes pagadas sin log contable
SELECT
  o.id,
  o.created_at,
  o.payment_status,
  o.status,
  o.total_amount
FROM orders o
LEFT JOIN accounting_webhook_logs l ON l.order_id = o.id
WHERE o.payment_status IN ('paid', 'approved')
  AND COALESCE(o.total_amount, 0) > 0
  AND l.id IS NULL
ORDER BY o.created_at DESC
LIMIT 20;

-- 6) Cola/respuestas de pg_net
SELECT *
FROM net._http_response
ORDER BY created DESC
LIMIT 30;
