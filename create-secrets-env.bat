@echo off
REM ================================================================================================
REM DOGCATIFY - Crear archivo secrets.env desde .env
REM ================================================================================================

echo.
echo ====================================================================================================
echo    CREAR ARCHIVO SECRETS.ENV
echo ====================================================================================================
echo.
echo Este script extraera los secrets de tu archivo .env y creara secrets.env
echo.

REM Verificar que existe .env
if not exist ".env" (
    echo [ERROR] No se encontro el archivo .env
    echo.
    echo Asegurate de estar en la raiz del proyecto.
    pause
    exit /b 1
)

echo [OK] Archivo .env encontrado
echo.

REM Crear secrets.env
echo # Secrets para Produccion - Dogcatify > secrets.env
echo # Generado automaticamente el %date% a las %time% >> secrets.env
echo. >> secrets.env

echo Extrayendo secrets de .env...
echo.

REM Extraer Firebase
findstr "FIREBASE_PRIVATE_KEY_ID=" .env >> secrets.env
findstr "FIREBASE_PRIVATE_KEY=" .env >> secrets.env
findstr "FIREBASE_CLIENT_EMAIL=" .env >> secrets.env
findstr "FIREBASE_CLIENT_ID=" .env >> secrets.env
findstr "FIREBASE_CLIENT_CERT_URL=" .env >> secrets.env

echo [OK] Firebase credentials
echo.

REM Extraer Email API Key
findstr "EXPO_PUBLIC_EMAIL_API_KEY=" .env > temp_secret.txt
if exist temp_secret.txt (
    for /f "tokens=2 delims==" %%a in (temp_secret.txt) do (
        echo RESEND_API_KEY=%%a >> secrets.env
    )
    del temp_secret.txt
    echo [OK] Resend API Key
) else (
    echo [ADVERTENCIA] No se encontro RESEND_API_KEY en .env
)
echo.

REM Agregar placeholders para secrets que faltan
echo. >> secrets.env
echo # IMPORTANTE: Agrega estos secrets manualmente: >> secrets.env
echo # MERCADOPAGO_ACCESS_TOKEN=APP-xxxxxxxx >> secrets.env
echo # MERCADOPAGO_PUBLIC_KEY=APP_USR-xxxxxxxx >> secrets.env
echo # OPENAI_API_KEY=sk-xxxxxxxx >> secrets.env
echo # GOOGLE_CLOUD_PROJECT_ID=tu-proyecto >> secrets.env
echo # GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----" >> secrets.env
echo # GOOGLE_CLOUD_CLIENT_EMAIL=tu@email.iam.gserviceaccount.com >> secrets.env

echo.
echo ====================================================================================================
echo ARCHIVO secrets.env CREADO
echo ====================================================================================================
echo.
echo [OK] Se extrajo la informacion de Firebase desde .env
echo.
echo [PENDIENTE] Debes agregar manualmente:
echo  - MERCADOPAGO_ACCESS_TOKEN
echo  - MERCADOPAGO_PUBLIC_KEY
echo  - OPENAI_API_KEY
echo  - GOOGLE_CLOUD_PROJECT_ID
echo  - GOOGLE_CLOUD_PRIVATE_KEY
echo  - GOOGLE_CLOUD_CLIENT_EMAIL
echo.
echo Edita el archivo secrets.env y completa los valores faltantes.
echo.
echo Cuando termines, ejecuta: deploy-functions-production.bat
echo.

REM Mostrar preview del archivo
echo ====================================================================================================
echo PREVIEW DE secrets.env:
echo ====================================================================================================
echo.
type secrets.env
echo.
echo ====================================================================================================
echo.

pause
