# Ajustes Realizados - Sistema de Órdenes y Pagos

## Resumen de Cambios

Se realizaron ajustes al sistema de notificaciones de MercadoPago y al registro de datos en las órdenes para mejorar la gestión de pagos fallidos y asegurar que todos los datos necesarios estén disponibles sin necesidad de JOINs.

---

## 1. Gestión de Pagos Fallidos

### Problema
Cuando un usuario iba a MercadoPago para pagar y cancelaba el pago desde allá, regresaba a la aplicación pero la orden quedaba en estado `pending` indefinidamente.

### Solución Implementada
**Archivo**: `app/payment/failure.tsx`

La pantalla de pago fallido ahora:

1. **Cancela automáticamente la orden** cuando el usuario regresa de MercadoPago
2. **Actualiza el estado** de la orden a `cancelled` y `payment_status` a `failed`
3. **Cancela la reserva asociada** (si es una orden de tipo `service_booking`)
4. **Restaura el stock de productos** (solo para productos, no servicios)
5. **Muestra información detallada** de la orden cancelada

### Flujo de Cancelación
```
Usuario → MercadoPago → Cancela pago → Regresa a app (dogcatify://payment/failure?order_id=xxx)
   ↓
App detecta order_id → Cancela orden → Actualiza booking (si existe) → Restaura stock
   ↓
Muestra pantalla de pago fallido con detalles
```

### Código Clave
```typescript
// Cancelar la orden
await supabaseClient
  .from('orders')
  .update({
    status: 'cancelled',
    payment_status: 'failed',
    updated_at: new Date().toISOString()
  })
  .eq('id', order_id);

// Cancelar reserva asociada (si existe)
if (order.booking_id) {
  await supabaseClient
    .from('bookings')
    .update({
      status: 'cancelled',
      payment_status: 'failed',
      updated_at: new Date().toISOString()
    })
    .eq('id', order.booking_id);
}

// Restaurar stock de productos
for (const item of order.items) {
  if (item.type !== 'service') {
    // Incrementar stock...
  }
}
```

---

## 2. Registro Completo de Datos en Órdenes

### Problema
Las órdenes generadas desde servicios (veterinaria, peluquería, pensión, etc.) no registraban todos los datos necesarios como:
- Nombre del negocio
- Nombre del servicio
- Nombre de la mascota
- Datos del cliente

Esto requería hacer múltiples JOINs para mostrar información básica.

### Solución Implementada
**Archivo**: `utils/mercadoPago.ts`

#### Órdenes de Servicios (`createServiceBookingOrder`)
Ahora registra:

```typescript
const orderData = {
  // IDs de relaciones
  partner_id: bookingData.partnerId,
  customer_id: bookingData.customerId,
  booking_id: insertedBooking.id,
  service_id: bookingData.serviceId,
  pet_id: bookingData.petId,

  // NUEVOS: Datos completos (sin necesidad de JOINs)
  partner_name: bookingData.partnerName,        // ej: "Veterinaria San Francisco"
  service_name: bookingData.serviceName,        // ej: "Consulta General"
  pet_name: bookingData.petName,                // ej: "Max"
  customer_name: bookingData.customerInfo.displayName,
  customer_email: bookingData.customerInfo.email,
  customer_phone: bookingData.customerInfo.phone,

  // Detalles de la cita
  appointment_date: bookingData.date.toISOString(),
  appointment_time: bookingData.time,
  booking_notes: bookingData.notes,

  // Items con datos completos
  items: [{
    id: bookingData.serviceId,
    name: bookingData.serviceName,
    price: bookingData.totalAmount,
    quantity: 1,
    type: 'service',
    partner_name: bookingData.partnerName,     // NUEVO en items
    iva_rate: ivaRate,
    subtotal: subtotal,
    iva_amount: ivaAmount,
    discount_percentage: bookingData.discountPercentage ?? 0,
    original_price: bookingData.originalPrice,
    currency: 'UYU',
    currency_code_dgi: '858'
  }],

  // Totales con IVA
  subtotal: subtotal,
  iva_rate: ivaRate,
  iva_amount: ivaAmount,
  total_amount: bookingData.totalAmount,
  commission_amount: commissionAmount,
  partner_amount: partnerAmount,

  // Metadata
  payment_method: 'mercadopago',
  status: 'pending',
  order_type: 'service_booking',
  created_at: new Date().toISOString()
};
```

#### Órdenes de Productos (`createMultiPartnerOrder`)
Ahora registra:

```typescript
const orderData = {
  partner_id: primaryPartnerId,
  customer_id: customerInfo.id,

  // NUEVOS: Datos completos
  partner_name: primaryPartnerConfig.business_name,
  customer_name: customerInfo.displayName || 'Usuario',
  customer_email: customerInfo.email,
  customer_phone: customerInfo.phone || null,

  // Items, totales, etc...
  items: itemsWithIVA,
  subtotal: ivaCalculation.subtotal,
  iva_rate: ivaCalculation.ivaRate,
  iva_amount: ivaCalculation.ivaAmount,
  total_amount: totalAmount,
  // ...resto de campos
};
```

