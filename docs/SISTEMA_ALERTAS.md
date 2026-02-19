# Sistema de Alertas de Seguridad

## 🚨 Descripción

El sistema de alertas monitorea automáticamente la tabla `audit_logs` y envía notificaciones por email cuando detecta patrones sospechosos o problemas críticos.

## Arquitectura

```
┌──────────────────────────────────────────────────────┐
│             Cron Job (cada 15 minutos)               │
└───────────────────┬──────────────────────────────────┘
                    │
         ┌──────────▼──────────┐
         │   Edge Function     │
         │ check-alert-        │
         │  thresholds         │
         └──────────┬──────────┘
                    │
     ┌──────────────┴──────────────┐
     │                             │
┌────▼─────┐              ┌────────▼────────┐
│audit_logs│◄─────────────┤ Revisa umbrales │
│  table   │              └────────┬────────┘
└──────────┘                       │
                          ┌────────▼────────┐
                          │ ¿Umbral         │
                          │ excedido?       │
                          └────────┬────────┘
                                   │
                         Sí        │        No
                          ┌────────▼────────┐
                          │  send-email     │
                          │  (alerta admin) │
                          └─────────────────┘
```

## Umbrales de Alerta

### 1. Intentos Fallidos de Login

**Umbral:** 5 fallos en 10 minutos

**Descripción:** Detecta posibles ataques de fuerza bruta.

**Acción:** LOGIN_FAILED

**Email enviado:**
```
🚨 Alerta de Seguridad: LOGIN_FAILED

Eventos detectados: 5 en los últimos 10 minutos
Fecha: 07/02/2026 14:30:00

Últimos eventos:
- LOGIN_FAILED - user@example.com - 14:25
- LOGIN_FAILED - user@example.com - 14:26
- LOGIN_FAILED - user@example.com - 14:27
...
```

### 2. Pagos Fallidos

**Umbral:** 10 fallos en 30 minutos

**Descripción:** Detecta problemas con el sistema de pagos.

**Acción:** PAYMENT_FAILED

### 3. Errores del Sistema

**Umbral:** 20 errores en 10 minutos

**Descripción:** Detecta problemas críticos del sistema.

**Acción:** ERROR

### 4. Errores de API

**Umbral:** 15 errores en 15 minutos

**Descripción:** Detecta problemas con APIs externas.

**Acción:** API_ERROR

## Configuración

### 1. Umbral Personalizado

Edita el archivo `supabase/functions/check-alert-thresholds/index.ts`:

```typescript
const ALERT_THRESHOLDS: AlertThreshold[] = [
  {
    type: "LOGIN_FAILED",
    count: 5,                    // ← Número de eventos
    timeWindowMinutes: 10,       // ← Ventana de tiempo
    message: "Múltiples intentos fallidos de login detectados"
  },
  // Agregar nuevos umbrales aquí
  {
    type: "BOOKING_CANCEL",
    count: 20,
    timeWindowMinutes: 60,
    message: "Alto número de cancelaciones de reservas"
  }
];
```

### 2. Frecuencia del Cron Job

Edita el cron job en Supabase:

```sql
-- Cambiar de cada 15 minutos a cada 5 minutos
SELECT cron.schedule(
  'check-security-alerts',
  '*/5 * * * *',  -- ← Cambia aquí (*/5 = cada 5 min)
  $$...$$
);
```

### 3. Destinatario del Email

Las alertas se envían al primer admin encontrado:

```sql
SELECT email FROM profiles WHERE role = 'admin' LIMIT 1;
```

Para cambiar a múltiples destinatarios, edita la función `sendAlertEmail()` en `check-alert-thresholds/index.ts`.

## Instalación

### Paso 1: Desplegar la función

```bash
supabase functions deploy check-alert-thresholds --project-ref hpvzjuionqvgxlvhyqgz
```

### Paso 2: Configurar Cron Job

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'check-security-alerts',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://hpvzjuionqvgxlvhyqgz.supabase.co/functions/v1/check-alert-thresholds',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Paso 3: Verificar

```bash
# Ejecutar manualmente
curl -X POST https://hpvzjuionqvgxlvhyqgz.supabase.co/functions/v1/check-alert-thresholds \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"

# Ver resultado
{
  "success": true,
  "alerts": [],
  "message": "No alerts triggered. System operating normally."
}
```

## Monitoreo

### Ver cron jobs activos

```sql
SELECT * FROM cron.job WHERE jobname = 'check-security-alerts';
```

### Ver historial de ejecuciones

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'check-security-alerts'
)
ORDER BY start_time DESC
LIMIT 10;
```

### Ver alertas registradas

```sql
SELECT 
  created_at,
  details->>'alert_type' as tipo,
  details->>'event_count' as eventos,
  details->>'threshold' as umbral,
  details->>'time_window' as ventana_minutos
