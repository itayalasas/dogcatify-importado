-- Reconciliación automática de órdenes Mercado Pago + envío contable faltante

CREATE OR REPLACE FUNCTION public.reconcile_mercadopago_orders_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  supabase_url text := 'https://hpvzjuionqvgxlvhyqgz.supabase.co';
  service_role_key text;
  cron_secret text;
BEGIN
  service_role_key := current_setting('app.settings.service_role_key', true);
  IF service_role_key IS NULL OR service_role_key = '' THEN
    service_role_key := current_setting('supabase.service_role_key', true);
  END IF;

  cron_secret := current_setting('app.settings.cron_secret', true);

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

ALTER FUNCTION public.reconcile_mercadopago_orders_cron() OWNER TO postgres;
GRANT ALL ON FUNCTION public.reconcile_mercadopago_orders_cron() TO anon;
GRANT ALL ON FUNCTION public.reconcile_mercadopago_orders_cron() TO authenticated;
GRANT ALL ON FUNCTION public.reconcile_mercadopago_orders_cron() TO service_role;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'reconcile_mercadopago_orders'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'reconcile_mercadopago_orders',
    '*/10 * * * *',
    'SELECT public.reconcile_mercadopago_orders_cron();'
  );
END;
$$;
