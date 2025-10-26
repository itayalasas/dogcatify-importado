@echo off
echo ================================================
echo  Limpiando cache de Metro y reinstalando
echo ================================================
echo.

echo [1/5] Deteniendo procesos de Node...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo [2/5] Eliminando .expo...
if exist .expo rmdir /s /q .expo

echo.
echo [3/5] Eliminando node_modules...
if exist node_modules rmdir /s /q node_modules

echo.
echo [4/5] Eliminando cache de Metro en TEMP...
del /q /s "%LOCALAPPDATA%\Temp\metro-*" 2>nul
del /q /s "%LOCALAPPDATA%\Temp\haste-map-*" 2>nul

echo.
echo [5/5] Reinstalando dependencias...
call npm install

echo.
echo ================================================
echo  Listo! Ahora ejecuta: npx expo start -c --tunnel
echo ================================================
pause
