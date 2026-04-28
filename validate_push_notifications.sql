-- Validación del Sistema de Notificaciones Push

-- 1. Verificar que la tabla scheduled_notifications existe y tiene datos
SELECT 
  'scheduled_notifications table' AS check_item,
  COUNT(*) AS total_records,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status = 'sent') AS sent,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed
FROM scheduled_notifications;

-- 2. Verificar que el trigger on_order_status_change existe
SELECT 
  t.tgname AS trigger_name,
  'orders' AS table_name,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'orders'
AND t.tgname = 'on_order_status_change';

-- 3. Verificar que los usuarios tienen fcm_token
SELECT 
  'Push Tokens Status' AS check_item,
  COUNT(*) FILTER (WHERE fcm_token IS NOT NULL) AS users_with_fcm_token,
  COUNT(*) FILTER (WHERE push_token IS NOT NULL) AS users_with_legacy_token,
  COUNT(*) AS total_users
FROM profiles;

-- 4. Ver últimas notificaciones sin enviar
SELECT 
  id,
  user_id,
  notification_type,
  title,
  body,
  scheduled_for,
  status,
  error_message
FROM scheduled_notifications
WHERE status IN ('pending', 'failed')
ORDER BY created_at DESC
LIMIT 10;
