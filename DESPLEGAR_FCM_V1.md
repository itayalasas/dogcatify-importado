# 🚀 Desplegar FCM API v1 - Instrucciones Finales

## ✅ Estado Actual

- **Service Account**: Configurado correctamente ✅
- **Base de datos**: Actualizada con columna `fcm_token` ✅
- **Edge Functions**: Creadas y corregidas ✅
- **Cliente**: Actualizado para obtener FCM token ✅
- **Error de payload**: Corregido ✅

## 📦 Despliegue Paso a Paso

### Paso 1: Desplegar Edge Function Corregida (IMPORTANTE)

La edge function tiene un fix crítico que debes desplegar.

#### Opción A: Usando Supabase CLI (Recomendado)

```bash
# 1. Asegúrate de estar logueado en Supabase
supabase login

# 2. Link al proyecto (si no lo has hecho)
supabase link --project-ref TU_PROJECT_REF

# 3. Despliega la función corregida
supabase functions deploy send-notification-fcm-v1
```

#### Opción B: Usando Supabase Dashboard

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Edge Functions**
4. Busca `send-notification-fcm-v1`
5. Click en **"Deploy"** o **"Update"**
6. Sube el contenido de `supabase/functions/send-notification-fcm-v1/index.ts`

#### Opción C: Sistema MCP (Si está disponible)

El sistema MCP puede desplegar automáticamente si está configurado.

### Paso 2: Verificar el Despliegue

```bash
node scripts/test-fcm-v1.js
```

**Resultado esperado:**

```
╔════════════════════════════════════════════╗
║   TEST: Firebase Cloud Messaging API v1   ║
╚════════════════════════════════════════════╝


=== VERIFICANDO CONFIGURACIÓN ===

✅ Service Account configurado correctamente
✅ Edge function está lista (token de prueba inválido es esperado)

=== TEST FCM API v1 ===

1. Buscando usuarios con FCM token...
❌ No se encontraron usuarios con FCM token

📝 Nota: Los usuarios deben registrar sus notificaciones primero
```

Esto es **normal** si aún no has rebuildeado la app. Continuemos.

### Paso 3: Rebuild de la App Móvil

⚠️ **IMPORTANTE**: La validación automática de tokens **NO funciona en Expo Go**.

Necesitas hacer un **build nativo** porque:
- FCM tokens solo están disponibles en builds nativas
- Expo Go no tiene acceso a notificaciones push nativas
- El sistema detecta Expo Go y se salta automáticamente

**Opciones de Build:**

```bash
# Opción A: Build con EAS (Preview) - RECOMENDADO
eas build --platform android --profile preview

# Opción B: Build de Producción
eas build --platform android --profile production

# Opción C: Build de desarrollo local (requiere Android Studio)
npm run android
```

**Logs esperados:**

En **Expo Go** verás:
```
⚠️ Running in Expo Go - Notifications require native build
💡 Run: eas build --platform android --profile preview
```

En **Build Nativa** verás:
```
✅ Usuario logueado, validando tokens...
=== VALIDANDO TOKENS AL INICIAR SESIÓN ===
✅ Tokens actualizados exitosamente
```

### Paso 4: Registrar Notificaciones en Dispositivo

1. Instala la app rebuildeada en un dispositivo Android físico
2. Abre la app
3. Ve a **Perfil** → **Configuración**
4. Activa las notificaciones
5. Acepta los permisos cuando se soliciten

Los logs en consola mostrarán:

```
Getting native FCM token for Android...
✅ FCM token obtained: cXXXXXXXXXXXXXXXXXXX...
Storing push tokens in user profile...
- Expo Push Token: ExponentPushToken[xxx]...
- FCM Token: cXXXXXXXXXXXXXXXXXXX...
✅ Push tokens saved successfully
✅ FCM v1 API ready for Android
```

### Paso 5: Verificar en Base de Datos

```sql
SELECT
  id,
  display_name,
  push_token IS NOT NULL as expo_token,
  fcm_token IS NOT NULL as fcm_token,
  LEFT(fcm_token, 30) as fcm_preview
FROM profiles
WHERE fcm_token IS NOT NULL
LIMIT 5;
```

**Resultado esperado:**

```
| id  | display_name | expo_token | fcm_token | fcm_preview |
|-----|--------------|------------|-----------|-------------|
| xxx | Tu Nombre    | true       | true      | cXXXXXXXXX... |
```

### Paso 6: Enviar Notificación de Prueba

```bash
node scripts/test-fcm-v1.js
```

**Resultado esperado:**

