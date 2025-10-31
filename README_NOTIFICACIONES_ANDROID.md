# 🔔 Guía Completa: Notificaciones Push en Android

## 📋 Índice de Documentación

| Documento | Cuándo Usar | Tiempo |
|-----------|-------------|--------|
| **Este archivo** | Punto de entrada principal | - |
| [RESUMEN_NOTIFICACIONES_ANDROID.md](RESUMEN_NOTIFICACIONES_ANDROID.md) | Resumen ejecutivo y quick start | 2 min |
| [CHECKLIST_NOTIFICACIONES_ANDROID.md](CHECKLIST_NOTIFICACIONES_ANDROID.md) | Lista de verificación paso a paso | 10 min |
| [COMANDOS_RAPIDOS_FCM.md](COMANDOS_RAPIDOS_FCM.md) | Comandos de referencia rápida | 1 min |
| [CONFIGURAR_FCM_EXPO.md](CONFIGURAR_FCM_EXPO.md) | Guía detallada de configuración | 15 min |
| [FIX_NOTIFICACIONES_ANDROID.md](FIX_NOTIFICACIONES_ANDROID.md) | Solución de problemas detallada | 20 min |

---

## 🎯 Quick Start (5 minutos)

### El Problema

```
Error: "Unable to retrieve the FCM server key for the recipient's app"
```

Las notificaciones funcionan en iOS pero no en Android porque **falta configurar las credenciales de Firebase Cloud Messaging (FCM) en Expo**.

### La Solución (3 pasos)

#### 1. Obtener Server Key (2 min)

1. Ve a: https://console.firebase.google.com/project/app-mascota-7db30/settings/cloudmessaging
2. Si ves mensaje sobre habilitar API:
   - Click en el menú (⋮) → "Manage API in Google Cloud Console"
   - Click en **ENABLE**
   - Espera 1-2 minutos
3. Copia el **Server Key** (empieza con `AAAA...`)

#### 2. Subir a Expo (2 min)

```bash
eas login
eas credentials
```

En el menú:
- Selecciona: **Android** → **preview** → **Push Notifications**
- Selecciona: **Add a FCM server key**
- Pega el Server Key

#### 3. Probar (1 min)

```bash
# Obtén tu token desde: App > Perfil > Notificaciones
node scripts/test-android-notifications.js "ExponentPushToken[tu-token]"
```

**Resultado esperado:**
```
✅ ¡Notificación enviada exitosamente!
```

Y recibirás la notificación en tu dispositivo Android.

---

## 📊 Estado Actual del Proyecto

### ✅ Configuración de Código (Completada)

Todo el código necesario ya está implementado:

- ✅ Permisos en AndroidManifest.xml
- ✅ Servicio Firebase (MyFirebaseMessagingService)
- ✅ google-services.json configurado
- ✅ Dependencias Firebase
- ✅ Canales de notificación
- ✅ Configuración en app.json

### ❌ Credenciales FCM (Pendiente)

Lo único que falta:

- ❌ Subir FCM Server Key a Expo

**Acción requerida**: Seguir los 3 pasos del Quick Start arriba.

---

## 🔍 Verificación

### Verificar configuración local

```bash
bash scripts/check-fcm-status.sh
```

**Resultado esperado**: Todos los checks en ✓ verde excepto credenciales Expo.

### Verificar credenciales en Expo

```bash
eas credentials
```

**Busca**: "Push Notifications: FCM server key" en la lista.

---

## 🧪 Scripts Disponibles

### Verificar configuración
```bash
bash scripts/check-fcm-status.sh
```

### Probar notificaciones
```bash
node scripts/test-android-notifications.js "ExponentPushToken[tu-token]"
```

---

## 🆘 Problemas Comunes

### 1. Error: "InvalidCredentials"

**Causa**: FCM Server Key no configurado o incorrecto.

**Solución**: Sigue el Quick Start arriba para configurar credenciales.

### 2. Error: "DeviceNotRegistered"

**Causa**: Token expirado o inválido.

**Solución**:
1. En la app: Perfil > Desactiva/Activa notificaciones
2. Copia el nuevo token
3. Prueba nuevamente

