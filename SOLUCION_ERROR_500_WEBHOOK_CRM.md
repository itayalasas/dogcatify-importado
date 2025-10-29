# Solución Error 500 en Webhook del CRM

## Problema Identificado

El webhook está enviando datos correctamente a la URL del CRM, pero está recibiendo un error 500 con el mensaje:

```json
{
  "error": "Internal server error",
  "message": "Error desconocido"
}
```

## Cambios Realizados en DogCatiFy

### 1. Fix del shipping_cost

**Problema:** El campo `shipping_cost` no se estaba guardando en la base de datos, siempre se enviaba como 0.

**Solución:** Se agregó `shipping_cost: totalShippingCost` en el `orderData` en `/utils/mercadoPago.ts` línea 577.

```typescript
const orderData = {
  // ... otros campos
  shipping_cost: totalShippingCost,  // ✅ AGREGADO
  total_amount: totalAmount,
  // ... otros campos
};
```

**Resultado:** Ahora el webhook enviará el shipping_cost correcto:

```json
{
  "data": {
    "totals": {
      "shipping_cost": 500,  // ✅ Ahora muestra el valor correcto
      "shipping_iva_amount": 0
    },
    "shipping_info": {
      "shipping_cost": 500,  // ✅ Ahora muestra el valor correcto
      "shipping_iva_amount": 0,
      "shipping_total": 500,
      "shipping_address": "..."
    }
  }
}
```

### 2. Estructura del Webhook Actualizada (V2)

El webhook ahora envía un array de partners con información completa:

```json
{
  "data": {
    "partners": [
      {
        "id": "uuid",
        "business_name": "Nombre del negocio",
        "commission_percentage": 5.0,
        "commission_amount": 11.50,
        "partner_amount": 218.50,
        "items": [ /* productos del partner */ ]
      }
    ]
  }
}
```

## Posibles Causas del Error 500 en el CRM

El CRM está retornando error 500 "Error desconocido". Esto puede ser causado por:

### 1. El CRM no está actualizado para la nueva estructura

**Síntomas:**
- El webhook anterior funcionaba
- Después de actualizar la estructura a V2 (con array de partners), empezó a fallar

**Solución:**
El equipo del CRM debe actualizar su código para manejar el nuevo formato. Ver el documento `FORMATO_JSON_WEBHOOK_CRM_V2.md` para la estructura completa.

### 2. El CRM espera campos obligatorios que faltan

**Posibles campos faltantes:**
- ¿El CRM espera algún campo adicional en `partners[]`?
- ¿Hay validaciones de formato específicas?
- ¿Se requieren campos adicionales en `customer` o `payment_info`?

**Recomendación:**
Revisar los logs del CRM para ver el error específico.

### 3. Problema con los datos nulos

**Áreas a revisar:**
```json
{
  "payment_info": {
    "payment_id": null,        // ← Puede causar problema si CRM espera string
    "payment_status": null,    // ← Puede causar problema si CRM espera string
    "payment_preference_id": null
  },
  "booking_info": null         // ← Puede causar problema si CRM espera object
}
```

**Solución:**
Si el CRM no maneja nulls correctamente, podríamos cambiar a strings vacíos u omitir los campos.

### 4. Problema con el tipo de datos numéricos

**Ejemplo:**
```json
{
  "commission_percentage": 5.0,    // ← ¿Debe ser string "5.0"?
  "commission_amount": 11.5,       // ← ¿Debe ser "11.50"?
  "shipping_cost": 500             // ← ¿Debe ser "500.00"?
}
```

## Cómo Diagnosticar

### Paso 1: Verificar logs del CRM

El equipo del CRM debe revisar sus logs de errores para ver:
- Stack trace del error
- Qué campo o validación está fallando
- Mensaje de error específico

### Paso 2: Verificar el payload recibido

En DogCatiFy, el payload completo se guarda en `webhook_logs.payload`. Ejemplo:

```sql
SELECT payload
FROM webhook_logs
WHERE order_id = 'uuid-de-la-orden'
ORDER BY created_at DESC
LIMIT 1;
```

### Paso 3: Probar con datos de prueba

El equipo del CRM puede usar este endpoint para probar:

```bash
POST https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/notify-order-webhook
Content-Type: application/json
Authorization: Bearer YOUR_ANON_KEY

{
  "order_id": "uuid-de-una-orden-existente",
  "event_type": "order.created"
}
```

### Paso 4: Validar la firma HMAC

El webhook incluye una firma HMAC-SHA256 en el header `X-DogCatiFy-Signature`.

**Código de ejemplo para validar:**

