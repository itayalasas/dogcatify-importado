# Ejemplo Completo del JSON del Webhook Actualizado

Este documento muestra el formato COMPLETO y ACTUALIZADO del JSON que se envía al CRM con todos los campos de descuento.

## JSON Completo de Ejemplo

```json
{
  "data": {
    "id": "999efb77-f9f0-4ac4-bb82-120437570af1",
    "status": "confirmed",
    "order_type": "product_purchase",
    "payment_method": "mercadopago",
    "customer": {
      "id": "105be4af-8691-4b51-8ecb-3bbd50b3736e",
      "display_name": "Pedro Ayala",
      "email": "payalaortiz@gmail.com",
      "phone": "095148335",
      "calle": "Itapebi",
      "numero": "2194",
      "barrio": "Jacinto Vera",
      "codigo_postal": "11800"
    },
    "partners": [
      {
        "id": "8dfe492a-688c-4abe-b079-2533d14f3a64",
        "business_name": "Animal Shop",
        "email": "tienda.test@dogcatify.com",
        "phone": "25047420",
        "rut": "2134983456330",
        "calle": "Avenida 8 de octubre",
        "numero": "4100",
        "barrio": "Unión",
        "codigo_postal": "11600",
        "commission_percentage": 5,
        "is_primary": true,
        "items": [
          {
            "id": "f5004c3d-6f87-4cef-9477-1ce5b0e02e45",
            "name": "BF Cachorros Razas pequeñas 3kg",
            "image": "https://zkgiwamycbjcogcgqhff.supabase.co/storage/v1/object/public/dogcatify/partners/8dfe492a-688c-4abe-b079-2533d14f3a64/services/1761793247531-zsoane.jpg",
            "price": 1087.5,
            "quantity": 1,
            "subtotal": 891.39,
            "currency": "UYU",
            "currency_code_dgi": "858",
            "iva_rate": 22,
            "iva_amount": 196.11,
            "partnerId": "8dfe492a-688c-4abe-b079-2533d14f3a64",
            "partnerName": "Tienda",
            "original_price": 1450,
            "price_original": 1450,
            "discount_percentage": 25,
            "discount_amount": 362.5
          }
        ],
        "subtotal": 891.39,
        "iva_amount": 196.11,
        "commission_amount": 44.57,
        "partner_amount": 846.82,
        "total": 891.39
      }
    ],
    "totals": {
      "subtotal": 891.39,
      "iva_amount": 196.11,
      "iva_rate": 22,
      "iva_included_in_price": true,
      "shipping_cost": 0,
      "shipping_iva_amount": 0,
      "total_commission": 44.57,
      "total_partner_amount": 846.82,
      "total_amount": 1087.5,
      "total_partners": 1
    },
    "shipping_info": {
      "shipping_cost": 0,
      "shipping_iva_amount": 0,
      "shipping_total": 0,
      "shipping_address": "Retiro en tienda: "
    },
    "payment_info": {
      "payment_id": "132243707596",
      "payment_status": "approved",
      "payment_method": "mercadopago",
      "payment_preference_id": null
    },
    "booking_info": null,
    "created_at": "2025-11-02T22:20:28.599+00:00",
    "updated_at": "2025-11-02T22:20:50.259+00:00"
  },
  "event": "order.created",
  "order_id": "999efb77-f9f0-4ac4-bb82-120437570af1",
  "timestamp": "2025-11-02T22:20:50.259Z"
}
```

## Campos Clave en Items

Cada item en el array `items` contiene los siguientes campos relacionados con precios y descuentos:

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `price` | number | Precio FINAL después del descuento (lo que se cobra) | 1087.5 |
| `original_price` | number | Precio original antes del descuento (campo legacy) | 1450 |
| `price_original` | number | **NUEVO** - Precio original unitario para trazabilidad en CRM | 1450 |
| `discount_percentage` | number | Porcentaje de descuento aplicado | 25 |
| `discount_amount` | number | **NUEVO** - Monto del descuento por unidad | 362.5 |
| `quantity` | number | Cantidad de unidades | 1 |
| `subtotal` | number | Subtotal sin IVA | 891.39 |
| `iva_amount` | number | Monto del IVA | 196.11 |

## Fórmulas de Cálculo

### 1. Descuento por Unidad
```
discount_amount = price_original - price
discount_amount = 1450 - 1087.5 = 362.5
```

### 2. Verificar Porcentaje
```
discount_percentage = (discount_amount / price_original) * 100
discount_percentage = (362.5 / 1450) * 100 = 25%
```

