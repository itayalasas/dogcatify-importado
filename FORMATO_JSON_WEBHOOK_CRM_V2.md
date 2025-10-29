# Formato JSON del Webhook para CRM - Versión 2.0

Este documento describe el formato actualizado del JSON que se envía desde DogCatiFy hacia el CRM cuando se genera o actualiza una orden.

## Cambios Principales en la V2

1. **`partners` es ahora un array** con información de TODOS los partners involucrados en la orden
2. Cada partner incluye su **porcentaje de comisión** (`commission_percentage`)
3. Cada partner incluye el **monto de comisión calculado** (`commission_amount`) y el **monto que recibirá** (`partner_amount`)
4. Mejor organización con secciones separadas: `totals`, `shipping_info`, `payment_info`, `booking_info`

## Estructura General

```json
{
  "data": {
    "id": "uuid-de-la-orden",
    "status": "pending|approved|cancelled|completed",
    "order_type": "product_purchase|service_booking",
    "payment_method": "mercadopago|cash|other",
    "customer": { ... },
    "partners": [ ... ],
    "totals": { ... },
    "shipping_info": { ... },
    "payment_info": { ... },
    "booking_info": { ... },
    "created_at": "timestamp",
    "updated_at": "timestamp"
  },
  "event": "order.created|order.updated|order.cancelled|order.completed",
  "order_id": "uuid-de-la-orden",
  "timestamp": "timestamp-del-evento"
}
```

## Ejemplo Completo - Orden con 2 Partners

```json
{
  "data": {
    "id": "1944cc58-e73c-44fa-a37f-68b7b102c875",
    "status": "pending",
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
        "commission_percentage": 5.0,
        "is_primary": true,
        "items": [
          {
            "id": "1b33264c-2505-4ac2-9e82-8613ce9a42bd",
            "name": "Collar antipulgaa",
            "image": "https://zkgiwamycbjcogcgqhff.supabase.co/storage/v1/object/public/dogcatify/partners/27a89e1b-0884-4eed-ad9b-c56a01ac7b2f/services/1753341849729-2rf8ml.jpg",
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
        "commission_amount": 11.50,
        "partner_amount": 218.50,
        "total": 230
      },
      {
        "id": "9186f952-cbd3-453a-bbba-06791e7a3e1c",
        "business_name": "Laika",
        "email": "partner2@example.com",
        "phone": "99999999",
        "rut": "12345678-9",
        "calle": "Calle 2",
        "numero": "456",
        "barrio": "Barrio 2",
        "codigo_postal": "12000",
        "commission_percentage": 5.0,
        "is_primary": false,
        "items": [
          {
            "id": "b2f4beaa-46be-43bf-856e-89f7cca9e632",
            "name": "Prueba IVA",
            "image": "https://zkgiwamycbjcogcgqhff.supabase.co/storage/v1/object/public/dogcatify/partners/9186f952-cbd3-453a-bbba-06791e7a3e1c/services/1760795337957-5y5qdp.jpg",
            "price": 250,
            "quantity": 1,
            "subtotal": 204.92,
            "iva_rate": 22,
            "iva_amount": 45.08,
            "currency": "UYU",
            "currency_code_dgi": "858",
            "original_price": 250,
            "discount_percentage": 0,
            "partnerId": "9186f952-cbd3-453a-bbba-06791e7a3e1c",
            "partnerName": "Laika"
          }
        ],
        "subtotal": 250,
        "iva_amount": 45.08,
        "commission_amount": 12.50,
        "partner_amount": 237.50,
        "total": 250
      }
    ],

    "totals": {
      "subtotal": 393.44,
      "iva_amount": 86.56,
      "iva_rate": 22,
      "iva_included_in_price": true,
      "shipping_cost": 0,
      "shipping_iva_amount": 0,
      "total_commission": 49,
      "total_partner_amount": 931,
      "total_amount": 980,
      "total_partners": 2
    },

    "shipping_info": {
      "shipping_cost": 0,
      "shipping_iva_amount": 0,
      "shipping_total": 0,
      "shipping_address": "Benigno paiva 1165, Buceo, Montevideo - CP: 11600 - Tel: 206362565"
    },

    "payment_info": {
      "payment_id": null,
      "payment_status": null,
      "payment_method": "mercadopago",
      "payment_preference_id": null
    },

    "booking_info": null,

    "created_at": "2025-10-29T03:15:39.381+00:00",
    "updated_at": "2025-10-29T03:15:39.703321+00:00"
  },
  "event": "order.created",
  "order_id": "1944cc58-e73c-44fa-a37f-68b7b102c875",
  "timestamp": "2025-10-29T03:15:40.000Z"
}
```