FROM audit_logs
WHERE action = 'SECURITY_ALERT'
ORDER BY created_at DESC;
```

## Desactivar Alertas

### Temporalmente

```sql
-- Pausar cron job
SELECT cron.unschedule('check-security-alerts');
```

### Permanentemente

```sql
-- Eliminar cron job
SELECT cron.unschedule('check-security-alerts');

-- Opcional: Eliminar la función
-- No recomendado si planeas reactivarla
```

## Alertas Personalizadas

### Ejemplo: Alerta de Cancelaciones Masivas

```typescript
// En check-alert-thresholds/index.ts
const ALERT_THRESHOLDS: AlertThreshold[] = [
  // ... umbrales existentes
  {
    type: "BOOKING_CANCEL",
    count: 20,
    timeWindowMinutes: 60,
    message: "Alto número de cancelaciones detectado - posible problema con el servicio"
  }
];
```

### Ejemplo: Alerta de Acceso Admin

```typescript
{
  type: "ADMIN_ACCESS",
  count: 50,
  timeWindowMinutes: 60,
  message: "Múltiples accesos admin - verificar actividad"
}
```

### Ejemplo: Alerta de Cambios de Configuración

```typescript
{
  type: "SETTINGS_CHANGE",
  count: 10,
  timeWindowMinutes: 30,
  message: "Múltiples cambios en configuración - revisión recomendada"
}
```

## Integraciones

### Slack (futuro)

```typescript
// Agregar en sendAlertEmail()
async function sendSlackAlert(alertType: string, count: number) {
  const webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
  
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `🚨 Alerta: ${alertType}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${count}* eventos detectados`
          }
        }
      ]
    })
  });
}
```

### Telegram (futuro)

```typescript
async function sendTelegramAlert(alertType: string, count: number) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `🚨 Alerta: ${alertType}\n${count} eventos detectados`
    })
  });
}
```

## Troubleshooting

### Las alertas no se envían

1. **Verificar que el cron job está activo:**
```sql
SELECT * FROM cron.job WHERE jobname = 'check-security-alerts';
```

2. **Verificar últimas ejecuciones:**
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'check-security-alerts')
ORDER BY start_time DESC LIMIT 5;
```

3. **Verificar logs de la función:**
   - Ir a Dashboard de Supabase
   - Edge Functions → check-alert-thresholds → Logs

4. **Verificar que existe un admin:**
```sql
SELECT * FROM profiles WHERE role = 'admin';
```

### Los emails no llegan

1. **Verificar función send-email:**
```bash
supabase functions list
```

2. **Probar envío manual:**
```bash
curl -X POST https://hpvzjuionqvgxlvhyqgz.supabase.co/functions/v1/send-email \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_email": "admin@example.com",
    "subject": "Test",
    "html": "<h1>Test</h1>"
  }'
```

3. **Revisar spam:** Los emails pueden ir a spam la primera vez

### Demasiadas alertas

Ajusta los umbrales:

```typescript
// En check-alert-thresholds/index.ts
{
  type: "LOGIN_FAILED",
  count: 10,              // ← Aumenta de 5 a 10
  timeWindowMinutes: 20,  // ← Aumenta de 10 a 20
  message: "..."
}
```

### Muy pocas alertas

Reduce los umbrales:

```typescript
{
  type: "LOGIN_FAILED",
  count: 3,               // ← Reduce de 5 a 3
  timeWindowMinutes: 5,   // ← Reduce de 10 a 5
  message: "..."
}
```

## Mejores Prácticas

1. **Revisa las alertas regularmente** en el panel de seguridad
2. **Ajusta los umbrales** según el volumen de tu plataforma
3. **No ignores alertas repetidas** - investiga la causa raíz
4. **Mantén actualizada la lista de admins** que reciben alertas
5. **Documenta acciones tomadas** después de cada alerta

## Métricas

### Alertas por tipo (último mes)

```sql
SELECT 
  details->>'alert_type' as tipo_alerta,
  COUNT(*) as total_alertas,
  AVG((details->>'event_count')::int) as promedio_eventos
FROM audit_logs
WHERE action = 'SECURITY_ALERT'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY details->>'alert_type'
ORDER BY total_alertas DESC;
```

### Tiempo de respuesta

```sql
-- Alertas sin resolver (sin acción admin posterior)
SELECT 
  created_at,
  details->>'alert_type' as tipo,
  details->>'event_count' as eventos
FROM audit_logs
WHERE action = 'SECURITY_ALERT'
  AND NOT EXISTS (
    SELECT 1 FROM audit_logs al2
    WHERE al2.action = 'ADMIN_ACCESS'
    AND al2.created_at > audit_logs.created_at
    AND al2.created_at < audit_logs.created_at + INTERVAL '1 hour'
  )
ORDER BY created_at DESC;
```

---

**Última actualización:** 2026-02-07  
**Versión:** 1.0  
**Estado:** ✅ Activo en producción
