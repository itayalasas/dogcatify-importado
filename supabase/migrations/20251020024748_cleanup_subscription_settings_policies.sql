/*
  # Limpiar políticas duplicadas de subscription_settings

  1. Problema
    - Existen dos políticas SELECT en subscription_settings:
      * "Admin can view subscription settings" (solo admin)
      * "Users can view subscription settings" (todos)
    - Aunque funcionan por OR, es confuso tener ambas

  2. Solución
    - Eliminar la política restrictiva del admin
    - Mantener solo la política que permite a todos ver la configuración
    - El admin puede ver porque la política "Users can view" incluye a todos (incluyendo admin)

  3. Seguridad
    - Todos los usuarios autenticados pueden ver (SELECT) la configuración
    - Solo admin@dogcatify.com puede modificar (UPDATE/INSERT)
*/

-- Eliminar la política restrictiva del admin para SELECT
DROP POLICY IF EXISTS "Admin can view subscription settings" ON subscription_settings;

-- La política "Users can view subscription settings" ya existe y es suficiente
-- Verificar que existe (si no existe, crearla)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'subscription_settings' 
    AND policyname = 'Users can view subscription settings'
  ) THEN
    CREATE POLICY "Users can view subscription settings"
      ON subscription_settings FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
