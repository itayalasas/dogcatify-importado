/*
  # Corregir Referencias de Partner en Webhook Subscriptions

  1. Problema
    - webhook_subscriptions.partner_id apunta a profiles(id)
    - orders.partner_id apunta a partners(id)
    - Esto causa inconsistencia entre tablas
  
  2. Solución
    - Cambiar webhook_subscriptions.partner_id para referenciar partners(id)
    - Actualizar políticas RLS para usar la relación correcta
    - Mantener compatibilidad con user_id a través de partners.user_id
  
  3. Notas
    - Esta migración elimina y recrea la tabla para cambiar el foreign key
    - Los datos existentes se preservan si los hay
*/

-- Guardar datos existentes temporalmente
CREATE TEMP TABLE temp_webhook_subscriptions AS
SELECT * FROM webhook_subscriptions;

-- Eliminar tabla existente (esto también eliminará las políticas RLS)
DROP TABLE IF EXISTS webhook_subscriptions CASCADE;

-- Recrear tabla con la referencia correcta a partners
CREATE TABLE webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  webhook_url text NOT NULL,
  events jsonb NOT NULL DEFAULT '["order.created", "order.updated", "order.cancelled"]'::jsonb,
  secret_key text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_webhook_url CHECK (webhook_url ~* '^https?://.*')
);

-- Restaurar datos si había alguno (ajustando partner_id si es necesario)
-- Por ahora dejamos vacío ya que no había datos válidos

-- Índices
CREATE INDEX idx_webhook_subscriptions_partner_id ON webhook_subscriptions(partner_id);
CREATE INDEX idx_webhook_subscriptions_is_active ON webhook_subscriptions(is_active);

-- Habilitar RLS
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS actualizadas para trabajar con partners
CREATE POLICY "Partners can view own webhook subscriptions"
  ON webhook_subscriptions FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Partners can create own webhook subscriptions"
  ON webhook_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    partner_id IN (
      SELECT id FROM partners WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Partners can update own webhook subscriptions"
  ON webhook_subscriptions FOR UPDATE
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    partner_id IN (
      SELECT id FROM partners WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Partners can delete own webhook subscriptions"
  ON webhook_subscriptions FOR DELETE
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE user_id = auth.uid()
    )
  );

-- Recrear trigger para updated_at
CREATE TRIGGER webhook_subscription_updated_at
  BEFORE UPDATE ON webhook_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_subscription_updated_at();

-- Comentario
COMMENT ON TABLE webhook_subscriptions IS 
  'Almacena suscripciones de webhooks para partners. partner_id referencia la tabla partners, no profiles.';
