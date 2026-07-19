-- Ensure the purchase confirmation email is sent only once per checkout.
-- Split child orders must not trigger customer confirmation emails.

CREATE OR REPLACE FUNCTION public.send_order_confirmation_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  supabase_url text;
  supabase_service_key text;
  function_url text;
  payload jsonb;
  request_id bigint;
  customer_email_text text;
  customer_name_text text;
  delivery_address_text text;
  payment_method_display text;
  template_to_use text;
  email_data jsonb;
BEGIN
  -- Only the root/master order should send the confirmation email.
  -- Child orders created for split-store checkouts already belong to the same purchase.
  IF NEW.parent_order_id IS NOT NULL THEN
    RAISE NOTICE '⏭️ Skipping confirmation email for split child order %', NEW.id;
    RETURN NEW;
  END IF;

  -- Log de inicio del trigger
  RAISE NOTICE '🚀 TRIGGER STARTED for order: %, operation: %, payment_status: % -> %',
    NEW.id, TG_OP, COALESCE(OLD.payment_status, 'NULL'), NEW.payment_status;

  -- Solo enviar para pagos confirmados
  IF NEW.payment_status NOT IN ('paid', 'approved') THEN
    RAISE NOTICE '⏸️ SKIPPED: Payment status is not paid/approved: %', NEW.payment_status;
    RETURN NEW;
  END IF;

  -- No enviar si ya se habia enviado antes (evitar duplicados en UPDATE)
  IF TG_OP = 'UPDATE' AND OLD.payment_status IN ('paid', 'approved') THEN
    RAISE NOTICE '⏸️ SKIPPED: Payment was already confirmed (OLD status: %)', OLD.payment_status;
    RETURN NEW;
  END IF;

  -- No enviar para servicios gratuitos
  IF NEW.payment_method = 'free' OR NEW.total_amount = 0 THEN
    RAISE NOTICE '⏸️ SKIPPED: Free service order: %', NEW.id;
    RETURN NEW;
  END IF;

  RAISE NOTICE '✅ VALIDATION PASSED: Proceeding to send email...';

  -- Obtener email del cliente desde profiles
  RAISE NOTICE '🔍 Looking for customer: %', NEW.customer_id;

  SELECT
    p.email,
    COALESCE(p.display_name, p.email)
  INTO customer_email_text, customer_name_text
  FROM profiles p
  WHERE p.id = NEW.customer_id;

  IF customer_email_text IS NULL THEN
    RAISE WARNING '❌ No email found for customer %', NEW.customer_id;
    RETURN NEW;
  END IF;

  RAISE NOTICE '✅ Customer found: % <%>', customer_name_text, customer_email_text;

  -- Configuracion de Supabase
  supabase_url := 'https://hpvzjuionqvgxlvhyqgz.supabase.co';
  function_url := supabase_url || '/functions/v1/send-invoice-email';
  supabase_service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdnpqdWlvbnF2Z3hsdmh5cWd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDExNzI5MywiZXhwIjoyMDc5NjkzMjkzfQ.10BnGYY1A8HKpFM59m4MOkOnZoYvSzac45cP3A2_t2c';

  -- Determinar el template y datos segun el tipo de orden
  IF NEW.order_type = 'service_booking' THEN
    template_to_use := 'agenda_confirmation';

    RAISE NOTICE '📅 Service booking detected - using agenda_confirmation template';

    email_data := jsonb_build_object(
      'client_name', customer_name_text,
      'order_number', COALESCE(NEW.order_number, '#' || RIGHT(NEW.id::text, 6)),
      'service_name', COALESCE(NEW.service_name, 'Servicio'),
      'provider_name', COALESCE(NEW.partner_name, 'Proveedor'),
      'reservation_date', COALESCE(TO_CHAR(NEW.appointment_date, 'DD/MM/YYYY'), 'Fecha no especificada'),
      'reservation_time', COALESCE(NEW.appointment_time, 'N/A'),
      'pet_name', COALESCE(NEW.pet_name, 'Mascota')
    );
  ELSE
    template_to_use := 'shop_confirmation';

    RAISE NOTICE '🛍️ Product purchase detected - using shop_confirmation template';

    delivery_address_text := COALESCE(NEW.shipping_address, 'Sin dirección especificada');

    payment_method_display := CASE
      WHEN NEW.payment_method = 'mercadopago' THEN 'Mercado Pago'
      WHEN NEW.payment_method = 'cash' THEN 'Efectivo'
      WHEN NEW.payment_method = 'card' THEN 'Tarjeta'
      ELSE INITCAP(NEW.payment_method)
    END;

    email_data := jsonb_build_object(
      'client_name', customer_name_text,
      'order_number', COALESCE(NEW.order_number, '#' || RIGHT(NEW.id::text, 6)),
      'order_date', TO_CHAR(NEW.created_at, 'DD/MM/YYYY'),
      'payment_method', payment_method_display,
      'payment_status', 'Confirmada',
      'delivery_address', delivery_address_text
    );
  END IF;

  payload := jsonb_build_object(
    'template_name', template_to_use,
    'recipient_email', customer_email_text,
    'order_id', NEW.id::text,
    'wait_for_invoice', true,
    'data', email_data
  );

  RAISE NOTICE '📤 Sending HTTP request to: %', function_url;
  RAISE NOTICE '📦 Payload: %', payload::text;

  BEGIN
    SELECT net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_service_key
      ),
      body := payload,
      timeout_milliseconds := 15000
    ) INTO request_id;

    RAISE NOTICE '✅ HTTP request queued successfully (request_id: %)', request_id;
    RAISE NOTICE '📧 Order confirmation email queued for order % to %',
      NEW.id, customer_email_text;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ EXCEPTION in HTTP request: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RAISE WARNING '❌ Failed to send confirmation email for order %', NEW.id;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "public"."send_order_confirmation_email"() IS 'Envía un solo correo de confirmación al cliente cuando se confirma el pago de la orden principal; las subórdenes divididas no envían correos duplicados.';
