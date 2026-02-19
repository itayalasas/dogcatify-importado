@echo off
REM Script de instalación del Sistema de Auditoría y Seguridad
REM DogCatify - Sistema de Auditoría v1.0

echo ========================================
echo Sistema de Auditoria y Seguridad
echo DogCatify v1.0
echo ========================================
echo.

REM Verificar que estamos en el directorio correcto
if not exist "supabase\migrations" (
    echo ERROR: No se encontro la carpeta supabase/migrations
    echo Asegurate de ejecutar este script desde la raiz del proyecto
    pause
    exit /b 1
)

echo [1/4] Verificando archivos...
echo.

REM Verificar que existen los archivos necesarios
if not exist "supabase\migrations\20260207000000_create_audit_logs_system.sql" (
    echo ERROR: No se encontro el archivo de migracion
    pause
    exit /b 1
)

if not exist "services\auditService.ts" (
    echo ERROR: No se encontro auditService.ts
    pause
    exit /b 1
)

if not exist "supabase\functions\check-alert-thresholds\index.ts" (
    echo ERROR: No se encontro la Edge Function check-alert-thresholds
    pause
    exit /b 1
)

echo ✓ Todos los archivos necesarios estan presentes
echo.

echo [2/4] Aplicando migracion a la base de datos...
echo.
echo Ejecuta este comando en el SQL Editor de Supabase:
echo.
echo    -- Copia y pega el contenido de:
echo    supabase/migrations/20260207000000_create_audit_logs_system.sql
echo.
pause

echo [3/4] Desplegando Edge Function...
echo.
echo Ejecuta este comando:
echo.
echo    supabase functions deploy check-alert-thresholds --project-ref hpvzjuionqvgxlvhyqgz
echo.
pause

echo [4/4] Configurando Cron Job...
echo.
echo Ejecuta este SQL en Supabase:
echo.
echo    CREATE EXTENSION IF NOT EXISTS pg_cron;
echo.
echo    SELECT cron.schedule(
echo      'check-security-alerts',
echo      '*/15 * * * *',
echo      $$
echo      SELECT net.http_post(
echo        url := 'https://hpvzjuionqvgxlvhyqgz.supabase.co/functions/v1/check-alert-thresholds',
echo        headers := jsonb_build_object(
echo          'Content-Type', 'application/json',
echo          'Authorization', 'Bearer [TU_SERVICE_ROLE_KEY]'
echo        ),
echo        body := '{}'::jsonb
echo      );
echo      $$
echo    );
echo.
pause

echo.
echo ========================================
echo Instalacion Completada!
echo ========================================
echo.
echo Proximos pasos:
echo.
echo 1. Verifica que la tabla existe:
echo    SELECT * FROM audit_logs LIMIT 1;
echo.
echo 2. Prueba el sistema haciendo login
echo.
echo 3. Verifica los logs:
echo    SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
echo.
echo 4. Revisa la documentacion en docs/README_AUDITORIA.md
echo.
echo ========================================
pause
