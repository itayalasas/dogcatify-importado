# Formato de Datos Enviados al CRM - Webhooks de Órdenes

## Resumen Ejecutivo

Este documento describe el formato exacto de los datos que se envían al CRM cuando se crea o actualiza una orden de compra o servicio en DogCatiFy.

## 📋 Reglas de Envío

### ✅ Se Envían al CRM:
- ✅ Órdenes de productos (compras en la tienda)
- ✅ Órdenes de servicios con costo (has_cost = true)
- ✅ Total mayor a 0

### ❌ NO Se Envían al CRM:
- ❌ Servicios gratuitos (has_cost = false)
- ❌ Órdenes con payment_method = 'free'
- ❌ Órdenes con total_amount = 0

**Motivo**: Los servicios gratuitos no requieren facturación en el CRM.

---

## 🧮 Manejo del IVA

### Configuración del IVA

Cada partner puede configurar:
- `iva_rate`: Porcentaje de IVA (ej: 22 para 22%)
- `iva_included_in_price`: Si el IVA está incluido en el precio mostrado

### Cálculo del IVA

#### IVA Incluido en el Precio (`iva_included_in_price = true`)

Cuando el precio que ve el cliente YA INCLUYE el IVA:

```
Precio mostrado: $1,450.00 (IVA incluido)
Tasa de IVA: 22%

Cálculo:
subtotal = 1450 / (1 + 22/100) = 1450 / 1.22 = $1,188.52
iva_amount = 1450 - 1188.52 = $261.48
total_amount = $1,450.00 (lo que paga el cliente)
```

**Lo que se envía al CRM para facturar:**
```json
{
  "subtotal": 1188.52,      // Base imponible (sin IVA)
  "iva_amount": 261.48,     // IVA a declarar
  "iva_rate": 22.00,        // Tasa aplicada
  "total_amount": 1450.00   // Total pagado
}
```

#### IVA NO Incluido en el Precio (`iva_included_in_price = false`)

Cuando el precio mostrado NO incluye el IVA (se suma al final):

```
Precio base: $1,000.00 (sin IVA)
Tasa de IVA: 22%

Cálculo:
subtotal = $1,000.00
iva_amount = 1000 * (22/100) = $220.00
total_amount = 1000 + 220 = $1,220.00 (lo que paga el cliente)
```

**Lo que se envía al CRM para facturar:**
```json
{
  "subtotal": 1000.00,      // Base imponible (sin IVA)
  "iva_amount": 220.00,     // IVA a declarar
  "iva_rate": 22.00,        // Tasa aplicada
  "total_amount": 1220.00   // Total pagado (base + IVA)
}
```

---

## 📦 Estructura del Webhook

### Ejemplo Completo: Orden de Producto con IVA Incluido

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "paid",
    "order_type": "product_purchase",
    "payment_method": "mercadopago",

    "customer": {
      "id": "user-123",
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "phone": "099123456",
      "address": {
        "street": "Av. Italia",
        "number": "1234",
        "neighborhood": "Pocitos",
        "city": "Montevideo",
        "postal_code": "11300"
      }
    },

    "partners": [
      {
        "id": "partner-456",
        "business_name": "Tienda Animal Shop",
        "email": "tienda@animalshop.com",
        "phone": "099654321",
        "rut": "211234560018",
        "address": {
          "street": "Calle Principal",
          "number": "567",
          "neighborhood": "Centro",
          "postal_code": "11000"
        },
        "commission_percentage": 5.0,
        "is_primary": true,

        "items": [
          {
            "id": "prod-789",
            "name": "BF Cachorros Razas pequeñas 3kg",
            "description": "Alimento balanceado para cachorros",
            "quantity": 1,
            "price": 1450.00,
            "type": "product",
            "currency": "UYU",
            "currency_code_dgi": "858",
            "iva_rate": 22.00,
            "subtotal": 1188.52,
            "iva_amount": 261.48
          }
        ],

        "subtotal": 1188.52,        // Base sin IVA del partner
        "iva_amount": 261.48,       // IVA del partner
        "commission_amount": 72.50, // 5% de 1450
        "partner_amount": 1377.50,  // Lo que recibe el partner
        "total": 1188.52            // Subtotal (sin IVA)
      }
    ],

    "totals": {
      "subtotal": 1188.52,              // Base total sin IVA
      "iva_amount": 261.48,             // IVA total
      "iva_rate": 22.00,                // Tasa de IVA
      "iva_included_in_price": true,    // El IVA estaba incluido
      "shipping_cost": 150.00,          // Costo de envío
      "shipping_iva_amount": 27.05,     // IVA del envío (si aplica)
      "total_commission": 72.50,        // Comisión total de la plataforma
      "total_partner_amount": 1377.50,  // Total para el partner
      "total_amount": 1600.00,          // Total final pagado (producto + envío)
      "total_partners": 1
    },

    "shipping_info": {
      "shipping_cost": 150.00,
      "shipping_iva_amount": 27.05,
      "shipping_total": 177.05,
      "shipping_address": "Av. Italia 1234, Pocitos, Montevideo - CP: 11300 - Tel: 099123456"
    },

    "payment_info": {
      "payment_id": "mp-123456789",
      "payment_status": "approved",
      "payment_method": "credit_card",
      "payment_preference_id": "pref-abc123"
    },

    "booking_info": null,

    "created_at": "2025-11-02T15:30:00Z",
    "updated_at": "2025-11-02T15:35:00Z"
  },
  "event": "order.created",
  "order_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-11-02T15:30:00Z"
}
```

### Ejemplo: Orden de Servicio con Costo

```json
{
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "status": "paid",
    "order_type": "service_booking",
    "payment_method": "mercadopago",

    "customer": {
      "id": "user-789",
      "name": "María García",
      "email": "maria@example.com",
      "phone": "099987654"
    },

    "partners": [
      {
        "id": "partner-veterinaria",
        "business_name": "Veterinaria San Roque",
        "items": [
          {
            "id": "service-consulta",
            "name": "Consulta Veterinaria General",
            "quantity": 1,
            "price": 2000.00,
            "type": "service",
            "iva_rate": 22.00,
            "subtotal": 1639.34,
            "iva_amount": 360.66
          }
        ],
        "subtotal": 1639.34,
        "iva_amount": 360.66,
        "commission_amount": 100.00,
        "partner_amount": 1900.00,
        "total": 1639.34
      }
    ],

    "totals": {
      "subtotal": 1639.34,
      "iva_amount": 360.66,
      "iva_rate": 22.00,
      "iva_included_in_price": true,
      "shipping_cost": 0,
      "shipping_iva_amount": 0,
      "total_commission": 100.00,
      "total_partner_amount": 1900.00,
      "total_amount": 2000.00,
      "total_partners": 1
    },

    "shipping_info": {
      "shipping_cost": null,
      "shipping_iva_amount": null,
      "shipping_total": null,
      "shipping_address": null
    },

    "booking_info": {
      "booking_id": "booking-123",
      "service_id": "service-consulta",
      "appointment_date": "2025-11-05T00:00:00Z",
      "appointment_time": "10:00",
      "pet_id": "pet-456",
      "pet_name": "Luna",
      "booking_notes": "Primera consulta"
    }
  },
  "event": "order.created",
  "order_id": "660e8400-e29b-41d4-a716-446655440001",
  "timestamp": "2025-11-02T16:00:00Z"
}
```

---

## 🔐 Seguridad del Webhook

### Firma HMAC

Cada webhook incluye una firma HMAC en el header `X-DogCatiFy-Signature` para validar autenticidad.

**Headers del webhook:**
```
Content-Type: application/json
X-DogCatiFy-Signature: a1b2c3d4e5f6...
X-DogCatiFy-Event: order.created
User-Agent: DogCatiFy-Webhook/1.0
```

### Validar la Firma

```javascript
const crypto = require('crypto');

function validateSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = hmac.digest('hex');

  return signature === expectedSignature;
}
```

---

## 📊 Tipos de Eventos

| Evento | Descripción | Cuándo se dispara |
|--------|-------------|-------------------|
| `order.created` | Orden creada | Cuando se crea una orden con costo |
| `order.updated` | Orden actualizada | Cuando cambia algún dato de la orden |
| `order.completed` | Orden completada | Cuando el status cambia a 'completed' |
| `order.cancelled` | Orden cancelada | Cuando el status cambia a 'cancelled' |

---

## 💡 Notas Importantes para el CRM

1. **Base Imponible**: Siempre usar `subtotal` como base imponible para la factura
2. **IVA Separado**: El `iva_amount` viene calculado y separado del subtotal
3. **Total a Cobrar**: `total_amount` es lo que pagó el cliente
4. **Moneda**: Todos los valores están en la moneda configurada (UYU por defecto)
5. **Redondeo**: Todos los valores tienen 2 decimales máximo
6. **Servicios Gratuitos**: NO recibirán webhooks (no facturar)

---

## 🔄 Flujo de Datos

```
Cliente compra producto $1,450 (IVA incluido 22%)
                ↓
Sistema calcula:
  - Subtotal sin IVA: $1,188.52
  - IVA (22%): $261.48
  - Total: $1,450.00
                ↓
Se crea orden en DB con datos separados
                ↓
Trigger detecta nueva orden
                ↓
¿Es servicio gratuito? → SI → NO enviar webhook
                ↓ NO
Envía webhook al CRM con:
  - subtotal: 1188.52 (base para facturar)
  - iva_amount: 261.48 (IVA a declarar)
  - total_amount: 1450.00 (total pagado)
                ↓
CRM recibe y factura correctamente
```

---

## 📝 Cambios Implementados

### 2025-11-02: Exclusión de Servicios Gratuitos
- ✅ Servicios con `has_cost = false` no generan webhooks
- ✅ Órdenes con `payment_method = 'free'` no se envían al CRM
- ✅ Órdenes con `total_amount = 0` no se envían al CRM

### Verificado: Manejo Correcto del IVA
- ✅ IVA incluido: se extrae del precio total
- ✅ IVA no incluido: se suma al precio base
- ✅ Subtotal y IVA siempre separados en el webhook
- ✅ Cada partner tiene su subtotal e IVA calculado

---

## 🧪 Testing

### Test de Producto con IVA Incluido
```bash
# Crear orden de prueba
# Precio mostrado: $1,450
# IVA: 22% incluido

Resultado esperado:
- subtotal: 1188.52
- iva_amount: 261.48
- total_amount: 1450.00
```

### Test de Servicio Gratuito
```bash
# Crear reserva de servicio gratuito
# has_cost: false
# payment_method: 'free'

Resultado esperado:
- NO se envía webhook al CRM
- Se crea orden en DB normalmente
- Partner recibe notificación push
```
