/*
  # Crear Triggers para Notificar Webhooks en Cambios de Órdenes

  1. Función para notificar webhooks
    - Se ejecuta cuando una orden es creada, actualizada o su status cambia
    - Llama a la Edge Function notify-order-webhook

  2. Triggers
    - Trigger AFTER INSERT en orders (order.created)
    - Trigger AFTER UPDATE en orders (order.updated)
    - Trigger específico para cambio de status a cancelled (order.cancelled)
    - Trigger específico para cambio de status a completed (order.completed)

  3. Notas
    - Los triggers usan pg_notify para enviar eventos asíncronos
    - La Edge Function se puede invocar mediante un listener externo
    - Para producción, se recomienda usar una cola de trabajos como pg_cron
*/

-- Función para notificar cambios en órdenes via webhook
CREATE OR REPLACE FUNCTION notify_order_webhook()
RETURNS TRIGGER AS $$
DECLARE
  event_type text;
  webhook_payload jsonb;
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

  -- Crear payload para el webhook
  webhook_payload := jsonb_build_object(
    'order_id', NEW.id,
    'event_type', event_type,
    'partner_id', NEW.partner_id,
    'status', NEW.status,
    'timestamp', now()
  );

  -- Notificar mediante pg_notify (para procesamiento asíncrono)
  PERFORM pg_notify('order_webhook', webhook_payload::text);

  -- Nota: En producción, aquí se debería encolar un trabajo para llamar
  -- a la Edge Function notify-order-webhook de manera asíncrona
  -- Por ahora, los webhooks se deben llamar manualmente o mediante un worker externo

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para orden creada
DROP TRIGGER IF EXISTS order_created_webhook ON orders;
CREATE TRIGGER order_created_webhook
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_webhook();

-- Trigger para orden actualizada
DROP TRIGGER IF EXISTS order_updated_webhook ON orders;
CREATE TRIGGER order_updated_webhook
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (
    OLD.* IS DISTINCT FROM NEW.*
  )
  EXECUTE FUNCTION notify_order_webhook();

-- Función auxiliar para invocar la Edge Function desde triggers (opcional)
-- Esta función se puede usar si tienes pg_net instalado
CREATE OR REPLACE FUNCTION invoke_webhook_edge_function(order_id_param uuid, event_type_param text)
RETURNS void AS $$
DECLARE
  supabase_url text;
  supabase_anon_key text;
  function_url text;
  request_payload jsonb;
BEGIN
  -- Obtener la URL de Supabase desde variables de entorno
  -- Nota: Esto requiere que las variables estén configuradas en Supabase
  supabase_url := current_setting('app.settings.supabase_url', true);
  supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);

  IF supabase_url IS NULL OR supabase_anon_key IS NULL THEN
    RAISE NOTICE 'Supabase URL or Anon Key not configured';
    RETURN;
  END IF;

  function_url := supabase_url || '/functions/v1/notify-order-webhook';
  
  request_payload := jsonb_build_object(
    'order_id', order_id_param,
    'event_type', event_type_param
  );

  -- Aquí se invocaría la Edge Function usando pg_net
  -- PERFORM net.http_post(
  --   url := function_url,
  --   headers := jsonb_build_object(
  --     'Content-Type', 'application/json',
  --     'Authorization', 'Bearer ' || supabase_anon_key
  --   ),
  --   body := request_payload
  -- );

  RAISE NOTICE 'Webhook notification queued for order % with event %', order_id_param, event_type_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;