## Descripción de Campos

### `data.customer`
Información del cliente que realizó la compra.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | ID único del cliente |
| `display_name` | string | Nombre completo del cliente |
| `email` | string | Email del cliente |
| `phone` | string | Teléfono del cliente |
| `calle` | string | Calle de la dirección |
| `numero` | string | Número de puerta |
| `barrio` | string | Barrio |
| `codigo_postal` | string | Código postal |
| `location` | object\|null | Coordenadas geográficas (si están disponibles) |

### `data.partners[]`
Array con información de TODOS los partners involucrados en la orden.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | ID único del partner |
| `business_name` | string | Nombre del negocio |
| `email` | string | Email del partner |
| `phone` | string | Teléfono del partner |
| `rut` | string | RUT del partner (Uruguay) |
| `calle` | string | Calle de la dirección del negocio |
| `numero` | string | Número de puerta |
| `barrio` | string | Barrio |
| `codigo_postal` | string | Código postal |
| `commission_percentage` | number | **NUEVO**: Porcentaje de comisión contratado (ej: 5.0 = 5%) |
| `is_primary` | boolean | Indica si es el partner principal de la orden |
| `items` | array | Lista de productos/servicios de este partner |
| `subtotal` | number | Subtotal de los items de este partner |
| `iva_amount` | number | Monto de IVA de los items de este partner |
| `commission_amount` | number | **NUEVO**: Monto de comisión a cobrar a este partner |
| `partner_amount` | number | **NUEVO**: Monto que recibirá el partner (subtotal - comisión) |
| `total` | number | Total de este partner |

### `data.partners[].items[]`
Productos o servicios del partner.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | ID del producto/servicio |
| `name` | string | Nombre del producto/servicio |
| `image` | string\|null | URL de la imagen |
| `price` | number | Precio unitario |
| `quantity` | number | Cantidad |
| `subtotal` | number | Subtotal (sin IVA) |
| `iva_rate` | number | Tasa de IVA aplicada (%) |
| `iva_amount` | number | Monto de IVA |
| `currency` | string | Moneda (UYU, USD, etc.) |
| `currency_code_dgi` | string | Código de moneda DGI (858 = UYU) |
| `original_price` | number | Precio original (antes de descuentos) |
| `discount_percentage` | number | Porcentaje de descuento aplicado |
| `partnerId` | uuid | ID del partner |
| `partnerName` | string | Nombre del partner |

### `data.totals`
Totales generales de la orden.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `subtotal` | number | Subtotal general (sin IVA) |
| `iva_amount` | number | Monto total de IVA |
| `iva_rate` | number | Tasa de IVA (%) |
| `iva_included_in_price` | boolean | Si el IVA está incluido en los precios |
| `shipping_cost` | number | Costo de envío |
| `shipping_iva_amount` | number | IVA del envío |
| `total_commission` | number | Comisión total de la plataforma |
| `total_partner_amount` | number | Monto total a pagar a partners |
| `total_amount` | number | Monto total de la orden |
| `total_partners` | number | Cantidad de partners en la orden |

### `data.shipping_info`
Información de envío (solo para `product_purchase`, null para servicios).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `shipping_cost` | number\|null | Costo de envío |
| `shipping_iva_amount` | number\|null | IVA del envío |
| `shipping_total` | number\|null | Total del envío |
| `shipping_address` | string\|null | Dirección completa de envío |

