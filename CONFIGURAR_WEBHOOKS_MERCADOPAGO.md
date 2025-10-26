# Configuración de Webhooks de Mercado Pago

## Problema Identificado

Las órdenes quedan en estado `pending` porque **Mercado Pago NO está enviando notificaciones al webhook** cuando se completan los pagos.

## Solución: Configurar Webhooks en el Panel de Mercado Pago

### Paso 1: Acceder al Panel de Mercado Pago

1. Ve a: https://www.mercadopago.com.uy/developers/panel
2. Inicia sesión con tu cuenta
3. Selecciona tu aplicación: **DogCatiFy Sandbox**

### Paso 2: Configurar Webhooks

1. En el menú lateral, haz click en **"Webhooks"**
2. Haz click en **"Configurar notificaciones"** o **"+ Crear Webhook"**

### Paso 3: Datos del Webhook

Configura el webhook con estos datos:

**URL del Webhook:**
```
https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/mercadopago-webhook
```

**Eventos a notificar:**
- ✅ **Pagos (Payments)** - `payment`
- ✅ **Merchant Orders** - `merchant_order`

**Versión de la API:**
- Selecciona la última versión disponible (v1)

### Paso 4: Modo Test vs Producción

**IMPORTANTE:** Debes configurar webhooks tanto para:
- **Ambiente de Test** (usando credenciales TEST)
- **Ambiente de Producción** (usando credenciales de producción)

Actualmente estás en **modo TEST**, así que asegúrate de:
1. Estar usando las credenciales de TEST
2. Configurar el webhook en el ambiente de TEST
3. Hacer pruebas con tarjetas de prueba de Mercado Pago

### Paso 5: Verificar Configuración

Una vez configurado, Mercado Pago te mostrará:
- ✅ URL del webhook configurada
- ✅ Eventos suscritos
- ✅ Estado: Activo

Puedes probar el webhook haciendo click en **"Probar webhook"** en el panel.

## Cómo Funciona el Webhook

### Flujo Normal de Pago:

1. **Usuario hace un pago** → Mercado Pago procesa el pago
2. **MP envía notificación** → POST a tu webhook con el `payment_id`
3. **Tu webhook recibe** → Procesa la notificación
4. **Webhook consulta MP API** → Obtiene detalles del pago usando el `payment_id`
5. **Actualiza la orden** → Cambia estado de `pending` a `confirmed`
6. **Envía emails** → Confirma pago al cliente y al partner

### Ejemplo de notificación que MP envía:

```json
{
  "id": 123456789,
  "live_mode": false,
  "type": "payment",
  "date_created": "2025-10-26T07:00:00.000Z",
  "application_id": 1624486229466072,
  "user_id": 1876395148,
  "version": 1,
  "api_version": "v1",
  "action": "payment.created",
  "data": {
    "id": "987654321"  // ← ID del pago en Mercado Pago
  }
}
```

## Verificar que el Webhook Funciona

### 1. Ver Logs en Supabase

Ve a: https://supabase.com/dashboard/project/zkgiwamycbjcogcgqhff/functions/mercadopago-webhook/logs

Deberías ver:
```
Received MP webhook: {...}
Processing payment notification for payment ID: 987654321
Calling MP API: https://api.mercadopago.com/v1/payments/987654321
Payment data from MP: {...}
✅ Order xxx updated to status: confirmed
```

### 2. Verificar Estado de Órdenes

Consulta en tu base de datos:

```sql
SELECT
  id,
  status,
  payment_status,
  payment_id,
  created_at
FROM orders
WHERE status = 'confirmed'
ORDER BY created_at DESC
LIMIT 5;
```

Deberías ver órdenes con:
- `status = 'confirmed'`
- `payment_status = 'approved'`
- `payment_id` con un número válido

### 3. Panel de Mercado Pago

En el panel de MP, ve a:
- **Webhooks** → **Historial de envíos**
- Deberías ver las notificaciones enviadas con estado **200 OK**

## Solución de Problemas

### Las órdenes siguen en pending

**Posibles causas:**

1. **Webhook no configurado**
   - Solución: Sigue los pasos arriba

2. **URL del webhook incorrecta**
   - Verifica que sea exactamente: `https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/mercadopago-webhook`

3. **Eventos no seleccionados**
   - Asegúrate de haber marcado "Payments"

4. **Credenciales TEST no válidas**
   - Regenera tus credenciales TEST en el panel de MP

5. **Ambiente mezclado** (TEST + PROD)
   - Usa SOLO credenciales TEST si estás en sandbox
   - Usa SOLO credenciales PROD si estás en producción

### Ver logs de error

Si el webhook falla, verás en los logs de Supabase:
```
Failed to fetch payment from MP API: 404
MP API Error: payment not found
```

Esto significa que el `payment_id` no existe o las credenciales son incorrectas.

## Tarjetas de Prueba

Para probar pagos en modo TEST, usa estas tarjetas de Mercado Pago Uruguay:

### Pago Aprobado
- **Tarjeta:** 5031 7557 3453 0604
- **CVV:** 123
- **Vencimiento:** 11/25
- **Nombre:** APRO

### Pago Rechazado
- **Tarjeta:** 5031 4332 1540 6351
- **CVV:** 123
- **Vencimiento:** 11/25
- **Nombre:** OTHE

### Pago Pendiente
- **Tarjeta:** 5031 4332 1540 6351
- **CVV:** 123
- **Vencimiento:** 11/25
- **Nombre:** PEND

## Seguridad: Validación de Firma con Clave Secreta

El webhook ahora **valida la firma** de cada notificación usando la **Clave Secreta** de Mercado Pago.

### ¿Por qué es importante?

Sin validación, cualquiera podría enviar notificaciones falsas a tu webhook y confirmar órdenes fraudulentas. La clave secreta garantiza que **solo Mercado Pago** puede enviar notificaciones válidas.

### ¿Cómo funciona?

1. Mercado Pago firma cada notificación con tu clave secreta
2. El webhook recibe headers `x-signature` y `x-request-id`
3. El webhook calcula la firma esperada usando HMAC-SHA256
4. Si las firmas coinciden → ✅ procesa la notificación
5. Si NO coinciden → ❌ rechaza con error 401

### Clave Secreta Configurada

✅ La clave secreta ya está guardada en la base de datos:
```
5225bbcf087d4531d1d9a4f585ff586aae3d8b295180daa3f31d81b1ce7e6fb5
```

**IMPORTANTE:** Esta clave está en la configuración de `admin_settings` en Supabase y se usa automáticamente. NO necesitas configurarla manualmente.

## Resumen

✅ **Webhook desplegado y funcionando** en:
   `https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/mercadopago-webhook`

✅ **Validación de firma implementada** - Solo acepta notificaciones firmadas por Mercado Pago

✅ **Clave secreta configurada** - Protege contra notificaciones fraudulentas

⚠️ **FALTA CONFIGURAR** en el panel de Mercado Pago para que envíe notificaciones

📝 **Próximos pasos:**
1. Configura el webhook en: https://www.mercadopago.com.uy/developers/panel
2. Prueba con una tarjeta de prueba
3. Verifica que la orden cambie a `confirmed`
4. Revisa los logs en Supabase
