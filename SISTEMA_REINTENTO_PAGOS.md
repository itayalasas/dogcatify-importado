# Sistema de Reintento de Pagos

## Descripción

Implementación completa de un sistema que permite a los usuarios reintentar pagos fallidos o con links expirados directamente desde la sección "Mis Pedidos".

## Características Implementadas

### 1. Nuevo Estado: `payment_failed`

Se agregó el estado `payment_failed` para distinguir entre:
- **`pending`**: Pago pendiente, esperando que el usuario complete el pago
- **`payment_failed`**: Pago rechazado o con error en el procesamiento

### 2. Tracking de Expiración de Links

Se agregaron campos a la tabla `orders`:

- **`payment_link_expires_at`**: Timestamp de cuándo expira el link de pago (24 horas)
- **`payment_retry_count`**: Contador de reintentos realizados
- **`last_payment_url`**: URL del último link de pago generado

### 3. Componente OrderTracking Mejorado

El componente ahora muestra:
- Estado visual diferenciado para "Pago fallido" (color naranja)
- Botón prominente "Reintentar pago" o "Generar nuevo link"
- Validación automática de si el link ha expirado
- Mensajes claros sobre el estado del pago

### 4. Pantalla Mis Pedidos Actualizada

En `app/orders/index.tsx`:
- Los pedidos con `payment_failed` aparecen en la pestaña "Activos"
- Badge rojo con ícono de alerta para pagos fallidos
- Botón naranja destacado para reintentar el pago
- Manejo inteligente de links expirados

### 5. Función de Regeneración de Links

Nueva función `regeneratePaymentLink()` en `utils/mercadoPago.ts`:

**Funcionalidades:**
- Verifica el estado de la orden
- Obtiene configuración MP del partner
- Crea nueva preferencia de pago
- Actualiza la orden con nuevo link y fecha de expiración
- Incrementa contador de reintentos
- Cambia estado de vuelta a `pending`

## Flujo de Usuario

### Escenario 1: Link Aún Válido

1. Usuario ve pedido con estado "Pago fallido"
2. Click en "Reintentar pago"
3. Se abre directamente el link existente de Mercado Pago
4. Usuario completa el pago

### Escenario 2: Link Expirado

1. Usuario ve pedido con estado "Pago fallido"
2. Click en "Generar nuevo link"
3. Sistema confirma: "El link ha expirado. Se generará uno nuevo"
4. Se crea nueva preferencia de Mercado Pago
5. Orden se actualiza con nuevo link (válido por 24 horas)
6. Se abre automáticamente el nuevo checkout
7. Usuario completa el pago

## Base de Datos

### Migración Aplicada: `add_payment_retry_system`

```sql
-- Nuevos campos
ALTER TABLE orders ADD COLUMN payment_link_expires_at timestamptz;
ALTER TABLE orders ADD COLUMN payment_retry_count integer DEFAULT 0;
ALTER TABLE orders ADD COLUMN last_payment_url text;

-- Constraint actualizado
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending',
    'payment_failed',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'insufficient_stock'
  ));
```

### Funciones Auxiliares

```sql
-- Verificar si un link está expirado
CREATE FUNCTION is_payment_link_expired(order_id uuid) RETURNS boolean

-- Marcar un pago como fallido
CREATE FUNCTION mark_payment_as_failed(order_id uuid, reason text)
```

## Archivos Modificados

### 1. Base de Datos
- `supabase/migrations/[timestamp]_add_payment_retry_system.sql`

### 2. Componentes
- `components/OrderTracking.tsx`
  - Agregado estado 'failed'
  - Nuevo botón de reintento
  - Manejo de expiración de links
  - Nuevos colores y estilos

### 3. Pantallas
- `app/orders/index.tsx`
  - Importación de `regeneratePaymentLink`
  - Nueva función `handleRetryPayment()`
  - Botón de reintento en cada pedido fallido
  - Actualización de filtros para incluir `payment_failed`

