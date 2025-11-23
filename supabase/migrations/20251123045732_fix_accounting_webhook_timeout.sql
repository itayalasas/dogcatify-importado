/*
  # Corregir Timeout en Webhooks de Contabilidad

  1. Problema
    - Los webhooks de pg_net están fallando por timeout (5 segundos default)
    - Las edge functions pueden tardar más, especialmente en cold start
    
  2. Solución
    - Aumentar timeout a 30 segundos para ambos webhooks
    - Esto da tiempo suficiente para que las functions respondan
    
  3. Cambios
    - Actualizar función trigger_crm_and_accounting_webhook
    - Agregar parámetro timeout_milliseconds a las llamadas pg_net
*/

-- Actualizar función con timeout aumentado
CREATE OR REPLACE FUNCTION trigger_crm_and_accounting_webhook()
RETURNS TRIGGER AS $$
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
BEGIN
  -- IMPORTANTE: No enviar webhooks para servicios gratuitos
  IF NEW.payment_method = 'free' OR NEW.total_amount = 0 THEN
    RAISE NOTICE 'Skipping webhooks for free service order: %', NEW.id;
    RETURN NEW;
  END IF;

  -- Determinar el tipo de evento y si hay cambios significativos
  IF TG_OP = 'INSERT' THEN
    event_type := 'order.created';
    has_significant_changes := true;

    -- Enviar a contabilidad si la orden ya está pagada al crearla
    IF NEW.payment_status IN ('paid', 'approved') THEN
      should_send_to_accounting := true;
      RAISE NOTICE 'Order % created with payment_status %, will send to accounting', NEW.id, NEW.payment_status;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Verificar si hubo cambios significativos

    -- 1. Cambio de status
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      has_significant_changes := true;

      -- Determinar el tipo de evento según el nuevo status
      IF NEW.status = 'cancelled' THEN
        event_type := 'order.cancelled';
      ELSIF NEW.status = 'confirmed' THEN
        event_type := 'order.confirmed';
      ELSIF NEW.status = 'completed' THEN
        event_type := 'order.completed';
      ELSE
        event_type := 'order.updated';
      END IF;

    -- 2. Cambio de payment_status
    ELSIF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      has_significant_changes := true;
      event_type := 'order.payment_updated';

      -- Si el pago acaba de ser confirmado, enviar a contabilidad
      IF NEW.payment_status IN ('paid', 'approved') AND
         (OLD.payment_status IS NULL OR OLD.payment_status NOT IN ('paid', 'approved')) THEN
        should_send_to_accounting := true;
        RAISE NOTICE 'Order % payment_status changed to %, will send to accounting', NEW.id, NEW.payment_status;
      END IF;

    -- 3. Cambio de total_amount
    ELSIF NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
      has_significant_changes := true;
      event_type := 'order.updated';

    -- 4. Cambio de items
    ELSIF NEW.items::text IS DISTINCT FROM OLD.items::text THEN
      has_significant_changes := true;
      event_type := 'order.updated';

    -- 5. Cambio de shipping_address
    ELSIF NEW.shipping_address::text IS DISTINCT FROM OLD.shipping_address::text THEN
      has_significant_changes := true;
      event_type := 'order.updated';

    ELSE
      -- No hay cambios significativos, no enviar webhook
      has_significant_changes := false;
    END IF;

    -- Si no hay cambios significativos, no enviar webhook
    IF NOT has_significant_changes THEN
      RAISE NOTICE 'No significant changes for order %, skipping webhook', NEW.id;
      RETURN NEW;
    END IF;

  ELSE
    RETURN NEW;
  END IF;

  -- Configuración de URL
  supabase_url := 'https://zkgiwamycbjcogcgqhff.supabase.co';
  function_url := supabase_url || '/functions/v1/send-order-to-crm';
  accounting_function_url := supabase_url || '/functions/v1/send-order-to-accounting';

  -- Service role key correcto
  supabase_service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprZ2l3YW15Y2JqY29nY2dxaGZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Nzg2ODUwNCwiZXhwIjoyMDYzNDQ0NTA0fQ.gDSaKjJYw0kAZKc7jOMCbB6g7pxh7v8f2CxObTkiF7E';

  -- 1. ENVIAR AL CRM (siempre para cambios significativos)
  payload := jsonb_build_object(
    'order_id', NEW.id,
    'event_type', event_type
  );

  BEGIN
    SELECT net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_service_key
      ),
      body := payload,
      timeout_milliseconds := 30000  -- 30 segundos timeout
    ) INTO request_id;

    RAISE NOTICE 'CRM webhook [%] queued for order % (request_id: %)', event_type, NEW.id, request_id;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to send CRM webhook notification for order %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
  END;

  -- 2. ENVIAR AL SISTEMA CONTABLE (solo si la orden está pagada)
  IF should_send_to_accounting THEN
    accounting_payload := jsonb_build_object(
      'order_id', NEW.id
    );

    BEGIN
      SELECT net.http_post(
        url := accounting_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || supabase_service_key
        ),
        body := accounting_payload,
        timeout_milliseconds := 30000  -- 30 segundos timeout
      ) INTO accounting_request_id;

      RAISE NOTICE 'Accounting webhook queued for paid order % (request_id: %)', NEW.id, accounting_request_id;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to send Accounting webhook notification for order %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_crm_and_accounting_webhook() IS
  'Dispara webhooks al CRM para cambios significativos y al sistema contable para órdenes pagadas. Timeout aumentado a 30s. Excluye servicios gratuitos.';
