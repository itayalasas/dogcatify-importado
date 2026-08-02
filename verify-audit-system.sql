-- Script de Verificación del Sistema de Auditoría
-- Ejecuta este script para verificar que todo está funcionando correctamente

\echo '=========================================='
\echo 'Verificación del Sistema de Auditoría'
\echo 'DogCatify v1.0'
\echo '=========================================='
\echo ''

-- 1. Verificar que la tabla existe
\echo '[1/8] Verificando tabla audit_logs...'
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs')
    THEN '✓ Tabla audit_logs existe'
    ELSE '✗ ERROR: Tabla audit_logs no existe'
  END as status;

-- 2. Verificar columnas
\echo ''
\echo '[2/8] Verificando estructura de columnas...'
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'audit_logs'
ORDER BY ordinal_position;

-- 3. Verificar índices
\echo ''
\echo '[3/8] Verificando índices...'
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'audit_logs'
ORDER BY indexname;

-- 4. Verificar políticas RLS
\echo ''
\echo '[4/8] Verificando políticas RLS...'
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'audit_logs';

-- 5. Verificar que RLS está habilitado
\echo ''
\echo '[5/8] Verificando que RLS está habilitado...'
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'audit_logs';

-- 6. Verificar funciones auxiliares
\echo ''
\echo '[6/8] Verificando funciones auxiliares...'
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN ('cleanup_old_audit_logs', 'get_audit_stats')
ORDER BY routine_name;

-- 7. Verificar vista audit_logs_with_user
\echo ''
\echo '[7/8] Verificando vista audit_logs_with_user...'
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'audit_logs_with_user')
    THEN '✓ Vista audit_logs_with_user existe'
    ELSE '✗ ERROR: Vista no existe'
  END as status;

-- 8. Ver logs recientes (últimos 10)
\echo ''
\echo '[8/8] Últimos 10 logs registrados:'
SELECT 
  created_at,
  action,
  status,
  COALESCE(user_id::text, 'ANÓNIMO') as user_id,
  resource_type,
  resource_id
FROM audit_logs
ORDER BY created_at DESC
LIMIT 10;

-- Estadísticas
\echo ''
\echo '=========================================='
\echo 'Estadísticas del Sistema'
\echo '=========================================='

-- Total de logs
SELECT 
  'Total de logs:' as metrica,
  COUNT(*)::text as valor
FROM audit_logs

UNION ALL

-- Logs de las últimas 24h
SELECT 
  'Logs últimas 24h:' as metrica,
  COUNT(*)::text as valor
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'

UNION ALL

-- Usuarios únicos
SELECT 
  'Usuarios únicos:' as metrica,
  COUNT(DISTINCT user_id)::text as valor
FROM audit_logs

UNION ALL

-- Errores últimas 24h
SELECT 
  'Errores últimas 24h:' as metrica,
  COUNT(*)::text as valor
FROM audit_logs
WHERE status = 'error'
  AND created_at > NOW() - INTERVAL '24 hours'

UNION ALL

-- Espacio usado
SELECT 
  'Espacio usado:' as metrica,
  pg_size_pretty(pg_total_relation_size('audit_logs')) as valor

UNION ALL

-- Log más antiguo
SELECT 
  'Log más antiguo:' as metrica,
  MIN(created_at)::text as valor
FROM audit_logs

UNION ALL

-- Log más reciente
SELECT 
  'Log más reciente:' as metrica,
  MAX(created_at)::text as valor
FROM audit_logs;

-- Verificar admins (para alertas)
\echo ''
\echo '=========================================='
\echo 'Administradores (para alertas)'
\echo '=========================================='
SELECT 
  email,
  display_name,
  role
FROM profiles
WHERE role = 'admin';

-- Verificar cron jobs
\echo ''
\echo '=========================================='
\echo 'Cron Jobs Configurados'
\echo '=========================================='
SELECT 
  jobname,
  schedule,
  active,
  jobid
FROM cron.job
WHERE jobname LIKE '%alert%' OR jobname LIKE '%audit%';

-- Últimas ejecuciones del cron
\echo ''
\echo 'Últimas ejecuciones del cron:'
SELECT 
  j.jobname,
  jrd.start_time,
  jrd.end_time,
  jrd.status,
  jrd.return_message
FROM cron.job_run_details jrd
JOIN cron.job j ON jrd.jobid = j.jobid
WHERE j.jobname LIKE '%alert%' OR j.jobname LIKE '%audit%'
ORDER BY jrd.start_time DESC
LIMIT 5;

\echo ''
\echo '=========================================='
\echo 'Verificación Completada'
\echo '=========================================='
\echo ''
\echo 'Si todos los checks muestran ✓, el sistema está funcionando correctamente.'
\echo ''
\echo 'Para ver más detalles, consulta docs/README_AUDITORIA.md'
\echo ''
