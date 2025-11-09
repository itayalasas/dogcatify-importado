#!/bin/bash

# Script para obtener SHA256 del keystore de Android
# Uso: ./scripts/get-android-sha256.sh

echo "🔍 Obteniendo SHA256 del keystore de Android..."
echo ""

KEYSTORE_PATH="android/app/debug.keystore"

if [ ! -f "$KEYSTORE_PATH" ]; then
  echo "❌ Error: No se encontró el archivo $KEYSTORE_PATH"
  exit 1
fi

echo "📁 Keystore encontrado: $KEYSTORE_PATH"
echo ""

SHA256=$(keytool -list -v -keystore "$KEYSTORE_PATH" \
  -alias androiddebugkey \
  -storepass android \
  -keypass android 2>/dev/null | grep "SHA256:" | sed 's/.*SHA256: //')

if [ -z "$SHA256" ]; then
  echo "❌ Error: No se pudo extraer el SHA256"
  echo ""
  echo "Intenta ejecutar manualmente:"
  echo "keytool -list -v -keystore $KEYSTORE_PATH -alias androiddebugkey -storepass android -keypass android"
  exit 1
fi

echo "✅ SHA256 extraído correctamente:"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$SHA256"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Copia este valor y pégalo en:"
echo "   web-redirect/.well-known/assetlinks.json"
echo ""
echo "   Reemplaza: YOUR_SHA256_FINGERPRINT_HERE"
echo "   Con:       $SHA256"
echo ""

# Guardar en archivo temporal
echo "$SHA256" > /tmp/dogcatify-sha256.txt
echo "💾 También guardado en: /tmp/dogcatify-sha256.txt"
echo ""

# Ofrecer actualizar automáticamente
read -p "¿Quieres actualizar assetlinks.json automáticamente? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  ASSETLINKS_FILE="web-redirect/.well-known/assetlinks.json"

  if [ ! -f "$ASSETLINKS_FILE" ]; then
    echo "❌ Error: No se encontró $ASSETLINKS_FILE"
    exit 1
  fi

  # Crear backup
  cp "$ASSETLINKS_FILE" "${ASSETLINKS_FILE}.backup"
  echo "📦 Backup creado: ${ASSETLINKS_FILE}.backup"

  # Actualizar archivo
  sed -i.tmp "s/YOUR_SHA256_FINGERPRINT_HERE/$SHA256/g" "$ASSETLINKS_FILE"
  rm -f "${ASSETLINKS_FILE}.tmp"

  echo "✅ Archivo actualizado correctamente!"
  echo ""
  echo "📄 Contenido actualizado:"
  cat "$ASSETLINKS_FILE"
  echo ""
fi

echo "🎯 Próximos pasos:"
echo "   1. Obtener Team ID de Apple"
echo "   2. Actualizar apple-app-site-association"
echo "   3. Redesplegar en Netlify"
echo "   4. Crear nuevo build con EAS"
