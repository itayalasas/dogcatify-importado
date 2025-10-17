# Conectar CRM Automáticamente - 3 Opciones

## 🎯 Situación Actual

Ya tienes todo preparado para que tu CRM reciba órdenes automáticamente. Tienes **3 opciones**:

---

## ✅ Opción 1: Webhooks (RECOMENDADO) ⭐

### ¿Qué es un Webhook?

Cuando se crea/actualiza una orden en DogCatify, **automáticamente** se envía una notificación HTTP POST a tu CRM con los datos de la orden.

### Ventajas
- ✅ **Tiempo real** - Tu CRM recibe la orden al instante
- ✅ **Automático** - No necesitas consultar constantemente
- ✅ **Eficiente** - Solo se envían los datos necesarios
- ✅ **Confiable** - Se reintenta automáticamente si falla

### Cómo Configurar

#### Paso 1: Crear un Endpoint en tu CRM

Tu CRM necesita tener una URL que reciba las notificaciones:

**Ejemplo en Node.js/Express:**

```javascript
// En tu servidor CRM
const express = require('express');
const app = express();
app.use(express.json());

// Endpoint para recibir webhooks de DogCatify
app.post('/webhooks/dogcatify/orders', async (req, res) => {
  const { event_type, order } = req.body;

  console.log(`Recibido evento: ${event_type}`);
  console.log('Datos de la orden:', order);

  // Verificar firma de seguridad
  const signature = req.headers['x-webhook-signature'];
  // TODO: Validar la firma con tu secret_key

  // Procesar según el tipo de evento
  switch (event_type) {
    case 'order.created':
      await crearOrdenEnCRM(order);
      break;
    case 'order.updated':
      await actualizarOrdenEnCRM(order);
      break;
    case 'order.cancelled':
      await cancelarOrdenEnCRM(order);
      break;
    case 'order.completed':
      await completarOrdenEnCRM(order);
      break;
  }

  // IMPORTANTE: Responder rápido
  res.status(200).json({ success: true });
});

async function crearOrdenEnCRM(order) {
  // Guardar en tu base de datos del CRM
  console.log('Creando orden en CRM:', order.id);
  // ... tu lógica aquí
}

app.listen(3000);
```

**Ejemplo en Python/Flask:**

```python
from flask import Flask, request, jsonify
import hmac
import hashlib

app = Flask(__name__)

@app.route('/webhooks/dogcatify/orders', methods=['POST'])
def receive_webhook():
    data = request.json
    event_type = data.get('event_type')
    order = data.get('order')

    print(f'Recibido evento: {event_type}')
    print(f'Orden: {order["id"]}')

    # Verificar firma de seguridad
    signature = request.headers.get('X-Webhook-Signature')
    # TODO: Validar la firma

    # Procesar según el evento
    if event_type == 'order.created':
        crear_orden_en_crm(order)
    elif event_type == 'order.updated':
        actualizar_orden_en_crm(order)
    elif event_type == 'order.cancelled':
        cancelar_orden_en_crm(order)
    elif event_type == 'order.completed':
        completar_orden_en_crm(order)

    return jsonify({'success': True}), 200

def crear_orden_en_crm(order):
    print(f'Creando orden en CRM: {order["id"]}')
    # ... tu lógica aquí

if __name__ == '__main__':
    app.run(port=3000)
```

#### Paso 2: Registrar tu Webhook en DogCatify

```sql
-- Ejecuta esto en Supabase SQL Editor
INSERT INTO webhook_subscriptions (
  partner_id,
  webhook_url,
  events,
  secret_key,
  is_active
) VALUES (
  'cualquier-uuid-aqui', -- No importa para CRM global
  'https://tu-crm.com/webhooks/dogcatify/orders',
  '["order.created", "order.updated", "order.cancelled", "order.completed"]'::jsonb,
  'genera-un-secret-key-aqui', -- Genera con: openssl rand -hex 32
  true
);
```

**Generar Secret Key seguro:**
```bash
openssl rand -hex 32
```

#### Paso 3: Probar

La Edge Function `notify-order-webhook` ya está creada. Cuando se crea una orden, automáticamente se dispara.

**Payload que recibirás:**

```json
{
  "event_type": "order.created",
  "order": {
    "id": "uuid-de-la-orden",
    "partner_id": "uuid-del-partner",
    "customer_id": "uuid-del-cliente",
    "status": "pending",
    "total_amount": 5000,
    "items": [...],
    "created_at": "2025-10-17T10:00:00Z",
    "updated_at": "2025-10-17T10:00:00Z"
  },
  "timestamp": "2025-10-17T10:00:00Z",
  "webhook_id": "uuid-del-webhook"
}
```

#### Paso 4: Validar Seguridad

En tu endpoint, verifica la firma:

