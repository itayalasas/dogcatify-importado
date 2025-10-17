/*
  # Habilitar Notificaciones Automáticas de Webhooks

  1. Extensión
    - Habilita pg_net para hacer llamadas HTTP desde triggers
  
  2. Función Actualizada
    - `trigger_webhook_notification` - Llama automáticamente a la Edge Function
    - Se ejecuta cuando una orden es insertada o actualizada
    - Usa pg_net.http_post para hacer llamadas HTTP asíncronas
  
  3. Triggers Actualizados
    - order_created_webhook - Se dispara al insertar una orden
    - order_updated_webhook - Se dispara al actualizar una orden
  
  4. Seguridad
    - La función usa SECURITY DEFINER para tener permisos de llamar a pg_net
    - Los webhooks se envían de forma asíncrona para no bloquear transacciones
*/

-- Habilitar extensión pg_net para llamadas HTTP
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Función para disparar webhook automáticamente cuando cambia una orden
CREATE OR REPLACE FUNCTION trigger_webhook_notification()
RETURNS TRIGGER AS $$
DECLARE
  event_type text;
  function_url text;
  supabase_url text;
  supabase_service_key text;
  request_id bigint;
BEGIN
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

  -- Obtener URL de Supabase (hardcoded por ahora, se puede parametrizar)
  supabase_url := 'https://zkgiwamycbjcogcgqhff.supabase.co';
  function_url := supabase_url || '/functions/v1/notify-order-webhook';
  
  -- Obtener service key desde configuración o usar valor por defecto
  supabase_service_key := current_setting('app.settings.supabase_service_key', true);
  
  -- Si no está configurado, usar el valor por defecto (esto se debe configurar en producción)
  IF supabase_service_key IS NULL THEN
    supabase_service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprZ2l3YW15Y2JqY29nY2dxaGZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4Njg1MDQsImV4cCI6MjA2MzQ0NDUwNH0.tyKCfVlMlH1sqGhVqDG8_Cz3zvqDOwGISLikHE6wnPk';
  END IF;

  -- Llamar a la Edge Function de forma asíncrona usando pg_net
  BEGIN
    SELECT INTO request_id extensions.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_service_key
      ),
      body := jsonb_build_object(
        'order_id', NEW.id,
        'event_type', event_type
      )
    );
    
    RAISE NOTICE 'Webhook notification queued with request_id: % for order % with event %', 
      request_id, NEW.id, event_type;
      
  EXCEPTION WHEN OTHERS THEN
    -- Log error pero no fallar la transacción
    RAISE WARNING 'Failed to queue webhook notification: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar triggers antiguos si existen
DROP TRIGGER IF EXISTS order_created_webhook ON orders;
DROP TRIGGER IF EXISTS order_updated_webhook ON orders;

-- Trigger para orden creada (se dispara automáticamente al INSERT)
CREATE TRIGGER order_created_webhook
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhook_notification();

-- Trigger para orden actualizada (se dispara automáticamente al UPDATE)
CREATE TRIGGER order_updated_webhook
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION trigger_webhook_notification();

-- Comentarios para documentación
COMMENT ON FUNCTION trigger_webhook_notification() IS 
  'Dispara automáticamente webhooks cuando una orden es creada o actualizada. Usa pg_net para llamadas HTTP asíncronas.';

COMMENT ON TRIGGER order_created_webhook ON orders IS 
  'Se dispara automáticamente cuando se inserta una nueva orden en la tabla orders';

COMMENT ON TRIGGER order_updated_webhook ON orders IS 
  'Se dispara automáticamente cuando se actualiza una orden existente en la tabla orders';
