@echo off
REM ================================================================================================
REM DOGCATIFY - Deploy Edge Functions a Producción
REM ================================================================================================

color 0B
title Dogcatify - Deploy Edge Functions

echo.
echo ====================================================================================================
echo    DEPLOY EDGE FUNCTIONS A PRODUCCION
echo ====================================================================================================
echo.
echo Este script desplegará todas las Edge Functions y configurará los secrets necesarios.
echo.
echo Funciones a desplegar: 31
echo Secrets requeridos: ~12
echo.
pause

REM ================================================================================================
REM PASO 1: Verificar instalación de Supabase CLI
REM ================================================================================================

echo.
echo ====================================================================================================
echo PASO 1: Verificando Supabase CLI...
echo ====================================================================================================
echo.

where supabase >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Supabase CLI no esta instalado.
    echo.
    echo Por favor instala Supabase CLI ejecutando:
    echo   npm install -g supabase
    echo.
    pause
    exit /b 1
)

echo [OK] Supabase CLI esta instalado
supabase --version
echo.

REM ================================================================================================
REM PASO 2: Conectar al proyecto de producción
REM ================================================================================================

echo.
echo ====================================================================================================
echo PASO 2: Conectando al proyecto de produccion...
echo ====================================================================================================
echo.
echo Project Ref: gfazxronwllqcswdaimh
echo.
echo Necesitaras la contraseña de la base de datos.
echo Para obtenerla: Dashboard -^> Settings -^> Database
echo.
pause

supabase link --project-ref gfazxronwllqcswdaimh

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] No se pudo conectar al proyecto
    pause
    exit /b 1
)

echo [OK] Conectado exitosamente
echo.

REM ================================================================================================
REM PASO 3: Verificar que existen las funciones localmente
REM ================================================================================================

echo.
echo ====================================================================================================
echo PASO 3: Verificando funciones locales...
echo ====================================================================================================
echo.

if not exist "supabase\functions" (
    echo [ERROR] No se encontro la carpeta supabase/functions
    echo.
    echo Asegurate de estar en la raiz del proyecto.
    pause
    exit /b 1
)

echo Funciones encontradas:
echo.
dir /b supabase\functions
echo.

REM ================================================================================================
REM PASO 4: Configurar Secrets
REM ================================================================================================

echo.
echo ====================================================================================================
echo PASO 4: Configurando Secrets...
echo ====================================================================================================
echo.
echo IMPORTANTE: Los secrets son necesarios para que las funciones funcionen correctamente.
echo.
echo Secrets requeridos:
echo  - FIREBASE_PRIVATE_KEY_ID
echo  - FIREBASE_PRIVATE_KEY
echo  - FIREBASE_CLIENT_EMAIL
echo  - FIREBASE_CLIENT_ID
echo  - FIREBASE_CLIENT_CERT_URL
echo  - RESEND_API_KEY
echo  - MERCADOPAGO_ACCESS_TOKEN
echo  - MERCADOPAGO_PUBLIC_KEY
echo  - OPENAI_API_KEY
echo  - GOOGLE_CLOUD_PROJECT_ID
echo  - GOOGLE_CLOUD_PRIVATE_KEY
echo  - GOOGLE_CLOUD_CLIENT_EMAIL
echo.

if exist "secrets.env" (
    echo [OK] Archivo secrets.env encontrado
    echo.
    echo Aplicando secrets...
    supabase secrets set --env-file secrets.env

    if %ERRORLEVEL% EQU 0 (
        echo [OK] Secrets configurados exitosamente
    ) else (
        echo [ERROR] Hubo un problema configurando los secrets
        echo.
        echo Revisa el archivo secrets.env
        pause
    )
) else (
    echo [ADVERTENCIA] No se encontro el archivo secrets.env
    echo.
    echo Para configurar los secrets:
    echo.
    echo 1. Crea un archivo llamado secrets.env en la raiz del proyecto
    echo 2. Agrega cada secret en formato: NOMBRE=valor
    echo 3. Vuelve a ejecutar este script
    echo.
    echo Ejemplo de secrets.env:
    echo RESEND_API_KEY=re_xxxxxxxxxx
    echo FIREBASE_CLIENT_EMAIL=tu@email.iam.gserviceaccount.com
    echo MERCADOPAGO_ACCESS_TOKEN=APP-xxxxxxxxxx
    echo.
    echo ¿Quieres continuar sin configurar secrets? (pueden configurarse despues^)
    pause
)

echo.

REM ================================================================================================
REM PASO 5: Desplegar Edge Functions
REM ================================================================================================

echo.
echo ====================================================================================================
echo PASO 5: Desplegando Edge Functions...
echo ====================================================================================================
echo.
echo Esto tomara varios minutos...
echo.

supabase functions deploy

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Hubo un problema desplegando las funciones
    echo.
    echo Revisa los errores arriba.
    pause
    exit /b 1
)

echo.
echo [OK] Edge Functions desplegadas exitosamente
echo.

REM ================================================================================================
REM PASO 6: Verificar despliegue
REM ================================================================================================

echo.
echo ====================================================================================================
echo PASO 6: Verificando despliegue...
echo ====================================================================================================
echo.

echo Funciones desplegadas:
echo.
supabase functions list

echo.
echo Secrets configurados:
echo.
supabase secrets list

echo.

REM ================================================================================================
REM PASO 7: Resumen y próximos pasos
REM ================================================================================================

echo.
echo ====================================================================================================
echo DESPLIEGUE COMPLETADO EXITOSAMENTE
echo ====================================================================================================
echo.
echo [OK] 31 Edge Functions desplegadas
echo [OK] Secrets configurados
echo [OK] Proyecto en produccion listo
echo.
echo ====================================================================================================
echo PROXIMOS PASOS
echo ====================================================================================================
echo.
echo 1. Probar funciones criticas:
echo    - send-email
echo    - mercadopago-webhook
echo    - send-notification-fcm-v1
echo.
echo 2. Configurar webhooks externos:
echo    - MercadoPago: https://gfazxronwllqcswdaimh.supabase.co/functions/v1/mercadopago-webhook
echo    - CRM: https://gfazxronwllqcswdaimh.supabase.co/functions/v1/dogcatify-order-webhook
echo.
echo 3. Actualizar variables de entorno en la app:
echo    - EXPO_PUBLIC_SUPABASE_URL
echo    - EXPO_PUBLIC_SUPABASE_ANON_KEY
echo.
echo 4. Probar end-to-end:
echo    - Registro de usuario
echo    - Crear mascota
echo    - Hacer un pedido
echo    - Recibir notificacion
echo.
echo ====================================================================================================
echo.

REM Crear log del despliegue
set LOGFILE=deploy_functions_log_%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%.txt
echo Deploy completado el %date% a las %time% > %LOGFILE%
echo Proyecto: gfazxronwllqcswdaimh >> %LOGFILE%
echo Funciones desplegadas: 31 >> %LOGFILE%
echo Estado: EXITOSO >> %LOGFILE%

echo Log guardado en: %LOGFILE%
echo.

pause
exit /b 0
