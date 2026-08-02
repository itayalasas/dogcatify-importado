/*
  # Actualizar FunciÃ³n Cron para Incluir user_email

  1. Cambios
    - Agrega user_email a los logs del cron
    - Mejora los detalles guardados en audit_logs
    - Agrega mÃ¡s informaciÃ³n Ãºtil para anÃ¡lisis

  2. Campos Agregados
    - user_email: Identifica quien/quÃ© generÃ³ el log
    - MÃ¡s detalles en el objeto details
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
  service_role_key := current_setting('app.settings.service_role_key', true);

  
  IF service_role_key IS NULL THEN
    service_role_key := current_setting('supabase.service_role_key', true);

  END IF;

  
  SELECT INTO request_id net.http_post(
    url := supabase_url || '/functions/v1/check-alert-thresholds',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || COALESCE(service_role_key, ''),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );

  
  INSERT INTO audit_logs (
    user_email,
    action,
    resource_type,
    success,
    details
  ) VALUES (
    'system@dogcatify.com',
    'CRON_ALERT_CHECK',
    'system_cron',
    true,
    jsonb_build_object(
      'job', 'check_alert_thresholds',
      'executed_at', NOW(),
      'request_id', request_id,
      'cron_schedule', '*/5 * * * *',
      'function_url', supabase_url || '/functions/v1/check-alert-thresholds'
    )
  );

  
EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO audit_logs (
      user_email,
      action,
      resource_type,
      success,
      error_message,
      details
    ) VALUES (
      'system@dogcatify.com',
      'CRON_ALERT_CHECK',
      'system_cron',
      false,
      SQLERRM,
      jsonb_build_object(
        'job', 'check_alert_thresholds',
        'executed_at', NOW(),
        'error_detail', SQLSTATE,
        'error_context', SQLERRM
      )
    );

END;

$$;

;


