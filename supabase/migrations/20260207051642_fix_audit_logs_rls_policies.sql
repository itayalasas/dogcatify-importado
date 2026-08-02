/*
  # Corregir polÃ­ticas RLS de audit_logs
  
  1. Problema
    - Los administradores no pueden ver logs desde el frontend
    - Las polÃ­ticas RLS pueden tener conflictos o no estar funcionando correctamente
  
  2. SoluciÃ³n
    - Eliminar todas las polÃ­ticas existentes
    - Recrear las polÃ­ticas de forma limpia y verificada
    - Asegurar que is_admin = true da acceso completo
*/

-- Eliminar todas las polÃ­ticas existentes en audit_logs
DO $$
BEGIN
  -- Drop all existing policies on audit_logs
  DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;

  DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_logs;

  DROP POLICY IF EXISTS "Anonymous users can insert login failure logs" ON audit_logs;

  DROP POLICY IF EXISTS "Service role can insert logs" ON audit_logs;

END $$;


-- PolÃ­tica 1: Administradores pueden ver TODOS los logs
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );


-- PolÃ­tica 2: Todos los usuarios autenticados pueden insertar logs
CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- PolÃ­tica 3: Usuarios anÃ³nimos pueden insertar logs de login fallidos
CREATE POLICY "Anonymous users can insert login failure logs"
  ON audit_logs
  FOR INSERT
  TO anon
  WITH CHECK (
    action IN ('LOGIN_FAILED', 'LOGIN_ERROR', 'LOGIN_ATTEMPT')
  );


-- Verificar que RLS estÃ¡ habilitado
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
;


