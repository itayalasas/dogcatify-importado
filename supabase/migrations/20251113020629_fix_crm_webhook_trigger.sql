/*
  # Fix CRM Webhook Trigger - Usar Service Role Key correcto

  1. Problema
    - El trigger no está disparando correctamente
    - Necesitamos usar el SERVICE_ROLE_KEY en lugar del ANON_KEY
    
  2. Solución
    - Actualizar el trigger para usar el service role key correcto
    - Asegurar que pg_net tenga los permisos necesarios
*/

-- Eliminar la función existente
DROP FUNCTION IF EXISTS trigger_crm_webhook() CASCADE;

-- Recrear la función con el service role key correcto
CREATE OR REPLACE FUNCTION trigger_crm_webhook()
RETURNS TRIGGER AS $$
DECLARE
  event_type text;
  function_url text;
  supabase_url text;
  supabase_service_key text;
  payload jsonb;
  request_id bigint;
BEGIN
  -- IMPORTANTE: No enviar webhooks para servicios gratuitos
  IF NEW.payment_method = 'free' OR NEW.total_amount = 0 THEN
    RAISE NOTICE 'Skipping CRM webhook for free service order: %', NEW.id;
    RETURN NEW;
  END IF;

  -- Determinar el tipo de evento
  IF TG_OP = 'INSERT' THEN
    event_type := 'order.created';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Si el status cambió a cancelled
    IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
      event_type := 'order.cancelled';
    -- Si el status cambió a completed
    ELSIF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
      event_type := 'order.completed';
    -- Cualquier otra actualización
    ELSE
      event_type := 'order.updated';
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

    RAISE NOTICE 'CRM webhook notification queued for order % with event % (request_id: %)', NEW.id, event_type, request_id;

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
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION trigger_crm_webhook();

COMMENT ON FUNCTION trigger_crm_webhook() IS
  'Dispara automáticamente webhooks al CRM externo cuando una orden es creada o actualizada. Excluye servicios gratuitos.';
