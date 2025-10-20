/*
  # Corregir políticas de suscripciones para usar el email correcto del admin

  1. Cambios
    - Actualizar todas las políticas RLS para usar 'admin@dogcatify.com' en lugar de 'admin@dogcatify'
    - Esto permite que el admin con email admin@dogcatify.com pueda gestionar las suscripciones

  2. Políticas Actualizadas
    - subscription_settings: SELECT, UPDATE, INSERT
    - subscription_plans: SELECT, INSERT, UPDATE, DELETE
    - user_subscriptions: SELECT, INSERT, UPDATE
*/

-- Drop existing policies para subscription_settings
DROP POLICY IF EXISTS "Admin can view subscription settings" ON subscription_settings;
DROP POLICY IF EXISTS "Admin can update subscription settings" ON subscription_settings;
DROP POLICY IF EXISTS "Admin can insert subscription settings" ON subscription_settings;

-- Recrear políticas con email correcto para subscription_settings
CREATE POLICY "Admin can view subscription settings"
  ON subscription_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify.com'
    )
  );

CREATE POLICY "Admin can update subscription settings"
  ON subscription_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify.com'
    )
  );

CREATE POLICY "Admin can insert subscription settings"
  ON subscription_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify.com'
    )
  );

-- Drop existing policies para subscription_plans
DROP POLICY IF EXISTS "Admin can view all subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Admin can insert subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Admin can update subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Admin can delete subscription plans" ON subscription_plans;

-- Recrear políticas con email correcto para subscription_plans
CREATE POLICY "Admin can view all subscription plans"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify.com'
    )
  );

CREATE POLICY "Admin can insert subscription plans"
  ON subscription_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify.com'
    )
  );

CREATE POLICY "Admin can update subscription plans"
  ON subscription_plans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify.com'
    )
  );

CREATE POLICY "Admin can delete subscription plans"
  ON subscription_plans FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify.com'
    )
  );

-- Drop existing policies para user_subscriptions
DROP POLICY IF EXISTS "Admin can view all subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Admin can create subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Admin can update subscriptions" ON user_subscriptions;

-- Recrear políticas con email correcto para user_subscriptions
CREATE POLICY "Admin can view all subscriptions"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify.com'
    )
  );

CREATE POLICY "Admin can create subscriptions"
  ON user_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify.com'
    )
  );

CREATE POLICY "Admin can update subscriptions"
  ON user_subscriptions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@dogcatify.com'
    )
  );