---

## 3. Columnas Necesarias en la Tabla `orders`

### Columnas Actuales (según imagen)
✅ Ya existen:
- `id`, `partner_id`, `customer_id`
- `items` (jsonb)
- `status`, `total_amount`
- `shipping_address`
- `created_at`, `updated_at`
- `payment_preference_id`, `payment_id`, `payment_method`, `payment_status`, `payment_data`
- `commission_amount`, `partner_amount`, `partner_breakdown`
- `booking_id`, `order_type`, `service_id`, `appointment_date`, `appointment_time`, `pet_id`, `booking_notes`
- `subtotal`, `iva_rate`, `iva_amount`, `iva_included_in_price`

### Columnas a Agregar (❌ Faltan)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `partner_name` | text | Nombre del negocio/veterinaria/peluquería |
| `service_name` | text | Nombre del servicio (solo para service_booking) |
| `pet_name` | text | Nombre de la mascota |
| `customer_name` | text | Nombre completo del cliente |
| `customer_email` | text | Email del cliente |
| `customer_phone` | text | Teléfono del cliente |

### Script SQL para Agregar Columnas
**Archivo**: `ADD_MISSING_COLUMNS_ORDERS.sql`

Ejecutar en el SQL Editor de Supabase:
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS partner_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pet_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone text;

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_orders_partner_name ON orders(partner_name);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
```

---

## 4. Beneficios de los Cambios

### 4.1 Gestión de Pagos Fallidos
- ✅ **Órdenes limpias**: No quedan órdenes pendientes indefinidamente
- ✅ **Stock actualizado**: El stock se restaura automáticamente al cancelar
- ✅ **Experiencia de usuario**: Retroalimentación clara sobre el estado del pago
- ✅ **Integridad de datos**: Bookings y orders siempre sincronizados

### 4.2 Datos Completos en Órdenes
- ✅ **Sin JOINs**: Información básica disponible directamente en la orden
- ✅ **Rendimiento**: Consultas más rápidas al evitar JOINs
- ✅ **Histórico preservado**: Si se elimina un partner/servicio/pet, la orden mantiene los datos
- ✅ **Reportes simplificados**: Toda la info necesaria en una sola tabla
- ✅ **Facturación**: Datos completos para generar facturas e invoices

---

## 5. Webhooks de MercadoPago (Sin Cambios)

Los webhooks existentes siguen funcionando normalmente:

**Archivo**: `supabase/functions/mercadopago-webhook/index.ts`

- ✅ `payment.created` → Actualiza orden a `confirmed`
- ✅ `payment.updated` → Actualiza orden según estado
- ✅ Estados manejados: `approved`, `pending`, `in_process`, `rejected`, `cancelled`, `refunded`

**Lo único nuevo** es el manejo en la app cuando el usuario cancela desde MercadoPago y regresa directamente sin webhook.

---

## 6. Próximos Pasos

### Para aplicar los cambios:

1. **Ejecutar el script SQL** en Supabase:
   ```bash
   # Abrir Supabase Dashboard → SQL Editor
   # Copiar y pegar el contenido de ADD_MISSING_COLUMNS_ORDERS.sql
   # Ejecutar
   ```

2. **Verificar que las columnas se agregaron**:
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'orders'
   ORDER BY column_name;
   ```

3. **Probar el flujo de pago fallido**:
   - Crear una orden
   - Ir a MercadoPago
   - Cancelar el pago
   - Verificar que la orden se cancele automáticamente
   - Verificar que el stock se restaure (si hay productos)

4. **Verificar nuevas órdenes**:
   - Crear una orden de servicio
   - Verificar que tenga `partner_name`, `service_name`, `pet_name`, etc.
   - Crear una orden de productos
   - Verificar que tenga `partner_name`, `customer_name`, etc.

---

## 7. Archivos Modificados

1. ✏️ `app/payment/failure.tsx` - Gestión de pagos fallidos
2. ✏️ `utils/mercadoPago.ts` - Registro completo de datos en órdenes
3. 📄 `supabase/migrations/20251019033500_add_order_details_columns.sql` - Migración de BD
4. 📄 `ADD_MISSING_COLUMNS_ORDERS.sql` - Script SQL para ejecutar manualmente
5. 📄 `AJUSTES_ORDENES_Y_PAGOS.md` - Este documento

---

## 8. Notas Importantes

⚠️ **Importante**: Después de agregar las columnas en la base de datos, todas las **nuevas órdenes** tendrán estos datos completos. Las órdenes antiguas tendrán estos campos en `null`, lo cual es normal.

⚠️ **Webhook sigue funcionando**: Los cambios no afectan el webhook de MercadoPago. Solo agregamos el manejo del caso cuando el usuario cancela directamente desde la interfaz de MercadoPago.

⚠️ **Compatibilidad**: El código es compatible hacia atrás. Si falta alguna columna, simplemente no se guardará ese dato, pero no causará errores.

---

## Contacto y Soporte

Si tienes dudas sobre estos cambios o necesitas ajustes adicionales, no dudes en preguntar.