```
✅ Encontrados 1 usuarios con FCM token

2. Enviando notificación de prueba a: Tu Nombre
   FCM Token: cXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX...

Status de respuesta: 200 OK

✅ NOTIFICACIÓN ENVIADA EXITOSAMENTE!
Resultado: {
  "success": true,
  "messageId": "projects/app-mascota-7db30/messages/0:xxxx",
  ...
}

📱 Revisa tu dispositivo Android para ver la notificación
```

### Paso 7: Verificar Recepción

En tu dispositivo Android deberías recibir una notificación que dice:

```
🔔 Test FCM API v1
Esta es una notificación de prueba enviada con Firebase Cloud Messaging API v1
```

---

## 🔍 Troubleshooting

### Error: "Invalid JSON payload received"

**Causa**: La edge function no está actualizada con el fix

**Solución**:
```bash
supabase functions deploy send-notification-fcm-v1
```

### Error: "No se encontraron usuarios con FCM token"

**Causa**: La app no ha sido rebuildeada o los usuarios no han reregistrado notificaciones

**Solución**:
1. Rebuild de la app
2. Registra notificaciones en un dispositivo
3. Verifica en base de datos

### Error: "FIREBASE_SERVICE_ACCOUNT not configured"

**Causa**: El secret no está configurado en Supabase

**Solución**:
```bash
supabase secrets set FIREBASE_SERVICE_ACCOUNT='CONTENIDO_DEL_JSON'
```

### Notificación no llega al dispositivo

**Diagnóstico**:

1. Verifica que el token exista en DB:
```sql
SELECT fcm_token FROM profiles WHERE id = 'TU_USER_ID';
```

2. Verifica logs de la función:
```bash
supabase functions logs send-notification-fcm-v1 --tail
```

3. Verifica permisos en Android:
   - Configuración → Apps → DogCatiFy → Notificaciones → Activadas

---

## 📊 Monitoreo Post-Despliegue

### Ver Logs en Tiempo Real

```bash
# Logs de FCM v1
supabase functions logs send-notification-fcm-v1 --tail

# Logs de notificaciones programadas
supabase functions logs send-scheduled-notifications --tail
```

### Queries Útiles

**Usuarios con ambos tokens:**
```sql
SELECT COUNT(*) as total
FROM profiles
WHERE push_token IS NOT NULL
  AND fcm_token IS NOT NULL;
```

**Notificaciones enviadas hoy:**
```sql
SELECT
  COUNT(*) as total,
  status
FROM scheduled_notifications
WHERE sent_at::date = CURRENT_DATE
GROUP BY status;
```

**Última notificación enviada por método:**
```sql
-- Esta info estará en los logs
-- Buscar: "sent via fcm-v1" o "sent via expo-legacy"
```

---

## 🎯 Checklist Final de Despliegue

### Pre-despliegue
- [x] Service Account configurado
- [x] Edge functions creadas
- [x] Base de datos actualizada
- [x] Cliente actualizado
- [x] Error de payload corregido

### Despliegue
- [ ] Edge function desplegada (`supabase functions deploy`)
- [ ] Test de verificación ejecutado (`node scripts/test-fcm-v1.js`)
- [ ] App rebuildeada
- [ ] Notificaciones registradas en dispositivo
- [ ] Token FCM guardado en DB

### Post-despliegue
- [ ] Notificación de prueba enviada
- [ ] Notificación recibida en dispositivo
- [ ] Logs verificados
- [ ] Métricas monitoreadas
- [ ] Sistema de fallback confirmado

---

## 📝 Comandos Rápidos de Referencia

```bash
# Desplegar función
supabase functions deploy send-notification-fcm-v1

# Test completo
node scripts/test-fcm-v1.js

# Ver logs
supabase functions logs send-notification-fcm-v1 --tail

# Rebuild app
npm run android

# Build producción
eas build --platform android --profile production
```

---

## 🎊 Una Vez Completado

Tu sistema estará enviando notificaciones usando:

1. **FCM API v1** - Para usuarios con FCM token (Android nuevo)
2. **Expo Push** - Fallback para usuarios sin FCM token (legacy)
3. **APNs** - iOS sin cambios (a través de Expo)

Todo funcionando en paralelo con **cero downtime** y **máxima compatibilidad**.

---

## 📚 Documentación Relacionada

- `CONFIGURACION_FCM_API_V1.md` - Configuración inicial
- `MIGRACION_FCM_API_V1.md` - Documentación técnica completa
- `FIX_FCM_PAYLOAD_ERROR.md` - Detalles del fix aplicado
- `RESUMEN_MIGRACION_FCM_V1.md` - Resumen ejecutivo

---

**¡Listo para desplegar!** 🚀

Ejecuta los comandos y verifica cada paso con los checks proporcionados.
