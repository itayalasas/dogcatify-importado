#!/bin/bash

echo "🔍 Verificando configuración de Firebase Cloud Messaging"
echo "========================================================"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar google-services.json
echo "📋 1. Verificando google-services.json..."
if [ -f "google-services.json" ]; then
    echo -e "${GREEN}✓${NC} google-services.json encontrado en la raíz"

    # Extraer información
    PROJECT_ID=$(grep -o '"project_id": "[^"]*"' google-services.json | cut -d'"' -f4)
    PROJECT_NUMBER=$(grep -o '"project_number": "[^"]*"' google-services.json | cut -d'"' -f4)
    PACKAGE_NAME=$(grep -o '"package_name": "[^"]*"' google-services.json | cut -d'"' -f4)
    APP_ID=$(grep -o '"mobilesdk_app_id": "[^"]*"' google-services.json | cut -d'"' -f4)

    echo "   Project ID: $PROJECT_ID"
    echo "   Project Number: $PROJECT_NUMBER"
    echo "   Package Name: $PACKAGE_NAME"
    echo "   App ID: $APP_ID"
else
    echo -e "${RED}✗${NC} google-services.json NO encontrado en la raíz"
fi
echo ""

# Verificar en android/app/
echo "📋 2. Verificando google-services.json en android/app/..."
if [ -f "android/app/google-services.json" ]; then
    echo -e "${GREEN}✓${NC} google-services.json encontrado en android/app/"
else
    echo -e "${RED}✗${NC} google-services.json NO encontrado en android/app/"
    echo -e "${YELLOW}   💡 Ejecuta: cp google-services.json android/app/${NC}"
fi
echo ""

# Verificar permisos en AndroidManifest.xml
echo "📋 3. Verificando permisos en AndroidManifest.xml..."
if grep -q "POST_NOTIFICATIONS" android/app/src/main/AndroidManifest.xml; then
    echo -e "${GREEN}✓${NC} Permiso POST_NOTIFICATIONS configurado"
else
    echo -e "${RED}✗${NC} Permiso POST_NOTIFICATIONS NO encontrado"
fi
echo ""

# Verificar servicio FCM
echo "📋 4. Verificando servicio Firebase..."
if grep -q "MyFirebaseMessagingService" android/app/src/main/AndroidManifest.xml; then
    echo -e "${GREEN}✓${NC} Servicio MyFirebaseMessagingService registrado"
else
    echo -e "${RED}✗${NC} Servicio MyFirebaseMessagingService NO registrado"
fi
echo ""

# Verificar archivo del servicio
echo "📋 5. Verificando archivo MyFirebaseMessagingService.kt..."
if [ -f "android/app/src/main/java/com/dogcatify/app/MyFirebaseMessagingService.kt" ]; then
    echo -e "${GREEN}✓${NC} Archivo MyFirebaseMessagingService.kt existe"
else
    echo -e "${RED}✗${NC} Archivo MyFirebaseMessagingService.kt NO existe"
fi
echo ""

# Verificar dependencias en build.gradle
echo "📋 6. Verificando dependencias Firebase en build.gradle..."
if grep -q "firebase-messaging" android/app/build.gradle; then
    echo -e "${GREEN}✓${NC} Dependencia firebase-messaging configurada"
else
    echo -e "${RED}✗${NC} Dependencia firebase-messaging NO encontrada"
fi

if grep -q "google-services" android/build.gradle; then
    echo -e "${GREEN}✓${NC} Plugin google-services configurado"
else
    echo -e "${RED}✗${NC} Plugin google-services NO encontrado"
fi
echo ""

# Verificar EAS credentials
echo "📋 7. Verificando credenciales EAS..."
echo -e "${YELLOW}   ℹ Para verificar credenciales FCM en Expo:${NC}"
echo "   1. Ejecuta: eas login"
echo "   2. Ejecuta: eas credentials"
echo "   3. Selecciona Android > Push Notifications"
echo ""

# Verificar app.json
echo "📋 8. Verificando configuración de notificaciones en app.json..."
if grep -q "POST_NOTIFICATIONS" app.json; then
    echo -e "${GREEN}✓${NC} Permiso POST_NOTIFICATIONS en app.json"
else
    echo -e "${YELLOW}⚠${NC} Permiso POST_NOTIFICATIONS no encontrado en app.json"
fi

if grep -q "expo-notifications" app.json; then
    echo -e "${GREEN}✓${NC} Plugin expo-notifications configurado"
else
    echo -e "${RED}✗${NC} Plugin expo-notifications NO configurado"
fi
echo ""

# Resumen
echo "========================================================"
echo "📊 RESUMEN"
echo "========================================================"
echo ""
echo "Para que las notificaciones funcionen en Android necesitas:"
echo ""
echo "1. ${GREEN}✓${NC} Configuración local (código):"
echo "   - google-services.json en raíz y android/app/"
echo "   - Permisos en AndroidManifest.xml"
echo "   - Servicio MyFirebaseMessagingService"
echo "   - Dependencias Firebase en build.gradle"
echo ""
echo "2. ${YELLOW}⚠${NC} Configuración en Expo (credenciales):"
echo "   - FCM Server Key o Service Account configurado"
echo "   - Ejecuta: eas credentials"
echo "   - Configura: Push Notifications > FCM server key"
echo ""
echo "3. ${GREEN}✓${NC} Cloud Messaging API habilitada en Firebase:"
echo "   - Ve a Firebase Console"
echo "   - Project Settings > Cloud Messaging"
echo "   - Verifica que esté habilitado"
echo ""
echo "📚 Guía completa: CONFIGURAR_FCM_EXPO.md"
echo ""
