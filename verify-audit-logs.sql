-- Script para verificar registros de auditoría
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar que la tabla audit_logs existe y ver su estructura
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'audit_logs'
ORDER BY ordinal_position;

-- 2. Contar registros totales de auditoría
SELECT 
  COUNT(*) as total_registros,
  COUNT(DISTINCT user_id) as usuarios_unicos,
  COUNT(DISTINCT action) as acciones_diferentes
FROM audit_logs;

-- 3. Ver distribución de acciones registradas
SELECT 
  action,
  COUNT(*) as cantidad,
  MIN(created_at) as primera_vez,
  MAX(created_at) as ultima_vez
FROM audit_logs
GROUP BY action
ORDER BY cantidad DESC;

-- 4. Verificar registros de LOGIN_FAILED específicamente
SELECT 
  id,
  user_id,
  action,
  status,
  error_message,
  details,
  ip_address,
  user_agent,
  created_at
FROM audit_logs
WHERE action = 'LOGIN_FAILED'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Ver últimos 20 registros de auditoría (todas las acciones)
SELECT 
  id,
  user_id,
  action,
  resource_type,
  resource_id,
  status,
  error_message,
  created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 20;

-- 6. Verificar intentos de login (exitosos y fallidos)
SELECT 
  action,
  status,
  COUNT(*) as cantidad,
  details->>'email' as email
FROM audit_logs
WHERE action IN ('LOGIN_ATTEMPT', 'LOGIN_FAILED', 'LOGIN')
GROUP BY action, status, details->>'email'
ORDER BY cantidad DESC;

-- 7. Ver timeline de actividad de login en las últimas 24 horas
SELECT 
  DATE_TRUNC('hour', created_at) as hora,
  action,
  COUNT(*) as cantidad
FROM audit_logs
WHERE action IN ('LOGIN_ATTEMPT', 'LOGIN_FAILED', 'LOGIN')
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), action
ORDER BY hora DESC, action;

-- 8. Verificar si hay registros con status 'error'
SELECT 
  action,
  status,
  error_message,
  COUNT(*) as cantidad
FROM audit_logs
WHERE status = 'error'
GROUP BY action, status, error_message
ORDER BY cantidad DESC;

-- 9. Ver detalles completos del último LOGIN_FAILED
SELECT 
  *
FROM audit_logs
WHERE action = 'LOGIN_FAILED'
ORDER BY created_at DESC
LIMIT 1;

-- 10. Verificar que las RLS policies están activas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'audit_logs';
