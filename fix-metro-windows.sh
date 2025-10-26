#!/bin/bash

echo "================================================"
echo " Limpiando caché de Metro y reinstalando"
echo "================================================"
echo

echo "[1/4] Eliminando .expo..."
rm -rf .expo

echo
echo "[2/4] Eliminando node_modules..."
rm -rf node_modules

echo
echo "[3/4] Eliminando caché de Metro en TEMP..."
rm -rf $LOCALAPPDATA/Temp/metro-* 2>/dev/null
rm -rf $LOCALAPPDATA/Temp/haste-map-* 2>/dev/null

echo
echo "[4/4] Reinstalando dependencias..."
npm install

echo
echo "================================================"
echo " ✅ Listo! Ahora ejecuta: npx expo start -c --tunnel"
echo "================================================"
