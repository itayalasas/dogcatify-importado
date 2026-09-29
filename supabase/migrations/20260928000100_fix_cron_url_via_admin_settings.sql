-- The previous migration (20260928000000) tried to resolve the per-project
-- URL from a custom Postgres GUC (app.settings.supabase_url), matching the
-- existing app.settings.service_role_key pattern. That GUC requires
-- superuser privileges to set on Supabase's managed Postgres
-- (ALTER DATABASE ... SET app.settings.x fails with "permission denied to
-- set parameter"), which isn't available through the CLI/Management API
-- connection. Using public.admin_settings (already the app's existing
-- runtime-config table, see contexts loading SYSTEM_CONFIG_KEY) needs only a
-- normal INSERT/UPDATE, so the per-project value can actually be set.

CREATE OR REPLACE FUNCTION public.send_scheduled_notifications_cron() RETURNS void
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
BEGIN
  service_role_key := current_setting('app.settings.service_role_key', true);
  IF service_role_key IS NULL OR service_role_key = '' THEN
    service_role_key := current_setting('supabase.service_role_key', true);
  END IF;

  SELECT INTO request_id net.http_post(
    url := supabase_url || '/functions/v1/send-scheduled-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, ''),
      'apikey', COALESCE(service_role_key, '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );

  RAISE NOTICE 'send_scheduled_notifications_cron queued request_id: % (url: %)', request_id, supabase_url;
END;
$$;

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

CREATE OR REPLACE FUNCTION check_alert_thresholds_cron() RETURNS void
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
BEGIN
  service_role_key := current_setting('app.settings.service_role_key', true);
  IF service_role_key IS NULL OR service_role_key = '' THEN
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

CREATE OR REPLACE FUNCTION public.trigger_crm_and_accounting_webhook() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_type text;
  function_url text;
  accounting_function_url text;
  supabase_url text;
  supabase_service_key text;
  payload jsonb;
  accounting_payload jsonb;
  request_id bigint;
  accounting_request_id bigint;
  has_significant_changes boolean := false;
  should_send_to_accounting boolean := false;
  status_changed boolean := false;
  payment_status_changed boolean := false;
  webhook_headers jsonb;
BEGIN
  IF NEW.payment_method = 'free' OR NEW.total_amount = 0 THEN
    RAISE NOTICE 'Skipping webhooks for free order: %', NEW.id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    event_type := 'order.created';
    has_significant_changes := true;

    IF NEW.payment_status IN ('paid', 'approved') THEN
      should_send_to_accounting := true;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    status_changed := NEW.status IS DISTINCT FROM OLD.status;
    payment_status_changed := NEW.payment_status IS DISTINCT FROM OLD.payment_status;

    has_significant_changes :=
      status_changed OR
      payment_status_changed OR
      NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
      NEW.items::text IS DISTINCT FROM OLD.items::text OR
      NEW.shipping_address::text IS DISTINCT FROM OLD.shipping_address::text;

    IF NOT has_significant_changes THEN
      RAISE NOTICE 'No significant changes for order %, skipping webhook', NEW.id;
      RETURN NEW;
    END IF;

    IF status_changed THEN
      IF NEW.status = 'cancelled' THEN
        event_type := 'order.cancelled';
      ELSIF NEW.status = 'confirmed' THEN
        event_type := 'order.confirmed';
      ELSIF NEW.status = 'completed' THEN
        event_type := 'order.completed';
      ELSE
        event_type := 'order.updated';
      END IF;
    ELSIF payment_status_changed THEN
      event_type := 'order.payment_updated';
    ELSE
      event_type := 'order.updated';
    END IF;

    IF (
         payment_status_changed
         AND NEW.payment_status IN ('paid', 'approved')
         AND (OLD.payment_status IS NULL OR OLD.payment_status NOT IN ('paid', 'approved'))
       )
       OR (
         status_changed
         AND NEW.status = 'confirmed'
         AND NEW.payment_status IN ('paid', 'approved')
       ) THEN
      should_send_to_accounting := true;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  supabase_url := COALESCE(
    (SELECT value->>'url' FROM public.admin_settings WHERE key = 'cron_project_url'),
    'https://hpvzjuionqvgxlvhyqgz.supabase.co'
  );
  function_url := supabase_url || '/functions/v1/send-order-to-crm';
  accounting_function_url := supabase_url || '/functions/v1/send-order-to-accounting';

  supabase_service_key := current_setting('app.settings.service_role_key', true);
  IF supabase_service_key IS NULL OR supabase_service_key = '' THEN
    supabase_service_key := current_setting('supabase.service_role_key', true);
  END IF;

  IF supabase_service_key IS NULL OR supabase_service_key = '' THEN
    RAISE WARNING 'Missing service_role key in DB settings; sending webhook without auth headers for order %', NEW.id;
    webhook_headers := jsonb_build_object('Content-Type', 'application/json');
  ELSE
    webhook_headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || supabase_service_key,
      'apikey', supabase_service_key
    );
  END IF;

  payload := jsonb_build_object(
    'order_id', NEW.id,
    'event_type', event_type
  );

  BEGIN
    SELECT net.http_post(
      url := function_url,
      headers := webhook_headers,
      body := payload,
      timeout_milliseconds := 30000
    ) INTO request_id;

    RAISE NOTICE 'CRM webhook [%] queued for order % (request_id: %)', event_type, NEW.id, request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed CRM webhook for order %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
  END;

  IF should_send_to_accounting THEN
    accounting_payload := jsonb_build_object('order_id', NEW.id);

    BEGIN
      SELECT net.http_post(
        url := accounting_function_url,
        headers := webhook_headers,
        body := accounting_payload,
        timeout_milliseconds := 30000
      ) INTO accounting_request_id;

      RAISE NOTICE 'Accounting webhook queued for order % (request_id: %)', NEW.id, accounting_request_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed Accounting webhook for order %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_crm_and_accounting_webhook() IS
'Fix 2026-09-28: resuelve la URL del proyecto desde admin_settings (key=cron_project_url, por-proyecto) en vez de hardcodear la de producción.';
