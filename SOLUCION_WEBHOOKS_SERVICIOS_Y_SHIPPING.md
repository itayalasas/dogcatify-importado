# Solución: Webhooks para Servicios y Shipping Cost

## Problemas Identificados

### 1. El `shipping_cost` siempre enviaba 0 al CRM
**Causa:** El campo `shipping_cost` no se estaba guardando en la base de datos al crear órdenes de productos.

**Impacto:** El CRM recibía webhooks con `shipping_cost: 0` aunque el cliente pagara $500 de envío.

### 2. Los servicios no enviaban el formato V2 al CRM
**Causa:** La función `buildPartnersArray` solo funcionaba cuando había `partner_breakdown` (productos), pero las órdenes de servicios no tienen ese campo.

**Impacto:** Los webhooks de servicios enviaban un formato antiguo sin el array `partners` ni `commission_percentage`.

## Soluciones Implementadas

### ✅ Fix 1: Agregar `shipping_cost` al crear órdenes de productos

**Archivo:** `/utils/mercadoPago.ts` línea 577

**Antes:**
```typescript
const orderData = {
  // ... otros campos
  total_amount: totalAmount,
  commission_amount: commissionAmount,
  // shipping_cost faltaba aquí
};
```

**Después:**
```typescript
const orderData = {
  // ... otros campos
  shipping_cost: totalShippingCost,  // ✅ AGREGADO
  total_amount: totalAmount,
  commission_amount: commissionAmount,
};
```

**Resultado:** Ahora el `shipping_cost` se guarda correctamente en la base de datos y el webhook lo envía con el valor real:

```json
{
  "totals": {
    "shipping_cost": 500
  },
  "shipping_info": {
    "shipping_cost": 500,
    "shipping_iva_amount": 0,
    "shipping_total": 500
  }
}
```

### ✅ Fix 2: Adaptar webhook para servicios (formato V2)

**Archivo:** `/supabase/functions/notify-order-webhook/index.ts`

**Cambio:** Se actualizó la función `buildPartnersArray` para que funcione tanto con productos como con servicios.

**Lógica implementada:**

1. **Para productos:** Usa el `partner_breakdown` que contiene la información de múltiples partners
2. **Para servicios:** Usa el `partner_id` directamente (un solo partner)
3. Si no hay `partner_breakdown`, calcula los totales desde los `items` o desde los totales de la orden

```typescript
// Si hay partner_breakdown (productos), usar ese
const partnerBreakdown = orderData.partner_breakdown?.partners || {};
let partnerIds = Object.keys(partnerBreakdown);

// Si no hay partner_breakdown pero hay partner_id (servicios), usar ese
if (partnerIds.length === 0 && orderData.partner_id) {
  partnerIds = [orderData.partner_id];
}
```

**Resultado:** Ahora los webhooks de servicios envían el mismo formato V2 que los productos:

```json
{
  "data": {
    "id": "uuid-servicio",
    "status": "confirmed",
    "order_type": "service_booking",
    "partners": [
      {
        "id": "partner-uuid",
        "business_name": "Peluquería Dinky",
        "commission_percentage": 5,
        "commission_amount": 32.5,
        "partner_amount": 617.5,
        "items": [
          {
            "id": "service-uuid",
            "name": "Baño completo",
            "type": "service",
            "price": 650,
            "quantity": 1
          }
        ]
      }
    ],
    "totals": {
      "subtotal": 532.79,
      "iva_amount": 117.21,
      "shipping_cost": null,
      "total_amount": 650,
      "total_partners": 1
    },
    "shipping_info": {
      "shipping_cost": null,
      "shipping_iva_amount": null,
      "shipping_total": null,
      "shipping_address": null
    },
    "payment_info": {
      "payment_id": "131069717021",
      "payment_status": "approved",
      "payment_method": "mercadopago"
    },
    "booking_info": {
      "booking_id": "uuid-booking",
      "service_id": "uuid-servicio",
      "appointment_date": "2025-10-30T02:46:37.239+00:00",
      "appointment_time": "14:00",
      "pet_id": "uuid-pet",
      "pet_name": "Lolo",
      "booking_notes": null
    }
  }
}
```

## Diferencias: Productos vs Servicios

### Productos (product_purchase)
- ✅ Tienen `shipping_cost` con valor (ej: 500)
- ✅ Tienen `shipping_info` completo con dirección
- ✅ Pueden tener múltiples partners
- ✅ `booking_info` es `null`
- ✅ Usan `partner_breakdown` para calcular comisiones

### Servicios (service_booking)
- ✅ Tienen `shipping_cost: null` (no aplica)
- ✅ Tienen `shipping_info` con valores en `null`
- ✅ Tienen UN solo partner
- ✅ Tienen `booking_info` con datos de la cita
- ✅ No usan `partner_breakdown`, calculan desde la orden

## Verificación de Funcionamiento

### 1. Órdenes de productos
```sql
SELECT id, order_type, shipping_cost, total_amount
FROM orders
WHERE order_type = 'product_purchase'
ORDER BY created_at DESC
LIMIT 5;
```

**Resultado esperado:** `shipping_cost` debe tener el valor correcto (ej: 500, 0, etc.)

### 2. Webhooks de productos
```sql
SELECT order_id, event_type, success, payload->'data'->'shipping_info'->>'shipping_cost' as shipping_cost
FROM webhook_logs
WHERE order_id IN (
  SELECT id FROM orders WHERE order_type = 'product_purchase' LIMIT 5
)
ORDER BY created_at DESC;
```

**Resultado esperado:** `shipping_cost` debe coincidir con el valor en la orden