```javascript
const crypto = require('crypto');

function validateSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return signature === expectedSignature;
}

// En el endpoint del CRM
const receivedSignature = req.headers['x-dogcatify-signature'];
const payloadString = JSON.stringify(req.body);
const isValid = validateSignature(payloadString, receivedSignature, 'TU_SECRET_KEY');

if (!isValid) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

## Ejemplo de Payload Completo que se Envía

```json
{
  "data": {
    "id": "08254bb3-7792-4138-9df3-a268e343d335",
    "status": "confirmed",
    "order_type": "product_purchase",
    "payment_method": "mercadopago",
    "customer": {
      "id": "8b0ac28e-1095-4b66-bb4a-181128870e85",
      "display_name": "Lemuel Hernandez",
      "email": "lemuelhernandez881@gmail.com",
      "phone": "206362565",
      "calle": "Benigno paiva",
      "numero": "1165",
      "barrio": "Buceo",
      "codigo_postal": "11600",
      "location": null
    },
    "partners": [
      {
        "id": "27a89e1b-0884-4eed-ad9b-c56a01ac7b2f",
        "business_name": "Mascota Feliz",
        "email": "lemuelhernandez881@gmail.com",
        "phone": "23695236",
        "rut": "79293998-7",
        "calle": "Nicaragua",
        "numero": "1880",
        "barrio": "Villa Muñoz",
        "codigo_postal": "11800",
        "commission_percentage": 5,
        "is_primary": true,
        "items": [
          {
            "id": "1b33264c-2505-4ac2-9e82-8613ce9a42bd",
            "name": "Collar antipulgaa",
            "image": "https://...",
            "price": 230,
            "quantity": 1,
            "subtotal": 188.52,
            "iva_rate": 22,
            "iva_amount": 41.48,
            "currency": "UYU",
            "currency_code_dgi": "858",
            "original_price": 230,
            "discount_percentage": 0,
            "partnerId": "27a89e1b-0884-4eed-ad9b-c56a01ac7b2f",
            "partnerName": "Mascota Feliz"
          }
        ],
        "subtotal": 230,
        "iva_amount": 41.48,
        "commission_amount": 11.5,
        "partner_amount": 218.5,
        "total": 230
      }
    ],
    "totals": {
      "subtotal": 188.52,
      "iva_amount": 41.48,
      "iva_rate": 22,
      "iva_included_in_price": true,
      "shipping_cost": 500,
      "shipping_iva_amount": 0,
      "total_commission": 36.5,
      "total_partner_amount": 693.5,
      "total_amount": 730,
      "total_partners": 1
    },
    "shipping_info": {
      "shipping_cost": 500,
      "shipping_iva_amount": 0,
      "shipping_total": 500,
      "shipping_address": "Benigno paiva 1165, Buceo, Montevideo - CP: 11600 - Tel: 206362565"
    },
    "payment_info": {
      "payment_id": "131665370972",
      "payment_status": "approved",
      "payment_method": "mercadopago",
      "payment_preference_id": null
    },
    "booking_info": null,
    "created_at": "2025-10-29T04:25:26.55+00:00",
    "updated_at": "2025-10-29T04:25:42.739+00:00"
  },
  "event": "order.updated",
  "order_id": "08254bb3-7792-4138-9df3-a268e343d335",
  "timestamp": "2025-10-29T04:25:44.033Z"
}
```

## Recomendaciones para el Equipo del CRM

1. **Actualizar el endpoint** para manejar el nuevo formato con array de `partners`
2. **Agregar logging detallado** para identificar qué está causando el error 500
3. **Validar la firma HMAC** para asegurar que las peticiones vienen de DogCatiFy
4. **Manejar campos null** correctamente (payment_id, booking_info, etc.)
5. **Retornar errores descriptivos** en lugar de "Error desconocido"

## Formato de Respuesta Esperado del CRM

### Respuesta Exitosa (200)
```json
{
  "success": true,
  "message": "Webhook procesado correctamente",
  "order_id": "uuid"
}
```

### Respuesta con Error (4xx o 5xx)
```json
{
  "error": "ValidationError",
  "message": "El campo 'partners[0].rut' es requerido",
  "details": {
    "field": "partners[0].rut",
    "received": null,
    "expected": "string"
  }
}
```

## Próximos Pasos

1. ✅ **COMPLETADO:** Fix del shipping_cost en DogCatiFy
2. ⏳ **PENDIENTE:** Equipo del CRM debe revisar sus logs y actualizar el código
3. ⏳ **PENDIENTE:** Coordinar pruebas entre ambos equipos

## Contacto

Para cualquier duda o coordinación de pruebas, contactar al equipo de desarrollo de DogCatiFy.
