# Estructura de Webhook con Información de Envío

## Descripción General

El webhook ahora incluye información completa sobre el envío para órdenes de productos, con el cálculo automático del IVA aplicado al costo de envío cuando corresponda.

## Campo `shipping_info`

Todas las órdenes incluyen un objeto `shipping_info` dentro del campo `data` del payload del webhook.

### Para Órdenes de Productos (`order_type: 'product_purchase'`)

```json
{
  "event": "order.created",
  "order_id": "uuid-de-la-orden",
  "timestamp": "2025-10-19T23:00:00.000Z",
  "data": {
    "id": "uuid-de-la-orden",
    "order_type": "product_purchase",
    "subtotal": 1000.00,
    "shipping_cost": 150.00,
    "iva_rate": 22.00,
    "iva_amount": 253.00,
    "iva_included_in_price": false,
    "total_amount": 1403.00,
    "shipping_info": {
      "shipping_cost": 150.00,
      "shipping_iva_amount": 33.00,
      "shipping_total": 183.00,
      "shipping_address": "Calle Principal 123, Montevideo"
    },
    "items": [...],
    "customer_name": "Juan Pérez",
    "customer_email": "juan@example.com",
    "customer_phone": "+598 99 123 456"
  }
}
```

### Para Órdenes de Servicios (`order_type: 'service_booking'`)

```json
{
  "event": "order.created",
  "order_id": "uuid-de-la-orden",
  "timestamp": "2025-10-19T23:00:00.000Z",
  "data": {
    "id": "uuid-de-la-orden",
    "order_type": "service_booking",
    "subtotal": 500.00,
    "shipping_cost": 0,
    "iva_rate": 22.00,
    "iva_amount": 110.00,
    "iva_included_in_price": false,
    "total_amount": 610.00,
    "shipping_info": {
      "shipping_cost": null,
      "shipping_iva_amount": null,
      "shipping_total": null,
      "shipping_address": null
    },
    "service_name": "Consulta veterinaria",
    "appointment_date": "2025-10-20T14:00:00.000Z",
    "pet_name": "Max",
    "customer_name": "María García",
    "customer_email": "maria@example.com",
    "customer_phone": "+598 99 654 321"
  }
}
```

## Campos del Objeto `shipping_info`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `shipping_cost` | `number` o `null` | Costo base del envío sin IVA. `null` para servicios. |
| `shipping_iva_amount` | `number` o `null` | Monto de IVA aplicado al envío. `null` para servicios o si el IVA está incluido. |
| `shipping_total` | `number` o `null` | Total del envío (costo + IVA). `null` para servicios. |
| `shipping_address` | `string` o `null` | Dirección de envío. `null` para servicios o si no se especificó. |

## Cálculo del IVA sobre el Envío

El IVA sobre el costo de envío se calcula de la siguiente manera:

1. **Si `iva_included_in_price` es `false`**:
   - `shipping_iva_amount = shipping_cost * (iva_rate / 100)`
   - `shipping_total = shipping_cost + shipping_iva_amount`

2. **Si `iva_included_in_price` es `true`**:
   - `shipping_iva_amount = 0` (el IVA ya está incluido en el precio)
   - `shipping_total = shipping_cost`

3. **Para servicios (`order_type: 'service_booking'`)**:
   - Todos los campos de `shipping_info` son `null`

## Ejemplo de Procesamiento en el CRM

```javascript
// Ejemplo de función para procesar el webhook
function processOrderWebhook(payload) {
  const { data } = payload;
  const { shipping_info, order_type } = data;

  // Verificar si la orden tiene envío
  if (order_type === 'product_purchase' && shipping_info.shipping_cost !== null) {
    console.log('Orden con envío:');
    console.log(`- Costo de envío: $${shipping_info.shipping_cost}`);
    console.log(`- IVA del envío: $${shipping_info.shipping_iva_amount}`);
    console.log(`- Total del envío: $${shipping_info.shipping_total}`);
    console.log(`- Dirección: ${shipping_info.shipping_address}`);
  } else {
    console.log('Orden sin envío (servicio o producto sin costo de envío)');
  }

  // Calcular total general
  const totalGeneral = data.subtotal +
                       data.iva_amount +
                       (shipping_info.shipping_total || 0);

  console.log(`Total general: $${totalGeneral}`);
}
```

## Cambios Importantes

### Siempre se Incluye `shipping_info`

- **Antes**: El campo de envío podía estar ausente en algunos webhooks
- **Ahora**: Todas las órdenes incluyen el objeto `shipping_info`, incluso si es con valores `null`

### Transparencia en el Cálculo

- El IVA sobre el envío se calcula y muestra por separado
- Esto permite al CRM entender exactamente cuánto es el costo de envío y cuánto es el IVA aplicado

### Consistencia

- Los webhooks tienen una estructura consistente independientemente del tipo de orden
- Facilita el procesamiento en el CRM sin necesidad de verificar la existencia de campos

## Migración Necesaria en la Base de Datos

Para que esto funcione correctamente, debe aplicarse la siguiente migración:

```sql
-- Agregar columna shipping_cost a la tabla orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost numeric DEFAULT 0;
```

Esta migración ya está disponible en:
`supabase/migrations/20251019230500_add_shipping_cost_to_orders.sql`
