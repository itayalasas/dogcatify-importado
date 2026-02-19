@echo off
echo ====================================================
echo  Actualizando función Edge: extract-medical-card-info
echo ====================================================
echo.
echo Esta función mejora la extracción de fechas del carnet
echo priorizando las fechas escritas a mano sobre los stickers
echo.
pause
echo.
echo Desplegando función...
supabase functions deploy extract-medical-card-info
echo.
echo ====================================================
if %ERRORLEVEL% EQU 0 (
    echo ✅ Función actualizada correctamente
    echo.
    echo Ahora al escanear carnets, OpenAI priorizará:
    echo - Fechas escritas a mano en la columna de firma
    echo - Sobre fechas impresas en stickers
) else (
    echo ❌ Error al actualizar la función
    echo Verifica tu conexión y configuración de Supabase
)
echo ====================================================
pause
