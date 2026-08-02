/*
  # Habilitar pg_cron y Configurar Jobs AutomÃ¡ticos para Alertas

  1. Extensiones
    - Habilita pg_cron para ejecutar jobs programados
    - Habilita http para hacer requests HTTP

  2. FunciÃ³n
    - check_alert_thresholds_cron: Llama a la edge function de alertas

  3. Cron Job
    - Nombre: check-alert-thresholds
    - Frecuencia: cada 5 minutos
    - AcciÃ³n: verifica umbrales y envÃ­a alertas si es necesario

  4. Logs
    - Registra cada ejecuciÃ³n en audit_logs
    - Registra errores para debugging
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE EXTENSION IF NOT EXISTS http;


CREATE OR REPLACE FUNCTION check_alert_thresholds_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;

  service_role_key text;

BEGIN
  supabase_url := current_setting('app.settings.supabase_url', true);

  service_role_key := current_setting('app.settings.service_role_key', true);

  
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/check-alert-thresholds',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_role_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );

  
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
      'executed_at', NOW()
    )
  );

  
EXCEPTION
  WHEN OTHERS THEN
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


DO $$
BEGIN
  PERFORM cron.unschedule('check-alert-thresholds');

EXCEPTION
  WHEN OTHERS THEN NULL;

END $$;


SELECT cron.schedule(
  'check-alert-thresholds',
  '*/5 * * * *',
  $$SELECT check_alert_thresholds_cron();
$$
);

;


