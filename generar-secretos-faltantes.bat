@echo off
echo ====================================================
echo  Generador de Secretos Faltantes
echo ====================================================
echo.
echo Este script te ayudará a generar los secretos que faltan
echo.
pause

echo.
echo ====================================================
echo  1. WEBHOOK_SECRET (para firmar webhooks salientes)
echo ====================================================
echo.
echo Generando WEBHOOK_SECRET...
powershell -Command "$bytes = New-Object byte[] 48; (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes); [Convert]::ToBase64String($bytes)"
echo.
echo Copia este valor y agrégalo en Supabase Dashboard como WEBHOOK_SECRET
echo.
pause

echo.
echo ====================================================
echo  2. CRON_SECRET (para validar llamadas a trabajos cron)
echo ====================================================
echo.
echo Generando CRON_SECRET...
powershell -Command "$bytes = New-Object byte[] 32; (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes); [Convert]::ToBase64String($bytes)"
echo.
echo Copia este valor y agrégalo en Supabase Dashboard como CRON_SECRET
echo.
pause

echo.
echo ====================================================
echo  SECRETOS QUE DEBES OBTENER MANUALMENTE
echo ====================================================
echo.
echo 3. MERCADOPAGO_WEBHOOK_SECRET
echo    - Ve a: https://www.mercadopago.com/developers
echo    - Integraciones ^> Webhooks
echo    - Copia el webhook secret
echo.
echo 4. FIREBASE_SERVICE_ACCOUNT (y otros Firebase)
echo    - Ve a: Firebase Console ^> Project Settings ^> Service Accounts
echo    - Click "Generate new private key"
echo    - Descarga el JSON
echo    - Copia cada campo al secreto correspondiente:
echo      * FIREBASE_SERVICE_ACCOUNT = Todo el JSON como string
echo      * FIREBASE_PRIVATE_KEY_ID = campo "private_key_id"
echo      * FIREBASE_CLIENT_EMAIL = campo "client_email"
echo      * FIREBASE_CLIENT_ID = campo "client_id"
echo      * FIREBASE_CLIENT_CERT_URL = campo "client_x509_cert_url"
echo      * FIREBASE_PRIVATE_KEY = campo "private_key"
echo.
echo 5. CRM_WEBHOOK_URL y CRM_API_KEY (OPCIONAL)
echo    - Solo si usas integración con CRM externo
echo.
echo ====================================================
echo  INSTRUCCIONES PARA AGREGAR EN SUPABASE
echo ====================================================
echo.
echo 1. Ve a Supabase Dashboard de tu proyecto
echo 2. Settings ^> Edge Functions ^> Secrets
echo 3. Click "Add or replace secrets"
echo 4. Agrega cada secreto con su nombre y valor
echo 5. Click "Save"
echo.
echo IMPORTANTE: Después de agregar los secretos, debes
echo redesplegar las Edge Functions que los usan:
echo.
echo    supabase functions deploy mercadopago-webhook
echo    supabase functions deploy send-notification-fcm-v1
echo    supabase functions deploy send-scheduled-notifications
echo.
echo ====================================================
pause

echo.
echo ====================================================
echo  ¿Quieres abrir la documentación completa?
echo ====================================================
echo.
set /p open="Presiona Y para abrir SECRETOS_FALTANTES.md [Y/N]: "
if /i "%open%"=="Y" (
    start SECRETOS_FALTANTES.md
)

echo.
echo ====================================================
echo  Script completado
echo ====================================================
echo.
echo Revisa SECRETOS_FALTANTES.md para más detalles
echo.
pause
