# Estructura Actualizada del Webhook

## JSON de Salida del Webhook al CRM

Con los ajustes realizados, el webhook ahora incluye campos adicionales que facilitan la integración con sistemas externos (CRM, ERP, etc.) sin necesidad de consultas adicionales.

---

## Campos Nuevos Agregados

### En el nivel raíz de `data`:

| Campo | Tipo | Descripción | Disponible en |
|-------|------|-------------|---------------|
| `partner_name` | string | Nombre del negocio (veterinaria, peluquería, tienda, etc.) | Todas las órdenes |
| `service_name` | string \| null | Nombre del servicio reservado | Solo `service_booking` |
| `pet_name` | string \| null | Nombre de la mascota | Solo `service_booking` |
| `customer_name` | string | Nombre completo del cliente | Todas las órdenes |
| `customer_email` | string | Email del cliente | Todas las órdenes |
| `customer_phone` | string \| null | Teléfono del cliente | Todas las órdenes |
| `iva_included_in_price` | boolean | Si el IVA está incluido en el precio original | Todas las órdenes |
| `partner_breakdown` | object | Desglose por partner cuando hay múltiples partners | Solo órdenes multi-partner |

### En `items[]` (cada item del array):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `partner_name` | string | Nombre del partner que vende este item específico |

---

## Ejemplo de JSON Actualizado

### Orden de Productos (product_purchase)

```json
{
  "event": "order.created",
  "order_id": "05f3c619-bded-46a4-9418-559286b5145d",
  "timestamp": "2025-10-19T02:39:25.253Z",
  "data": {
    "id": "05f3c619-bded-46a4-9418-559286b5145d",
    "partner_id": "9186f952-cbd3-453a-bbba-06791e7a3e1c",
    "customer_id": "d0e8ec28-fae3-4701-88da-3af6ed408c4e",
    "status": "pending",
    "order_type": "product_purchase",

    "partner_name": "Tienda Mascotas Premium",
    "customer_name": "Pedro Ayala Ortiz",
    "customer_email": "pedro.ayala@ayalait.uy",
    "customer_phone": "095148335",

    "subtotal": 2091,
    "iva_rate": 22,
    "iva_amount": 460.02,
    "iva_included_in_price": false,
    "total_amount": 3051.02,

    "commission_amount": 152.55,
    "partner_amount": 2898.47,

    "items": [
      {
        "id": "bad80936-8d4d-4315-9956-652c87985049",
        "name": "Prot 21",
        "price": 1045.5,
        "quantity": 2,
        "subtotal": 2091,
        "iva_rate": 22,
        "iva_amount": 460.02,
        "original_price": 1230,
        "discount_percentage": 15,
        "currency": "UYU",
        "currency_code_dgi": "858",
        "partner_name": "Tienda Mascotas Premium",
        "partnerId": "9186f952-cbd3-453a-bbba-06791e7a3e1c",
        "image": "https://zkgiwamycbjcogcgqhff.supabase.co/storage/..."
      }
    ],

    "shipping_address": "Nicaragua 1991, Tres Cruces, Montevideo - CP: 11800 - Tel: 095148335",
    "payment_method": "mercadopago",
    "payment_status": null,
    "payment_id": null,
    "payment_preference_id": null,

    "booking_id": null,
    "service_id": null,
    "pet_id": null,
    "appointment_date": null,
    "appointment_time": null,
    "booking_notes": null,
    "service_name": null,
    "pet_name": null,

    "created_at": "2025-10-19T02:39:23.708+00:00",
    "updated_at": "2025-10-19T02:39:23.800721+00:00",

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

    "partner_breakdown": {
      "partners": {
        "9186f952-cbd3-453a-bbba-06791e7a3e1c": {
          "partner_id": "9186f952-cbd3-453a-bbba-06791e7a3e1c",
          "partner_name": "Tienda Mascotas Premium",
          "items": [
            {
              "id": "bad80936-8d4d-4315-9956-652c87985049",
              "name": "Prot 21",
              "price": 1045.5,
              "quantity": 2,
              "total": 2091
            }
          ],
          "subtotal": 2091
        }
      },
      "total_partners": 1,
      "commission_split": 152.55,
      "shipping_cost": 500,
      "iva_rate": 22,
      "iva_amount": 460.02,
      "iva_included": false
    }
  }
}
```

---

### Orden de Servicio (service_booking)

