# 🔧 Fix: Scheduled Notifications - Serialización de Data para FCM v1

## 🐛 Problema Encontrado

La edge function `send-scheduled-notifications` estaba fallando con el siguiente error:

```
"Invalid value at 'message.data[4].value' (TYPE_STRING), 3411.12"
```

### Causa Raíz

FCM v1 API **requiere que todos los valores en el campo `data` sean strings**, pero la función estaba enviando valores de diferentes tipos (números, booleans, objetos) directamente.

### Ejemplo del Error

```typescript
// ❌ INCORRECTO - Causa el error
data: {
  orderId: 123,           // número
  amount: 3411.12,        // número decimal
  isPaid: true,           // boolean
  items: { id: 1 }        // objeto
}

// ✅ CORRECTO - Lo que FCM v1 necesita
data: {
  orderId: "123",
  amount: "3411.12",
  isPaid: "true",
  items: "{\"id\":1}"
}
```

## ✅ Solución Implementada

### Serialización Automática de Data

Agregamos código que convierte automáticamente todos los valores a strings antes de enviar a FCM v1:

```typescript
// Convertir todos los valores de data a strings (requerido por FCM v1)
const notificationData = notification.data || {};
const serializedData: Record<string, string> = {};

for (const [key, value] of Object.entries(notificationData)) {
  if (value !== null && value !== undefined) {
    // Si ya es string, lo deja como está
    // Si no, lo convierte a JSON string
    serializedData[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
}

// Ahora enviar con data serializado
const fcmResponse = await fetch(
  `${supabaseUrl}/functions/v1/send-notification-fcm-v1`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({
      token: profile.fcm_token,
      title: notification.title,
      body: notification.body,
      data: serializedData,  // ✅ Todos los valores son strings
      channelId: 'default',
    }),
  }
);
```

## 📊 Comparación Antes/Después

### Antes (❌ Error)

```typescript
// Data original de la notificación
const notificationData = {
  type: "order_update",
  orderId: 456,
  amount: 3411.12,
  currency: "UYU",
  status: "paid"
};

// Se enviaba directamente a FCM v1
body: JSON.stringify({
  token: profile.fcm_token,
  title: "Pedido actualizado",
  body: "Tu pedido ha sido confirmado",
  data: notificationData  // ❌ Contiene números
})

// Resultado: ERROR 400
// "Invalid value at 'message.data[4].value' (TYPE_STRING), 3411.12"
```

### Después (✅ Funciona)

```typescript
// Data original de la notificación
const notificationData = {
  type: "order_update",
  orderId: 456,
  amount: 3411.12,
  currency: "UYU",
  status: "paid"
};

// Serialización automática
const serializedData = {};
for (const [key, value] of Object.entries(notificationData)) {
  serializedData[key] = typeof value === 'string' ? value : JSON.stringify(value);
}

// Resultado:
{
  type: "order_update",      // String, no cambia
  orderId: "456",            // Convertido a string
  amount: "3411.12",         // Convertido a string
  currency: "UYU",           // String, no cambia
  status: "paid"             // String, no cambia
}

// Se envía con valores serializados
body: JSON.stringify({
  token: profile.fcm_token,
  title: "Pedido actualizado",
  body: "Tu pedido ha sido confirmado",
  data: serializedData  // ✅ Todos son strings
})

// Resultado: ✅ SUCCESS
```

## 🔍 Detalles Técnicos

### Tipos de Valores Manejados

| Tipo Original | Serialización | Ejemplo |
|---------------|---------------|---------|
| `string` | Sin cambios | `"hello"` → `"hello"` |
| `number` | `JSON.stringify()` | `123` → `"123"` |
| `boolean` | `JSON.stringify()` | `true` → `"true"` |
| `object` | `JSON.stringify()` | `{a:1}` → `"{\"a\":1}"` |
| `array` | `JSON.stringify()` | `[1,2]` → `"[1,2]"` |
| `null` | Se omite | `null` → no se incluye |
| `undefined` | Se omite | `undefined` → no se incluye |

### Código de Serialización

```typescript
const serializedData: Record<string, string> = {};

for (const [key, value] of Object.entries(notificationData)) {
  if (value !== null && value !== undefined) {
    serializedData[key] = typeof value === 'string'
      ? value
      : JSON.stringify(value);
  }
}
```

**Ventajas:**
- ✅ Maneja todos los tipos de datos
- ✅ Omite valores null/undefined
- ✅ Preserva strings originales
- ✅ Convierte tipos complejos correctamente

## 🧪 Testing

### Probar con Diferentes Tipos de Data

