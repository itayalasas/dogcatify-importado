# Estructura del Webhook con Descuentos

Este documento describe la estructura del JSON que se envía al CRM. Los campos de descuento **siempre están presentes** en todos los items, incluso cuando no hay descuento aplicado.

## Orden con Productos (con descuento)

```json
{
  "event": "order.created",
  "order_id": "dcbc1ffc-309a-44f0-84f8-70273da49b78",
  "timestamp": "2025-10-18T13:50:56.210Z",
  "data": {
    "id": "dcbc1ffc-309a-44f0-84f8-70273da49b78",
    "status": "pending",
    "order_type": "product_purchase",
    "customer": {
      "id": "d0e8ec28-fae3-4701-88da-3af6ed408c4e",
      "display_name": "Pedro Ayala Ortiz",
      "email": "pedro.ayala@ayalait.uy",
      "phone": "095148335",
      "calle": "Nicaragua",
      "numero": "1991",
      "barrio": "Tres Cruces",
      "codigo_postal": "11800",
      "location": null
    },
    "items": [
      {
        "id": "b2f4beaa-46be-43bf-856e-89f7cca9e632",
        "name": "Collar antipulgas Premium",
        "image": "https://zkgiwamycbjcogcqhff.supabase.co/storage/v1/object/public/dogcatify/partners/xxx/products/collar.jpg",
        "price": 200,
        "quantity": 1,
        "subtotal": 200,
        "partnerId": "9186f952-cbd3-453a-bbba-06791e7a3e1c",
        "partnerName": "Tienda",
        "iva_rate": 22,
        "iva_amount": 44,
        "discount_percentage": 20,
        "original_price": 250,
        "currency": "UYU",
        "currency_code_dgi": "858"
      },
      {
        "id": "c3f5beaa-46be-43bf-856e-89f7cca9e633",
        "name": "Alimento Premium 15kg",
        "image": "https://zkgiwamycbjcogcqhff.supabase.co/storage/v1/object/public/dogcatify/partners/xxx/products/alimento.jpg",
        "price": 4500,
        "quantity": 2,
        "subtotal": 9000,
        "partnerId": "9186f952-cbd3-453a-bbba-06791e7a3e1c",
        "partnerName": "Tienda",
        "iva_rate": 22,
        "iva_amount": 1980,
        "discount_percentage": 10,
        "original_price": 5000,
        "currency": "UYU",
        "currency_code_dgi": "858"
      }
    ],
    "subtotal": 9200,
    "iva_rate": 22,
    "iva_amount": 2024,
    "total_amount": 11224,
    "commission_amount": 561.2,
    "partner_amount": 10662.8,
    "partner_id": "9186f952-cbd3-453a-bbba-06791e7a3e1c",
    "customer_id": "d0e8ec28-fae3-4701-88da-3af6ed408c4e",
    "pet_id": null,
    "booking_id": null,
    "service_id": null,
    "appointment_date": null,
    "appointment_time": null,
    "booking_notes": null,
    "shipping_address": "Nicaragua 1991, Tres Cruces, Montevideo - CP: 11800 - Tel: 095148335",
    "payment_method": "mercadopago",
    "payment_id": null,
    "payment_status": null,
    "payment_preference_id": null,
    "created_at": "2025-10-18T13:50:54.854+00:00",
    "updated_at": "2025-10-18T13:50:54.872334+00:00"
  }
}
```

## Orden con Servicio (con descuento)

```json
{
  "event": "order.created",
  "order_id": "ef789012-3456-78ab-cdef-123456789abc",
  "timestamp": "2025-10-18T14:30:22.450Z",
  "data": {
    "id": "ef789012-3456-78ab-cdef-123456789abc",
    "status": "pending",
    "order_type": "service_booking",
    "customer": {
      "id": "d0e8ec28-fae3-4701-88da-3af6ed408c4e",
      "display_name": "Pedro Ayala Ortiz",
      "email": "pedro.ayala@ayalait.uy",
      "phone": "095148335",
      "calle": "Nicaragua",
      "numero": "1991",
      "barrio": "Tres Cruces",
      "codigo_postal": "11800",
      "location": null
    },
    "items": [
      {
        "id": "abc12345-service-id",
        "name": "Baño y corte de pelo",
        "price": 1200,
        "quantity": 1,
        "type": "service",
        "subtotal": 1200,
        "iva_rate": 22,
        "iva_amount": 264,
        "discount_percentage": 15,
        "original_price": 1500,
        "currency": "UYU",
        "currency_code_dgi": "858"
      }
    ],
    "subtotal": 1200,
    "iva_rate": 22,
    "iva_amount": 264,
    "total_amount": 1464,
    "commission_amount": 73.2,
    "partner_amount": 1390.8,
    "partner_id": "veterinaria-123-id",
    "customer_id": "d0e8ec28-fae3-4701-88da-3af6ed408c4e",
    "pet_id": "pet-abc-123",
    "booking_id": "booking-xyz-456",
    "service_id": "abc12345-service-id",
    "appointment_date": "2025-10-25T10:00:00.000Z",
    "appointment_time": "10:00",
    "booking_notes": "Mi perro es muy tranquilo",
    "shipping_address": null,
    "payment_method": "mercadopago",
    "payment_id": null,
    "payment_status": null,
    "payment_preference_id": null,
    "created_at": "2025-10-18T14:30:20.123+00:00",
    "updated_at": "2025-10-18T14:30:20.456+00:00"
  }
}
```

## Campos de descuento en items

Cada item en el array `items` incluye **siempre** los siguientes campos:

