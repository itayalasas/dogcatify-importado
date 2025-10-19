-- ============================================
-- Validación de Reservas Duplicadas
-- ============================================
-- Este script previene que se puedan hacer múltiples reservas
-- para el mismo servicio, fecha y hora.

-- 1. Crear índice para optimizar consultas de disponibilidad
-- Este índice hace que las búsquedas de horarios disponibles sean mucho más rápidas
CREATE INDEX IF NOT EXISTS idx_orders_booking_availability
ON orders(service_id, appointment_date, appointment_time, status)
WHERE order_type = 'service_booking' AND status != 'cancelled';

COMMENT ON INDEX idx_orders_booking_availability IS
'Índice para consultas rápidas de disponibilidad de horarios en reservas de servicios';

-- 2. Crear índice para búsquedas por fecha
CREATE INDEX IF NOT EXISTS idx_orders_appointment_date
ON orders(appointment_date)
WHERE order_type = 'service_booking' AND status != 'cancelled';

-- 3. OPCIONAL: Constraint único para evitar duplicados a nivel de BD
-- IMPORTANTE: Este constraint previene completamente reservas duplicadas,
-- pero solo funciona si appointment_time nunca es NULL para service_booking.
-- Si hay servicios sin hora específica (como pensión todo el día),
-- este constraint podría causar problemas. En ese caso, NO ejecutar esta línea.

-- Descomentar la siguiente línea solo si TODOS los servicios requieren hora específica:
-- CREATE UNIQUE INDEX idx_orders_unique_booking
-- ON orders(service_id, appointment_date, appointment_time)
-- WHERE order_type = 'service_booking' AND status != 'cancelled';

-- ============================================
-- Verificar que los índices se crearon
-- ============================================
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'orders'
    AND indexname LIKE '%booking%'
ORDER BY indexname;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

/*
CÓMO FUNCIONA LA VALIDACIÓN:

1. **En la App (React Native)**:
   - Antes de crear una orden, se consulta la tabla `orders`
   - Se buscan reservas existentes para:
     * mismo service_id
     * misma fecha (appointment_date)
     * misma hora (appointment_time)
     * estado != 'cancelled'
   - Si existe una reserva, se bloquea y se muestra alerta al usuario
   - Si no existe, se permite crear la orden

2. **Al Mostrar Horarios Disponibles**:
   - Se consultan todas las órdenes para el servicio y fecha seleccionada
   - Las horas con reservas activas se marcan como no disponibles
   - El usuario solo puede seleccionar horas libres

3. **Índices Creados**:
   - `idx_orders_booking_availability`: Optimiza búsquedas de disponibilidad
   - `idx_orders_appointment_date`: Optimiza búsquedas por fecha

4. **Constraint Único (Opcional)**:
   - Si se activa, la BD rechazará automáticamente duplicados
   - Útil como capa extra de seguridad
   - Solo usar si TODOS los servicios tienen hora específica

EJEMPLO DE CONSULTA OPTIMIZADA:
```sql
SELECT appointment_time
FROM orders
WHERE service_id = 'abc-123'
  AND appointment_date >= '2025-10-20T00:00:00'
  AND appointment_date <= '2025-10-20T23:59:59'
  AND status != 'cancelled'
  AND order_type = 'service_booking';
```

Esta consulta ahora usará el índice `idx_orders_booking_availability`
y será extremadamente rápida incluso con millones de órdenes.
*/
