# Comandos Rápidos - Notificaciones Android FCM

## 🎯 Configuración (una sola vez)

### 1. Login a Expo
```bash
eas login
```

### 2. Configurar FCM Server Key
```bash
eas credentials
# Selecciona: Android > preview > Push Notifications > Add FCM server key
# Pega el Server Key de Firebase
```

### 3. Configurar para otros profiles
```bash
# Production
eas credentials --profile production

# Development
eas credentials --profile development
```

---

## 🔍 Verificación

### Ver credenciales configuradas
```bash
eas credentials
```

### Verificar configuración local
```bash
bash scripts/check-fcm-status.sh
```

---

## 🧪 Pruebas

### Probar notificación
```bash
# Reemplaza con tu token real
node scripts/test-android-notifications.js "ExponentPushToken[tu-token-aqui]"
```

### Ver logs en tiempo real (Android conectado)
```bash
adb logcat | grep -i "firebase\|notification\|expo"
```

---

## 🔧 Mantenimiento

### Limpiar y rebuild
```bash
cd android
./gradlew clean
cd ..
eas build --platform android --profile preview --clear-cache
```

### Actualizar google-services.json
```bash
# Después de descargar nuevo archivo de Firebase
cp google-services.json android/app/google-services.json
```

---

## 📍 Enlaces Importantes

### Firebase Console
```
https://console.firebase.google.com/project/app-mascota-7db30
```

### Firebase Cloud Messaging
```
https://console.firebase.google.com/project/app-mascota-7db30/settings/cloudmessaging
```

### Google Cloud Console (habilitar API)
```
https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=app-mascota-7db30
```

### Expo Dashboard
```
https://expo.dev/accounts/pedro86cu/projects/dogcatify
```

---

## 🆘 Solución Rápida de Problemas

### Error: InvalidCredentials
```bash
# 1. Verifica que Cloud Messaging API esté habilitada
# 2. Copia nuevamente el Server Key de Firebase
# 3. Reconfigura credenciales
eas credentials
```

### Error: DeviceNotRegistered
```bash
# 1. El token expiró, regenera en la app:
#    - Ve a Perfil
#    - Desactiva notificaciones
#    - Vuelve a activar
#    - Copia el nuevo token
```

### Notificaciones no llegan
```bash
# 1. Verifica permisos en el dispositivo
# 2. Asegúrate de que Google Play Services esté actualizado
# 3. Revisa que la app no esté optimizada por batería
# 4. Prueba con:
node scripts/test-android-notifications.js "ExponentPushToken[nuevo-token]"
```

---

## 📊 Datos del Proyecto

```
Project ID:      app-mascota-7db30
Project Number:  867298215472
Package Name:    com.dogcatify.app
App ID:          1:867298215472:android:44f476301c4481617acff5
```

---

## ✅ Checklist Rápido

```bash
# Configuración local
✓ google-services.json en raíz y android/app/
✓ POST_NOTIFICATIONS en AndroidManifest.xml
✓ MyFirebaseMessagingService creado
✓ Dependencias Firebase en build.gradle

# Configuración Expo (HACER AHORA)
❌ FCM Server Key en Expo
   → eas credentials
   → Android > Push Notifications > Add FCM server key

# Verificación
❌ Prueba de notificación exitosa
   → node scripts/test-android-notifications.js "token"
```

---

## 🚀 Flujo Completo (Copy-Paste)

```bash
# 1. Login
eas login

# 2. Configurar credenciales
eas credentials
# → Android → preview → Push Notifications → Add FCM server key
# → Pegar Server Key de Firebase

# 3. Verificar
eas credentials

# 4. Probar (reemplaza el token)
node scripts/test-android-notifications.js "ExponentPushToken[GmaZ8POLgyDoSH9O2tbukD]"

# 5. Si funciona, configurar para production
eas credentials --profile production
```

---

## 💡 Recordatorios

- ✅ No necesitas rebuild después de configurar credenciales
- ✅ Puedes probar inmediatamente
- ✅ El mismo Server Key sirve para todos los profiles
- ✅ Las credenciales se configuran una sola vez
- ✅ iOS no necesita esta configuración (usa APNS automáticamente)

---

## 📚 Más Información

- **Resumen**: `RESUMEN_NOTIFICACIONES_ANDROID.md`
- **Guía completa**: `CONFIGURAR_FCM_EXPO.md`
- **Troubleshooting**: `FIX_NOTIFICACIONES_ANDROID.md`
- **Checklist**: `CHECKLIST_NOTIFICACIONES_ANDROID.md`
