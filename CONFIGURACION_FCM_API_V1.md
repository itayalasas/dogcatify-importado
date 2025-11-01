# 🚀 Configuración de Firebase Cloud Messaging API v1

Esta guía te ayudará a configurar FCM API v1 en tu proyecto DogCatiFy.

## 📋 Resumen de Cambios Implementados

### ✅ Archivos Creados/Modificados

1. **`supabase/functions/_shared/firebase-auth.ts`** - Helper OAuth 2.0
2. **`supabase/functions/send-notification-fcm-v1/index.ts`** - Edge Function FCM v1
3. **`contexts/NotificationContext.tsx`** - Actualizado para obtener FCM token
4. **`supabase/functions/send-scheduled-notifications/index.ts`** - Actualizado con fallback
5. **Base de datos** - Nueva columna `fcm_token` en tabla `profiles`
6. **`scripts/test-fcm-v1.js`** - Script de testing

---

## 🔧 Paso 1: Obtener Service Account de Firebase

### 1.1 Descargar el archivo JSON

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **app-mascota-7db30**
3. Click en el icono de ⚙️ (Settings) → **Project Settings**
4. Ve a la pestaña **Service Accounts**
5. Click en **"Generate new private key"**
6. Descarga el archivo JSON
7. **GUARDA ESTE ARCHIVO DE FORMA SEGURA** - Contiene credenciales privadas

El archivo descargado se verá similar a esto:

```json
{
  "type": "service_account",
  "project_id": "app-mascota-7db30",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nXXXXXXXXXX...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@app-mascota-7db30.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

---

## 🔐 Paso 2: Configurar Secret en Supabase

Tienes **dos opciones** para configurar el Service Account:

### Opción A: Usando Supabase CLI (Recomendado)

```bash
# Asegúrate de tener el archivo JSON descargado
# Por ejemplo: firebase-service-account.json

# Configura el secret (reemplaza el contenido entre comillas)
supabase secrets set FIREBASE_SERVICE_ACCOUNT='CONTENIDO_COMPLETO_DEL_JSON_AQUI'
```

**Ejemplo:**

```bash
supabase secrets set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"app-mascota-7db30","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\nXXX...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk@app-mascota-7db30.iam.gserviceaccount.com",...}'
```

### Opción B: Usando Supabase Dashboard

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Project Settings** → **Edge Functions** → **Secrets**
4. Click en **"Add new secret"**
5. Nombre: `FIREBASE_SERVICE_ACCOUNT`
6. Valor: Pega el contenido completo del JSON (todo en una línea)
7. Click en **"Add secret"**

### ⚠️ Importante

- El JSON debe estar **en una sola línea** (sin saltos de línea excepto dentro de `private_key`)
- Los caracteres `\n` dentro de `private_key` deben mantenerse
- Las comillas dobles dentro del JSON deben estar escapadas si usas la CLI

---

## 🧪 Paso 3: Testing

### 3.1 Desplegar la Edge Function

```bash
# Asegúrate de estar en el directorio del proyecto
cd /ruta/a/dogcatify

# Despliega la función usando Supabase CLI o el sistema MCP
# La función ya está creada en:
# supabase/functions/send-notification-fcm-v1/
```

Si usas Supabase CLI:

```bash
supabase functions deploy send-notification-fcm-v1
```

### 3.2 Verificar Configuración

```bash
node scripts/test-fcm-v1.js
```

Este script:
1. ✅ Verifica que el Service Account esté configurado
2. 📱 Busca usuarios con FCM token
3. 🔔 Envía una notificación de prueba
4. 📊 Muestra el resultado

### 3.3 Resultado Esperado

#### Si todo está bien configurado:

```
✅ Service Account configurado correctamente
✅ Encontrados 1 usuarios con FCM token
✅ NOTIFICACIÓN ENVIADA EXITOSAMENTE!
📱 Revisa tu dispositivo Android para ver la notificación
```

#### Si falta configuración:

```
❌ Service Account NO configurado

📝 INSTRUCCIONES PARA CONFIGURAR:
1. Descarga el Service Account JSON de Firebase
2. Ejecuta: supabase secrets set FIREBASE_SERVICE_ACCOUNT='...'
```

---

## 📱 Paso 4: Obtener FCM Token en la App

### 4.1 Actualizar la App

Los cambios ya están implementados en `NotificationContext.tsx`. Ahora cuando un usuario:

1. Registra notificaciones por primera vez
2. O actualiza sus notificaciones

Se obtienen **DOS tokens automáticamente**:

- **Expo Push Token** - Para compatibilidad (API heredada)
- **FCM Token** - Para FCM API v1 (Android nativo)

### 4.2 Testing en Dispositivo

1. **Rebuild la app** (los cambios del Context requieren rebuild):

```bash
# Para Android
eas build --platform android --profile preview

# O desarrollo local
npm run android
```

2. **Abre la app** en un dispositivo Android físico

3. **Registra notificaciones**:
   - Ve a Perfil → Configuración
   - Activa notificaciones
   - Acepta los permisos

4. **Verifica en la base de datos**:

```sql
SELECT
  id,
  display_name,
  push_token,
  fcm_token,
  created_at
