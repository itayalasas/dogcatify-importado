@echo off
echo ====================================================
echo  Aplicando migración: Correo de confirmación de orden
echo ====================================================
echo.
echo Esta migración agrega:
echo - Función que envía correo de confirmación automáticamente
echo - Trigger que se activa cuando payment_status cambia a paid/approved
echo - El cliente recibirá un correo con los detalles de su compra
echo.
pause
echo.
echo Aplicando migración a Supabase...
supabase db push
echo.
if %ERRORLEVEL% EQU 0 (
    echo ====================================================
    echo ✅ Migración aplicada correctamente
    echo ====================================================
    echo.
    echo Ahora cuando un cliente pague por Mercado Pago:
    echo 1. El webhook de Mercado Pago actualiza payment_status a "paid"
    echo 2. El trigger detecta el cambio
    echo 3. Se envía automáticamente un correo de confirmación
    echo.
    echo Para probar:
    echo - Realiza un pago de prueba con Mercado Pago
    echo - El correo se enviará automáticamente
    echo.
) else (
    echo ====================================================
    echo ❌ Error al aplicar la migración
    echo ====================================================
    echo.
    echo Verifica:
    echo - Tu conexión a internet
    echo - Que estés logueado en Supabase CLI
    echo - Que el proyecto esté vinculado correctamente
    echo.
)
echo ====================================================
pause
