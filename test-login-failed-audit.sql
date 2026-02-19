-- Test específico para verificar INSERT de LOGIN_FAILED
-- Este script simula lo que hace el código cuando falla un login

-- 1. Ver el formato actual de los registros de auditoría
SELECT 
  id,
  user_id,
  user_email,
  action,
  success,
  error_message,
  details::text,
  ip_address,
  user_agent,
  created_at
FROM audit_logs
WHERE action IN ('LOGIN_ATTEMPT', 'LOGIN_FAILED', 'LOGIN')
ORDER BY created_at DESC
LIMIT 5;

-- 2. Insertar un registro de prueba de LOGIN_FAILED (simulando el código)
-- IMPORTANTE: Este INSERT debe funcionar igual que desde el código
INSERT INTO audit_logs (
  user_id,
  user_email,
  action,
  success,
  error_message,
  details,
  ip_address,
  user_agent,
  created_at
) VALUES (
  NULL,  -- user_id es NULL cuando el login falla (usuario no autenticado)
  'test@example.com',  -- email del usuario que intentó loguearse
  'LOGIN_FAILED',
  false,  -- success es false para indicar fallo
  'Invalid login credentials',
  jsonb_build_object(
    'email', 'test@example.com',
    'reason', 'Invalid login credentials',
    'method', 'email_password'
  ),
  '127.0.0.1',  -- IP de prueba
  'Test Script',  -- User agent de prueba
  NOW()
);

-- 3. Verificar que se insertó correctamente
SELECT 
  id,
  user_id,
  user_email,
  action,
  success,
  error_message,
  details::text,
  ip_address,
  user_agent,
  created_at
FROM audit_logs
WHERE action = 'LOGIN_FAILED'
  AND details->>'email' = 'test@example.com'
ORDER BY created_at DESC
LIMIT 1;

-- 4. Contar todos los LOGIN_FAILED
SELECT COUNT(*) as total_login_failed
FROM audit_logs
WHERE action = 'LOGIN_FAILED';

-- 5. Ver estadísticas de LOGIN_FAILED por email
SELECT 
  user_email,
  details->>'email' as email_intentado,
  COUNT(*) as intentos_fallidos,
  MAX(created_at) as ultimo_intento,
  array_agg(DISTINCT error_message) as tipos_error
FROM audit_logs
WHERE action = 'LOGIN_FAILED'
GROUP BY user_email, details->>'email'
ORDER BY intentos_fallidos DESC;

-- 6. Verificar que el servicio de auditoría puede insertar sin autenticación
-- (esto simula el comportamiento del código cuando no hay usuario autenticado)
SELECT 
  COUNT(*) as registros_sin_usuario,
  COUNT(CASE WHEN user_email IS NOT NULL THEN 1 END) as con_email
FROM audit_logs
WHERE user_id IS NULL;

-- 7. Ver diferencia entre éxitos y fallos
SELECT 
  action,
  success,
  COUNT(*) as cantidad
FROM audit_logs
WHERE action IN ('LOGIN', 'LOGIN_FAILED', 'LOGIN_ATTEMPT')
GROUP BY action, success
ORDER BY action, success DESC;

-- 8. Limpiar el registro de prueba (opcional)
-- DELETE FROM audit_logs 
-- WHERE action = 'LOGIN_FAILED' 
--   AND details->>'email' = 'test@example.com'
--   AND user_agent = 'Test Script';
