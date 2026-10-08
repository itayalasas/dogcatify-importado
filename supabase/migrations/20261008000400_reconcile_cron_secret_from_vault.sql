-- reconcile-mercadopago-orders acepta la llamada si el header X-Cron-Secret
-- coincide con el secreto CRON_SECRET de la función, o si el Authorization es
-- exactamente su SUPABASE_SERVICE_ROLE_KEY. En dev la clave guardada en Vault
-- no coincide con la de la función (Supabase tiene claves nuevas y legacy), así
-- que respondía 401. Ahora el cron también manda el secreto 'cron_secret' de
-- Vault. Configuración, una vez por proyecto, con el mismo valor en los dos:
--
--   supabase secrets set CRON_SECRET=<valor> --project-ref <ref>
--   select vault.create_secret('<valor>', 'cron_secret');

CREATE OR REPLACE FUNCTION public.reconcile_mercadopago_orders_cron() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id bigint;
  supabase_url text := COALESCE(
    (SELECT value->>'url' FROM public.admin_settings WHERE key = 'cron_project_url'),
    'https://hpvzjuionqvgxlvhyqgz.supabase.co'
  );
  service_role_key text;
  cron_secret text;
BEGIN
  service_role_key := public.get_service_role_key_for_cron();

  BEGIN
    SELECT decrypted_secret INTO cron_secret
      FROM vault.decrypted_secrets
     WHERE name = 'cron_secret'
     ORDER BY created_at DESC
     LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    cron_secret := NULL;
  END;
  IF cron_secret IS NULL OR cron_secret = '' THEN
    cron_secret := current_setting('app.settings.cron_secret', true);
  END IF;

  SELECT INTO request_id net.http_post(
    url := supabase_url || '/functions/v1/reconcile-mercadopago-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, ''),
      'apikey', COALESCE(service_role_key, ''),
      'X-Cron-Secret', COALESCE(cron_secret, '')
    ),
    body := jsonb_build_object(
      'lookback_hours', 48,
      'limit', 150,
      'stale_pending_minutes', 5,
      'dry_run', false
    ),
    timeout_milliseconds := 60000
  );

  INSERT INTO audit_logs (
    user_email,
    action,
    resource_type,
    success,
    details
  ) VALUES (
    'system@dogcatify.com',
    'CRON_RECONCILE_MERCADOPAGO_ORDERS',
    'system_cron',
    true,
    jsonb_build_object(
      'job', 'reconcile_mercadopago_orders',
      'executed_at', NOW(),
      'request_id', request_id,
      'function_url', supabase_url || '/functions/v1/reconcile-mercadopago-orders',
      'cron_schedule', '*/10 * * * *'
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
      'CRON_RECONCILE_MERCADOPAGO_ORDERS',
      'system_cron',
      false,
      SQLERRM,
      jsonb_build_object(
        'job', 'reconcile_mercadopago_orders',
        'executed_at', NOW(),
        'error_detail', SQLSTATE,
        'error_context', SQLERRM
      )
    );
END;
$$;
