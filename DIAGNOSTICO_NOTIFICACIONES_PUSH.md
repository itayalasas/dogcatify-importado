## 🔍 Análisis: Notificaciones Push No Llegan a Usuarios

### ❌ Problemas Identificados

#### 1. **PROBLEMA CRÍTICO: No hay Cron Job configurado**
- ✅ Existe la función `send-scheduled-notifications` en Supabase
- ✅ Se crean notificaciones en la tabla `scheduled_notifications`
- ❌ **NO hay un cron job que ejecute esa función periódicamente**
- **Impacto**: Las notificaciones nunca se envían aunque se creen

#### 2. **Los usuarios pueden no tener tokens de push**
- La función `send-scheduled-notifications` busca `fcm_token` o `push_token`
- Si los usuarios no tienen registrados estos tokens, no pueden recibir push
- **Verificar**: Ejecutar `SELECT COUNT(*) FILTER (WHERE fcm_token IS NOT NULL) FROM profiles;`

#### 3. **EXPO_ACCESS_TOKEN no está configurado**
- La función de notificaciones usa FCM v1 API
- Necesita variables de entorno: `SUPABASE_SERVICE_ROLE_KEY` y `EXPO_ACCESS_TOKEN`
- **Ver**: `supabase/functions/send-scheduled-notifications/index.ts` línea 27

#### 4. **Trigger potencialmente inactivo o con problemas**
- Trigger `on_order_status_change` debería activarse cuando cambia el status
- Inserta en `scheduled_notifications` con `scheduled_for: now()`
- **Verificar**: Ejecutar query de validación

### 📋 Componentes del Sistema

```
1. TRIGGER (on_order_status_change) 
   ↓ [Cuando status de orden cambia]
   ↓
2. FUNCIÓN (create_order_status_notification)
   ↓ [Crea registro en tabla]
   ↓
3. TABLA (scheduled_notifications)
   ↓ [Registro con status='pending']
   ↓
4. CRON JOB (FALTA CONFIGURAR) ← AQUÍ ESTÁ EL PROBLEMA
   ↓ [Debería ejecutarse cada X minutos]
   ↓
5. FUNCIÓN (send-scheduled-notifications)
   ↓ [Obtiene tokens del usuario]
   ↓
6. FCM v1 API
   ↓ [Envía la notificación]
   ↓
7. DISPOSITIVO DEL USUARIO (Recibe push)
```

### ✅ Lo que ESTÁ funcionando:

1. ✅ Trigger de órdenes está creado
2. ✅ Función de notificaciones está creada
3. ✅ Se están insertando notificaciones en `scheduled_notifications`
4. ✅ Las páginas de pagos redirigen correctamente
5. ✅ Deep links están configurados

### ❌ Lo que FALTA:

1. ❌ **Cron job para ejecutar `send-scheduled-notifications` cada 5 minutos**
2. ❌ Posiblemente tokens de push no registrados en usuarios
3. ❌ EXPO_ACCESS_TOKEN puede no estar configurado en Supabase secrets

### 🔧 SOLUCIONES

#### SOLUCIÓN 1: Crear Cron Job (URGENTE)

Ejecutar en Supabase SQL Editor:

```sql
-- Crear extensión pg_cron si no existe
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Crear cron job que ejecute cada 5 minutos
SELECT cron.schedule(
  'send-scheduled-notifications',
  '*/5 * * * *',
  'SELECT net.http_post(
    url := ''https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/send-scheduled-notifications'',
    headers := jsonb_build_object(
      ''Authorization'', ''Bearer <SERVICE_ROLE_KEY>'',
      ''Content-Type'', ''application/json''
    ),
    body := jsonb_build_object()
  ) as request_id;'
);
```

**O alternativa más simple:**

```sql
-- Crear tabla de configuración de cron
CREATE TABLE IF NOT EXISTS cron_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_name TEXT UNIQUE,
  schedule TEXT NOT NULL,
  function_name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- Insertar el cron job
INSERT INTO cron_jobs (job_name, schedule, function_name)
VALUES ('send-notifications', '*/5 * * * *', 'send-scheduled-notifications')
ON CONFLICT (job_name) DO UPDATE SET active = true;
```

#### SOLUCIÓN 2: Verificar tokens de push en usuarios

```sql
-- Ver usuarios sin tokens
SELECT 
  id,
  email,
  display_name,
  fcm_token,
  push_token,
  updated_at
FROM profiles
WHERE fcm_token IS NULL AND push_token IS NULL
LIMIT 20;

-- Ver estadísticas
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE fcm_token IS NOT NULL) as with_fcm,
  COUNT(*) FILTER (WHERE push_token IS NOT NULL) as with_legacy,
  COUNT(*) FILTER (WHERE fcm_token IS NULL AND push_token IS NULL) as without_token
FROM profiles;
```

#### SOLUCIÓN 3: Configurar EXPO_ACCESS_TOKEN en Supabase

1. Ir a Supabase Dashboard → Project Settings → Edge Functions Secrets
2. Agregar:
   - `EXPO_ACCESS_TOKEN`: Token de Expo Push Service
   - `SUPABASE_SERVICE_ROLE_KEY`: Already should exist

#### SOLUCIÓN 4: Verificar que los usuarios registren tokens en login

En `NotificationContext.tsx`, verificar que `registerForPushNotifications()` se llama:

```typescript
// En el useEffect de login:
const token = await registerForPushNotifications();
if (token) {
  // Guardar token en profiles
  await supabaseClient
    .from('profiles')
    .update({ fcm_token: token })
    .eq('id', userId);
}
```

### 🧪 Prueba Rápida

1. **Crear orden de prueba y cambiar status**
2. **Verificar `scheduled_notifications`:**
   ```sql
   SELECT * FROM scheduled_notifications 
   WHERE notification_type = 'order_status_change' 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
3. **Ejecutar manualmente `send-scheduled-notifications`:**
   ```bash
   curl -X POST https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/send-scheduled-notifications \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json"
   ```
4. **Verificar status de notificaciones:**
   ```sql
   SELECT status, COUNT(*) FROM scheduled_notifications 
   GROUP BY status;
   ```

### 📊 Resumen

| Componente | Estado | Acción |
|-----------|--------|--------|
| Trigger | ✅ OK | Ninguna |
| Función de notificación | ✅ OK | Ninguna |
| Tabla de notificaciones | ✅ OK | Limpiar old records |
| **Cron Job** | ❌ FALTA | **Crear urgentemente** |
| Tokens de push | ❓ Verificar | Revisar usuarios |
| Secrets FCM | ❓ Verificar | Configurar si falta |

### 🎯 Próximos Pasos

1. **URGENTE**: Crear cron job para ejecutar `send-scheduled-notifications`
2. Verificar que usuarios tienen tokens de push registrados
3. Configurar `EXPO_ACCESS_TOKEN` en Supabase secrets
4. Ejecutar prueba de envío manual
5. Monitorear logs de la función