```json
{
  "event": "order.created",
  "order_id": "abc123-def456-ghi789",
  "timestamp": "2025-10-19T14:30:00.000Z",
  "data": {
    "id": "abc123-def456-ghi789",
    "partner_id": "partner-vet-001",
    "customer_id": "customer-001",
    "status": "pending",
    "order_type": "service_booking",

    "partner_name": "Veterinaria San Francisco",
    "service_name": "Consulta General",
    "pet_name": "Max",
    "customer_name": "María García",
    "customer_email": "maria.garcia@email.com",
    "customer_phone": "099123456",

    "subtotal": 1475,
    "iva_rate": 22,
    "iva_amount": 324.5,
    "iva_included_in_price": true,
    "total_amount": 1800,

    "commission_amount": 90,
    "partner_amount": 1710,

    "items": [
      {
        "id": "service-consulta-001",
        "name": "Consulta General",
        "price": 1800,
        "quantity": 1,
        "type": "service",
        "subtotal": 1475,
        "iva_rate": 22,
        "iva_amount": 324.5,
        "original_price": 1800,
        "discount_percentage": 0,
        "currency": "UYU",
        "currency_code_dgi": "858",
        "partner_name": "Veterinaria San Francisco"
      }
    ],

    "shipping_address": null,
    "payment_method": "mercadopago",
    "payment_status": "pending",
    "payment_id": null,
    "payment_preference_id": "mp-pref-123",

    "booking_id": "booking-abc-123",
    "service_id": "service-consulta-001",
    "pet_id": "pet-max-001",
    "appointment_date": "2025-10-25T10:00:00.000Z",
    "appointment_time": "10:00",
    "booking_notes": "Primera consulta del cachorro",

    "created_at": "2025-10-19T14:30:00.000Z",
    "updated_at": "2025-10-19T14:30:00.000Z",

    "customer": {
      "id": "customer-001",
      "display_name": "María García",
      "email": "maria.garcia@email.com",
      "phone": "099123456",
      "calle": "18 de Julio",
      "numero": "1234",
      "barrio": "Centro",
      "codigo_postal": "11100",
      "location": null
    },

    "partner_breakdown": null
  }
}
```

---

## Cambios Clave para el CRM

### 1. Ya No Necesitas Consultar Partner
**Antes:**
```javascript
// Tenías que hacer una consulta adicional
const partner = await getPartnerById(order.partner_id);
console.log(`Orden del negocio: ${partner.business_name}`);
```

**Ahora:**
```javascript
// Está directamente en la orden
console.log(`Orden del negocio: ${order.partner_name}`);
```

---

### 2. Información Completa de Servicios
**Antes:**
```javascript
// Tenías que hacer consultas adicionales
const service = await getServiceById(order.service_id);
const pet = await getPetById(order.pet_id);
console.log(`Servicio: ${service.name} para ${pet.name}`);
```

**Ahora:**
```javascript
// Todo está en la orden
console.log(`Servicio: ${order.service_name} para ${order.pet_name}`);
```

---

### 3. Datos del Cliente Duplicados (Para Histórico)
**Nuevo comportamiento:**
- `customer_name`, `customer_email`, `customer_phone` se guardan directamente en la orden
- También sigue disponible el objeto `customer` completo con JOIN
- Esto preserva los datos históricos incluso si el cliente cambia su información

---

## Casos de Uso en CRM

### Mostrar Lista de Órdenes
```javascript
// Puedes mostrar todo sin consultas adicionales
orders.forEach(order => {
  console.log(`
    Cliente: ${order.customer_name}
    Negocio: ${order.partner_name}
    ${order.service_name ? `Servicio: ${order.service_name}` : 'Productos'}
    ${order.pet_name ? `Mascota: ${order.pet_name}` : ''}
    Total: $${order.total_amount}
  `);
});
```

### Generar Factura
```javascript
// Toda la info necesaria está en la orden
const invoice = {
  cliente: order.customer_name,
  email: order.customer_email,
  telefono: order.customer_phone,
  proveedor: order.partner_name,
  items: order.items,
  subtotal: order.subtotal,
  iva: order.iva_amount,
  total: order.total_amount,
  direccion_envio: order.shipping_address
};
```

### Buscar Órdenes
```javascript
// Puedes buscar directamente por estos campos
const ordenesDeVeterinaria = orders.filter(o =>
  o.partner_name.toLowerCase().includes('veterinaria')
);

const ordenesDelCliente = orders.filter(o =>
  o.customer_email === 'pedro.ayala@ayalait.uy'
);

const ordenesConMascota = orders.filter(o =>
  o.pet_name === 'Max'
);
```

---

## Compatibilidad

### Órdenes Antiguas
Las órdenes creadas antes de estos cambios tendrán estos campos en `null`:
- `partner_name` → `null`
- `service_name` → `null`
- `pet_name` → `null`
- `customer_name` → `null`
- `customer_email` → `null`
- `customer_phone` → `null`

Para estas órdenes, deberás usar el objeto `customer` y hacer consultas al partner si es necesario.

### Órdenes Nuevas
Todas las órdenes nuevas (después de aplicar las migraciones) tendrán estos campos completos.

---

## Resumen de Beneficios

✅ **Menos consultas a la BD**: No necesitas JOINs para mostrar info básica
✅ **Rendimiento mejorado**: Datos ya disponibles en la orden
✅ **Histórico preservado**: Si se elimina el partner/servicio/pet, la orden mantiene los datos
✅ **Integración más simple**: Tu CRM puede trabajar solo con el webhook
✅ **Búsquedas más rápidas**: Puedes indexar y buscar directamente por estos campos
✅ **Facturas más fáciles**: Toda la info necesaria en un solo lugar

---

## Próximo Paso

**Actualizar el Edge Function:**
La función `notify-order-webhook` ya fue actualizada para incluir estos campos en el SELECT query.

**Importante:** Después de ejecutar el script SQL `ADD_MISSING_COLUMNS_ORDERS.sql`, deberás redesplegar la función Edge:

```bash
# Desde tu proyecto local con Supabase CLI
supabase functions deploy notify-order-webhook
```

O puedes redesplegarla manualmente desde el Dashboard de Supabase.
