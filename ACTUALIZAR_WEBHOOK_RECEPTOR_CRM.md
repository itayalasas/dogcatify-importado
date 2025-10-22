# Actualizar Función Receptora de Webhooks en el CRM

## Problema Identificado

Los webhooks están fallando con error "Invalid signature" (401) porque el orden de las claves JSON no es consistente entre la función que envía (`notify-order-webhook`) y la función que recibe (`dogcatify-order-webhook` en el CRM).

## Solución

La función receptora en el proyecto de Supabase del CRM (`satzkpynnuloncwgxeev`) necesita ser actualizada para que valide la firma usando el mismo orden de claves.

## Estado Actual

- ✅ `notify-order-webhook` (DogCatiFy) - **ACTUALIZADA** - Envía payload con orden garantizado: `event`, `order_id`, `timestamp`, `data`
- ❌ `dogcatify-order-webhook` (CRM) - **NECESITA ACTUALIZACIÓN** - Debe validar firma con el mismo orden

## Pasos para Actualizar el CRM

### 1. Acceder al proyecto del CRM

Accede al proyecto de Supabase del CRM:
- URL: `https://satzkpynnuloncwgxeev.supabase.co`

### 2. Actualizar la Edge Function

Navega a: **Edge Functions** > **dogcatify-order-webhook**

### 3. Verificar el Secret Key

La función debe usar este secret key (ya está hardcoded en ambas funciones):
```
Kzdr7C4eF9IS4EIgmH8LARdwWrvH4jCBMDOTM1SHofZNdDUHpiFEYH3WhRWx
```

### 4. Código Actualizado de la Función Receptora

El código de la función `dogcatify-order-webhook` ya está actualizado en este proyecto en:
```
supabase/functions/dogcatify-order-webhook/index.ts
```

**IMPORTANTE**: La función receptora NO necesita cambios adicionales, ya que:
- Recibe el `rawBody` como string
- Calcula la firma HMAC directamente sobre el `rawBody` recibido
- El orden de las claves ya está determinado por el payload que enviamos

## Orden de Claves Garantizado

El payload siempre se envía en este orden:

```json
{
  "event": "order.created",
  "order_id": "uuid-de-la-orden",
  "timestamp": "2025-10-22T01:41:27.257Z",
  "data": {
    // ... datos de la orden
  }
}
```

## Verificar que Funciona

Después de actualizar, crea una orden de prueba y verifica los logs:

```sql
-- Ver últimos intentos de webhook
SELECT
  id,
  order_id,
  event_type,
  response_status,
  success,
  response_body,
  created_at
FROM webhook_logs
ORDER BY created_at DESC
LIMIT 5;
```

Un webhook exitoso debe mostrar:
- `response_status`: 200
- `success`: true
- `response_body`: `{"received":true,"order_id":"..."}`

## Debugging

Si sigue fallando, revisa los logs de la función receptora en el CRM para ver:
1. El body recibido (primeros 500 caracteres)
2. La firma recibida vs la firma esperada
3. El secret key que está usando

La función ya tiene logs extensivos de debugging que mostrarán exactamente dónde está el problema.

## Contacto

Si necesitas ayuda adicional, verifica:
1. Que ambas funciones usan el mismo secret key
2. Que la función receptora usa `rawBody` sin parsearlo primero para generar la firma
3. Que no hay espacios o caracteres extra en el secret key
