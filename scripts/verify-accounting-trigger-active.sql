-- Verificación puntual: trigger contable activo en orders
-- Ejecutar en Supabase SQL Editor

-- 1) Función del trigger disponible
SELECT
  p.proname AS function_name,
  n.nspname AS schema_name,
  p.prosecdef AS is_security_definer,
  CASE
    WHEN pg_get_functiondef(p.oid) ILIKE '%/functions/v1/send-order-to-accounting%' THEN true
    ELSE false
  END AS calls_send_order_to_accounting,
  CASE
    WHEN pg_get_functiondef(p.oid) ILIKE '%current_setting(''app.settings.service_role_key'', true)%'
      OR pg_get_functiondef(p.oid) ILIKE '%current_setting(''supabase.service_role_key'', true)%'
    THEN true
    ELSE false
  END AS uses_dynamic_service_key
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'trigger_crm_and_accounting_webhook';

-- 2) Trigger enlazado y habilitado en public.orders
SELECT
  t.tgname,
  t.tgenabled,
  p.proname AS trigger_function,
  CASE WHEN t.tgenabled = 'O' THEN true ELSE false END AS is_enabled,
  pg_get_triggerdef(t.oid) AS trigger_def
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'public.orders'::regclass
  AND NOT t.tgisinternal
  AND p.proname = 'trigger_crm_and_accounting_webhook';

-- 3) Sanidad: órdenes pagadas recientes sin envío contable exitoso
SELECT
  o.id,
  o.created_at,
  o.payment_status,
  o.status,
  o.total_amount
FROM orders o
WHERE o.created_at > now() - interval '7 days'
  AND o.payment_status IN ('paid', 'approved')
  AND COALESCE(o.total_amount, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM accounting_webhook_logs l
    WHERE l.order_id = o.id
      AND l.success = true
  )
ORDER BY o.created_at DESC
LIMIT 50;

-- 4) REPARACIÓN INMEDIATA (ejecutar solo si el trigger no aparece o está deshabilitado)
-- Asegura que la función correcta esté referenciada por ambos triggers en orders
-- IMPORTANTE: esto no borra datos, solo recrea enlaces de trigger.
--
-- DROP TRIGGER IF EXISTS order_created_webhook ON public.orders;
-- DROP TRIGGER IF EXISTS order_updated_webhook ON public.orders;
--
-- CREATE TRIGGER order_created_webhook
-- AFTER INSERT ON public.orders
-- FOR EACH ROW
-- EXECUTE FUNCTION public.trigger_crm_and_accounting_webhook();
--
-- CREATE TRIGGER order_updated_webhook
-- AFTER UPDATE ON public.orders
-- FOR EACH ROW
-- EXECUTE FUNCTION public.trigger_crm_and_accounting_webhook();

-- 5) PRUEBA RÁPIDA DEL PIPELINE CONTABLE
-- 5.1 Buscar una orden pagada reciente sin log contable exitoso
-- 5.2 Forzar envío directo a la function (independiente del trigger)
--
-- SELECT net.http_post(
--   url := 'https://hpvzjuionqvgxlvhyqgz.supabase.co/functions/v1/send-order-to-accounting',
--   headers := jsonb_build_object('Content-Type', 'application/json'),
--   body := jsonb_build_object('order_id', 'REEMPLAZAR_ORDER_ID'),
--   timeout_milliseconds := 30000
-- );

