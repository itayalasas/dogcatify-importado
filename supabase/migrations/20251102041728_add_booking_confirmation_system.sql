/*
  # Sistema de Confirmación de Reservas para Servicios Sin Costo

  1. Nuevos Campos en partner_services
    - `cancellation_hours` (integer) - Horas previas para cancelar la cita (aplica a todos los servicios)
    - `confirmation_hours` (integer, nullable) - Horas previas para confirmar (solo servicios sin costo)
  
  2. Nueva Tabla: booking_confirmation_tokens
    - `id` (uuid, primary key)
    - `order_id` (uuid, foreign key) - Referencia a orders
    - `token_hash` (text, unique) - Token para confirmar la reserva
    - `email_sent_at` (timestamptz, nullable) - Cuándo se envió el email
    - `confirmed_at` (timestamptz, nullable) - Cuándo se confirmó
    - `expires_at` (timestamptz) - Cuándo expira el token
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  3. Seguridad
    - Enable RLS en booking_confirmation_tokens
    - Políticas para partners y clientes

  4. Índices
    - token_hash para búsqueda rápida
    - order_id para referencias
    - expires_at para limpiar tokens expirados
*/

-- Agregar campos a partner_services
DO $$
BEGIN
  -- Campo para horas de cancelación (transversal para todos los servicios)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_services' AND column_name = 'cancellation_hours'
  ) THEN
    ALTER TABLE partner_services 
    ADD COLUMN cancellation_hours integer NOT NULL DEFAULT 24;
    
    COMMENT ON COLUMN partner_services.cancellation_hours IS 'Horas previas para cancelar la cita (aplica a todos los servicios)';
  END IF;

  -- Campo para horas de confirmación (solo servicios sin costo)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_services' AND column_name = 'confirmation_hours'
  ) THEN
    ALTER TABLE partner_services 
    ADD COLUMN confirmation_hours integer;
    
    COMMENT ON COLUMN partner_services.confirmation_hours IS 'Horas previas para confirmar reserva (solo servicios sin costo)';
  END IF;
END $$;

-- Crear tabla de tokens de confirmación
CREATE TABLE IF NOT EXISTS booking_confirmation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  email_sent_at timestamptz,
  confirmed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_booking_tokens_order_id 
  ON booking_confirmation_tokens(order_id);

CREATE INDEX IF NOT EXISTS idx_booking_tokens_hash 
  ON booking_confirmation_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_booking_tokens_expires 
  ON booking_confirmation_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_booking_tokens_email_sent 
  ON booking_confirmation_tokens(email_sent_at) 
  WHERE email_sent_at IS NULL;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_booking_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_booking_tokens_updated_at_trigger 
  ON booking_confirmation_tokens;

CREATE TRIGGER update_booking_tokens_updated_at_trigger
  BEFORE UPDATE ON booking_confirmation_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_tokens_updated_at();

-- Enable RLS
ALTER TABLE booking_confirmation_tokens ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios pueden ver sus propios tokens (a través de sus órdenes)
CREATE POLICY "Users can view own booking confirmation tokens"
  ON booking_confirmation_tokens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = booking_confirmation_tokens.order_id
      AND orders.customer_id = auth.uid()
    )
  );

-- Política: Partners pueden ver tokens de sus servicios
CREATE POLICY "Partners can view booking tokens for their services"
  ON booking_confirmation_tokens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = booking_confirmation_tokens.order_id
      AND orders.partner_id = auth.uid()
    )
  );

-- Política: Sistema puede crear tokens (a través de service role)
CREATE POLICY "Service role can manage booking tokens"
  ON booking_confirmation_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Agregar comentarios
COMMENT ON TABLE booking_confirmation_tokens IS 
  'Tokens de confirmación para reservas de servicios sin costo';

COMMENT ON COLUMN booking_confirmation_tokens.order_id IS 
  'ID de la orden/reserva asociada';

COMMENT ON COLUMN booking_confirmation_tokens.token_hash IS 
  'Token único para confirmar la reserva';

COMMENT ON COLUMN booking_confirmation_tokens.email_sent_at IS 
  'Timestamp de cuándo se envió el email de confirmación';

COMMENT ON COLUMN booking_confirmation_tokens.confirmed_at IS 
  'Timestamp de cuándo se confirmó la reserva';

COMMENT ON COLUMN booking_confirmation_tokens.expires_at IS 
  'Timestamp de cuándo expira el token';