```javascript
const crypto = require('crypto');

function verificarFirma(payload, signature, secretKey) {
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = hmac.digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Usar en el endpoint
app.post('/webhooks/dogcatify/orders', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secretKey = 'tu-secret-key-del-paso-2';

  if (!verificarFirma(req.body, signature, secretKey)) {
    return res.status(401).json({ error: 'Firma inválida' });
  }

  // Procesar webhook...
});
```

---

## 📊 Opción 2: Polling (Consulta Periódica)

Si no puedes configurar webhooks, puedes consultar la API cada X minutos.

### Ventajas
- ✅ Fácil de implementar
- ✅ No necesitas exponer un endpoint

### Desventajas
- ⚠️ No es en tiempo real
- ⚠️ Más carga en el servidor

### Implementación

**Consultar cada 5 minutos:**

```javascript
const ADMIN_TOKEN = 'dogcatify_admin_2025_secure';
const API_URL = 'https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api';

async function sincronizarOrdenes() {
  // Obtener última sincronización
  const ultimaSinc = await obtenerUltimaSincronizacion(); // De tu DB
  const desde = ultimaSinc || new Date(Date.now() - 24*60*60*1000).toISOString();

  // Consultar órdenes nuevas/actualizadas
  const response = await fetch(
    `${API_URL}?from=${desde}&limit=100`,
    {
      headers: { 'X-API-Key': ADMIN_TOKEN }
    }
  );

  const data = await response.json();
  const ordenes = data.data.orders;

  console.log(`Encontradas ${ordenes.length} órdenes nuevas/actualizadas`);

  // Procesar cada orden
  for (const orden of ordenes) {
    await procesarOrdenEnCRM(orden);
  }

  // Guardar timestamp de última sincronización
  await guardarUltimaSincronizacion(new Date().toISOString());
}

// Ejecutar cada 5 minutos
setInterval(sincronizarOrdenes, 5 * 60 * 1000);

// Ejecutar inmediatamente al iniciar
sincronizarOrdenes();
```

**Con Node-Cron:**

```javascript
const cron = require('node-cron');

// Ejecutar cada 5 minutos
cron.schedule('*/5 * * * *', () => {
  console.log('Sincronizando órdenes...');
  sincronizarOrdenes();
});
```

---

## 🔄 Opción 3: Realtime con Supabase Realtime

Escuchar cambios en tiempo real directamente desde la base de datos.

### Ventajas
- ✅ Tiempo real verdadero
- ✅ Muy eficiente

### Desventajas
- ⚠️ Requiere conexión persistente a Supabase
- ⚠️ Más complejo de configurar

### Implementación

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://zkgiwamycbjcogcgqhff.supabase.co',
  'tu-anon-key'
);

// Escuchar nuevas órdenes
const subscription = supabase
  .channel('orders-changes')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'orders'
    },
    (payload) => {
      console.log('Nueva orden creada!', payload.new);
      procesarOrdenEnCRM(payload.new);
    }
  )
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders'
    },
    (payload) => {
      console.log('Orden actualizada!', payload.new);
      actualizarOrdenEnCRM(payload.new);
    }
  )
  .subscribe();

// Para cancelar la suscripción
// subscription.unsubscribe();
```

---

## 📋 Comparación de Opciones

| Característica | Webhooks | Polling | Realtime |
|----------------|----------|---------|----------|
| Tiempo Real | ✅ Sí | ⚠️ ~5 min delay | ✅ Sí |
| Complejidad | Media | Baja | Alta |
| Carga Servidor | Baja | Media | Baja |
| Confiabilidad | Alta | Media | Alta |
| Recomendado para | Producción | Prototipo | Apps sofisticadas |

---

## 🎯 Recomendación

Para tu CRM, recomiendo **Opción 1: Webhooks** porque:

1. Es la más eficiente
2. Tiempo real
3. Ya está todo configurado
4. Es el estándar de la industria

---

## 🧪 Probar Webhooks

### Script de Prueba

Ya tienes un servidor de ejemplo en el proyecto:

```bash
node scripts/webhook-server-example.js
```

Este servidor corre en `http://localhost:3000/webhooks/orders` y puedes usarlo para probar.

### Probar Manualmente

```bash
# Simular webhook
curl -X POST http://localhost:3000/webhooks/orders \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: test-signature" \
  -d '{
    "event_type": "order.created",
    "order": {
      "id": "123",
      "partner_id": "456",
      "status": "pending",
      "total_amount": 5000
    }
  }'
```

---

## 📝 Siguiente Paso

1. **Decide qué opción usar** (recomiendo Webhooks)
2. **Crea el endpoint en tu CRM** usando los ejemplos de arriba
3. **Registra el webhook** en la base de datos
4. **Prueba** creando una orden de prueba

¿Con cuál opción quieres empezar? Te ayudo a configurarla paso a paso.