### 3. Webhooks de servicios
```sql
SELECT order_id, event_type, success,
  payload->'data'->'partners' as partners,
  payload->'data'->'booking_info' as booking_info
FROM webhook_logs
WHERE order_id IN (
  SELECT id FROM orders WHERE order_type = 'service_booking' LIMIT 5
)
ORDER BY created_at DESC;
```

**Resultado esperado:**
- `partners` debe ser un array con un elemento
- Cada partner debe tener `commission_percentage`
- `booking_info` debe tener los datos de la cita

## Estado Actual

### ✅ Completado
1. El `shipping_cost` se guarda correctamente en la base de datos para productos
2. Los webhooks de productos envían el `shipping_cost` correcto
3. Los webhooks de servicios usan el formato V2 con array de `partners`
4. Los servicios incluyen `commission_percentage` en el JSON
5. Los servicios tienen `booking_info` con datos de la cita
6. Edge Function `notify-order-webhook` actualizada y desplegada

### ⚠️ Pendiente (lado del CRM)
1. El CRM debe actualizar su código para manejar el formato V2
2. El CRM debe manejar correctamente:
   - El array `partners` (en lugar de un objeto `partner`)
   - El campo `commission_percentage`
   - Diferenciar entre `product_purchase` y `service_booking`
   - Campos `null` en `shipping_info` para servicios
   - Datos en `booking_info` para servicios

## Ejemplo Completo: Webhook de Servicio

```json
{
  "data": {
    "id": "744efeb0-06ba-44a8-9acb-fc38090e6bfd",
    "status": "confirmed",
    "order_type": "service_booking",
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
        "id": "5d579c88-497e-4fa4-9c72-e845054f5f39",
        "business_name": "Peluquería Dinky",
        "email": "lemuelhernandez881@gmail.com",
        "phone": "25361498",
        "rut": "72078996-7",
        "calle": null,
        "numero": null,
        "barrio": null,
        "codigo_postal": null,
        "commission_percentage": 5,
        "is_primary": true,
        "items": [
          {
            "id": "c252ee90-690c-4a45-a55a-84b8c273277e",
            "name": "Baño completo",
            "type": "service",
            "price": 650,
            "quantity": 1,
            "subtotal": 532.79,
            "iva_rate": 22,
            "iva_amount": 117.21,
            "currency": "UYU",
            "currency_code_dgi": "858",
            "discount_percentage": 0,
            "original_price": 650
          }
        ],
        "subtotal": 650,
        "iva_amount": 117.21,
        "commission_amount": 32.5,
        "partner_amount": 617.5,
        "total": 650
      }
    ],
    "totals": {
      "subtotal": 532.79,
      "iva_amount": 117.21,
      "iva_rate": 22,
      "iva_included_in_price": true,
      "shipping_cost": null,
      "shipping_iva_amount": null,
      "total_commission": 32.5,
      "total_partner_amount": 617.5,
      "total_amount": 650,
      "total_partners": 1
    },
    "shipping_info": {
      "shipping_cost": null,
      "shipping_iva_amount": null,
      "shipping_total": null,
      "shipping_address": null
    },
    "payment_info": {
      "payment_id": "131069717021",
      "payment_status": "approved",
      "payment_method": "mercadopago",
      "payment_preference_id": "2519338363-c2d83d51-5ca4-488e-a768-b865a24f0318"
    },
    "booking_info": {
      "booking_id": "d0b9c6d6-3f09-4f35-967c-8be8c98262c3",
      "service_id": "c252ee90-690c-4a45-a55a-84b8c273277e",
      "appointment_date": "2025-10-30T02:46:37.239+00:00",
      "appointment_time": "14:00",
      "pet_id": "25ca43e3-af53-4cda-b815-4fc6aef691f7",
      "pet_name": "Lolo",
      "booking_notes": null
    },
    "created_at": "2025-10-29T02:46:51.893+00:00",
    "updated_at": "2025-10-29T02:47:11.053+00:00"
  },
  "event": "order.updated",
  "order_id": "744efeb0-06ba-44a8-9acb-fc38090e6bfd",
  "timestamp": "2025-10-29T02:47:13.308Z"
}
```

## Campos Importantes para Facturación

### Datos del Partner (para facturar AL partner)
```json
{
  "partners": [
    {
      "business_name": "Peluquería Dinky",
      "rut": "72078996-7",
      "email": "lemuelhernandez881@gmail.com",
      "phone": "25361498",
      "partner_amount": 617.5,
      "commission_amount": 32.5,
      "commission_percentage": 5
    }
  ]
}
```

### Datos del Cliente (para facturar DEL cliente)
```json
{
  "customer": {
    "display_name": "Lemuel Hernandez",
    "email": "lemuelhernandez881@gmail.com",
    "phone": "206362565",
    "calle": "Benigno paiva",
    "numero": "1165",
    "barrio": "Buceo",
    "codigo_postal": "11600"
  }
}
```

### Totales
```json
{
  "totals": {
    "subtotal": 532.79,
    "iva_amount": 117.21,
    "iva_rate": 22,
    "total_amount": 650,
    "shipping_cost": null,
    "total_commission": 32.5,
    "total_partner_amount": 617.5
  }
}
```

## Próximos Pasos

1. ✅ **COMPLETADO:** DogCatiFy envía el formato correcto para productos y servicios
2. ⏳ **PENDIENTE:** El equipo del CRM debe actualizar su código para recibir el formato V2
3. ⏳ **PENDIENTE:** Coordinar pruebas entre ambos equipos
4. ⏳ **PENDIENTE:** Validar que la facturación se genere correctamente en el CRM

## Referencias

- Documentación del formato V2: `FORMATO_JSON_WEBHOOK_CRM_V2.md`
- Diagnóstico de errores 500: `SOLUCION_ERROR_500_WEBHOOK_CRM.md`
- Ejemplos de uso: `INICIO_RAPIDO_WEBHOOKS.md`
