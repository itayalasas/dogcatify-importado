-- Diagnóstico puntual: trigger de contabilidad y autenticación
-- Ejecutar en Supabase SQL Editor

-- 1) Estado de la función trigger_crm_and_accounting_webhook
WITH fn AS (
  SELECT pg_get_functiondef(p.oid) AS function_sql
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'trigger_crm_and_accounting_webhook'
)
SELECT
  CASE WHEN EXISTS (SELECT 1 FROM fn) THEN 'OK' ELSE 'MISSING' END AS function_exists,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM fn
      WHERE function_sql ~ 'eyJ[a-zA-Z0-9_\-]{20,}'
    ) THEN true
    ELSE false
  END AS has_hardcoded_jwt,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM fn
      WHERE function_sql ILIKE '%current_setting(''app.settings.service_role_key'', true)%'
        AND function_sql ILIKE '%current_setting(''supabase.service_role_key'', true)%'
    ) THEN true
    ELSE false
  END AS uses_dynamic_service_key,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM fn
      WHERE function_sql ILIKE '%''Authorization'', ''Bearer '' || supabase_service_key%'
        AND function_sql ILIKE '%''apikey'', supabase_service_key%'
    ) THEN true
    ELSE false
  END AS sends_auth_and_apikey_headers;

-- 2) Ver triggers activos sobre orders
SELECT
  tgname,
  tgenabled,
  pg_get_triggerdef(oid) AS trigger_def
FROM pg_trigger
WHERE tgrelid = 'public.orders'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- 3) Órdenes pagadas recientes (carrito + servicios)
SELECT
  id,
  created_at,
  order_type,
  payment_method,
  payment_status,
  status,
  total_amount
FROM orders
WHERE created_at > now() - interval '7 days'
  AND payment_status IN ('paid', 'approved')
  AND COALESCE(total_amount, 0) > 0
ORDER BY created_at DESC
LIMIT 50;

-- 4) Órdenes pagadas sin log contable
SELECT
  o.id,
  o.created_at,
  o.order_type,
  o.payment_status,
  o.status,
  o.total_amount
FROM orders o
LEFT JOIN accounting_webhook_logs l ON l.order_id = o.id
WHERE o.created_at > now() - interval '7 days'
  AND o.payment_status IN ('paid', 'approved')
  AND COALESCE(o.total_amount, 0) > 0
  AND l.id IS NULL
ORDER BY o.created_at DESC
LIMIT 50;

-- 5) Respuestas recientes de pg_net (si no hay filas, no se está encolando llamada)
SELECT *
FROM net._http_response
ORDER BY created DESC
LIMIT 30;
