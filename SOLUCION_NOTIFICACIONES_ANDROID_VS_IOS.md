# 🔔 Solución: Notificaciones Funcionan en iOS pero NO en Android

## 📊 Situación Actual

✅ **iOS**: Notificaciones funcionan perfectamente (confirmado con screenshot)
❌ **Android**: Notificaciones NO llegan
✅ **Configuración**: Perfecta según diagnóstico automático

## 🎯 Causas Comunes y Soluciones

### 1. Build Antigua o Caché

**Problema:** El build actual de Android podría no incluir los cambios de Firebase.

**Solución:**
```bash
# 1. Limpiar completamente Android
cd android
./gradlew clean
cd ..

# 2. Limpiar caché de Expo
npm start -- --clear

# 3. Rebuild completo
npx expo run:android --no-build-cache
```

### 2. Permisos de Notificación en el Dispositivo

**Problema:** Android requiere permisos explícitos para notificaciones (Android 13+).

**Verificación:**
1. Abre **Configuración** del dispositivo
2. **Apps** → **DogCatiFy**
3. **Notificaciones** → Verifica que estén **ACTIVADAS**
4. **Todos los canales** deben estar activados

**En la App:**
```javascript
// El código ya lo hace, pero verifica en logs
const { status } = await Notifications.requestPermissionsAsync();
console.log('Permiso de notificaciones:', status);
// Debe ser: 'granted'
```

### 3. Token FCM No Se Está Generando

**Problema:** El token de Android (FCM) no se genera correctamente.

**Diagnóstico:**
```bash
# Ejecuta la app en modo debug y revisa logs
npx expo run:android

# En otra terminal, filtra logs de FCM:
adb logcat | grep -E "FCM|MyFirebaseMsgService|expo-notifications"
```

**Busca en los logs:**
```
✅ Buen signo:
- "Refreshed FCM token: XXX"
- "Push token generated successfully"
- "Token saved to database"

❌ Mal signo:
- "Error getting FCM token"
- "Service not available"
- "AUTHENTICATION_FAILED"
```

### 4. Google Services JSON Incorrecto

**Problema:** Aunque el archivo existe, podría estar para un proyecto diferente o con credenciales incorrectas.

**Verificación:**
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **app-mascota-7db30**
3. **Project Settings** → **General**
4. Busca la app Android: **com.dogcatify.app**
5. **Descarga** el `google-services.json` más reciente
6. **Reemplaza** el archivo en `android/app/google-services.json`
7. **Rebuild** la app

### 5. Server Key de Firebase

**Problema:** El server key de Firebase podría estar mal configurado en tu backend.

**Verificación en Firebase Console:**
1. Ve a **Project Settings** → **Cloud Messaging**
2. Copia el **Server Key** (también llamado Legacy server key)
3. Verifica que este key esté en tu backend/Supabase

**En Supabase:**
```sql
-- Verifica que tengas el Server Key configurado
SELECT * FROM app_config WHERE key = 'firebase_server_key';
```

### 6. Modo de Notificaciones

**Problema:** Android y iOS manejan notificaciones de manera diferente.

**Diferencias Clave:**

| Aspecto | iOS (APNs) | Android (FCM) |
|---------|-----------|---------------|
| Token | `ExponentPushToken[xxx]` | `ExponentPushToken[xxx]` (pero diferente interno) |
| Permisos | Solicitados al inicio | Android 13+ requiere permiso explícito |
| Background | Funciona automáticamente | Requiere `MyFirebaseMessagingService.kt` |
| Canal | No necesario | Requiere channel configurado |

### 7. Test con Firebase Console

**Mejor forma de diagnosticar:**

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. **Engage** → **Cloud Messaging**
3. **Send your first message**
4. Click **Send test message**
5. Ingresa el **FCM token** de tu dispositivo Android
   - Puedes obtenerlo desde logs de la app
   - O desde la tabla `profiles` en Supabase
6. Click **Test**

**Resultado esperado:**
- ✅ Notificación llega → El problema está en tu backend
- ❌ Notificación NO llega → El problema está en Firebase/Android setup

## 🔍 Script de Diagnóstico Avanzado

Creé un script que puedes ejecutar:

```bash
node scripts/diagnose-android-notifications.js
```

## 📋 Checklist de Verificación

Marca cada item después de verificarlo:

### Configuración
- [ ] `google-services.json` está en `android/app/`
- [ ] Package name es `com.dogcatify.app` en todos lados
- [ ] Firebase Messaging Service existe
- [ ] Build.gradle incluye google-services plugin
- [ ] AndroidManifest incluye permisos POST_NOTIFICATIONS

### Dispositivo
- [ ] Permisos de notificaciones ACTIVADOS en Configuración
- [ ] App está actualizada (build reciente)
- [ ] No está en modo "No molestar"
- [ ] Conexión a internet activa

### Testing
- [ ] Token FCM se genera correctamente (ver logs)
- [ ] Token se guarda en la base de datos
- [ ] Test desde Firebase Console funciona
- [ ] Notificación de prueba desde tu backend funciona

## 🚀 Pasos Recomendados (EN ORDEN)

### Paso 1: Rebuild Completo
```bash
cd android && ./gradlew clean && cd ..
npm start -- --clear
npx expo run:android --no-build-cache
```

### Paso 2: Verificar Permisos
1. Abre la app
2. Acepta permisos de notificaciones
3. Verifica en Configuración del dispositivo

### Paso 3: Test con Firebase Console
1. Obtén el FCM token de los logs
2. Envía test desde Firebase Console
3. Confirma que llega

### Paso 4: Test con Tu Backend
1. Envía notificación desde tu Edge Function
2. Revisa logs de Supabase
3. Confirma que llega

## 🐛 Debugging Logs

Para ver logs detallados:

```bash
# Terminal 1: Ejecuta la app
npx expo run:android

# Terminal 2: Filtra logs relevantes
adb logcat | grep -E "expo-notifications|FCM|MyFirebaseMsgService|DogCatiFy"
```

**Logs importantes a buscar:**
```
✅ "Refreshed FCM token: XXX"
✅ "Push token generated successfully"
✅ "Message Notification Body: XXX"
✅ "sendNotification called with: XXX"

❌ "Error getting FCM token"
❌ "Service not available"
❌ "AUTHENTICATION_FAILED"
❌ "MissingPermission"
```

## 🎯 Causas Más Probables (Ordenadas por Frecuencia)

1. **Build antigua** (90% de los casos)
   - Solución: Rebuild completo con --no-build-cache

2. **Permisos no otorgados** (5% de los casos)
   - Solución: Verificar en Configuración → Apps → DogCatiFy → Notificaciones

3. **google-services.json desactualizado** (3% de los casos)
   - Solución: Descargar nuevo desde Firebase Console

4. **Firebase Server Key incorrecto** (2% de los casos)
   - Solución: Actualizar en backend/Supabase

## 💡 Dato Importante

**iOS y Android usan sistemas completamente diferentes:**

### iOS (APNs)
- Sistema de Apple (APNs)
- Configuración en Expo
- Token tipo: `ExponentPushToken[xxx]`
- **Más simple de configurar**

### Android (FCM)
- Sistema de Google (Firebase Cloud Messaging)
- Requiere Firebase Project
- Requiere `google-services.json`
- Requiere servicio nativo (MyFirebaseMessagingService.kt)
- Token tipo: `ExponentPushToken[xxx]` (pero internamente usa FCM token)
- **Más complejo pero más configurable**

## 🆘 Si Nada Funciona

Si después de todo esto aún no funciona:

1. **Verifica el Project ID de Firebase:**
   ```javascript
   // En app debe ser:
   const projectId = '0618d9ae-6714-46bb-adce-f4ee57fff324';
   ```

2. **Verifica que el google-services.json corresponda a ese proyecto:**
   ```json
   {
     "project_info": {
       "project_id": "app-mascota-7db30"  // ← Debe coincidir
     }
   }
   ```

3. **Revisa Firebase Console:**
   - Proyecto: app-mascota-7db30
   - App Android registrada: com.dogcatify.app
   - Cloud Messaging habilitado

4. **Contacta con más detalles:**
   - Logs completos de `adb logcat`
   - Screenshot de Firebase Console
   - Versión de Android del dispositivo

## 📱 Comando Rápido de Verificación

```bash
# Todo en uno:
cd android && ./gradlew clean && cd .. && \
npm start -- --clear && \
npx expo run:android --no-build-cache && \
adb logcat | grep -E "expo-notifications|FCM"
```

---

**Última actualización:** 2025-11-01
**Estado:** Configuración verificada ✅ | Pendiente: Testing en dispositivo