### `data.payment_info`
Información del pago.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `payment_id` | string\|null | ID del pago en MercadoPago (cuando esté disponible) |
| `payment_status` | string\|null | Estado del pago |
| `payment_method` | string | Método de pago utilizado |
| `payment_preference_id` | string\|null | ID de la preferencia de pago en MercadoPago |

### `data.booking_info`
Información de reserva (solo para `service_booking`, null para productos).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `booking_id` | uuid\|null | ID de la reserva |
| `service_id` | uuid\|null | ID del servicio |
| `appointment_date` | date\|null | Fecha de la cita |
| `appointment_time` | time\|null | Hora de la cita |
| `pet_id` | uuid\|null | ID de la mascota |
| `pet_name` | string\|null | Nombre de la mascota |
| `booking_notes` | string\|null | Notas de la reserva |

## Eventos Disponibles

| Evento | Descripción | Cuándo se dispara |
|--------|-------------|-------------------|
| `order.created` | Orden creada | Al crear una nueva orden |
| `order.updated` | Orden actualizada | Al actualizar el estado u otros datos |
| `order.completed` | Orden completada | Cuando el pago es aprobado |
| `order.cancelled` | Orden cancelada | Al cancelar una orden |

## Cálculo de Comisiones

La comisión de cada partner se calcula de la siguiente manera:

```
commission_amount = subtotal × (commission_percentage / 100)
partner_amount = subtotal - commission_amount
```

**Ejemplo:**
- Subtotal del partner: $230
- Comisión contratada: 5%
- commission_amount: $230 × 0.05 = $11.50
- partner_amount: $230 - $11.50 = $218.50

## Seguridad

Todos los webhooks incluyen:

1. **Firma HMAC-SHA256** en el header `X-DogCatiFy-Signature`
2. **Tipo de evento** en el header `X-DogCatiFy-Event`
3. **User-Agent**: `DogCatiFy-Webhook/1.0`

Para verificar la autenticidad del webhook, calcule el HMAC-SHA256 del body del request usando la clave secreta compartida y compárela con el valor del header `X-DogCatiFy-Signature`.

## Notas Importantes

1. **Múltiples Partners**: Una orden puede tener productos de varios partners diferentes. El array `partners` contendrá un elemento por cada partner involucrado.

2. **Partner Principal**: El campo `is_primary` indica cuál es el partner principal (el primero agregado o el que tiene la relación directa con la orden).

3. **Comisiones Variables**: Cada partner puede tener un porcentaje de comisión diferente según su contrato con la plataforma.

4. **Moneda**: Actualmente el sistema soporta UYU y USD. El código DGI 858 corresponde a Peso Uruguayo.

5. **IVA Incluido**: Cuando `iva_included_in_price` es `true`, los precios ya incluyen el IVA. El campo `subtotal` muestra el precio sin IVA y `iva_amount` el IVA calculado.

## Ejemplo de Orden con 1 Solo Partner

```json
{
  "data": {
    "id": "uuid-orden",
    "status": "pending",
    "order_type": "product_purchase",
    "payment_method": "mercadopago",
    "customer": { ... },
    "partners": [
      {
        "id": "uuid-partner",
        "business_name": "Veterinaria Central",
        "commission_percentage": 5.0,
        "is_primary": true,
        "items": [
          {
            "id": "uuid-producto",
            "name": "Alimento para perros 15kg",
            "price": 1500,
            "quantity": 2,
            "subtotal": 2459.02,
            "iva_amount": 540.98,
            "total": 3000
          }
        ],
        "subtotal": 2459.02,
        "iva_amount": 540.98,
        "commission_amount": 122.95,
        "partner_amount": 2336.07,
        "total": 3000
      }
    ],
    "totals": {
      "subtotal": 2459.02,
      "iva_amount": 540.98,
      "total_commission": 122.95,
      "total_partner_amount": 2336.07,
      "total_amount": 3000,
      "total_partners": 1
    },
    ...
  },
  "event": "order.created",
  "order_id": "uuid-orden",
  "timestamp": "2025-10-29T03:15:40.000Z"
}
```

## Contacto

Para cualquier duda sobre la integración del webhook, contactar al equipo de desarrollo de DogCatiFy.