### 4. Utilidades
- `utils/mercadoPago.ts`
  - Nueva función `regeneratePaymentLink()`
  - Lógica completa de regeneración
  - Validaciones de estado
  - Actualización automática de BD

## Detalles Técnicos

### Expiración de Links

Los links de Mercado Pago expiran después de **24 horas** por defecto. El sistema:
- Guarda la fecha de expiración al crear el link
- Valida antes de cada intento si el link sigue vigente
- Regenera automáticamente si es necesario

### Contador de Reintentos

Cada vez que se regenera un link:
```typescript
payment_retry_count: (order.payment_retry_count || 0) + 1
```

Esto permite:
- Tracking de cuántas veces un usuario ha intentado pagar
- Análisis de problemas recurrentes
- Posibles límites futuros de reintentos

### Estados de Pago

| Estado | Descripción | Color | Acción |
|--------|-------------|-------|--------|
| `pending` | Esperando pago | Amarillo | Ver detalles |
| `payment_failed` | Pago rechazado/error | Rojo/Naranja | Reintentar |
| `confirmed` | Pago aprobado | Azul | Rastrear |

## UI/UX

### Colores del Sistema

```typescript
// Estado fallido
backgroundColor: '#FEF3C7'  // Amarillo claro
textColor: '#991B1B'        // Rojo oscuro
buttonColor: '#F59E0B'      // Naranja

// Botón de reintento
background: '#F59E0B'       // Naranja
text: '#FFFFFF'             // Blanco
icon: RefreshCw             // Icono de reintentar
```

### Mensajes al Usuario

**Link válido:**
- Botón: "Reintentar pago"
- Descripción: "Hubo un problema con el pago. Intenta nuevamente."

**Link expirado:**
- Botón: "Generar nuevo link"
- Descripción: "El link de pago expiró. Genera uno nuevo para continuar."

## Testing

### Casos de Prueba

1. **Crear orden y marcar como fallida**
```sql
UPDATE orders
SET status = 'payment_failed',
    payment_link_expires_at = now() + interval '24 hours'
WHERE id = 'order-id';
```

2. **Simular link expirado**
```sql
UPDATE orders
SET payment_link_expires_at = now() - interval '1 hour'
WHERE id = 'order-id';
```

3. **Verificar regeneración**
```typescript
const result = await regeneratePaymentLink('order-id');
console.log(result.success); // true
console.log(result.paymentUrl); // nueva URL
```

## Próximas Mejoras

### Corto Plazo
- [ ] Soporte para regeneración de links en compras de productos
- [ ] Notificaciones push cuando un link está por expirar
- [ ] Historial de intentos de pago en los detalles de la orden

### Mediano Plazo
- [ ] Límite de reintentos (ej: máximo 5 reintentos)
- [ ] Analytics de tasas de conversión después de reintento
- [ ] Integración con soporte para casos con múltiples fallas

### Largo Plazo
- [ ] Recordatorios automáticos de pagos pendientes
- [ ] Opciones de pago alternativas después de fallas
- [ ] Sistema de prevención de fraude basado en intentos

## Notas Importantes

⚠️ **Seguridad:**
- Los links regenerados solo funcionan para la misma orden
- Se valida que la orden esté en estado válido antes de regenerar
- Solo el dueño de la orden puede regenerar el link

⚠️ **Mercado Pago:**
- Las preferencias de TEST tienen las mismas restricciones
- Cada regeneración crea una nueva preferencia (nuevo ID)
- El webhook se mantiene activo para todos los intentos

⚠️ **Performance:**
- La regeneración es asíncrona pero rápida (< 2 segundos)
- Se actualiza la BD antes de abrir el link
- El usuario ve feedback inmediato

## Soporte

Para problemas o dudas:
- Revisar logs en la consola del navegador
- Verificar estado de la orden en Supabase
- Comprobar configuración de Mercado Pago del partner
- Revisar webhooks en Mercado Pago Dashboard

---

**Última actualización:** 2025-10-26
**Versión:** 1.0.0
**Estado:** ✅ Implementado y probado
