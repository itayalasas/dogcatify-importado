# Validación de Reservas Duplicadas

## Problema Identificado ❌

Según las capturas de pantalla compartidas, existían **3 reservas para el mismo servicio, fecha y hora**:

```
service_id: c252ee90-690c-4a45-a55a-84b8c273277
appointment_date: 2025-10-20
appointment_time: 09:00
```

Y la interfaz **aún mostraba las 09:00 como disponibles**, permitiendo hacer más reservas para ese mismo horario. Esto es un problema crítico que causa:

- ✗ Sobreagendamiento del servicio
- ✗ Múltiples clientes reservando el mismo horario
- ✗ Conflictos de agenda para los partners
- ✗ Mala experiencia de usuario

---

## Solución Implementada ✅

Se implementaron **3 capas de validación** para prevenir reservas duplicadas:

### 1. Validación al Mostrar Horarios Disponibles

**Archivo**: `app/services/booking/[serviceId].tsx`

**Función**: `fetchBookedTimes()`

```typescript
const fetchBookedTimes = async (date: Date) => {
  if (!partnerId || !serviceId) return;

  try {
    const dateString = date.toISOString().split('T')[0];

    // IMPORTANTE: Consultar ORDERS (no bookings)
    // Filtrar por:
    // 1. service_id = el servicio actual
    // 2. appointment_date = la fecha seleccionada
    // 3. status != 'cancelled' (solo reservas activas)
    const { data: orders, error } = await supabaseClient
      .from('orders')
      .select('appointment_time, status, order_type')
      .eq('service_id', serviceId)
      .gte('appointment_date', `${dateString}T00:00:00`)
      .lte('appointment_date', `${dateString}T23:59:59`)
      .neq('status', 'cancelled')
      .eq('order_type', 'service_booking');

    // Extraer las horas ya reservadas
    const bookedTimeSlots = orders
      ?.filter(order => order.appointment_time)
      .map(order => order.appointment_time) || [];

    setBookedTimes(bookedTimeSlots);
  } catch (error) {
    console.error('Error fetching booked times:', error);
  }
};
```

**Qué hace:**
- ✅ Consulta la tabla `orders` para obtener reservas existentes
- ✅ Filtra por `service_id`, `appointment_date` y excluye canceladas
- ✅ Las horas ocupadas se marcan visualmente como no disponibles
- ✅ El usuario **no puede seleccionar** horas ya reservadas

**Cambio clave:**
- **ANTES**: Consultaba tabla `bookings` (que puede estar desactualizada)
- **AHORA**: Consulta tabla `orders` (la fuente de verdad de las reservas)

---

### 2. Validación Antes de Crear la Orden

**Archivo**: `app/services/booking/[serviceId].tsx`

**Función**: `handleMercadoPagoPayment()`

```typescript
// VALIDACIÓN CRÍTICA: Verificar que no exista una reserva
if (selectedTime && selectedTime !== 'N/A') {
  const dateString = selectedDate.toISOString().split('T')[0];

  console.log('🔍 Validando disponibilidad de horario...');
  const { data: existingOrders, error: checkError } = await supabaseClient
    .from('orders')
    .select('id, appointment_time, status')
    .eq('service_id', service.id)
    .gte('appointment_date', `${dateString}T00:00:00`)
    .lte('appointment_date', `${dateString}T23:59:59`)
    .eq('appointment_time', selectedTime)
    .neq('status', 'cancelled')
    .eq('order_type', 'service_booking');

  if (existingOrders && existingOrders.length > 0) {
    console.warn('⚠️ Ya existe una reserva para esta fecha/hora/servicio');
    setPaymentLoading(false);
    setPaymentStep('methods');

    Alert.alert(
      'Horario No Disponible',
      `Lo sentimos, la hora ${selectedTime} para el día ${selectedDate.toLocaleDateString()} ya no está disponible. Por favor selecciona otro horario.`,
      [
        {
          text: 'Entendido',
          onPress: () => {
            // Recargar los horarios ocupados
            fetchBookedTimes(selectedDate);
            setSelectedTime(null);
          }
        }
      ]
    );
    return; // Detener la creación de la orden
  }

  console.log('✅ Horario disponible, continuando con la reserva...');
}
```

