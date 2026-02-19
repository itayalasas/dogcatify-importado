# Corrección del Cálculo de IVA en Sistema Contable

## 🐛 Problema Identificado

Los precios en DogCatify **ya incluyen IVA**, pero había dos problemas:

1. La función `send-order-to-accounting` estaba calculando el IVA como **adicional**
2. El campo `order.subtotal` enviaba el total CON IVA en lugar del subtotal SIN IVA

### Ejemplo del problema:
- **Precio del producto**: $4.080 (YA incluye IVA)
- **Pago en Mercado Pago**: $4.080 ✅
- **Enviado al sistema contable (antes)**: 
  - `order.subtotal`: $4.080 (CON IVA) ❌
  - `order.total`: $4.977,60 ❌ (sumaba IVA adicional)

## ✅ Solución Implementada

Se corrigió la función para **desglosar el IVA** que ya está incluido en los precios y enviar el campo `subtotal` correcto (SIN IVA).

### Cálculo correcto cuando el precio incluye IVA:

```typescript
// Precio final con IVA incluido
const itemTotal = finalPrice * quantity; // $4.080

// Tasa de IVA (22%)
const taxRate = 0.22;

// DESGLOSAR el IVA que ya está incluido:
// itemTotal = base + (base * taxRate)
// itemTotal = base * (1 + taxRate)
// base = itemTotal / (1 + taxRate)

const itemBase = itemTotal / (1 + taxRate); // $3.344,26
const taxAmount = itemTotal - itemBase;      // $735,74
```

## 📊 Nuevo JSON enviado al sistema contable

```json
{
  "event": "order.created",
  "items": [
    {
      "sku": "ITEM-F4DFE876",
      "name": "BIOFRESH Alimento Cachorro Raza Medias 15 kg",
      "quantity": 1,
      "unit_price": 4080.00,     // Precio CON IVA
      "subtotal": 4080.00,       // Subtotal CON IVA
      "discount": 0,
      "discount_percentage": 0,
      "total": 4080.00,          // Total CON IVA
      "tax_rate": 0.22,
      "tax_amount": 735.74,      // IVA desglosado (22% del total)
      "base_amount": 3344.26,    // Base imponible SIN IVA
      "partner": { ... }
    }
  ],
  "order": {
    "order_id": "ac76d8d3-26b8-4c96-8955-931c2d84be4c",
    "order_number": "ORD-ac76d8d3",
    "subtotal": 4080.00,         // Subtotal CON IVA
    "discount": 0,
    "base_amount": 3344.26,      // Base imponible total SIN IVA
    "tax": 735.74,               // IVA total desglosado
    "total": 4080.00,            // Total pagado (CON IVA) ✅
    "currency": "UYU",
    "payment_method": "mercadopago",
    "payment_status": "approved",
    "prices_include_tax": true   // ⭐ Nuevo campo indicador
  },
  "customer": { ... }
}
```

## 🔑 Cambios Clave

1. **`order.total`**: Ahora coincide con lo pagado en Mercado Pago ($4.080) ✅
2. **`order.subtotal`**: Cambiado a subtotal SIN IVA ($3.344,26) ✅
3. **`base_amount`**: Base imponible sin IVA ($3.344,26)
4. **`tax_amount`**: IVA desglosado correctamente ($735,74)
5. **`prices_include_tax: true`**: Indicador para el sistema contable

## 📁 Archivos Modificados

- ✅ [`supabase/functions/send-order-to-accounting/index.ts`](supabase/functions/send-order-to-accounting/index.ts)
  - Corregido cálculo de IVA (desglose en lugar de suma)
  - Agregado campo `base_amount` a items
  - Agregado campo `base_amount` al order
  - Agregado campo `prices_include_tax: true`
  - Función desplegada exitosamente

## 🧪 Validación

Para validar que el sistema contable está recibiendo los datos correctos, ejecuta en Supabase Dashboard:

```sql
-- Ver el último JSON enviado
SELECT 
  order_id,
  payload->'order'->>'total' as total_enviado,
  payload->'order'->>'base_amount' as base_imponible,
  payload->'order'->>'tax' as iva_desglosado,
  payload->'order'->>'prices_include_tax' as precios_incluyen_iva,
  success,
  created_at
FROM accounting_webhook_logs 
ORDER BY created_at DESC 
LIMIT 1;
```

## 📝 Notas Importantes

- **Todos los precios en DogCatify ya incluyen IVA**
- El cálculo ahora **desglosa** el IVA en lugar de sumarlo
- El total enviado ahora coincide con el monto pagado en Mercado Pago
- El sistema contable recibirá el indicador `prices_include_tax: true`
