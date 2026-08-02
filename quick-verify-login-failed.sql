-- ========================================
-- VERIFICACIÓN RÁPIDA: LOGIN_FAILED
-- Ejecutar en Supabase SQL Editor
-- ========================================

-- 1️⃣ ¿Existe la tabla audit_logs?
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    RAISE NOTICE '✅ Tabla audit_logs existe';
  ELSE
    RAISE NOTICE '❌ Tabla audit_logs NO existe - ejecutar migración primero';
  END IF;
END $$;

-- 2️⃣ Ver registros de LOGIN_FAILED (si existen)
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Hay ' || COUNT(*)::text || ' registros de LOGIN_FAILED'
    ELSE '⚠️ No hay registros de LOGIN_FAILED todavía'
  END as resultado
FROM audit_logs
WHERE action = 'LOGIN_FAILED';

-- 3️⃣ Ver últimos 5 LOGIN_FAILED (si existen)
SELECT 
  '📋 Últimos LOGIN_FAILED:' as titulo;
  
SELECT 
  created_at,
  user_email,
  details->>'email' as email_intentado,
  error_message,
  success
FROM audit_logs
WHERE action = 'LOGIN_FAILED'
ORDER BY created_at DESC
LIMIT 5;

-- 4️⃣ Insertar registro de prueba
INSERT INTO audit_logs (
  user_id,
  user_email,
  action,
  success,
  error_message,
  details,
  created_at
) VALUES (
  NULL,
  'test-verification@example.com',
  'LOGIN_FAILED',
  false,
  'Invalid login credentials (TEST)',
  jsonb_build_object(
    'email', 'test-verification@example.com',
    'reason', 'Invalid login credentials',
    'method', 'email_password',
    'test', true
  ),
  NOW()
)
RETURNING 
  id,
  action,
  success,
  error_message,
  user_email,
  details->>'email' as email,
  created_at;

-- 5️⃣ Verificar que se insertó
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ INSERT exitoso - Se encontró el registro de prueba'
    ELSE '❌ No se encontró el registro de prueba'
  END as resultado,
  COUNT(*) as total
FROM audit_logs
WHERE action = 'LOGIN_FAILED'
  AND details->>'test' = 'true';

-- 6️⃣ Ver el registro de prueba completo
SELECT 
  id,
  user_id,
  user_email,
  action,
  success,
  error_message,
  details,
  created_at
FROM audit_logs
WHERE action = 'LOGIN_FAILED'
  AND details->>'test' = 'true'
ORDER BY created_at DESC
LIMIT 1;

-- 7️⃣ Estadísticas generales
SELECT 
  '📊 Resumen de auditoría:' as titulo;

SELECT 
  action,
  success,
  COUNT(*) as cantidad
FROM audit_logs
WHERE action IN ('LOGIN_ATTEMPT', 'LOGIN_FAILED', 'LOGIN', 'LOGOUT')
GROUP BY action, success
ORDER BY action, success;

-- 8️⃣ LIMPIAR registro de prueba (opcional)
-- Descomentar si quieres eliminar el registro de prueba:
/*
DELETE FROM audit_logs 
WHERE action = 'LOGIN_FAILED' 
  AND details->>'test' = 'true';
  
SELECT '🗑️ Registro de prueba eliminado' as resultado;
*/

-- ========================================
-- RESULTADO ESPERADO:
-- ========================================
-- ✅ Si todo funciona:
--   - Tabla existe
--   - INSERT exitoso
--   - Se puede leer el registro
--   - user_id es NULL
--   - user_email tiene el email
--   - action es LOGIN_FAILED
--   - success es false
-- ========================================
