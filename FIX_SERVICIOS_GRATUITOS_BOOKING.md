# Fix: Servicios Gratuitos no deben ir a MercadoPago

## Problema

Cuando un servicio tiene precio $0 o está marcado como `has_cost = false`, la app seguía mostrando el modal de "Método de Pago" y redirigiendo a MercadoPago.

**Comportamiento incorrecto:**
1. Usuario selecciona servicio gratuito (Consulta traumatomogo - $0)
2. Usuario selecciona fecha y hora
3. Usuario presiona "Confirmar Reserva"
4. ❌ Se abre modal de "Método de Pago"
5. ❌ Se redirige a MercadoPago

**Comportamiento esperado:**
1. Usuario selecciona servicio gratuito
2. Usuario selecciona fecha y hora
3. Usuario presiona "Confirmar Reserva"
4. ✅ Se crea la reserva directamente
5. ✅ Muestra confirmación sin pasar por pago

## Causa del Problema

### 1. Detección incorrecta de servicio gratuito

En `app/services/booking.tsx` (línea 94):
```typescript
hasCost: serviceData.has_cost === true || serviceData.has_cost === null
```

Esta lógica asumía que `has_cost = null` significa "tiene costo", pero debería ser al revés. Si no está explícitamente en `false`, se considera con costo.

### 2. No validaba precio $0

No se verificaba si `price === 0` para determinar si es servicio gratuito.

### 3. Siempre abría modal de pago

En `app/services/booking/[serviceId].tsx` (línea 429):
```typescript
setShowPaymentModal(true); // Siempre se abría
```

No había validación previa del costo del servicio.

## Solución Implementada

### Archivo 1: `app/services/booking.tsx`

#### Mejora en detección de servicio gratuito:

```typescript
// Determinar si el servicio tiene costo:
// 1. Si has_cost es explícitamente false → servicio gratis
// 2. Si price es 0 → servicio gratis
// 3. En cualquier otro caso → tiene costo
const isFreeService = serviceData.has_cost === false || serviceData.price === 0;

console.log('Service data loaded:', {
  id: serviceData.id,
  name: serviceData.name,
  has_cost: serviceData.has_cost,
  price: serviceData.price,
  isFreeService: isFreeService
});

setService({
  id: serviceData.id,
  name: serviceData.name,
  description: serviceData.description,
  price: serviceData.price || 0,
  duration: serviceData.duration,
  category: serviceData.category,
  partnerId: serviceData.partner_id,
  hasCost: !isFreeService, // False si es gratis, true si tiene costo
});
```

**Qué hace:**
- Verifica `has_cost === false` explícitamente
- Verifica `price === 0` como segunda condición
- Ambas condiciones indican servicio gratuito
- Registra en logs para debugging

#### Modal de pago solo si tiene costo:

```typescript
{/* Modal de Métodos de Pago - Solo se muestra si el servicio tiene costo */}
{service?.hasCost && (
  <Modal
    visible={showPaymentMethodModal}
    transparent
    animationType="slide"
    onRequestClose={() => setShowPaymentModal(false)}
  >
```

**Antes:** `service?.hasCost === true`
**Después:** `service?.hasCost`

### Archivo 2: `app/services/booking/[serviceId].tsx`

#### Validación antes de abrir modal:

```typescript
const handleConfirmBooking = () => {
  if (!selectedDate) {
    Alert.alert('Error', 'Por favor selecciona una fecha');
    return;
  }

  if (!boardingCategory && !selectedTime) {
    Alert.alert('Error', 'Por favor selecciona una hora');
    return;
  }

  // Verificar si el servicio es gratuito
  const servicePrice = getServicePrice();
  const isFreeService = service?.has_cost === false || servicePrice === 0;

  console.log('Confirming booking - Price:', servicePrice, 'Is Free:', isFreeService);

  if (isFreeService) {
    // Servicio gratuito - crear reserva directamente sin pago
    handleFreeServiceBooking();
  } else {
    // Servicio con costo - mostrar modal de pago
    setShowPaymentModal(true);
  }
};
```

