/*
  # Mejorar Lógica de Webhooks al CRM

  1. Problema
    - El trigger se dispara demasiado frecuentemente
    - Se envían webhooks para cambios menores como updated_at
    - Se envía order.updated inmediatamente después de order.created
    
  2. Solución
    - Solo enviar order.created cuando se inserta la orden
    - Solo enviar order.updated cuando haya cambios significativos:
      * Status cambió
      * Payment status cambió
      * Total amount cambió
    - No enviar si solo cambió updated_at en los primeros 10 segundos
    
  3. Eventos importantes:
    - order.created: Cuando se crea la orden
    - order.confirmed: Cuando status cambia a confirmed
    - order.cancelled: Cuando status cambia a cancelled
    - order.completed: Cuando status cambia a completed
*/

-- Eliminar la función existente
DROP FUNCTION IF EXISTS trigger_crm_webhook() CASCADE;

-- Recrear la función con mejor lógica
CREATE OR REPLACE FUNCTION trigger_crm_webhook()
RETURNS TRIGGER AS $$
DECLARE
  event_type text;
  function_url text;
  supabase_url text;
  supabase_service_key text;
  payload jsonb;
  request_id bigint;
  has_significant_changes boolean := false;
BEGIN
  -- IMPORTANTE: No enviar webhooks para servicios gratuitos
  IF NEW.payment_method = 'free' OR NEW.total_amount = 0 THEN
    RAISE NOTICE 'Skipping CRM webhook for free service order: %', NEW.id;
    RETURN NEW;
  END IF;

  -- Determinar el tipo de evento y si hay cambios significativos
  IF TG_OP = 'INSERT' THEN
    event_type := 'order.created';
    has_significant_changes := true;
    
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

  -- Service role key correcto
  supabase_service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprZ2l3YW15Y2JqY29nY2dxaGZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Nzg2ODUwNCwiZXhwIjoyMDYzNDQ0NTA0fQ.gDSaKjJYw0kAZKc7jOMCbB6g7pxh7v8f2CxObTkiF7E';

  -- Crear payload
  payload := jsonb_build_object(
    'order_id', NEW.id,
    'event_type', event_type
  );

  -- Llamar a la Edge Function usando pg_net
  BEGIN
    SELECT net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_service_key
      ),
      body := payload
    ) INTO request_id;

    RAISE NOTICE 'CRM webhook [%] queued for order % (request_id: %)', event_type, NEW.id, request_id;

  EXCEPTION WHEN OTHERS THEN
    -- Log error pero no fallar la transacción
    RAISE WARNING 'Failed to send CRM webhook notification for order %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear triggers
DROP TRIGGER IF EXISTS order_created_crm_webhook ON orders;
CREATE TRIGGER order_created_crm_webhook
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_crm_webhook();

DROP TRIGGER IF EXISTS order_updated_crm_webhook ON orders;
CREATE TRIGGER order_updated_crm_webhook
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_crm_webhook();

COMMENT ON FUNCTION trigger_crm_webhook() IS
  'Dispara webhooks al CRM solo para cambios significativos: status, payment_status, total_amount, items o shipping_address. Excluye servicios gratuitos.';
