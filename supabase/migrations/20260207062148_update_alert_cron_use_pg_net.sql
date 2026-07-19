/*
  # Actualizar Cron Job para Usar pg_net

  1. Cambios
    - Actualiza la funciÃ³n para usar pg_net.http_post
    - Hardcodea la URL de Supabase y usa variables de sistema
    - Maneja errores correctamente

  2. Notas
    - pg_net es mÃ¡s confiable en Supabase que http extension
    - El service role key estÃ¡ disponible en variables de entorno del sistema
*/

CREATE OR REPLACE FUNCTION check_alert_thresholds_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;

  supabase_url text := 'https://hpvzjuionqvgxlvhyqgz.supabase.co';

  service_role_key text;

BEGIN
  -- Obtener service role key desde variables de entorno de Supabase
  -- En Supabase, estas estÃ¡n disponibles automÃ¡ticamente
  service_role_key := current_setting('app.settings.service_role_key', true);

  
  -- Si no estÃ¡ configurado, intentar con la variable de entorno del sistema
  IF service_role_key IS NULL THEN
    service_role_key := current_setting('supabase.service_role_key', true);

  END IF;

  
  -- Hacer request HTTP usando pg_net
  SELECT INTO request_id net.http_post(
    url := supabase_url || '/functions/v1/check-alert-thresholds',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || COALESCE(service_role_key, ''),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );

  
  -- Log de ejecuciÃ³n exitosa
  INSERT INTO audit_logs (
    action,
    resource_type,
    success,
    details
  ) VALUES (
    'CRON_ALERT_CHECK',
    'system_cron',
    true,
    jsonb_build_object(
      'job', 'check_alert_thresholds',
      'executed_at', NOW(),
      'request_id', request_id
    )
  );

  
EXCEPTION
  WHEN OTHERS THEN
    -- Log de error
    INSERT INTO audit_logs (
      action,
      resource_type,
      success,
      error_message,
      details
    ) VALUES (
      'CRON_ALERT_CHECK',
      'system_cron',
      false,
      SQLERRM,
      jsonb_build_object(
        'job', 'check_alert_thresholds',
        'executed_at', NOW(),
        'error_detail', SQLSTATE
      )
    );

END;

$$;

;


