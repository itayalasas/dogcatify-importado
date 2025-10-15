# Configuración de Cancelación Automática de Órdenes

## Descripción

Esta configuración permite cancelar automáticamente las órdenes de reserva que no se han confirmado después de 10 minutos. El sistema:

1. ✅ **Bloquea horarios inmediatamente** cuando se crea una reserva con estado `pending_payment`
2. ⏰ **Cancela automáticamente** órdenes que llevan más de 10 minutos sin confirmar
3. 🔄 **Libera el horario** para que otros usuarios puedan reservar
4. 💳 **Cancela el pago en Mercado Pago** si existe un pago pendiente

## Función Desplegada

✅ La Edge Function `cancel-expired-orders` ya está desplegada en Supabase

**URL de la función:**
```
https://[TU-PROYECTO].supabase.co/functions/v1/cancel-expired-orders
```

---

## Paso 1: Configurar Token Secreto (OBLIGATORIO)

La función está protegida con un token secreto personalizado para evitar accesos no autorizados.

### Generar un Token Secreto

Genera un token seguro aleatorio. Puedes usar uno de estos métodos:

**Opción A: Usando openssl (Linux/Mac)**
```bash
openssl rand -base64 32
```

**Opción B: Usando Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Opción C: Online**
Ve a https://www.random.org/strings/ y genera una cadena de 32 caracteres.

**Ejemplo de token generado:**
```
mT8xK9pQ2wR5yN3jL7vB4hF6gD1sA0cE
```

### Configurar el Secret en Supabase

1. Ve al Dashboard de Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Project Settings** → **Edge Functions**
4. En la sección **Secrets**, agrega un nuevo secret:
   - **Name**: `CRON_SECRET`
   - **Value**: [Tu token generado]
5. Haz clic en **Add Secret**

**IMPORTANTE:** Guarda este token en un lugar seguro, lo necesitarás para configurar el cron job.

---

## Paso 2: Configurar el Cron Job

### Opción A: Usando cron-job.org (Recomendado - GRATIS)

#### 1. Crear cuenta en cron-job.org

Ve a https://cron-job.org y crea una cuenta gratuita.

#### 2. Crear un nuevo Cron Job

Haz clic en "Create cronjob" y configura lo siguiente:

**Title:**
```
DogCatify - Cancelar Órdenes Expiradas
```

**URL:**
```
https://[TU-PROYECTO-ID].supabase.co/functions/v1/cancel-expired-orders
```

Reemplaza `[TU-PROYECTO-ID]` con tu ID real de Supabase. Ejemplo:
```
https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/cancel-expired-orders
```

**Request Method:**
```
POST
```

**Request Headers:**

Haz clic en "Add header" y agrega estos dos headers:

**Header 1:**
- Name: `X-Cron-Secret`
- Value: `[TU-TOKEN-SECRETO]`

Ejemplo:
```
X-Cron-Secret: mT8xK9pQ2wR5yN3jL7vB4hF6gD1sA0cE
```

**Header 2:**
- Name: `Content-Type`
- Value: `application/json`

**Request Body:**
Deja vacío o pon:
```json
{}
```

**Schedule:**
- Selecciona: **Every 10 minutes**
- O usa cron expression: `*/10 * * * *`

#### 3. Guardar y Activar

1. Haz clic en "Create cronjob"
2. Activa el job usando el toggle
3. Haz clic en "Test run" para verificar que funciona

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "No expired orders found",
  "cancelledCount": 0
}
```

---

### Opción B: Usando pg_cron (Dentro de Supabase)

Si prefieres que el cron job se ejecute directamente desde la base de datos:

#### 1. Habilitar pg_cron

1. Ve a **Database** → **Extensions**
2. Busca y habilita **pg_cron**

#### 2. Ejecutar Script SQL

Ve a **SQL Editor** y ejecuta:

```sql
-- Habilitar la extensión pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Configurar variables
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://[TU-PROYECTO].supabase.co';
ALTER DATABASE postgres SET app.settings.cron_secret = '[TU-TOKEN-SECRETO]';

-- Crear el cron job para ejecutar cada 10 minutos
SELECT cron.schedule(
  'cancel-expired-orders',
  '*/10 * * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/cancel-expired-orders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', current_setting('app.settings.cron_secret')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
```

Reemplaza:
- `[TU-PROYECTO]` con tu ID de Supabase
- `[TU-TOKEN-SECRETO]` con el token que generaste

---

## Probar la Configuración

### Probar manualmente con curl

```bash
curl -X POST \
  "https://[TU-PROYECTO].supabase.co/functions/v1/cancel-expired-orders" \
  -H "X-Cron-Secret: [TU-TOKEN-SECRETO]" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "No expired orders found",
  "cancelledCount": 0
}
```

O si hay órdenes para cancelar:
```json
{
  "success": true,
  "message": "Cancelled 2 expired orders",
  "cancelledCount": 2
}
```

**Respuesta con error (token incorrecto):**
```json
{
  "success": false,
  "error": "Unauthorized: Invalid or missing X-Cron-Secret header"
}
```

---

## Verificar que el Cron está Funcionando

### Si usas cron-job.org:

1. Ve a tu dashboard en cron-job.org
2. Haz clic en tu cron job
3. Ve a la pestaña "History"
4. Verifica que las ejecuciones muestran status 200 OK

### Si usas pg_cron:

```sql
-- Ver el historial de ejecuciones
SELECT * FROM cron.job_run_details
WHERE jobname = 'cancel-expired-orders'
ORDER BY start_time DESC
LIMIT 10;

