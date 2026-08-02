@echo off
echo Aplicando migración para corregir constraint de recordatorios de vacunas...
echo.

REM Asegurarse de estar en la carpeta correcta
cd /d "%~dp0"

echo Aplicando migración...
supabase db push

echo.
echo ✅ Migración aplicada correctamente
echo.
echo Ahora puedes intentar guardar las vacunas nuevamente.
pause
