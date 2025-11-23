/*
  # Corregir Trigger para Detectar Múltiples Cambios Simultáneos

  1. Problema Identificado
    - El trigger usa ELSIF que solo evalúa la primera condición que cumple
    - Cuando MercadoPago actualiza status Y payment_status juntos, solo detecta el cambio de status
    - Por eso no envía a contabilidad cuando el payment_status cambia a 'approved'
    
  2. Solución
    - Cambiar ELSIF por IF independientes para evaluar TODOS los cambios
    - Detectar cambio de payment_status independientemente de otros cambios
    - Enviar a contabilidad cuando payment_status cambia a paid/approved
    
  3. Cambios
    - Reescribir la lógica de detección de cambios en UPDATE
    - Usar flags independientes para cada tipo de cambio
    - Asegurar que se envía a contabilidad cuando corresponde
*/

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
  status_changed boolean := false;
  payment_status_changed boolean := false;
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
    -- Verificar TODOS los cambios (usar IF en lugar de ELSIF)
    
    -- 1. Verificar cambio de status
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      has_significant_changes := true;
      status_changed := true;
      
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
    END IF;
    
    -- 2. Verificar cambio de payment_status (INDEPENDIENTE del status)
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      has_significant_changes := true;
      payment_status_changed := true;
      
      -- Si no se definió event_type por cambio de status, usar payment_updated
      IF NOT status_changed THEN
        event_type := 'order.payment_updated';
      END IF;
      
      -- Si el pago acaba de ser confirmado, enviar a contabilidad
      IF NEW.payment_status IN ('paid', 'approved') AND
         (OLD.payment_status IS NULL OR OLD.payment_status NOT IN ('paid', 'approved')) THEN
        should_send_to_accounting := true;
        RAISE NOTICE 'Order % payment_status changed from % to %, will send to accounting', 
          NEW.id, OLD.payment_status, NEW.payment_status;
      END IF;
    END IF;

    -- 3. Verificar otros cambios solo si no hubo cambios de status o payment
    IF NOT status_changed AND NOT payment_status_changed THEN
      IF NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
        has_significant_changes := true;
        event_type := 'order.updated';
      ELSIF NEW.items::text IS DISTINCT FROM OLD.items::text THEN
        has_significant_changes := true;
        event_type := 'order.updated';
      ELSIF NEW.shipping_address::text IS DISTINCT FROM OLD.shipping_address::text THEN
        has_significant_changes := true;
        event_type := 'order.updated';
      END IF;
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
  'Dispara webhooks al CRM y contabilidad. Detecta TODOS los cambios simultáneos en UPDATE. Timeout 30s. Excluye servicios gratuitos.';
