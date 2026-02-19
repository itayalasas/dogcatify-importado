-- Aplicar trigger de confirmación de emails directamente
-- Este script se ejecuta directo en la base de datos remota

-- 1. Función para enviar correo de confirmación de orden
CREATE OR REPLACE FUNCTION send_order_confirmation_email()
RETURNS TRIGGER AS $$
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
  -- Log de inicio del trigger
  RAISE NOTICE '🚀 TRIGGER STARTED for order: %, operation: %, payment_status: % -> %', 
    NEW.id, TG_OP, COALESCE(OLD.payment_status, 'NULL'), NEW.payment_status;

  -- Solo enviar para pagos confirmados
  IF NEW.payment_status NOT IN ('paid', 'approved') THEN
    RAISE NOTICE '⏸️ SKIPPED: Payment status is not paid/approved: %', NEW.payment_status;
    RETURN NEW;
  END IF;

  -- No enviar si ya se había enviado antes (evitar duplicados en UPDATE)
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

  -- Configuración de Supabase
  supabase_url := 'https://hpvzjuionqvgxlvhyqgz.supabase.co';
  function_url := supabase_url || '/functions/v1/send-invoice-email';
  supabase_service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdnpqdWlvbnF2Z3hsdmh5cWd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDExNzI5MywiZXhwIjoyMDc5NjkzMjkzfQ.10BnGYY1A8HKpFM59m4MOkOnZoYvSzac45cP3A2_t2c';

  -- Determinar el template y datos según el tipo de orden
  IF NEW.order_type = 'service_booking' THEN
    -- Template para reservas de servicios (agenda)
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
    -- Template para compras de productos (tienda)
    template_to_use := 'shop_confirmation';
    
    RAISE NOTICE '🛍️ Product purchase detected - using shop_confirmation template';
    
    -- Obtener dirección de envío
    delivery_address_text := COALESCE(NEW.shipping_address, 'Sin dirección especificada');

    -- Formatear método de pago para mostrar
    payment_method_display := CASE 
      WHEN NEW.payment_method = 'mercadopago' THEN 'Mercado Pago'
      WHEN NEW.payment_method = 'cash' THEN 'Efectivo'
      WHEN NEW.payment_method = 'card' THEN 'Tarjeta'
      ELSE INITCAP(NEW.payment_method)
    END;
    
    email_data := jsonb_build_object(
      'client_name', customer_name_text,
      'order_number', COALESCE(NEW.order_number, '#' || RIGHT(NEW.id::text, 6)),  -- Usar order_number si existe, sino últimos 6 del UUID
      'order_date', TO_CHAR(NEW.created_at, 'DD/MM/YYYY'),
      'payment_method', payment_method_display,
      'payment_status', 'Confirmada',
      'delivery_address', delivery_address_text
    );
  END IF;

  -- Preparar payload para el correo con estructura correcta
  payload := jsonb_build_object(
    'template_name', template_to_use,
    'recipient_email', customer_email_text,
    'order_id', NEW.id::text,
    'wait_for_invoice', true,
    'data', email_data
  );

  -- Enviar correo a través de la Edge Function send-email
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
      timeout_milliseconds := 15000  -- 15 segundos timeout
    ) INTO request_id;

    RAISE NOTICE '✅ HTTP request queued successfully (request_id: %)', request_id;
    RAISE NOTICE '📧 Order confirmation email queued for order % to %', 
      NEW.id, customer_email_text;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ EXCEPTION in HTTP request: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RAISE WARNING '❌ Failed to send confirmation email for order %', NEW.id;
    -- No fallar el trigger completo si el email falla
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION send_order_confirmation_email() IS
  'Envía correo de confirmación al cliente cuando el pago de la orden es confirmado (payment_status = paid/approved)';

-- 2. Crear trigger para enviar correo cuando se confirma el pago
DROP TRIGGER IF EXISTS on_order_payment_confirmed_send_email ON orders;
CREATE TRIGGER on_order_payment_confirmed_send_email
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION send_order_confirmation_email();

COMMENT ON TRIGGER on_order_payment_confirmed_send_email ON orders IS
  'Trigger que envía correo de confirmación automáticamente cuando se confirma el pago de una orden (INSERT o UPDATE)';

-- Verificar que se creó correctamente
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'orders' 
  AND trigger_name = 'on_order_payment_confirmed_send_email';
