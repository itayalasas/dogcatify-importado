-- =========================================================================
-- SOLUCIÓN: Configurar Sistema de Notificaciones Push
-- =========================================================================

-- PASO 1: Habilitar extensión pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA public;

-- PASO 2: Habilitar net extension para HTTP calls
CREATE EXTENSION IF NOT EXISTS pgsql_http WITH SCHEMA public;

-- PASO 3: Ver trabajos cron existentes
SELECT * FROM cron.job;

-- PASO 4: Crear el cron job para enviar notificaciones cada 5 minutos
-- NOTA: Reemplazar <YOUR_SERVICE_ROLE_KEY> con la clave real
SELECT cron.schedule(
  'process-scheduled-notifications',
  '*/5 * * * *',
  $$
  SELECT http_post(
    'https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/send-scheduled-notifications',
    '{}',
    'application/json',
    NULL,
    jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE',
      'Content-Type', 'application/json'
    )
  );
  $$
);

-- PASO 5: Crear tabla de control de cron (para referencia)
CREATE TABLE IF NOT EXISTS notification_cron_config (
  id BIGSERIAL PRIMARY KEY,
  cron_job_name TEXT UNIQUE,
  frequency_minutes INTEGER,
  function_name TEXT,
  status TEXT DEFAULT 'active',
  last_run TIMESTAMP,
  error_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- PASO 6: Insertar configuración del cron job
INSERT INTO notification_cron_config (
  cron_job_name,
  frequency_minutes,
  function_name,
  status
) VALUES (
  'process-scheduled-notifications',
  5,
  'send-scheduled-notifications',
  'active'
) ON CONFLICT (cron_job_name) DO UPDATE SET
  status = 'active',
  updated_at = now();

-- PASO 7: Verificar notificaciones pendientes
SELECT 
  'Total Pending' AS metric,
  COUNT(*) AS count
FROM scheduled_notifications
WHERE status = 'pending'
UNION ALL
SELECT 
  'Total Failed',
  COUNT(*)
FROM scheduled_notifications
WHERE status = 'failed'
UNION ALL
SELECT 
  'Today Sent',
  COUNT(*)
FROM scheduled_notifications
WHERE status = 'sent' AND created_at > now() - interval '24 hours';

-- PASO 8: Ver usuarios sin tokens de push
SELECT 
  'Users without push tokens' AS metric,
  COUNT(*) AS count
FROM profiles
WHERE fcm_token IS NULL AND push_token IS NULL;

-- PASO 9: Triggers relacionados con notificaciones
SELECT 
  t.tgname AS trigger_name,
  c.relname AS table_name,
  p.proname AS function_name,
  CASE WHEN t.tgenabled = 'O' THEN 'ENABLED' ELSE 'DISABLED' END AS status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('orders', 'bookings', 'pet_health')
ORDER BY c.relname;

-- PASO 10: Crear trigger para limpiar notificaciones antiguas (opcional)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM scheduled_notifications
  WHERE status IN ('sent', 'failed')
    AND updated_at < now() - interval '30 days';
  
  RAISE NOTICE 'Cleaned up old notifications';
END;
$$ LANGUAGE plpgsql;

-- Ejecutar limpieza una vez al día a las 2 AM
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 2 * * *',
  'SELECT cleanup_old_notifications();'
);

-- =========================================================================
-- VALIDACIÓN: Ejecutar después de los pasos anteriores
-- =========================================================================

-- Verificar que el cron job fue creado
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'process-scheduled-notifications';

-- Ver estado de todos los trabajos cron
SELECT 
  'Cron Jobs Status' AS section,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE active) as active,
  COUNT(*) FILTER (WHERE active = false) as inactive
FROM cron.job;

-- Verificar últimas ejecuciones
SELECT 
  jobid,
  jobname,
  last_run,
  last_successful_run
FROM cron.job_run_details
WHERE jobname = 'process-scheduled-notifications'
ORDER BY last_run DESC
LIMIT 5;

-- =========================================================================
-- MONITOREO EN TIEMPO REAL
-- =========================================================================

-- Ver notificaciones pendientes y su edad
SELECT 
  id,
  user_id,
  notification_type,
  title,
  status,
  created_at,
  NOW() - created_at AS age,
  scheduled_for
FROM scheduled_notifications
WHERE status = 'pending'
ORDER BY created_at ASC
LIMIT 20;

-- Ver tasa de error
SELECT 
  notification_type,
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM scheduled_notifications
WHERE created_at > now() - interval '7 days'
GROUP BY notification_type, status
ORDER BY notification_type, count DESC;
