#!/bin/bash

# Script para actualizar archivos .well-known con credenciales reales
# Uso: ./scripts/update-well-known-files.sh

echo "🔧 Configurador de Universal Links"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar que estamos en la raíz del proyecto
if [ ! -d "web-redirect/.well-known" ]; then
  echo "❌ Error: Este script debe ejecutarse desde la raíz del proyecto"
  echo "   Asegúrate de estar en la carpeta que contiene 'web-redirect/'"
  exit 1
fi

# Solicitar Team ID
echo "📱 PASO 1: Configurar iOS (Apple)"
echo ""
echo "Para obtener tu Team ID:"
echo "   1. Ve a: https://developer.apple.com/account/"
echo "   2. Inicia sesión con: pedro.ayala@ayalait.com.uy"
echo "   3. El Team ID aparece en la esquina superior derecha (10 caracteres)"
echo ""
read -p "Ingresa tu Apple Team ID: " TEAM_ID

if [ -z "$TEAM_ID" ]; then
  echo "❌ Team ID no puede estar vacío"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Solicitar SHA256
echo "🤖 PASO 2: Configurar Android"
echo ""
echo "Para obtener tu SHA256, ejecuta:"
echo "   ./scripts/get-android-sha256.sh"
echo ""
echo "O manualmente:"
echo "   keytool -list -v -keystore android/app/debug.keystore \\"
echo "     -alias androiddebugkey -storepass android -keypass android"
echo ""
read -p "Ingresa tu SHA256 Fingerprint: " SHA256

if [ -z "$SHA256" ]; then
  echo "❌ SHA256 no puede estar vacío"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Confirmar datos
echo "📋 Resumen de configuración:"
echo ""
echo "   Apple Team ID: $TEAM_ID"
echo "   Android SHA256: $SHA256"
echo ""
read -p "¿Los datos son correctos? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Cancelado por el usuario"
  exit 1
fi

echo ""
echo "🔄 Actualizando archivos..."
echo ""

# Crear backups
APPLE_FILE="web-redirect/.well-known/apple-app-site-association"
ANDROID_FILE="web-redirect/.well-known/assetlinks.json"

cp "$APPLE_FILE" "${APPLE_FILE}.backup"
cp "$ANDROID_FILE" "${ANDROID_FILE}.backup"

echo "📦 Backups creados:"
echo "   - ${APPLE_FILE}.backup"
echo "   - ${ANDROID_FILE}.backup"
echo ""

# Actualizar apple-app-site-association
cat > "$APPLE_FILE" << EOF
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "${TEAM_ID}.com.dogcatify.app",
        "paths": [
          "/album/*",
          "/post/*",
          "/share/*"
        ]
      }
    ]
  },
  "webcredentials": {
    "apps": [
      "${TEAM_ID}.com.dogcatify.app"
    ]
  }
}
EOF

echo "✅ Actualizado: $APPLE_FILE"

# Actualizar assetlinks.json
cat > "$ANDROID_FILE" << EOF
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.dogcatify.app",
      "sha256_cert_fingerprints": [
        "${SHA256}"
      ]
    }
  }
]
EOF

echo "✅ Actualizado: $ANDROID_FILE"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 ¡Archivos actualizados correctamente!"
echo ""
echo "📄 Contenido de apple-app-site-association:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$APPLE_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📄 Contenido de assetlinks.json:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$ANDROID_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🎯 PRÓXIMOS PASOS:"
echo ""
echo "   1. Redesplegar en Netlify:"
echo "      - Ve a https://app.netlify.com"
echo "      - Arrastra la carpeta 'web-redirect' completa"
echo ""
echo "   2. Crear nuevo build:"
echo "      eas build --platform android --profile preview"
echo "      eas build --platform ios --profile production"
echo ""
echo "   3. Instalar el nuevo build en tu dispositivo"
echo ""
echo "   4. Probar el link:"
echo "      https://app-dogcatify.netlify.app/album/[id]"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 TIP: Si algo sale mal, puedes restaurar los backups:"
echo "   cp ${APPLE_FILE}.backup $APPLE_FILE"
echo "   cp ${ANDROID_FILE}.backup $ANDROID_FILE"
echo ""
