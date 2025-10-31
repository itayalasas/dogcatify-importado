# ✅ Checklist: Configurar Notificaciones Android

## Estado Actual: Configuración de Código ✅ | Credenciales FCM ❌

---

## Parte 1: Configuración de Código (COMPLETADA ✅)

### Archivos y Configuración Local

- [x] **google-services.json** en la raíz del proyecto
- [x] **google-services.json** copiado a `android/app/`
- [x] **Permiso POST_NOTIFICATIONS** en AndroidManifest.xml
- [x] **Servicio MyFirebaseMessagingService** creado
- [x] **Servicio registrado** en AndroidManifest.xml
- [x] **Dependencias Firebase** en build.gradle
- [x] **Plugin google-services** en build.gradle
- [x] **Configuración de notificaciones** en app.json
- [x] **Canales de notificación** en NotificationContext.tsx

### Información del Proyecto

```
✓ Project ID: app-mascota-7db30
✓ Project Number: 867298215472
✓ Package Name: com.dogcatify.app
✓ App ID: 1:867298215472:android:44f476301c4481617acff5
```

---

## Parte 2: Credenciales FCM en Expo (PENDIENTE ❌)

### Lo que necesitas hacer AHORA:

#### Paso 1: Obtener Server Key de Firebase

- [ ] Abrir https://console.firebase.google.com/
- [ ] Seleccionar proyecto: **app-mascota-7db30**
- [ ] Ir a: ⚙️ Project Settings > Cloud Messaging
- [ ] Si es necesario, habilitar Cloud Messaging API:
  - [ ] Click en menú (⋮) → "Manage API in Google Cloud Console"
  - [ ] Click en **ENABLE**
  - [ ] Esperar 1-2 minutos
- [ ] Copiar el **Server Key** (empieza con `AAAA...`)

#### Paso 2: Subir Credenciales a Expo

```bash
# 1. Login a Expo
eas login

# 2. Abrir configuración de credenciales
eas credentials
```

En el menú interactivo:
- [ ] Seleccionar: **Android**
- [ ] Seleccionar: **preview** (o tu profile)
- [ ] Seleccionar: **Push Notifications: FCM server key**
- [ ] Seleccionar: **Add a FCM server key**
- [ ] Pegar el Server Key
- [ ] Confirmar

#### Paso 3: Repetir para otros profiles (si los usas)

```bash
# Para production
eas credentials --profile production

# Para development
eas credentials --profile development
```

- [ ] Configurado para **preview**
- [ ] Configurado para **production** (si aplica)
- [ ] Configurado para **development** (si aplica)

---

## Parte 3: Verificación y Pruebas

### Verificar Credenciales

```bash
# Ver credenciales configuradas
eas credentials
```

- [ ] Confirmar que FCM Server Key aparece en la lista

### Probar Notificaciones

**IMPORTANTE**: No necesitas rebuild después de configurar credenciales.

```bash
# Obtén tu token desde la app (Perfil > Notificaciones)
node scripts/test-android-notifications.js "ExponentPushToken[tu-token]"
```

- [ ] Script ejecutado sin errores
- [ ] Respuesta: `"status": "ok"`
- [ ] Notificación recibida en el dispositivo Android

### Si la prueba falla:

```bash
# Verificar configuración local
bash scripts/check-fcm-status.sh
```

- [ ] Todas las verificaciones locales en ✓ verde
- [ ] Cloud Messaging API habilitada en Firebase
- [ ] Credenciales correctamente subidas a Expo

---

## Troubleshooting

### Error: "InvalidCredentials"

**Posibles causas:**
- [ ] Server Key no copiado correctamente
- [ ] Cloud Messaging API no habilitada
- [ ] Credenciales configuradas en profile incorrecto

**Solución:**
1. Verifica el Server Key en Firebase Console
2. Asegúrate de que Cloud Messaging API esté **ENABLED**
3. Vuelve a ejecutar `eas credentials` y configura el Server Key

### Error: "DeviceNotRegistered"

**Posibles causas:**
- [ ] Token expirado o inválido
- [ ] App no instalada correctamente

**Solución:**
1. Desinstala la app completamente
2. Reinstala desde el último build
3. Habilita notificaciones nuevamente
4. Obtén un nuevo token

### La notificación no llega pero no hay error

**Posibles causas:**
- [ ] Notificaciones deshabilitadas en el sistema
- [ ] Optimización de batería bloqueando la app
- [ ] Google Play Services desactualizado

**Solución:**
1. Ve a: Configuración > Apps > DogCatiFy > Permisos > Notificaciones
2. Asegúrate de que esté **Permitido**
3. Ve a: Configuración > Apps > DogCatiFy > Batería
4. Selecciona **Sin restricciones**
5. Actualiza Google Play Services si es necesario

---

## Documentación de Referencia

| Documento | Propósito |
|-----------|-----------|
| `RESUMEN_NOTIFICACIONES_ANDROID.md` | Resumen ejecutivo y pasos rápidos |
| `CONFIGURAR_FCM_EXPO.md` | Guía completa de configuración FCM |
| `FIX_NOTIFICACIONES_ANDROID.md` | Solución detallada de problemas |
| `scripts/check-fcm-status.sh` | Verificar configuración local |
| `scripts/test-android-notifications.js` | Probar envío de notificaciones |

---

## Estado Final Esperado

Una vez completado todo:

- ✅ Código local configurado
- ✅ Credenciales FCM en Expo
- ✅ Cloud Messaging API habilitada
- ✅ Notificaciones de prueba funcionando
- ✅ App recibiendo notificaciones en Android

---

## Tiempo Total Estimado

- ⏱️ **5-10 minutos** para configurar credenciales FCM
- ⏱️ **1-2 minutos** para verificar y probar

---

## Siguiente Paso

🚀 **Ve a Firebase Console y obtén el Server Key (Parte 2, Paso 1)**

https://console.firebase.google.com/project/app-mascota-7db30/settings/cloudmessaging
