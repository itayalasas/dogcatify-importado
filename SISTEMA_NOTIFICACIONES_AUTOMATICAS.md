# Sistema de Notificaciones Automáticas

Sistema completo de notificaciones push programadas para recordatorios de reservas y cambios de estado de órdenes.

## 🎯 Funcionalidades

### 1. Recordatorios de Reservas (24h antes)
- ✅ Se crea automáticamente cuando se confirma el pago de una reserva
- ✅ Notifica al usuario 24 horas antes de la cita
- ✅ Incluye detalles: servicio, mascota, hora, lugar
- ✅ Se cancela automáticamente si se cancela la reserva

### 2. Cambios de Estado de Órdenes
- ✅ Notifica inmediatamente cuando cambia el estado de un pedido
- ✅ Estados notificados:
  - `confirmed` - Pedido confirmado
  - `preparing` - Preparando tu pedido
  - `ready` - Pedido listo para enviar
  - `shipped` - Pedido en camino
  - `delivered` - Pedido entregado
  - `completed` - Pedido completado
  - `cancelled` - Pedido cancelado

## 🗄️ Estructura de Base de Datos

### Tabla: `scheduled_notifications`

```sql
- id (uuid) - Identificador único
- user_id (uuid) - Usuario destinatario
- notification_type (text) - 'booking_reminder' o 'order_status_change'
- reference_id (uuid) - ID de la reserva u orden
- reference_type (text) - 'booking' o 'order'
- title (text) - Título de la notificación
- body (text) - Mensaje
- data (jsonb) - Datos adicionales para deep linking
- scheduled_for (timestamptz) - Cuándo enviar
- sent_at (timestamptz) - Cuándo se envió (null si pendiente)
- status (text) - 'pending', 'sent', 'failed', 'cancelled'
- error_message (text) - Mensaje de error si falló
- retry_count (integer) - Número de reintentos
- created_at (timestamptz) - Fecha de creación
- updated_at (timestamptz) - Última actualización
```

## ⚙️ Componentes del Sistema

### 1. Triggers Automáticos

**Trigger: `on_booking_confirmed`**
- Se ejecuta cuando `payment_status` cambia a `'approved'` en tabla `bookings`
- Calcula hora de notificación (fecha de reserva - 24h)
- Crea notificación programada automáticamente
- Previene duplicados

**Trigger: `on_order_status_change`**
- Se ejecuta cuando cambia el campo `status` en tabla `orders`
- Crea notificación inmediata según el nuevo estado
- Incluye detalles del pedido en el mensaje

### 2. Edge Function: `send-scheduled-notifications`

**URL:** `https://[tu-proyecto].supabase.co/functions/v1/send-scheduled-notifications`

**Función:**
- Busca notificaciones pendientes cuya hora programada ya pasó
- Obtiene push token del usuario desde tabla `profiles`
- Envía notificación via Expo Push Service
- Actualiza estado de la notificación (sent/failed)
- Implementa sistema de reintentos (máximo 3)
- Procesa hasta 50 notificaciones por ejecución

## 🚀 Configuración del Cron Job

Para que el sistema funcione automáticamente, debes configurar un cron job que ejecute la edge function cada hora.

### Opción 1: cron-job.org (Recomendado - Gratuito)