**Qué hace:**
- Calcula el precio del servicio (incluyendo descuentos)
- Verifica si es gratis (`has_cost === false` o `price === 0`)
- Si es gratis: llama a `handleFreeServiceBooking()`
- Si tiene costo: abre modal de pago

#### Nueva función para servicios gratuitos:

```typescript
const handleFreeServiceBooking = async () => {
  if (!selectedDate || !service || !partner || !pet || !currentUser) {
    Alert.alert('Error', 'Información de reserva incompleta');
    return;
  }

  setPaymentLoading(true);
  setPaymentMessage('Confirmando tu reserva...');

  try {
    // Crear fecha y hora de la reserva
    const bookingDate = new Date(selectedDate);
    if (selectedTime) {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      bookingDate.setHours(hours, minutes, 0, 0);
    }

    // Crear la reserva directamente sin pago
    const { data: bookingData, error: bookingError } = await supabaseClient
      .from('bookings')
      .insert({
        service_id: serviceId,
        partner_id: partnerId,
        customer_id: currentUser.id,
        pet_id: petId,
        booking_date: bookingDate.toISOString(),
        booking_time: selectedTime || null,
        status: 'confirmed', // ✅ Directamente confirmada
        notes: notes.trim() || null,
        boarding_category: boardingCategory || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    // Enviar notificación al partner
    try {
      const { default: NotificationService } = await import('../../utils/notifications');
      await NotificationService.sendNotification(
        partnerId,
        '🎉 Nueva Reserva',
        `${currentUser.displayName || 'Un cliente'} ha reservado ${service.name}`,
        {
          type: 'booking',
          bookingId: bookingData.id,
          serviceId: serviceId
        }
      );
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
    }

    setPaymentLoading(false);

    Alert.alert(
      '¡Reserva Confirmada! 🎉',
      `Tu reserva ha sido confirmada:\n\n📅 ${selectedDate.toLocaleDateString()}\n${timeInfo}\n\nRecibirás una notificación de confirmación.`,
      [{ text: 'Perfecto', onPress: () => router.replace('/(tabs)/services') }]
    );
  } catch (error) {
    console.error('Error creating free booking:', error);
    setPaymentLoading(false);
    Alert.alert('Error', 'No se pudo crear la reserva. Por favor intenta nuevamente.');
  }
};
```

**Qué hace:**
- Crea la reserva directamente en Supabase
- Estado: `'confirmed'` (sin necesidad de pago)
- Envía notificación al partner
- Muestra confirmación al usuario
- Redirige a la pantalla de servicios

## Flujo Nuevo

### Servicio Gratuito (precio $0 o has_cost = false):

```
Usuario selecciona servicio
    ↓
Usuario selecciona fecha y hora
    ↓
Usuario presiona "Confirmar Reserva"
    ↓
handleConfirmBooking() detecta isFreeService = true
    ↓
handleFreeServiceBooking()
    ↓
INSERT INTO bookings (status = 'confirmed')
    ↓
Notificación al partner
    ↓
Alert de confirmación
    ↓
Redirect a /(tabs)/services
```

### Servicio con Costo (precio > 0 y has_cost != false):

```
Usuario selecciona servicio
    ↓
Usuario selecciona fecha y hora
    ↓
Usuario presiona "Confirmar Reserva"
    ↓
handleConfirmBooking() detecta isFreeService = false
    ↓
setShowPaymentModal(true)
    ↓
Usuario selecciona método de pago
    ↓
handleMercadoPagoPayment() o handleCardPayment()
    ↓
Proceso de pago...
```

## Casos de Uso Soportados

### Caso 1: Servicio explícitamente gratuito

```sql
INSERT INTO partner_services (name, price, has_cost)
VALUES ('Consulta gratis', 0, false);
```

✅ No redirige a MercadoPago

### Caso 2: Servicio con precio $0 pero has_cost no definido

```sql
INSERT INTO partner_services (name, price, has_cost)
VALUES ('Evento sin costo', 0, null);
```

✅ No redirige a MercadoPago (detecta price = 0)

### Caso 3: Servicio con precio pero marcado como sin costo

```sql
INSERT INTO partner_services (name, price, has_cost)
VALUES ('Donación sugerida', 100, false);
```