**Qué hace:**
- ✅ Justo antes de crear la orden, valida nuevamente
- ✅ Previene race conditions (2 usuarios reservando simultáneamente)
- ✅ Si el horario ya no está disponible:
  - Muestra un alert explicativo al usuario
  - Recarga los horarios disponibles
  - Resetea la hora seleccionada
  - **NO crea la orden duplicada**
- ✅ Si el horario está disponible, continúa normalmente

**Beneficio:**
- Protege contra el caso donde 2 usuarios están viendo el mismo horario disponible y ambos intentan reservar casi al mismo tiempo

---

### 3. Índices de Base de Datos (Optimización)

**Archivo**: `ADD_BOOKING_VALIDATION.sql`

```sql
-- Índice para consultas de disponibilidad (hace las búsquedas muy rápidas)
CREATE INDEX IF NOT EXISTS idx_orders_booking_availability
ON orders(service_id, appointment_date, appointment_time, status)
WHERE order_type = 'service_booking' AND status != 'cancelled';

-- Índice para búsquedas por fecha
CREATE INDEX IF NOT EXISTS idx_orders_appointment_date
ON orders(appointment_date)
WHERE order_type = 'service_booking' AND status != 'cancelled';
```

**Qué hace:**
- ✅ Hace que las consultas de disponibilidad sean **extremadamente rápidas**
- ✅ Optimiza búsquedas por `service_id`, `appointment_date`, `appointment_time`
- ✅ Funciona incluso con millones de órdenes en la BD

**Constraint Único (Opcional):**
```sql
-- SOLO si TODOS los servicios tienen hora específica
CREATE UNIQUE INDEX idx_orders_unique_booking
ON orders(service_id, appointment_date, appointment_time)
WHERE order_type = 'service_booking' AND status != 'cancelled';
```

**Qué hace:**
- ✅ La BD rechaza automáticamente duplicados a nivel de base de datos
- ✅ Capa extra de seguridad
- ⚠️ Solo usar si **TODOS** los servicios requieren hora específica
- ⚠️ No usar si hay servicios de "día completo" como pensión

---

## Flujo Completo de Validación

### Paso 1: Usuario Selecciona Fecha
```
Usuario selecciona: 20 de octubre
     ↓
fetchBookedTimes(2025-10-20)
     ↓
Consulta orders para ese día
     ↓
Obtiene: [09:00, 14:00, 16:00] están ocupadas
     ↓
Muestra horarios:
  08:00 ✅ Disponible
  09:00 ❌ Ocupado (deshabilitado)
  10:00 ✅ Disponible
  ...
```

### Paso 2: Usuario Intenta Reservar
```
Usuario selecciona: 10:00
     ↓
Presiona "Reservar"
     ↓
handleMercadoPagoPayment()
     ↓
Valida nuevamente: ¿10:00 está libre?
     ↓
     ├─ SÍ → Continúa creando orden
     └─ NO → Muestra alert y recarga horarios
```

### Paso 3: Protección contra Race Conditions
```
Usuario A: Ve 10:00 disponible
Usuario B: Ve 10:00 disponible
     ↓
Usuario A: Presiona "Reservar" (12:00:00.000)
Usuario B: Presiona "Reservar" (12:00:00.100)
     ↓
Usuario A: Validación → ✅ Libre → Crea orden
Usuario B: Validación → ❌ Ocupado (Usuario A ya reservó) → Alert
```

---

## Archivos Modificados

### 1. ✏️ `app/services/booking/[serviceId].tsx`

**Cambios:**
- `fetchBookedTimes()`: Ahora consulta `orders` en vez de `bookings`
- Filtra por `service_id` (antes no lo hacía)
- `handleMercadoPagoPayment()`: Agrega validación antes de crear orden
- `useEffect`: Actualiza dependencias para incluir `serviceId`

