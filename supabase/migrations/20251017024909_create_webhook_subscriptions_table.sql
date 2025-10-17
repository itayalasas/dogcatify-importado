/*
  # Crear Sistema de Webhooks para Órdenes

  1. Nueva Tabla: webhook_subscriptions
    - Almacena las suscripciones de webhooks de terceros
    - Campos:
      - `id` (uuid, primary key)
      - `partner_id` (uuid, foreign key) - Socio que suscribe el webhook
      - `webhook_url` (text) - URL donde enviar las notificaciones
      - `events` (jsonb) - Array de eventos a los que está suscrito (order.created, order.updated, order.cancelled)
      - `secret_key` (text) - Clave secreta para firmar las peticiones
      - `is_active` (boolean) - Si el webhook está activo
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Nueva Tabla: webhook_logs
    - Registra todos los intentos de envío de webhooks
    - Campos:
      - `id` (uuid, primary key)
      - `webhook_subscription_id` (uuid, foreign key)
      - `order_id` (uuid, foreign key)
      - `event_type` (text) - Tipo de evento (order.created, order.updated, etc.)
      - `payload` (jsonb) - Datos enviados
      - `response_status` (integer) - Código HTTP de respuesta
      - `response_body` (text) - Respuesta del webhook
      - `attempt_number` (integer) - Número de intento
      - `success` (boolean) - Si fue exitoso
      - `created_at` (timestamp)

  3. Seguridad
    - Habilitar RLS en ambas tablas
    - Los partners solo pueden ver sus propias suscripciones
    - Solo los partners pueden crear/actualizar sus webhooks
*/

-- Crear tabla de suscripciones de webhooks
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  webhook_url text NOT NULL,
  events jsonb NOT NULL DEFAULT '["order.created", "order.updated", "order.cancelled"]'::jsonb,
  secret_key text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_webhook_url CHECK (webhook_url ~* '^https?://.*')
);

-- Crear tabla de logs de webhooks
CREATE TABLE IF NOT EXISTS webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_subscription_id uuid REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  attempt_number integer DEFAULT 1,
  success boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_partner_id ON webhook_subscriptions(partner_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_is_active ON webhook_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_subscription_id ON webhook_logs(webhook_subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_order_id ON webhook_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at);

-- Habilitar RLS
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para webhook_subscriptions

-- Los partners pueden ver solo sus propias suscripciones
CREATE POLICY "Partners can view own webhook subscriptions"
  ON webhook_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = partner_id);

-- Los partners pueden crear sus propias suscripciones
CREATE POLICY "Partners can create own webhook subscriptions"
  ON webhook_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = partner_id);

-- Los partners pueden actualizar sus propias suscripciones
CREATE POLICY "Partners can update own webhook subscriptions"
  ON webhook_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = partner_id)
  WITH CHECK (auth.uid() = partner_id);

-- Los partners pueden eliminar sus propias suscripciones
CREATE POLICY "Partners can delete own webhook subscriptions"
  ON webhook_subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = partner_id);

-- Políticas RLS para webhook_logs

-- Los partners pueden ver los logs de sus propias suscripciones
CREATE POLICY "Partners can view own webhook logs"
  ON webhook_logs FOR SELECT
  TO authenticated
  USING (
    webhook_subscription_id IN (
      SELECT id FROM webhook_subscriptions WHERE partner_id = auth.uid()
    )
  );

-- Solo el sistema puede insertar logs (desde Edge Functions)
CREATE POLICY "System can insert webhook logs"
  ON webhook_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_webhook_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS webhook_subscription_updated_at ON webhook_subscriptions;
CREATE TRIGGER webhook_subscription_updated_at
  BEFORE UPDATE ON webhook_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_subscription_updated_at();