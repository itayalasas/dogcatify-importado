-- =====================================================
-- CHECK: Scheduled Notifications Pipeline Health
-- =====================================================

-- 1) Resumen general por estado (últimos 30 días)
SELECT
  status,
  COUNT(*) AS total,
  MIN(created_at) AS first_created_at,
  MAX(created_at) AS last_created_at
FROM public.scheduled_notifications
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY status
ORDER BY status;

-- 2) Pendientes listos para enviar (atrasados)
SELECT
  COUNT(*) AS overdue_pending,
  MIN(scheduled_for) AS oldest_overdue,
  MAX(scheduled_for) AS newest_overdue
FROM public.scheduled_notifications
WHERE status = 'pending'
  AND scheduled_for <= NOW();

-- 3) Últimos errores de envío
SELECT
  id,
  user_id,
  notification_type,
  reference_type,
  reference_id,
  error_message,
  retry_count,
  updated_at
FROM public.scheduled_notifications
WHERE status = 'failed'
ORDER BY updated_at DESC
LIMIT 30;

-- 4) Cobertura de tokens en usuarios con órdenes recientes
SELECT
  COUNT(*) FILTER (WHERE p.fcm_token IS NOT NULL AND p.fcm_token <> '') AS with_fcm_token,
  COUNT(*) FILTER (WHERE p.push_token IS NOT NULL AND p.push_token <> '') AS with_push_token,
  COUNT(*) FILTER (
    WHERE (p.fcm_token IS NULL OR p.fcm_token = '')
      AND (p.push_token IS NULL OR p.push_token = '')
  ) AS without_any_token,
  COUNT(*) AS total_customers_with_recent_orders
FROM (
  SELECT DISTINCT customer_id
  FROM public.orders
  WHERE created_at >= NOW() - INTERVAL '30 days'
) o
LEFT JOIN public.profiles p ON p.id = o.customer_id;

-- 5) Trigger activo en orders para cambios de estado
SELECT
  t.tgname AS trigger_name,
  t.tgenabled AS trigger_enabled,
  p.proname AS function_name,
  n.nspname AS schema_name
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE t.tgrelid = 'public.orders'::regclass
  AND NOT t.tgisinternal
  AND t.tgname = 'on_order_status_change';

-- 6) Función de trigger existe
SELECT
  routine_schema,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'create_order_status_notification';

-- 7) Cron job de envío de notificaciones
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname ILIKE '%scheduled%notification%'
   OR command ILIKE '%send_scheduled_notifications%'
   OR command ILIKE '%send-scheduled-notifications%'
ORDER BY jobid DESC;

-- 8) Últimas ejecuciones del cron (si existen)
SELECT
  j.jobid,
  j.jobname,
  d.status,
  d.start_time,
  d.end_time,
  d.return_message
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE j.jobname ILIKE '%scheduled%notification%'
ORDER BY d.start_time DESC
LIMIT 30;

-- 9) Órdenes recientes sin notificación de cambio de estado
SELECT
  o.id AS order_id,
  o.created_at,
  o.status,
  o.payment_status,
  o.order_type,
  o.customer_id
FROM public.orders o
LEFT JOIN public.scheduled_notifications sn
  ON sn.reference_id = o.id
 AND sn.reference_type = 'order'
 AND sn.notification_type = 'order_status_change'
WHERE o.created_at >= NOW() - INTERVAL '7 days'
  AND sn.id IS NULL
ORDER BY o.created_at DESC
LIMIT 50;
