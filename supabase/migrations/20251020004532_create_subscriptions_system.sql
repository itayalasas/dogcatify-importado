/*
  # Sistema de Suscripciones Premium

  1. Nuevas Tablas
    - `subscription_settings` - Configuración global del sistema de suscripciones
      - `id` (uuid, primary key)
      - `enabled` (boolean) - Si el sistema de suscripciones está habilitado
      - `updated_at` (timestamp)
      - `updated_by` (uuid, foreign key a profiles)
    
    - `subscription_plans` - Planes de suscripción disponibles
      - `id` (uuid, primary key)
      - `name` (text) - Nombre del plan (Basic, Premium, VIP)
      - `description` (text) - Descripción del plan
      - `price_monthly` (numeric) - Precio mensual
      - `price_yearly` (numeric) - Precio anual
      - `currency` (text) - Moneda (USD, UYU, etc)
      - `features` (jsonb) - Features incluidos en el plan
      - `is_active` (boolean) - Si el plan está activo
      - `sort_order` (integer) - Orden de visualización
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `user_subscriptions` - Suscripciones de usuarios
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key a profiles)
      - `plan_id` (uuid, foreign key a subscription_plans)
      - `status` (text) - Estado: active, cancelled, expired, pending
      - `crm_subscription_id` (text) - ID de la suscripción en el CRM
      - `started_at` (timestamp) - Fecha de inicio
      - `expires_at` (timestamp) - Fecha de expiración
      - `billing_cycle` (text) - monthly o yearly
      - `metadata` (jsonb) - Datos adicionales del CRM
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Seguridad
    - Enable RLS en todas las tablas
    - Solo admin@dogcatify puede modificar subscription_settings y subscription_plans
    - Usuarios pueden ver sus propias suscripciones
    - Usuarios pueden ver planes activos

  3. Datos Iniciales
    - Insertar configuración inicial (deshabilitado por defecto)
    - Insertar 3 planes de suscripción: Basic, Premium, VIP
*/

-- Crear tabla de configuración de suscripciones
CREATE TABLE IF NOT EXISTS subscription_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

-- Crear tabla de planes de suscripción
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_monthly numeric(10,2) NOT NULL,
  price_yearly numeric(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de suscripciones de usuarios
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  status text NOT NULL DEFAULT 'pending',
  crm_subscription_id text,
  started_at timestamptz,
  expires_at timestamptz,
  billing_cycle text CHECK (billing_cycle IN ('monthly', 'yearly')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);

-- Enable RLS
ALTER TABLE subscription_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas para subscription_settings
-- Solo el admin puede ver y modificar la configuración
CREATE POLICY "Admin can view subscription settings"
  ON subscription_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify'
    )
  );

CREATE POLICY "Admin can update subscription settings"
  ON subscription_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify'
    )
  );

CREATE POLICY "Admin can insert subscription settings"
  ON subscription_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify'
    )
  );

-- Políticas para subscription_plans
-- Todos pueden ver planes activos
CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admin puede ver todos los planes
CREATE POLICY "Admin can view all subscription plans"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify'
    )
  );

-- Admin puede insertar planes
CREATE POLICY "Admin can insert subscription plans"
  ON subscription_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify'
    )
  );

-- Admin puede actualizar planes
CREATE POLICY "Admin can update subscription plans"
  ON subscription_plans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify'
    )
  );

-- Admin puede eliminar planes
CREATE POLICY "Admin can delete subscription plans"
  ON subscription_plans FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify'
    )
  );

-- Políticas para user_subscriptions
-- Usuarios pueden ver sus propias suscripciones
CREATE POLICY "Users can view own subscriptions"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin puede ver todas las suscripciones
CREATE POLICY "Admin can view all subscriptions"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify'
    )
  );

-- Admin puede crear suscripciones
CREATE POLICY "Admin can create subscriptions"
  ON user_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify'
    )
  );

-- Admin puede actualizar suscripciones
CREATE POLICY "Admin can update subscriptions"
  ON user_subscriptions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify'
    )
  );

-- Insertar configuración inicial (deshabilitado por defecto)
INSERT INTO subscription_settings (enabled)
VALUES (false)
ON CONFLICT DO NOTHING;

-- Insertar planes de suscripción iniciales
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, currency, features, sort_order)
VALUES 
  (
    'Basic',
    'Plan básico con funciones esenciales',
    9.99,
    99.99,
    'USD',
    '[
      "Hasta 3 mascotas",
      "Historial médico básico",
      "Acceso a servicios locales",
      "Soporte por email"
    ]'::jsonb,
    1
  ),
  (
    'Premium',
    'Plan premium con funciones avanzadas',
    19.99,
    199.99,
    'USD',
    '[
      "Mascotas ilimitadas",
      "Historial médico completo con recordatorios",
      "Prioridad en reservas de servicios",
      "Descuentos en productos de la tienda (10%)",
      "Chat prioritario con veterinarios",
      "Soporte prioritario 24/7",
      "Álbumes ilimitados con videos"
    ]'::jsonb,
    2
  ),
  (
    'VIP',
    'Plan VIP con todas las funciones premium',
    39.99,
    399.99,
    'USD',
    '[
      "Todo lo incluido en Premium",
      "Consultas veterinarias online ilimitadas",
      "Descuentos máximos en tienda (20%)",
      "Envío gratis en compras",
      "Acceso a eventos exclusivos",
      "Asesor de mascotas personal",
      "Prioridad máxima en todos los servicios",
      "Badge VIP en perfil"
    ]'::jsonb,
    3
  )
ON CONFLICT DO NOTHING;

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_subscription_settings_updated_at ON subscription_settings;
CREATE TRIGGER update_subscription_settings_updated_at
  BEFORE UPDATE ON subscription_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();