### Campos obligatorios (siempre presentes)
- `id`: ID del producto o servicio
- `name`: Nombre del producto o servicio
- `price`: Precio final (con descuento aplicado si existe)
- `quantity`: Cantidad
- `subtotal`: Subtotal del item (price * quantity)
- `iva_rate`: Tasa de IVA aplicada (porcentaje)
- `iva_amount`: Monto del IVA
- `discount_percentage`: Porcentaje de descuento aplicado (0-100). **Siempre presente, será 0 si no hay descuento**
- `original_price`: Precio original sin descuento. **Siempre presente, será igual a `price` si no hay descuento**
- `currency`: Código ISO 4217 de la moneda (UYU, USD, EUR). **Por defecto: UYU**
- `currency_code_dgi`: Código numérico DGI de la moneda. **Por defecto: 858 (Peso Uruguayo)**

### Cálculo del descuento

Los campos `discount_percentage` y `original_price` **siempre están presentes**:

```javascript
// Cálculo del descuento cuando discount_percentage > 0
const discountAmount = original_price * (discount_percentage / 100);
const finalPrice = original_price - discountAmount;

// Ejemplo con descuento:
// original_price = 250
// discount_percentage = 20
// discountAmount = 250 * 0.20 = 50
// finalPrice (price) = 250 - 50 = 200

// Ejemplo sin descuento:
// original_price = 500
// discount_percentage = 0
// discountAmount = 500 * 0 = 0
// finalPrice (price) = 500
```

## Orden sin Descuentos

Cuando un producto NO tiene descuento, los campos se envían así:

```json
{
  "id": "producto-abc-123",
  "name": "Juguete para perros",
  "price": 500,
  "quantity": 1,
  "subtotal": 500,
  "partnerId": "partner-xyz",
  "partnerName": "Tienda",
  "iva_rate": 22,
  "iva_amount": 110,
  "discount_percentage": 0,
  "original_price": 500,
  "currency": "UYU",
  "currency_code_dgi": "858"
}
```

Nota que `discount_percentage` es 0, `original_price` es igual a `price`, y la moneda es Peso Uruguayo (UYU) por defecto.

## Notas importantes

1. **Los campos de descuento siempre están presentes**: `discount_percentage` y `original_price` **siempre** se envían en el JSON.

2. **Sin descuento**: Cuando no hay descuento:
   - `discount_percentage` = 0
   - `original_price` = `price` (son iguales)

3. **Con descuento**: Cuando hay descuento:
   - `discount_percentage` > 0 (el porcentaje de descuento)
   - `original_price` > `price` (el precio antes del descuento)

4. **El precio en `price` siempre es el precio final**: Es decir, ya tiene el descuento aplicado si existe.

5. **Para calcular el ahorro total**:
   ```javascript
   if (item.discount_percentage > 0) {
     const savings = (item.original_price - item.price) * item.quantity;
   }
   ```

4. **Tipos de descuentos soportados**:
   - Descuentos en productos desde promociones
   - Descuentos en servicios desde promociones
   - Los descuentos se crean desde la cuenta de administrador

5. **El webhook se dispara en los siguientes eventos**:
   - `order.created`: Cuando se crea una orden
   - `order.updated`: Cuando se actualiza una orden
   - `order.cancelled`: Cuando se cancela una orden
   - `order.completed`: Cuando se completa una orden

## Monedas y Códigos DGI

Todos los items incluyen información de moneda según los estándares de la DGI de Uruguay.

### Códigos de Moneda Soportados

| Moneda | Código ISO 4217 | Código DGI | Descripción |
|--------|-----------------|-------------|-------------|
| Peso Uruguayo | UYU | 858 | Moneda por defecto |
| Dólar Estadounidense | USD | 840 | Dólar americano |
| Euro | EUR | 978 | Moneda europea |

### Campos de Moneda en Items

Cada item incluye:
- `currency`: Código alfabético de 3 letras (ISO 4217)
- `currency_code_dgi`: Código numérico de 3 dígitos usado por la DGI

**Valores por defecto:**
- Si no se especifica moneda, se usa: `currency = "UYU"` y `currency_code_dgi = "858"`

**Ejemplo de uso en facturación electrónica:**
```xml
<Moneda>858</Moneda> <!-- Código DGI para Peso Uruguayo -->
```

### Importante para Integración DGI

1. **Usar siempre `currency_code_dgi` para facturación**: Este es el código que acepta la DGI en los comprobantes electrónicos.

2. **Código numérico de 3 dígitos**: El formato es siempre 3 dígitos (ejemplo: "858", "840", "978").

3. **Estándar ISO 4217**: Todos los códigos siguen el estándar internacional ISO 4217.

4. **Conversión de moneda**: El sistema NO realiza conversiones automáticas. Cada producto/servicio se guarda en su moneda original.

## Integración con CRM

Al recibir el webhook en tu CRM, puedes:

1. Verificar si hay descuento:
   ```javascript
   const hasDiscount = item.discount_percentage > 0;
   ```

2. Mostrar información de descuento y moneda al usuario:
   ```javascript
   if (hasDiscount) {
     const currencySymbol = item.currency === 'USD' ? '$' :
                           item.currency === 'EUR' ? '€' : '$';
     console.log(`Producto: ${item.name}`);
     console.log(`Moneda: ${item.currency} (Código DGI: ${item.currency_code_dgi})`);
     console.log(`Precio original: ${currencySymbol}${item.original_price}`);
     console.log(`Descuento: ${item.discount_percentage}%`);
     console.log(`Precio final: ${currencySymbol}${item.price}`);
     console.log(`Ahorro: ${currencySymbol}${item.original_price - item.price}`);
   }
   ```

3. Calcular totales de ahorro en la orden:
   ```javascript
   const totalSavings = order.items.reduce((sum, item) => {
     if (item.discount_percentage > 0) {
       return sum + ((item.original_price - item.price) * item.quantity);
     }
     return sum;
   }, 0);
   ```