1. **Crear cuenta** en [cron-job.org](https://cron-job.org)

2. **Crear nuevo cronjob:**
   - Título: `DogCatify - Send Notifications`
   - URL: `https://[tu-proyecto].supabase.co/functions/v1/send-scheduled-notifications`
   - Método: `POST`
   - Schedule: `0 * * * *` (cada hora)

3. **Configurar headers:**
   - `Authorization`: `Bearer [tu-supabase-anon-key]`
   - `Content-Type`: `application/json`

4. **Guardar y activar**

### Opción 2: EasyCron

1. **Crear cuenta** en [EasyCron](https://www.easycron.com)

2. **Add Cron Job:**
   - URL: `https://[tu-proyecto].supabase.co/functions/v1/send-scheduled-notifications`
   - Cron Expression: `0 * * * *`
   - HTTP Method: `POST`
   - HTTP Headers:
     ```
     Authorization: Bearer [tu-anon-key]
     Content-Type: application/json
     ```

3. **Enable y Save**

### Opción 3: GitHub Actions (Para proyectos en GitHub)

Crear `.github/workflows/send-notifications.yml`:

```yaml
name: Send Scheduled Notifications

on:
  schedule:
    - cron: '0 * * * *'  # Cada hora
  workflow_dispatch:  # Permitir ejecución manual

jobs:
  send-notifications:
    runs-on: ubuntu-latest
    steps:
      - name: Send notifications
        run: |
          curl -X POST \\
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \\
            -H "Content-Type: application/json" \\
            https://[tu-proyecto].supabase.co/functions/v1/send-scheduled-notifications
```

### Opción 4: Supabase Cron (Próximamente)

Cuando Supabase implemente cron jobs nativos, puedes usar:

```sql
SELECT cron.schedule(
  'send-notifications',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://[tu-proyecto].supabase.co/functions/v1/send-scheduled-notifications',
    headers := '{"Authorization": "Bearer [service-role-key]"}'::jsonb
  );
  $$
);
```

## 🧪 Probar el Sistema

### 1. Ejecutar script de prueba

```bash
node scripts/test-notification-system.js
```

Este script verifica:
- ✅ Acceso a tabla de notificaciones
- ✅ Triggers funcionando
- ✅ Notificaciones pendientes
- ✅ Historial de notificaciones enviadas

### 2. Probar manualmente la edge function

```bash
curl -X POST \\
  -H "Authorization: Bearer [tu-anon-key]" \\
  -H "Content-Type: application/json" \\
  https://[tu-proyecto].supabase.co/functions/v1/send-scheduled-notifications
```

### 3. Simular una reserva

1. Crear una reserva de prueba en la app
2. Confirmar el pago (payment_status = 'approved')
3. Verificar que se creó la notificación:

```sql
SELECT * FROM scheduled_notifications
WHERE notification_type = 'booking_reminder'
ORDER BY created_at DESC
LIMIT 1;
```

### 4. Simular cambio de estado de orden

```sql
UPDATE orders
SET status = 'shipped'
WHERE id = '[order-id]';

-- Verificar notificación creada
SELECT * FROM scheduled_notifications
WHERE reference_id = '[order-id]'
AND notification_type = 'order_status_change';
```

## 📊 Monitoreo

### Consultas útiles para monitorear el sistema:

**Ver notificaciones pendientes:**
```sql
SELECT
  notification_type,
  title,
  scheduled_for,
  retry_count
FROM scheduled_notifications
WHERE status = 'pending'
ORDER BY scheduled_for;
```

**Ver notificaciones fallidas:**
```sql
SELECT
  notification_type,
  title,
  error_message,
  retry_count,
  updated_at
FROM scheduled_notifications
WHERE status = 'failed'
ORDER BY updated_at DESC
LIMIT 10;
```

**Estadísticas generales:**
```sql
SELECT
  status,
  COUNT(*) as count,
  notification_type
FROM scheduled_notifications
GROUP BY status, notification_type;
```

**Últimas notificaciones enviadas:**
```sql
SELECT
  title,
  body,
  sent_at,
  notification_type
FROM scheduled_notifications
WHERE status = 'sent'
ORDER BY sent_at DESC
LIMIT 20;
```

## 🔧 Solución de Problemas

### Notificaciones no se crean

1. Verificar que los triggers están activos:
```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name IN ('on_booking_confirmed', 'on_order_status_change');
```

2. Verificar que la reserva cumple requisitos:
   - `payment_status = 'approved'`
   - Fecha de reserva es más de 24h en el futuro

### Notificaciones no se envían

1. Verificar que el usuario tiene push_token:
```sql
SELECT id, push_token FROM profiles WHERE id = '[user-id]';
```

2. Verificar que el cron job está funcionando (revisar logs del servicio)

3. Ejecutar manualmente la edge function para ver errores

### Usuario no recibe notificaciones

1. Verificar que el usuario dio permiso para notificaciones
2. Verificar que el push_token es válido
3. Verificar que la app está correctamente configurada con FCM

## 📝 Notas Importantes

- ✅ Las notificaciones de recordatorio solo se crean si la reserva es >24h en el futuro
- ✅ Los duplicados están prevenidos por constraint único
- ✅ Sistema de reintentos automático (máximo 3 intentos)
- ✅ Las notificaciones canceladas no se reenvían
- ✅ El cron job debe ejecutarse al menos cada hora
- ✅ Procesa máximo 50 notificaciones por ejecución

## 🎨 Personalización

### Modificar mensajes de notificación

Editar funciones en la migración `add_scheduled_notifications_system.sql`:

- `create_booking_reminder_notification()` - Mensajes de recordatorios
- `create_order_status_notification()` - Mensajes de cambios de estado

### Cambiar tiempo de recordatorio

Por defecto es 24h antes. Para cambiar:

```sql
-- En create_booking_reminder_notification()
reminder_time := NEW.date - interval '24 hours';

-- Cambiar a 48h:
reminder_time := NEW.date - interval '48 hours';

-- Cambiar a 2 horas:
reminder_time := NEW.date - interval '2 hours';
```

### Agregar nuevos tipos de notificaciones

1. Agregar nuevo valor al constraint de `notification_type`
2. Crear trigger para el nuevo evento
3. Actualizar edge function si es necesario

## ✅ Checklist de Implementación

- [x] Migración aplicada (`add_scheduled_notifications_system`)
- [x] Edge function desplegada (`send-scheduled-notifications`)
- [ ] Cron job configurado (elegir opción)
- [ ] Script de prueba ejecutado
- [ ] Notificaciones de prueba enviadas
- [ ] Sistema monitoreado por 24-48 horas

## 🆘 Soporte

Si tienes problemas:
1. Ejecutar script de prueba
2. Revisar logs de la edge function en Supabase Dashboard
3. Verificar logs del cron job
4. Revisar consultas de monitoreo SQL
