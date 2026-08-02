-- DIAGNÓSTICO PRECISO: ¿Por qué falla el envío?

-- 1. USUARIO ESPECÍFICO: ¿tiene fcm_token?
SELECT 
  id,
  email,
  display_name,
  fcm_token,
  push_token,
  created_at,
  updated_at
FROM profiles
WHERE id = '3d73602c-2011-412e-9a64-26969b65c418';

-- 2. ORDEN ESPECÍFICA: ¿existe y tiene datos?
SELECT 
  id,
  status,
  customer_id,
  total_amount,
  payment_method,
  created_at,
  updated_at
FROM orders
WHERE id = 'cc9578b1-e7b9-4c9d-ab6a-5b06467e0286';

-- 3. NOTIFICACIÓN QUE FALLÓ: detalles completos
SELECT 
  id,
  user_id,
  notification_type,
  title,
  body,
  data,
  status,
  error_message,
  retry_count,
  scheduled_for,
  sent_at,
  created_at,
  updated_at
FROM scheduled_notifications
WHERE id = '73962d4f-405a-4eab-9f00-3395ef3215b6';

-- 4. ¿Hay MÁS notificaciones fallidas?
SELECT 
  notification_type,
  COUNT(*) as total_failed,
  COUNT(*) FILTER (WHERE retry_count >= 3) as max_retries,
  MIN(updated_at) as oldest,
  MAX(updated_at) as newest
FROM scheduled_notifications
WHERE status = 'failed'
GROUP BY notification_type
ORDER BY total_failed DESC;

-- 5. Estadísticas de TODAS las notificaciones
SELECT 
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as percentage
FROM scheduled_notifications
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status
ORDER BY count DESC;

-- 6. ¿Cuántos usuarios NO tienen token?
SELECT 
  'Users WITHOUT push tokens' as metric,
  COUNT(*) as count
FROM profiles
WHERE fcm_token IS NULL AND push_token IS NULL;

-- 7. ¿Últimas 20 notificaciones fallidas CON detalles?
SELECT 
  id,
  user_id,
  notification_type,
  title,
  status,
  error_message,
  retry_count,
  updated_at,
  CASE 
    WHEN error_message LIKE '%Max retries%' THEN '⚠️ REINTENTOS AGOTADOS'
    WHEN error_message LIKE '%No push token%' THEN '❌ SIN TOKEN'
    WHEN error_message LIKE '%FCM%' THEN '❌ ERROR FCM'
    WHEN error_message LIKE '%auth%' THEN '❌ ERROR AUTH'
    WHEN error_message = '{}' OR error_message IS NULL THEN '❓ ERROR DESCONOCIDO'
    ELSE '❌ OTRO ERROR'
  END as error_type
FROM scheduled_notifications
WHERE status = 'failed'
ORDER BY updated_at DESC
LIMIT 20;

-- 8. ¿La función existe?
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name IN (
  'create_order_status_notification',
  'send_scheduled_notifications'
)
AND routine_schema = 'public';

-- 9. INTENTAR ENVIAR UNA NOTIFICACIÓN MANUALMENTE (sin reintentos)
-- Esto nos dirá si funciona el envío directo
-- Primero buscar una notificación pendiente:
SELECT 
  id,
  user_id,
  notification_type,
  title,
  status
FROM scheduled_notifications
WHERE status = 'pending'
LIMIT 1;

-- 10. Ver TODAS las órdenes recientes y su status
SELECT 
  id,
  status,
  customer_id,
  total_amount,
  updated_at
FROM orders
WHERE updated_at > NOW() - INTERVAL '48 hours'
ORDER BY updated_at DESC
LIMIT 20;