### 3. La notificación no llega (sin error)

**Causa**: Permisos del sistema o configuración del dispositivo.

**Solución**:
1. Verifica: Configuración > Apps > DogCatiFy > Permisos > Notificaciones (Permitido)
2. Verifica: Configuración > Apps > DogCatiFy > Batería (Sin restricciones)
3. Actualiza Google Play Services

---

## 📚 Información del Proyecto

```
Firebase Project:    app-mascota-7db30
Project Number:      867298215472
Package Name:        com.dogcatify.app
Android App ID:      1:867298215472:android:44f476301c4481617acff5
```

### Enlaces Importantes

- [Firebase Console](https://console.firebase.google.com/project/app-mascota-7db30)
- [Cloud Messaging Settings](https://console.firebase.google.com/project/app-mascota-7db30/settings/cloudmessaging)
- [Google Cloud Console](https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=app-mascota-7db30)
- [Expo Dashboard](https://expo.dev/accounts/pedro86cu/projects/dogcatify)

---

## 🎓 Entendiendo el Problema

### ¿Por qué funciona en iOS pero no en Android?

| Plataforma | Servicio | Configuración Requerida |
|------------|----------|------------------------|
| **iOS** | APNS (Apple) | Automático en Expo |
| **Android** | FCM (Firebase) | Manual - Server Key |

**iOS** → Expo maneja todo automáticamente con APNS.

**Android** → Necesitas configurar FCM manualmente porque:
1. Requiere proyecto Firebase
2. Requiere Server Key específico
3. Expo necesita ese Server Key para enviar notificaciones

### ¿Qué hace el Server Key?

El Server Key permite a Expo enviar notificaciones a través de Firebase Cloud Messaging a tus dispositivos Android. Sin él, Expo no puede comunicarse con FCM.

---

## 🔄 Flujo Completo

```
1. Usuario habilita notificaciones en la app
   ↓
2. App genera ExponentPushToken
   ↓
3. Token se guarda en Supabase (profiles.push_token)
   ↓
4. Cuando hay un evento (mensaje, reserva, etc.):
   ↓
5. Backend envía notificación a Expo con el token
   ↓
6. Expo usa FCM Server Key para enviar a Android
   ↓
7. FCM entrega notificación al dispositivo
   ↓
8. MyFirebaseMessagingService la muestra al usuario
```

**El punto 6 está fallando** porque falta el FCM Server Key en Expo.

---

## ✅ Checklist Mínimo

Antes de reportar un problema, verifica:

- [ ] Cloud Messaging API habilitada en Firebase
- [ ] FCM Server Key copiado correctamente
- [ ] Credenciales subidas a Expo con `eas credentials`
- [ ] Token generado y válido (empieza con `ExponentPushToken[`)
- [ ] Permisos de notificación aceptados en el dispositivo
- [ ] Google Play Services actualizado
- [ ] No hay optimización de batería bloqueando la app

---

## 🚀 Próximo Paso

**Configura las credenciales FCM ahora:**

1. Lee: [RESUMEN_NOTIFICACIONES_ANDROID.md](RESUMEN_NOTIFICACIONES_ANDROID.md)
2. Sigue: [CHECKLIST_NOTIFICACIONES_ANDROID.md](CHECKLIST_NOTIFICACIONES_ANDROID.md)
3. O usa el Quick Start al inicio de este documento

**Tiempo estimado**: 5-10 minutos

**Resultado**: Notificaciones funcionando en Android ✅

---

## 📞 Soporte

Si después de seguir toda la documentación sigues teniendo problemas:

1. Ejecuta `bash scripts/check-fcm-status.sh` y comparte el resultado
2. Ejecuta la prueba y comparte el error completo:
   ```bash
   node scripts/test-android-notifications.js "tu-token" 2>&1 | tee test-output.txt
   ```
3. Verifica los logs del dispositivo:
   ```bash
   adb logcat | grep -i "firebase\|notification" > device-logs.txt
   ```

---

**Última actualización**: 31 de Octubre de 2025

**Estado**: Código ✅ | Credenciales ❌ (pendiente de configurar)
