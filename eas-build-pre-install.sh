#!/bin/bash

echo "🔧 Configurando archivos de Firebase..."

# Restaurar google-services.json desde EAS Secret
if [ -n "$GOOGLE_SERVICES_JSON" ]; then
  echo "$GOOGLE_SERVICES_JSON" > ./google-services.json
  echo "✅ google-services.json creado en la raíz del proyecto"

  # También crear en android/app por si acaso
  mkdir -p android/app
  echo "$GOOGLE_SERVICES_JSON" > android/app/google-services.json
  echo "✅ google-services.json creado en android/app/"
else
  echo "❌ ERROR: GOOGLE_SERVICES_JSON no está configurado como variable de entorno"
  exit 1
fi

# Restaurar GoogleService-Info.plist desde EAS Secret (para iOS)
if [ -n "$GOOGLE_SERVICE_INFO_PLIST" ]; then
  mkdir -p ios
  echo "$GOOGLE_SERVICE_INFO_PLIST" > ios/GoogleService-Info.plist
  echo "✅ GoogleService-Info.plist creado para iOS"
else
  echo "⚠️  GOOGLE_SERVICE_INFO_PLIST no encontrado (solo necesario para iOS)"
fi

echo "✅ Configuración de Firebase completada"
