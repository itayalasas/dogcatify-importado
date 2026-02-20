-- Fix: evitar service_role hardcodeada en trigger de CRM + contabilidad
-- Causa típica: rotación de JWT -> Authorization inválido -> no llega a send-order-to-accounting

CREATE OR REPLACE FUNCTION public.trigger_crm_and_accounting_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

    IF payment_status_changed
       AND NEW.payment_status IN ('paid', 'approved')
       AND (OLD.payment_status IS NULL OR OLD.payment_status NOT IN ('paid', 'approved')) THEN
      should_send_to_accounting := true;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  supabase_url := 'https://hpvzjuionqvgxlvhyqgz.supabase.co';
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
'Fix 2026-02-20: usa service_role key desde DB settings en vez de hardcode para evitar invalid JWT al invocar send-order-to-accounting';