### 3. Descuento Total (con cantidad)
```
discount_total = discount_amount * quantity
discount_total = 362.5 * 1 = 362.5
```

### 4. Precio Original Total
```
price_original_total = price_original * quantity
price_original_total = 1450 * 1 = 1450
```

### 5. Ahorro Total del Cliente
```
ahorro_total = discount_amount * quantity
ahorro_total = 362.5 * 1 = 362.5
```

## Diferencia entre Campos de Precio

### `price` vs `original_price` vs `price_original`

- **`price`**: Precio final que se cobra al cliente después de aplicar descuentos
- **`original_price`**: Campo legacy que también contiene el precio original
- **`price_original`**: Nuevo campo específico para trazabilidad en el CRM, siempre contiene el precio unitario original

**¿Por qué tres campos?**
- `price`: Necesario para facturación
- `original_price`: Mantenido por compatibilidad con versiones anteriores
- `price_original`: Agregado específicamente para trazabilidad en CRM y análisis de descuentos

## Casos de Uso en el CRM

### 1. Calcular Ahorro Total del Cliente
```javascript
const ahorroTotal = items.reduce((total, item) => {
  return total + (item.discount_amount * item.quantity);
}, 0);
```

### 2. Validar Precios
```javascript
items.forEach(item => {
  const precioCalculado = item.price_original * (1 - item.discount_percentage / 100);
  const esValido = Math.abs(item.price - precioCalculado) < 0.01;
  console.log(`Item ${item.name}: ${esValido ? 'OK' : 'ERROR'}`);
});
```

### 3. Generar Reporte de Descuentos
```javascript
const reporteDescuentos = items.map(item => ({
  nombre: item.name,
  precioOriginal: item.price_original,
  precioFinal: item.price,
  descuentoPorcentaje: item.discount_percentage,
  descuentoMonto: item.discount_amount,
  cantidad: item.quantity,
  ahorroTotal: item.discount_amount * item.quantity
}));
```

### 4. Calcular Margen Real
```javascript
items.forEach(item => {
  const ingresoReal = item.price * item.quantity;
  const ingresoSinDescuento = item.price_original * item.quantity;
  const porcentajeMargenPerdido = ((ingresoSinDescuento - ingresoReal) / ingresoSinDescuento) * 100;

  console.log(`${item.name}:`);
  console.log(`  Ingreso real: $${ingresoReal}`);
  console.log(`  Ingreso sin descuento: $${ingresoSinDescuento}`);
  console.log(`  Margen perdido: ${porcentajeMargenPerdido.toFixed(2)}%`);
});
```

## Ejemplo con Servicio

Para servicios, la estructura es similar pero incluye información de la reserva:

```json
{
  "id": "service-123",
  "name": "Baño completo",
  "type": "service",
  "price": 532.79,
  "quantity": 1,
  "currency": "UYU",
  "currency_code_dgi": "858",
  "iva_rate": 22,
  "subtotal": 436.71,
  "iva_amount": 96.08,
  "original_price": 650,
  "price_original": 650,
  "discount_percentage": 18,
  "discount_amount": 117.21,
  "pet_id": "pet-456",
  "pet_name": "Sam",
  "appointment_date": "2025-11-03T00:00:00+00:00",
  "appointment_time": "12:00",
  "booking_notes": null
}
```

## Validación en el CRM

Tu sistema CRM puede usar estos campos para:

1. **Validar la integridad de los datos**:
   ```javascript
   const precioEsperado = price_original * (1 - discount_percentage / 100);
   const descuentoEsperado = price_original - price;
   ```

2. **Generar facturas detalladas**:
   - Mostrar precio original tachado
   - Mostrar descuento aplicado
   - Mostrar precio final

3. **Análisis de promociones**:
   - Rastrear qué productos se venden más con descuento
   - Calcular el impacto de los descuentos en las ventas
   - Determinar la efectividad de las promociones

4. **Reconciliación contable**:
   - Usar `price_original` para calcular ingresos potenciales
   - Usar `price` para calcular ingresos reales
   - Usar `discount_amount` para reportar descuentos otorgados

## Notas Importantes

1. **Todos los precios están en la moneda especificada** en `currency` (ej: UYU)
2. **Los montos están redondeados a 2 decimales** para evitar problemas de precisión
3. **`price_original` siempre es unitario**, multiplicar por `quantity` para el total
4. **`discount_amount` también es unitario**, multiplicar por `quantity` para el ahorro total
5. **Si no hay descuento**: `discount_percentage = 0`, `discount_amount = 0`, `price = price_original`