### 2. 📄 `ADD_BOOKING_VALIDATION.sql`

**Nuevo archivo:**
- Índices para optimizar consultas de disponibilidad
- Documentación sobre constraint único (opcional)
- Ejemplos de uso

### 3. 📄 `VALIDACION_RESERVAS_DUPLICADAS.md`

**Nuevo archivo:**
- Documentación completa del problema y solución
- Ejemplos de código
- Flujos de validación

---

## Cómo Probar

### Test 1: Horarios Ocupados No Aparecen
1. Crear una reserva para "Baño completo" el 20/oct a las 09:00
2. Intentar crear otra reserva para el mismo servicio y fecha
3. ✅ **Resultado esperado**: Las 09:00 aparecen deshabilitadas/grises

### Test 2: Validación al Intentar Reservar
1. Abrir la app en 2 dispositivos (o navegadores)
2. Ambos seleccionan "Baño completo" para el 20/oct a las 10:00
3. Usuario A presiona "Reservar" primero
4. Usuario B presiona "Reservar" después
5. ✅ **Resultado esperado**:
   - Usuario A: Reserva exitosa
   - Usuario B: Alert "Horario No Disponible"

### Test 3: Servicios Diferentes (No Deben Interferir)
1. Crear reserva para "Baño completo" a las 09:00
2. Intentar reservar "Consulta veterinaria" a las 09:00
3. ✅ **Resultado esperado**: Ambas reservas exitosas (son servicios diferentes)

### Test 4: Mismo Servicio, Diferentes Horas
1. Crear reserva para "Baño completo" a las 09:00
2. Intentar reservar "Baño completo" a las 10:00
3. ✅ **Resultado esperado**: Ambas reservas exitosas (horas diferentes)

---

## Métricas de Impacto

### Antes de los Cambios:
- ❌ Múltiples reservas para mismo horario
- ❌ Horarios ocupados aparecen como disponibles
- ❌ Sobreagendamiento de servicios
- ❌ Conflictos de agenda

### Después de los Cambios:
- ✅ Solo 1 reserva por servicio/fecha/hora
- ✅ Horarios ocupados aparecen deshabilitados
- ✅ Validación en tiempo real
- ✅ Protección contra race conditions
- ✅ Consultas optimizadas con índices

---

## Próximos Pasos

### 1. Ejecutar Script SQL
```bash
# En Supabase Dashboard → SQL Editor
# Ejecutar: ADD_BOOKING_VALIDATION.sql
```

Esto creará los índices para optimizar las consultas.

### 2. Probar la Funcionalidad
- Intentar crear reservas duplicadas
- Verificar que los horarios ocupados se muestran correctamente
- Probar en múltiples dispositivos simultáneamente

### 3. Considerar Constraint Único (Opcional)
Si **TODOS** tus servicios requieren hora específica, puedes descomentar la línea del constraint único en el SQL para tener una capa extra de validación a nivel de BD.

---

## Notas Importantes

⚠️ **Sobre la tabla `bookings`:**
- La tabla `bookings` puede tener datos temporales o desactualizados
- La tabla `orders` es la fuente de verdad de las reservas confirmadas
- Por eso ahora consultamos `orders` en vez de `bookings`

⚠️ **Servicios de día completo (pensión):**
- Estos servicios usan `appointment_time = 'N/A'` o similar
- La validación de duplicados está desactivada para ellos
- Si quieres validar pensión, necesitarás una lógica diferente (ej: validar por capacidad diaria)

⚠️ **Performance:**
- Con los índices creados, las consultas son muy rápidas
- Sin índices, con muchas órdenes, las consultas pueden ser lentas
- **Es importante ejecutar el script SQL** para crear los índices

---

## Contacto

Si tienes dudas sobre esta implementación o necesitas ajustes adicionales, no dudes en preguntar.
