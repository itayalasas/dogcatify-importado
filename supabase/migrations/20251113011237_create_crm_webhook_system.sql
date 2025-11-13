/*
  # Sistema de Webhooks al CRM

  1. Nueva Tabla: crm_webhook_logs
    - Registra todos los intentos de envío de webhooks al CRM externo
    - Campos:
      - `id` (uuid, primary key)
      - `order_id` (uuid, foreign key) - Referencia a la orden
      - `event_type` (text) - Tipo de evento (order.created, order.updated, etc.)
      - `payload` (jsonb) - Datos enviados al CRM
      - `response_status` (integer) - Código HTTP de respuesta
      - `response_body` (text) - Respuesta del CRM
      - `attempt_number` (integer) - Número de intento
      - `success` (boolean) - Si fue exitoso
      - `crm_url` (text) - URL del CRM a la que se envió
      - `created_at` (timestamp)

  2. Trigger Automático
    - Dispara la Edge Function `send-order-to-crm` cuando:
      * Se crea una nueva orden (INSERT)
      * Se actualiza una orden (UPDATE)
    - Excluye órdenes gratuitas (payment_method = 'free' o total_amount = 0)
    - Usa pg_net para llamadas HTTP asíncronas

  3. Seguridad
    - Habilitar RLS en crm_webhook_logs
    - Solo los administradores pueden ver los logs

  4. Configuración
    - La URL del CRM y API Key se configuran en variables de entorno:
      * CRM_WEBHOOK_URL
      * CRM_API_KEY
*/

-- Crear tabla de logs de webhooks al CRM
CREATE TABLE IF NOT EXISTS crm_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  attempt_number integer DEFAULT 1,
  success boolean DEFAULT false,
  crm_url text,
  created_at timestamptz DEFAULT now()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_crm_webhook_logs_order_id ON crm_webhook_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_crm_webhook_logs_event_type ON crm_webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_crm_webhook_logs_created_at ON crm_webhook_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_crm_webhook_logs_success ON crm_webhook_logs(success);

-- Habilitar RLS
ALTER TABLE crm_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Solo administradores pueden ver los logs
CREATE POLICY "Admins can view crm webhook logs"
  ON crm_webhook_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify.com'
    )
  );

-- Sistema puede insertar logs
CREATE POLICY "System can insert crm webhook logs"
  ON crm_webhook_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Función para disparar webhook al CRM automáticamente
CREATE OR REPLACE FUNCTION trigger_crm_webhook()
RETURNS TRIGGER AS $$
DECLARE
  event_type text;
  function_url text;
  supabase_url text;
  supabase_service_key text;
  payload jsonb;
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

  -- Service key
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

    RAISE NOTICE 'CRM webhook notification sent for order % with event %', NEW.id, event_type;

  EXCEPTION WHEN OTHERS THEN
    -- Log error pero no fallar la transacción
    RAISE WARNING 'Failed to send CRM webhook notification for order %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para orden creada (se dispara automáticamente al INSERT)
CREATE TRIGGER order_created_crm_webhook
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_crm_webhook();

-- Trigger para orden actualizada (se dispara automáticamente al UPDATE)
CREATE TRIGGER order_updated_crm_webhook
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION trigger_crm_webhook();

-- Comentarios para documentación
COMMENT ON FUNCTION trigger_crm_webhook() IS
  'Dispara automáticamente webhooks al CRM externo cuando una orden es creada o actualizada. Excluye servicios gratuitos.';

COMMENT ON TRIGGER order_created_crm_webhook ON orders IS
  'Se dispara automáticamente cuando se inserta una nueva orden para enviar al CRM';

COMMENT ON TRIGGER order_updated_crm_webhook ON orders IS
  'Se dispara automáticamente cuando se actualiza una orden para enviar al CRM';

COMMENT ON TABLE crm_webhook_logs IS
  'Registra todos los intentos de envío de webhooks al CRM externo para auditoría y debugging';