```typescript
// Test 1: Números
{
  orderId: 123,
  amount: 99.99
}
// Resultado: {"orderId":"123","amount":"99.99"} ✅

// Test 2: Booleans
{
  isPaid: true,
  isActive: false
}
// Resultado: {"isPaid":"true","isActive":"false"} ✅

// Test 3: Objetos
{
  user: { id: 1, name: "John" }
}
// Resultado: {"user":"{\"id\":1,\"name\":\"John\"}"} ✅

// Test 4: Arrays
{
  items: [1, 2, 3]
}
// Resultado: {"items":"[1,2,3]"} ✅

// Test 5: Mixed
{
  type: "order",
  id: 456,
  active: true,
  meta: { price: 100 }
}
// Resultado: {
//   "type":"order",
//   "id":"456",
//   "active":"true",
//   "meta":"{\"price\":100}"
// } ✅
```

## 📝 Casos de Uso Reales

### Notificación de Recordatorio de Vacuna

```typescript
// Data original
{
  notificationType: "vaccine_reminder",
  petId: "abc123",
  petName: "Max",
  vaccineId: 42,
  daysUntilDue: 7,
  isOverdue: false,
  metadata: {
    lastVaccineDate: "2024-01-15",
    nextVaccineDate: "2025-01-15"
  }
}

// Serializado automáticamente
{
  notificationType: "vaccine_reminder",
  petId: "abc123",
  petName: "Max",
  vaccineId: "42",                    // ✅ convertido
  daysUntilDue: "7",                  // ✅ convertido
  isOverdue: "false",                 // ✅ convertido
  metadata: "{\"lastVaccineDate\":\"2024-01-15\",\"nextVaccineDate\":\"2025-01-15\"}"  // ✅ convertido
}
```

### Notificación de Orden

```typescript
// Data original
{
  type: "order_update",
  orderId: 789,
  orderTotal: 3411.12,
  currency: "UYU",
  status: "confirmed",
  itemCount: 5
}

// Serializado automáticamente
{
  type: "order_update",
  orderId: "789",          // ✅ convertido
  orderTotal: "3411.12",   // ✅ convertido (esto causaba el error)
  currency: "UYU",
  status: "confirmed",
  itemCount: "5"           // ✅ convertido
}
```

## 🎯 Impacto del Fix

### Antes del Fix
- ❌ FCM v1 fallaba con error 400
- ❌ Fallback a Expo Push (menos eficiente)
- ❌ Notificaciones tardaban más
- ❌ Logs llenos de warnings

### Después del Fix
- ✅ FCM v1 funciona correctamente
- ✅ Sin necesidad de fallback
- ✅ Notificaciones más rápidas
- ✅ Logs limpios

## 📊 Resultados Esperados en Logs

### Antes (Con Error)

```
Attempting FCM v1 for notification 3b6d587b-baa8-47b0-bde0-c3c6a7af5628...
WARNING FCM v1 failed, will try fallback: {
  error: "Invalid value at 'message.data[4].value' (TYPE_STRING), 3411.12"
}
Attempting Expo Push Service for notification 3b6d587b-baa8-47b0-bde0-c3c6a7af5628...
✅ Notification 3b6d587b-baa8-47b0-bde0-c3c6a7af5628 sent via expo-legacy
```

### Después (Sin Error)

```
Attempting FCM v1 for notification 3b6d587b-baa8-47b0-bde0-c3c6a7af5628...
FCM v1 success: projects/dogcatify/messages/0:1234567890
✅ Notification 3b6d587b-baa8-47b0-bde0-c3c6a7af5628 sent via fcm-v1
```

## ✅ Checklist de Validación

- [x] Función corregida con serialización de data
- [x] Edge function desplegada
- [x] Compatible con todos los tipos de datos
- [x] Maneja null/undefined correctamente
- [x] Preserva strings originales
- [x] Convierte números y booleans
- [x] Serializa objetos y arrays complejos
- [x] Fallback a Expo Push sigue funcionando

## 🚀 Despliegue

```bash
# Función ya desplegada
✅ send-scheduled-notifications updated successfully
```

## 📚 Documentación Relacionada

- **FCM v1 API Reference**: Requiere todos los valores de `data` como strings
- **`send-notification-fcm-v1`**: Edge function que recibe las notificaciones
- **`scheduled_notifications`**: Tabla que almacena las notificaciones programadas

---

**Fix aplicado exitosamente** 🎉

Las notificaciones programadas ahora funcionan correctamente con FCM v1 API, sin importar el tipo de datos en el campo `data`.
