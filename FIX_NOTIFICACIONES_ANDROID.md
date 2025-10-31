# Solución: Notificaciones Push no funcionan en Android

## ⚠️ ACCIÓN REQUERIDA: Configurar Credenciales FCM

**El problema actual es que falta configurar las credenciales de Firebase Cloud Messaging (FCM) en Expo.**

```
Error: "Unable to retrieve the FCM server key for the recipient's app"
```

### Solución Rápida (5 minutos):

1. Ve a [Firebase Console](https://console.firebase.google.com/) → Proyecto **app-mascota-7db30**
2. Project Settings → Cloud Messaging → Copia el **Server Key**
3. En tu terminal:
   ```bash
   eas login
   eas credentials
   # Selecciona: Android > Preview/Production > Push Notifications > Add FCM server key
   # Pega el Server Key
   ```
4. Prueba inmediatamente (no necesitas rebuild):
   ```bash
   node scripts/test-android-notifications.js "ExponentPushToken[tu-token]"
   ```

**📖 Guía detallada**: Ver archivo `CONFIGURAR_FCM_EXPO.md`

---

## Problema
Las notificaciones push funcionan correctamente en iOS pero no llegan a dispositivos Android físicos.

## Causas Identificadas

### 1. Permiso POST_NOTIFICATIONS faltante
Android 13+ (API 33+) requiere el permiso explícito `POST_NOTIFICATIONS` para mostrar notificaciones.

### 2. Servicio Firebase Cloud Messaging no configurado
Faltaba el servicio personalizado de Firebase para recibir notificaciones en segundo plano.

### 3. google-services.json no sincronizado
El archivo puede no estar en la ubicación correcta para que Gradle lo encuentre.

### 4. Canales de notificación no inicializados correctamente
Android 8+ requiere canales de notificación configurados antes de mostrar notificaciones.

## Cambios Realizados

### 1. AndroidManifest.xml actualizado
- ✅ Agregado permiso `POST_NOTIFICATIONS`
- ✅ Registrado servicio `MyFirebaseMessagingService`
- ✅ Configuración de iconos y colores de notificación

### 2. Servicio Firebase creado
**Archivo:** `android/app/src/main/java/com/dogcatify/app/MyFirebaseMessagingService.kt`

Este servicio:
- Recibe notificaciones en segundo plano
- Crea canales de notificación automáticamente
- Muestra notificaciones con el icono y sonido correctos
- Maneja el tap en notificaciones

### 3. google-services.json sincronizado
El archivo ha sido copiado a `android/app/google-services.json`

### 4. app.json actualizado
Agregado el permiso `POST_NOTIFICATIONS` a la lista de permisos

## Pasos para Probar

### 1. Reconstruir la Aplicación

```bash
# Limpiar build anterior
cd android
./gradlew clean

# Volver a la raíz del proyecto
cd ..

# Crear nuevo build con EAS
eas build --platform android --profile preview
```

### 2. Instalar en Dispositivo Físico

```bash
# Cuando el build esté listo, descarga e instala el APK
# O usa EAS Submit para publicar en Play Store
```

### 3. Habilitar Notificaciones en la App

1. Abre la app
2. Ve a **Perfil**
3. Activa el interruptor de **Notificaciones Push**
4. **IMPORTANTE**: Acepta el permiso cuando Android lo solicite
5. Verifica que el estado muestre "Recibiendo notificaciones"

### 4. Probar Notificación

Opción A - Desde el script de prueba:

```bash
# Copia tu token desde la app (se muestra en la pantalla de perfil)
node scripts/test-android-notifications.js "ExponentPushToken[tu-token-aqui]"
```

Opción B - Desde el botón en la app:
1. En la pantalla de perfil, pulsa "Probar notificación"
2. Deberías recibir una notificación en segundos

## Verificación de Configuración

### Verificar Firebase
```bash
cat android/app/google-services.json | grep project_id
# Debe mostrar: "project_id": "app-mascota-7db30"
```

### Verificar Permisos
```bash
cat android/app/src/main/AndroidManifest.xml | grep POST_NOTIFICATIONS
# Debe encontrar la línea del permiso
```

### Verificar Servicio
```bash
cat android/app/src/main/AndroidManifest.xml | grep MyFirebaseMessagingService
# Debe mostrar el servicio registrado
```

## Solución de Problemas

### La notificación no llega

1. **Verifica la versión de Android**
   - Android 13+ requiere que el usuario acepte el permiso explícitamente
   - Ve a Configuración > Apps > DogCatiFy > Permisos > Notificaciones
   - Asegúrate de que esté habilitado

2. **Verifica el token**
   - El token debe empezar con `ExponentPushToken[`
   - Si empieza con otro formato, regenera el token

3. **Revisa los logs**
   ```bash
   # Con dispositivo conectado por USB
   adb logcat | grep -i "firebase\|notification\|expo"
   ```

4. **Verifica FCM en Firebase Console**
   - Ve a https://console.firebase.google.com
   - Selecciona tu proyecto "app-mascota-7db30"
   - Ve a Cloud Messaging
   - Verifica que el servicio esté habilitado

### El token se genera pero las notificaciones no llegan

1. **Regenera el token**
   - En la app, desactiva y vuelve a activar las notificaciones
   - Esto forzará la generación de un nuevo token

2. **Verifica la configuración de Google Play Services**
   - Asegúrate de que Google Play Services esté actualizado en el dispositivo
   - Configuración > Apps > Google Play Services

3. **Prueba desde Firebase Console**
   - Ve a Firebase Console > Cloud Messaging
   - Usa la herramienta "Send test message"
   - Ingresa tu token FCM

### Error "DeviceNotRegistered"

Este error significa que el token ha expirado o no es válido:

1. Desinstala completamente la app
2. Reinstala desde el build más reciente
3. Habilita notificaciones nuevamente
4. Obtén un nuevo token

### Error en el build

Si hay errores al compilar:

```bash
# Limpia completamente
cd android
./gradlew clean
rm -rf .gradle
rm -rf app/build

# Vuelve a la raíz
cd ..

# Limpia caché de Expo
expo prebuild --clean
```

## Diferencias entre iOS y Android

### iOS
- No requiere Firebase
- Usa APNS (Apple Push Notification Service)
- Los permisos se solicitan al usuario al momento de registrarse
- Las notificaciones funcionan inmediatamente después de aceptar

### Android
- Requiere Firebase Cloud Messaging (FCM)
- Requiere google-services.json configurado
- Android 13+ requiere permiso POST_NOTIFICATIONS explícito
- Requiere canales de notificación configurados
- El servicio debe estar registrado en AndroidManifest.xml

## Recursos Adicionales

- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Android Notification Channels](https://developer.android.com/training/notify-user/channels)
- [EAS Build](https://docs.expo.dev/build/introduction/)

## Contacto y Soporte

Si después de seguir estos pasos las notificaciones aún no funcionan:

1. Verifica los logs de la app con `adb logcat`
2. Revisa el estado del proyecto en Firebase Console
3. Asegúrate de estar usando un dispositivo físico (no emulador)
4. Verifica que el dispositivo tenga conexión a internet
5. Confirma que Google Play Services esté instalado y actualizado

## Checklist Final

Antes de reportar un problema, verifica que hayas completado:

- [ ] Rebuild de la app con los cambios aplicados
- [ ] Instalación en dispositivo físico Android
- [ ] Permiso POST_NOTIFICATIONS aceptado en Android 13+
- [ ] Token generado y guardado en la base de datos
- [ ] Token empieza con "ExponentPushToken["
- [ ] google-services.json en android/app/
- [ ] Firebase Cloud Messaging habilitado en Firebase Console
- [ ] Google Play Services actualizado en el dispositivo
- [ ] Conexión a internet activa
- [ ] Notificaciones habilitadas en configuración del sistema

¡Con estos cambios, las notificaciones deberían funcionar correctamente en Android!
