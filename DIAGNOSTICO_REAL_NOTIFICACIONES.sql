-- DIAGNÓSTICO REAL: Verificar por qué NO llegan las notificaciones de órdenes

-- 1. ¿El trigger existe y está activo?
SELECT 
  't.tgname' AS trigger_name,
  'orders' AS table_name,
  CASE WHEN t.tgenabled = 'O' THEN '✅ ENABLED'
       WHEN t.tgenabled = 'D' THEN '❌ DISABLED'
       WHEN t.tgenabled = 'R' THEN '⏸️ REPLICA ONLY'
       ELSE '❓ UNKNOWN' END AS status,
  p.proname AS function_called
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'orders'
AND t.tgname = 'on_order_status_change';

-- 2. ¿Se crearon notificaciones RECIENTEMENTE de órdenes?
SELECT 
  'order_status_change' AS notification_type,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status = 'sent') AS sent,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  MAX(created_at) AS last_one,
  NOW() - MAX(created_at) AS age
FROM scheduled_notifications
WHERE notification_type = 'order_status_change'
AND created_at > NOW() - INTERVAL '24 hours';

-- 3. ¿Se actualizaron órdenes RECIENTEMENTE?
SELECT 
  'Total recent order updates' AS metric,
  COUNT(*) AS count,
  MAX(updated_at) AS last_update
FROM orders
WHERE updated_at > NOW() - INTERVAL '24 hours'
AND status IN ('confirmed', 'preparing', 'ready', 'shipped', 'delivered');

-- 4. ¿Últimas 5 órdenes actualizadas?
SELECT 
  id,
  status,
  payment_status,
  customer_id,
  updated_at,
  created_at
FROM orders
ORDER BY updated_at DESC
LIMIT 5;

-- 5. ¿Hay notificaciones pendientes de órdenes?
SELECT 
  id,
  user_id,
  notification_type,
  title,
  body,
  status,
  created_at,
  scheduled_for,
  error_message
FROM scheduled_notifications
WHERE notification_type = 'order_status_change'
ORDER BY created_at DESC
LIMIT 10;

-- 6. ¿Los usuarios tienen fcm_token?
SELECT 
  'Users with/without tokens' AS metric,
  COUNT(*) FILTER (WHERE fcm_token IS NOT NULL) AS with_fcm_token,
  COUNT(*) FILTER (WHERE push_token IS NOT NULL) AS with_legacy_token,
  COUNT(*) FILTER (WHERE fcm_token IS NULL AND push_token IS NULL) AS without_any_token,
  COUNT(*) AS total_users
FROM profiles;

-- 7. Función create_order_status_notification existe?
SELECT 
  routine_name,
  routine_type,
  routine_schema
FROM information_schema.routines
WHERE routine_name = 'create_order_status_notification'
AND routine_schema = 'public';

-- 8. ¿Log de ejecución del cron? (si existe tabla de logs)
SELECT 
  'Last execution' AS check_name,
  MAX(updated_at) AS when,
  NOW() - MAX(updated_at) AS ago
FROM cron_jobs
WHERE job_name = 'process-scheduled-notifications';

-- 9. Ver ALL los triggers en órdenes
SELECT 
  tgname AS trigger_name,
  CASE WHEN tgenabled = 'O' THEN 'ENABLED' ELSE 'DISABLED' END AS status,
  pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'orders'::regclass;

-- 10. Simular cambio de status (para probar trigger)
-- PRIMERO: Ver una orden
SELECT id, status, customer_id FROM orders LIMIT 1;

-- LUEGO: Cambiar su status y ver si crea notificación
-- UPDATE orders SET status = 'preparing' WHERE id = 'AQUI_PONER_ID' AND status = 'confirmed';
-- SELECT * FROM scheduled_notifications ORDER BY created_at DESC LIMIT 1;