FROM profiles
WHERE fcm_token IS NOT NULL;
```

Deberías ver algo como:

```
| id | display_name | push_token | fcm_token | created_at |
|----|--------------|------------|-----------|------------|
| xxx| Juan Pérez   | ExponentP...| cXXXXX...| 2025-11-01 |
```

---

## 🔄 Paso 5: Sistema de Fallback

El sistema ahora funciona así:

```
┌─────────────────────────────────────────┐
│  Se necesita enviar una notificación    │
└──────────────────┬──────────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │ ¿Tiene FCM      │
         │ token?          │
         └────┬────────┬───┘
              │ Sí     │ No
              ▼        │
    ┌─────────────┐   │
    │ Intenta con │   │
    │ FCM v1 API  │   │
    └──┬──────────┘   │
       │              │
       ▼              │
  ┌─────────┐        │
  │ ¿Éxito? │        │
  └─┬───┬───┘        │
    │Sí │No          │
    │   └────────────┼─────────┐
    │                │         │
    ▼                ▼         ▼
┌────────┐    ┌──────────────────┐
│ ✅ FIN │    │ Fallback a Expo  │
└────────┘    │ Push (Legacy)    │
              └─────────┬────────┘
                        │
                        ▼
                  ┌──────────┐
                  │ ✅ FIN   │
                  └──────────┘
```

### Ventajas

1. **Compatibilidad total**: iOS sigue funcionando sin cambios
2. **Migración gradual**: Usuarios antiguos (solo Expo token) siguen recibiendo notificaciones
3. **Usuarios nuevos**: Obtienen ambos tokens automáticamente
4. **Sin downtime**: Si FCM v1 falla, usa el método legacy

---

## 📊 Paso 6: Monitoreo

### Ver logs de notificaciones:

```bash
# Ver logs de la edge function
supabase functions logs send-notification-fcm-v1

# Ver logs de notificaciones programadas
supabase functions logs send-scheduled-notifications
```

### Buscar notificaciones enviadas:

```sql
-- Notificaciones enviadas en las últimas 24 horas
SELECT
  id,
  title,
  body,
  status,
  sent_at,
  user_id
FROM scheduled_notifications
WHERE sent_at > NOW() - INTERVAL '24 hours'
ORDER BY sent_at DESC;
```

### Ver método de envío:

Los logs mostrarán:

```
✅ Notification 123 sent via fcm-v1
✅ Notification 456 sent via expo-legacy
```

---

## 🎯 Checklist de Implementación

### Pre-requisitos
- [x] Helper de autenticación OAuth 2.0 creado
- [x] Edge Function FCM v1 creada
- [x] Base de datos actualizada (columna `fcm_token`)
- [x] NotificationContext actualizado
- [x] Sistema de fallback implementado
- [x] Script de testing creado

### Configuración en Firebase
- [ ] Descargar Service Account JSON
- [ ] Guardar archivo de forma segura
- [ ] Verificar que tenga todos los campos necesarios

### Configuración en Supabase
- [ ] Configurar secret `FIREBASE_SERVICE_ACCOUNT`
- [ ] Verificar que el secret esté bien formateado
- [ ] Desplegar edge function `send-notification-fcm-v1`

### Testing
- [ ] Ejecutar `node scripts/test-fcm-v1.js`
- [ ] Verificar que el Service Account esté configurado
- [ ] Rebuild de la app móvil
- [ ] Registrar notificaciones en un dispositivo
- [ ] Verificar que se guarden ambos tokens
- [ ] Enviar notificación de prueba
- [ ] Confirmar recepción en dispositivo

### Monitoreo
- [ ] Configurar logs en Supabase
- [ ] Verificar métricas de envío
- [ ] Monitorear errores
- [ ] Confirmar que el fallback funciona

---

## ❓ Troubleshooting

### Error: "FIREBASE_SERVICE_ACCOUNT not configured"

**Causa:** El secret no está configurado en Supabase

**Solución:**
```bash
supabase secrets set FIREBASE_SERVICE_ACCOUNT='...'
```

### Error: "Invalid FIREBASE_SERVICE_ACCOUNT JSON format"

**Causa:** El JSON está mal formateado

**Solución:**
1. Asegúrate de que sea un JSON válido
2. Elimina saltos de línea (excepto en `private_key`)
3. Escapa comillas si es necesario

### Error: "Failed to get access token"

**Causas posibles:**
1. `private_key` incorrecta
2. `client_email` incorrecto
3. Service Account deshabilitado en Firebase

**Solución:**
1. Descarga un nuevo Service Account JSON
2. Verifica que esté activo en Firebase Console
3. Reconfigura el secret

### No se obtiene FCM token en Android

**Causa:** La app no tiene permisos de notificación

**Solución:**
1. Verifica que el usuario haya aceptado permisos
2. Revisa los logs de `NotificationContext`
3. Confirma que `google-services.json` esté configurado

### Notificaciones no llegan

**Diagnóstico:**

```bash
# Verificar token en base de datos
SELECT fcm_token FROM profiles WHERE id = 'USER_ID';

# Ver logs de la función
supabase functions logs send-notification-fcm-v1

# Test directo
node scripts/test-fcm-v1.js
```

---

## 📚 Recursos Adicionales

- [Documentación FCM API v1](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages)
- [Guía de migración oficial](https://firebase.google.com/docs/cloud-messaging/migrate-v1)
- [Service Accounts en Firebase](https://firebase.google.com/docs/admin/setup)

---

## 🎉 Próximos Pasos

Una vez que todo funcione:

1. **Monitorea** el uso por 1-2 semanas
2. **Verifica métricas** de entrega
3. **Compara** FCM v1 vs Legacy
4. **Considera deprecar** API heredada si FCM v1 funciona al 100%

---

**¡Felicidades! 🎊** Tu sistema de notificaciones ahora usa la API moderna de Firebase con fallback automático para máxima compatibilidad.
