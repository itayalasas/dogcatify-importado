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

## Configuración del Cron Job en Supabase

### Opción 1: Configurar desde el Dashboard de Supabase (Recomendado)

1. Ve al Dashboard de Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Database** → **Extensions**
4. Busca y habilita la extensión **pg_cron**
5. Ve a **SQL Editor**
6. Ejecuta el siguiente script SQL:

```sql
-- Habilitar la extensión pg_cron si no está habilitada
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Crear el cron job para ejecutar cada 2 minutos
SELECT cron.schedule(
  'cancel-expired-orders',           -- Nombre del job
  '*/2 * * * *',                     -- Cada 2 minutos
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/cancel-expired-orders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
```

7. Configura las variables de entorno necesarias:

```sql
-- Configurar la URL de Supabase (reemplaza con tu URL)
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://[TU-PROYECTO].supabase.co';

-- Configurar el service role key (reemplaza con tu clave)
ALTER DATABASE postgres SET app.settings.service_role_key = '[TU-SERVICE-ROLE-KEY]';
```

### Opción 2: Usar un Servicio Externo de Cron (Alternativa)

Si prefieres usar un servicio externo, puedes usar:

#### A) Usando cron-job.org (Gratis)

1. Ve a https://cron-job.org
2. Crea una cuenta
3. Crea un nuevo cron job con:
   - **URL**: `https://[TU-PROYECTO].supabase.co/functions/v1/cancel-expired-orders`
   - **Método**: POST
   - **Headers**:
     ```
     Authorization: Bearer [TU-SERVICE-ROLE-KEY]
     Content-Type: application/json
     ```
   - **Frecuencia**: Cada 2 minutos

#### B) Usando EasyCron (Gratis hasta 250 jobs/día)

1. Ve a https://www.easycron.com
2. Registrate y crea un cron job
3. Configura:
   - **URL**: `https://[TU-PROYECTO].supabase.co/functions/v1/cancel-expired-orders`
   - **Cron Expression**: `*/2 * * * *` (cada 2 minutos)
   - **Method**: POST
   - **Custom Headers**:
     ```
     Authorization: Bearer [TU-SERVICE-ROLE-KEY]
     Content-Type: application/json
     ```

### Opción 3: Usar Supabase Edge Function con Deno Deploy Cron

Si estás usando Deno Deploy, puedes configurar un cron en el archivo `deno.json`:

```json
{
  "tasks": {
    "cron:cancel-orders": "deno run --allow-net --allow-env cancel-expired-orders-cron.ts"
  },
  "cron": {
    "cancel-expired-orders": {
      "schedule": "*/2 * * * *",
      "handler": "cancel-expired-orders-cron.ts"
    }
  }
}
```

## Verificar que el Cron está Funcionando

### Ver logs del cron job (si usas pg_cron)

```sql
-- Ver el historial de ejecuciones
SELECT * FROM cron.job_run_details
WHERE jobname = 'cancel-expired-orders'
ORDER BY start_time DESC
LIMIT 10;

-- Ver los cron jobs configurados
SELECT * FROM cron.job;
```

### Probar la función manualmente

Puedes probar la función haciendo una llamada HTTP directa:

```bash
curl -X POST \
  https://[TU-PROYECTO].supabase.co/functions/v1/cancel-expired-orders \
  -H "Authorization: Bearer [TU-SERVICE-ROLE-KEY]" \
  -H "Content-Type: application/json"
```

## Monitoreo

### Ver órdenes canceladas en la base de datos

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

### Ver reservas canceladas

```sql
-- Ver reservas canceladas recientemente
SELECT
  b.id,
  b.created_at,
  b.updated_at,
  b.status,
  b.service_name,
  b.customer_email,
  b.date,
  b.time
FROM bookings b
WHERE b.status = 'cancelled'
  AND b.updated_at > NOW() - INTERVAL '1 hour'
ORDER BY b.updated_at DESC;
```

## Desactivar el Cron Job (si es necesario)

Si necesitas desactivar temporalmente la cancelación automática:

### Si usas pg_cron:

```sql
-- Desactivar el job
SELECT cron.unschedule('cancel-expired-orders');

-- Para reactivarlo, vuelve a ejecutar el script de configuración
```

### Si usas un servicio externo:
- Simplemente pausa o elimina el cron job desde el panel del servicio

## Notas Importantes

⚠️ **Importante**: El cron job ejecuta cada 2 minutos, pero solo cancela órdenes con más de 10 minutos. Esto significa:
- Una orden creada a las 10:00 AM será cancelada aproximadamente a las 10:10-10:12 AM
- El horario permanece bloqueado durante esos 10 minutos para dar tiempo al usuario de completar el pago

🔐 **Seguridad**: Nunca expongas tu Service Role Key públicamente. Solo úsala en el backend o en configuraciones seguras.

📊 **Rendimiento**: La función está optimizada para manejar múltiples órdenes expiradas en una sola ejecución.

## Frecuencia Recomendada

- **Cada 2 minutos** (configuración actual): Balance óptimo entre respuesta rápida y uso de recursos
- **Cada 5 minutos**: Si quieres reducir el uso de recursos
- **Cada minuto**: Solo si necesitas liberación inmediata de horarios (mayor consumo)

## Solución de Problemas

### La función no está cancelando órdenes

1. Verifica que el cron job esté configurado correctamente
2. Revisa los logs de la función en Supabase Dashboard → Edge Functions → Logs
3. Verifica que las variables de entorno estén configuradas

### Mercado Pago muestra errores

Esto es normal si el usuario no inició el pago. La función continuará cancelando la orden y liberando el horario de todas formas.

### Los horarios no se liberan

Verifica que la función `fetchExistingBookings` en el código cliente esté filtrando correctamente los estados `cancelled`.
