/*
  # Corregir Notificaciones Automáticas de Webhooks con pg_net

  1. Problema Identificado
    - La función anterior usaba pg_net incorrectamente
    - pg_net en Supabase no retorna request_id directamente
    - La función debe usar net.http_post de forma correcta
  
  2. Solución
    - Actualizar función para usar net.http_post sin asignar resultado
    - Usar configuración correcta de headers y body
    - Manejar errores apropiadamente
  
  3. Triggers
    - Mantener los triggers existentes
    - Se disparan automáticamente al insertar/actualizar órdenes
*/

-- Función corregida para disparar webhook automáticamente
CREATE OR REPLACE FUNCTION trigger_webhook_notification()
RETURNS TRIGGER AS $$
DECLARE
  event_type text;
  function_url text;
  supabase_url text;
  supabase_service_key text;
  payload jsonb;
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

  -- Llamar a la Edge Function usando pg_net (forma correcta para Supabase)
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

-- Los triggers ya existen, no necesitamos recrearlos
-- Solo agregamos comentarios actualizados
COMMENT ON FUNCTION trigger_webhook_notification() IS 
  'Dispara automáticamente webhooks cuando una orden es creada o actualizada. Usa net.http_post (pg_net) para llamadas HTTP asíncronas.';
