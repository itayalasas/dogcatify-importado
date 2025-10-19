#!/bin/bash

# Restaurar google-services.json desde EAS Secret
if [ -n "$GOOGLE_SERVICES_JSON" ]; then
  echo "$GOOGLE_SERVICES_JSON" > android/app/google-services.json
  echo "✅ google-services.json restaurado para Android"
else
  echo "⚠️  GOOGLE_SERVICES_JSON no encontrado"
fi

# Restaurar GoogleService-Info.plist desde EAS Secret (para iOS)
if [ -n "$GOOGLE_SERVICE_INFO_PLIST" ]; then
  echo "$GOOGLE_SERVICE_INFO_PLIST" > ios/GoogleService-Info.plist
  echo "✅ GoogleService-Info.plist restaurado para iOS"
else
  echo "⚠️  GOOGLE_SERVICE_INFO_PLIST no encontrado"
fi