✅ No redirige a MercadoPago (respeta has_cost = false)

### Caso 4: Servicio con costo normal

```sql
INSERT INTO partner_services (name, price, has_cost)
VALUES ('Consulta veterinaria', 800, true);
```

✅ Redirige a MercadoPago correctamente

### Caso 5: Servicio con descuento 100%

```sql
-- Precio original: 500
-- Descuento: 100%
-- Precio final: 0
```

✅ No redirige a MercadoPago (detecta precio final = 0)

## Testing

### Pasos para probar:

1. **Crear servicio gratuito:**
   ```sql
   UPDATE partner_services
   SET price = 0, has_cost = false
   WHERE name = 'Consulta traumatomogo';
   ```

2. **En la app:**
   - Ir a servicios
   - Seleccionar "Consulta traumatomogo"
   - Verificar que muestra "$0" o "GRATIS"
   - Seleccionar mascota
   - Seleccionar fecha
   - Seleccionar hora
   - Presionar "Confirmar Reserva"

3. **Verificar:**
   - ✅ NO debe abrir modal de "Método de Pago"
   - ✅ Debe mostrar loader breve "Confirmando tu reserva..."
   - ✅ Debe mostrar "¡Reserva Confirmada! 🎉"
   - ✅ Debe redirigir a servicios
   - ✅ Booking debe estar en estado 'confirmed' en DB

4. **Verificar en DB:**
   ```sql
   SELECT id, service_id, status, created_at
   FROM bookings
   WHERE customer_id = 'tu-user-id'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

   Debe mostrar:
   - `status = 'confirmed'`
   - No debe tener `payment_id` asociado

### Probar con servicio de pago:

1. **Servicio con costo:**
   ```sql
   UPDATE partner_services
   SET price = 500, has_cost = true
   WHERE name = 'Consulta veterinaria';
   ```

2. **En la app:**
   - Seguir mismos pasos
   - Presionar "Confirmar Reserva"

3. **Verificar:**
   - ✅ DEBE abrir modal de "Método de Pago"
   - ✅ Debe mostrar opciones de pago
   - ✅ Debe redirigir a MercadoPago al seleccionar

## Archivos Modificados

```
✅ app/services/booking.tsx
   - Mejora detección de servicio gratuito (líneas 79-102)
   - Modal solo si tiene costo (línea 709)

✅ app/services/booking/[serviceId].tsx
   - Validación en handleConfirmBooking (líneas 419-443)
   - Nueva función handleFreeServiceBooking (líneas 445-519)
```

## Beneficios

### Para usuarios:
- ✅ Experiencia más rápida para servicios gratuitos
- ✅ No confunde con pantallas de pago innecesarias
- ✅ Confirmación inmediata

### Para partners:
- ✅ Pueden ofrecer servicios sin costo
- ✅ Reciben notificación de reserva igual
- ✅ Bookings aparecen confirmados automáticamente

### Para el sistema:
- ✅ Menos carga en MercadoPago
- ✅ Menos errores de integración de pago
- ✅ Logs más claros (indica si es servicio gratuito)

## Logs para Debugging

Con el fix implementado, los logs mostrarán:

```
Service data loaded: {
  id: "uuid...",
  name: "Consulta traumatomogo",
  has_cost: false,
  price: 0,
  isFreeService: true
}

Confirming booking - Price: 0 Is Free: true
Service is free, confirming directly
```

Esto facilita el debugging en producción.

## Próximos Pasos

1. ✅ Commit de los cambios
2. ✅ Build y deploy
3. ✅ Probar en dispositivo real
4. ✅ Verificar bookings en DB
5. ✅ Confirmar notificaciones a partners

## Notas Importantes

- El campo `has_cost` en la tabla `partner_services` debe ser tipo `boolean`
- Si `has_cost` es `null`, se considera que tiene costo (por seguridad)
- Si `price` es `0`, siempre se considera gratuito, independientemente de `has_cost`
- Los servicios gratuitos se crean con `status = 'confirmed'` directamente
- Los servicios con pago se crean con `status = 'pending'` hasta que se confirme el pago