-- Ver los cron jobs configurados
SELECT * FROM cron.job;
```

### Ver órdenes canceladas en la base de datos:

```sql
-- Ver órdenes canceladas recientemente
SELECT
  id,
  created_at,
  updated_at,
  status,
  payment_status,
  order_type
FROM orders
WHERE status = 'cancelled'
  AND updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;
```

---

## Frecuencia Recomendada

- **Cada 10 minutos** (configuración recomendada): Balance óptimo
- **Cada 5 minutos**: Si quieres liberación más rápida de horarios
- **Cada 2 minutos**: Si tienes alto volumen de reservas

---

## Seguridad

### ¿Por qué usar un token secreto?

La función es pública (puede ser llamada desde internet) pero está protegida con un token secreto que solo tú conoces. Esto previene:

- ❌ Llamadas no autorizadas
- ❌ Abuso del servicio
- ❌ Cancelaciones maliciosas

### ¿Es seguro el token en cron-job.org?

Sí, los headers de cron-job.org son privados y no se exponen públicamente.

### ¿Debo rotar el token?

Puedes cambiar el token en cualquier momento:

1. Genera un nuevo token
2. Actualiza el secret en Supabase (Project Settings → Edge Functions)
3. Actualiza el header en cron-job.org

---

## Solución de Problemas

### Error 401 Unauthorized

**Causa:** Token secreto incorrecto o faltante

**Solución:**
1. Verifica que configuraste el secret `CRON_SECRET` en Supabase
2. Verifica que el header `X-Cron-Secret` en cron-job.org tiene el valor correcto
3. Asegúrate de que no hay espacios extra en el token

### La función no cancela órdenes

**Verificar:**
1. El cron job está activo y ejecutándose
2. Hay órdenes con más de 10 minutos en estado pending
3. Los logs de la función en Supabase Dashboard → Edge Functions → Logs

### Mercado Pago muestra errores

Esto es normal si el usuario no inició el pago. La función continuará cancelando la orden de todas formas.

---

## Monitoreo

### Ver logs de la función:

1. Ve a Supabase Dashboard
2. **Edge Functions** → **cancel-expired-orders**
3. Pestaña **Logs**

### Estadísticas SQL:

```sql
-- Contar órdenes canceladas por el cron en las últimas 24 horas
SELECT COUNT(*) as total_canceladas
FROM orders
WHERE status = 'cancelled'
  AND payment_status = 'cancelled'
  AND updated_at > NOW() - INTERVAL '24 hours';

-- Ver horario de las cancelaciones
SELECT
  DATE_TRUNC('hour', updated_at) as hora,
  COUNT(*) as cancelaciones
FROM orders
WHERE status = 'cancelled'
  AND updated_at > NOW() - INTERVAL '24 hours'
GROUP BY hora
ORDER BY hora DESC;
```

---

## Desactivar el Cron Job

### Si usas cron-job.org:
1. Ve a tu dashboard
2. Desactiva el toggle del job
3. O elimínalo completamente

### Si usas pg_cron:
```sql
-- Desactivar el job
SELECT cron.unschedule('cancel-expired-orders');
```

---

## Checklist de Configuración Completa

Antes de terminar, verifica que completaste todos los pasos:

- [ ] Generé un token secreto seguro
- [ ] Configuré el secret `CRON_SECRET` en Supabase
- [ ] Creé el cron job en cron-job.org (o configuré pg_cron)
- [ ] Configuré el header `X-Cron-Secret` correctamente
- [ ] Probé la función manualmente con curl (respuesta 200 OK)
- [ ] Verifiqué que el cron job está ejecutándose (History en cron-job.org)
- [ ] Guardé el token secreto en un lugar seguro

---

## Resumen de la Configuración

**Función:** `cancel-expired-orders`
**URL:** `https://[TU-PROYECTO].supabase.co/functions/v1/cancel-expired-orders`
**Método:** POST
**Headers requeridos:**
- `X-Cron-Secret`: Tu token secreto
- `Content-Type`: application/json

**Frecuencia:** Cada 10 minutos
**Timeout de órdenes:** 10 minutos
**Protección:** Token secreto personalizado

---

¡Listo! Tu sistema de cancelación automática está configurado y funcionando.
