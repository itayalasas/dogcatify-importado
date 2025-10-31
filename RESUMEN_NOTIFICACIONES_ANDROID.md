# Resumen: Notificaciones Android - Estado Actual

## 🔴 Problema Identificado

El error que estás viendo es:

```
"Unable to retrieve the FCM server key for the recipient's app.
Make sure you have provided a server key as directed by the Expo FCM documentation."
```

## ✅ Lo que YA está configurado (código)

1. ✅ Permiso `POST_NOTIFICATIONS` en AndroidManifest.xml
2. ✅ Servicio `MyFirebaseMessagingService` creado y registrado
3. ✅ `google-services.json` en las ubicaciones correctas
4. ✅ Dependencias de Firebase en build.gradle
5. ✅ Canales de notificación configurados
6. ✅ Configuración en app.json

## ❌ Lo que FALTA (credenciales en Expo)

**El código está correcto, pero falta subir las credenciales FCM a Expo.**

Expo necesita el "Server Key" de Firebase para enviar notificaciones a tus dispositivos Android.

## 🚀 Solución (Pasos exactos)

### Paso 1: Obtener el Server Key de Firebase (2 minutos)

1. Abre: https://console.firebase.google.com/
2. Selecciona tu proyecto: **app-mascota-7db30**
3. Click en el ícono de engranaje ⚙️ → **Project Settings**
4. Ve a la pestaña **Cloud Messaging**
5. Si aparece un mensaje sobre habilitar la API:
   - Click en el menú (⋮) junto a "Cloud Messaging API (Legacy)"
   - Click en "Manage API in Google Cloud Console"
   - Click en **ENABLE**
   - Espera 1-2 minutos y recarga la página de Firebase
6. Copia el **Server Key** (empieza con `AAAA...`)

### Paso 2: Subir credenciales a Expo (3 minutos)

En tu terminal del proyecto:

```bash
# 1. Login a Expo (si no lo has hecho)
eas login

# 2. Configurar credenciales
eas credentials

# 3. En el menú interactivo:
#    - Selecciona: Android
#    - Selecciona: preview (o el profile que uses)
#    - Selecciona: Push Notifications: FCM server key
#    - Selecciona: Add a FCM server key
#    - Pega el Server Key que copiaste
```

### Paso 3: Probar inmediatamente (1 minuto)

**¡No necesitas rebuild!** Las credenciales se usan en el servidor de Expo.

```bash
# Prueba con tu token (cópialo desde la app en Perfil)
node scripts/test-android-notifications.js "ExponentPushToken[tu-token-aqui]"
```

Deberías ver:
```
✅ ¡Notificación enviada exitosamente!
```

Y recibir la notificación en tu dispositivo Android en segundos.

## 📊 Verificación Rápida

Para verificar que todo esté configurado:

```bash
# Verifica la configuración local
bash scripts/check-fcm-status.sh

# Verifica las credenciales en Expo
eas credentials
```

## 🎯 Por qué funciona en iOS pero no en Android

- **iOS**: Usa APNS (Apple Push Notification Service) que Expo maneja automáticamente
- **Android**: Usa FCM (Firebase Cloud Messaging) que requiere configuración manual del Server Key

## 📚 Documentación Detallada

Si necesitas más información o tienes problemas:

1. **Guía completa de configuración**: `CONFIGURAR_FCM_EXPO.md`
2. **Guía de solución de problemas**: `FIX_NOTIFICACIONES_ANDROID.md`
3. **Script de verificación**: `scripts/check-fcm-status.sh`
4. **Script de prueba**: `scripts/test-android-notifications.js`

## ⏱️ Tiempo estimado total: 5-10 minutos

1. Obtener Server Key: 2 min
2. Subir a Expo: 3 min
3. Probar: 1 min
4. ✅ **Notificaciones funcionando en Android**

## ❓ Preguntas Frecuentes

### ¿Necesito hacer rebuild de la app?
**No.** Las credenciales FCM se usan en el servidor de Expo, no en tu app.

### ¿Tengo que hacer esto para cada build?
**No.** Solo una vez por proyecto. Las credenciales se guardan en Expo.

### ¿Qué pasa si uso development, preview y production?
Debes configurar las credenciales para cada profile que uses:
```bash
eas credentials --profile development
eas credentials --profile preview
eas credentials --profile production
```

### ¿Puedo usar el mismo Server Key para todos los profiles?
Sí, puedes usar el mismo Server Key para todos los profiles.

### ¿Cuándo expira el Server Key?
Los Server Keys de Firebase no expiran, pero puedes regenerarlos si es necesario.

## 🆘 Si algo no funciona

1. Verifica que Cloud Messaging API esté habilitada en Firebase
2. Confirma que copiaste el Server Key completo (empieza con AAAA)
3. Verifica que elegiste el profile correcto en `eas credentials`
4. Prueba regenerar el token en la app (desactiva/activa notificaciones)
5. Consulta `CONFIGURAR_FCM_EXPO.md` para troubleshooting detallado

---

**Siguiente paso**: Ve a Firebase Console y obtén el Server Key siguiendo el Paso 1 anterior.
