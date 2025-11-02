/*
  # Excluir Servicios Gratuitos de Webhooks al CRM

  1. Problema
    - Los servicios gratuitos (has_cost = false) crean órdenes con payment_method = 'free'
    - Estas órdenes se envían al CRM pero no deberían porque no hay facturación

  2. Solución
    - Modificar la función trigger_webhook_notification() para filtrar:
      * Órdenes con payment_method = 'free'
      * Órdenes con total_amount = 0
    - Estas órdenes NO generarán webhooks al CRM

  3. Notas
    - Solo afecta el envío al CRM, no afecta la creación de la orden
    - Las reservas gratuitas siguen funcionando normalmente
    - El partner recibe notificación push pero no se envía al CRM para facturar
*/

-- Actualizar función para excluir servicios gratuitos
CREATE OR REPLACE FUNCTION trigger_webhook_notification()
RETURNS TRIGGER AS $$
DECLARE
  event_type text;
  function_url text;
  supabase_url text;
  supabase_service_key text;
  payload jsonb;
BEGIN
  -- IMPORTANTE: No enviar webhooks para servicios gratuitos
  -- Estos no deben facturarse en el CRM
  IF NEW.payment_method = 'free' OR NEW.total_amount = 0 THEN
    RAISE NOTICE 'Skipping webhook for free service order: %', NEW.id;
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
  function_url := supabase_url || '/functions/v1/notify-order-webhook';

  -- Service key (en producción esto debería estar en configuración segura)
  supabase_service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprZ2l3YW15Y2JqY29nY2dxaGZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4Njg1MDQsImV4cCI6MjA2MzQ0NDUwNH0.tyKCfVlMlH1sqGhVqDG8_Cz3zvqDOwGISLikHE6wnPk';

  -- Crear payload
  payload := jsonb_build_object(
    'order_id', NEW.id,
    'event_type', event_type
  );

  -- Llamar a la Edge Function usando pg_net
  BEGIN
    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_service_key
      ),
      body := payload
    );

    RAISE NOTICE 'Webhook notification sent for order % with event %', NEW.id, event_type;

  EXCEPTION WHEN OTHERS THEN
    -- Log error pero no fallar la transacción
    RAISE WARNING 'Failed to send webhook notification for order %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_webhook_notification() IS
  'Dispara automáticamente webhooks cuando una orden es creada o actualizada. Excluye servicios gratuitos (payment_method=free o total_amount=0) que no deben facturarse en el CRM.';
