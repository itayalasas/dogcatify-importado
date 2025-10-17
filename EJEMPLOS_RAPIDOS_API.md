# Ejemplos Rápidos - API de Órdenes

Guía rápida con ejemplos listos para usar de la API de Órdenes de DogCatiFy.

## 🚀 Inicio Rápido

### 1. Obtener tu API Key

Tu API Key es tu Partner ID (UUID). Puedes obtenerlo de:

```sql
SELECT id FROM profiles WHERE email = 'tu-email@example.com';
```

### 2. URL Base

```
https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api
```

---

## 📖 Ejemplos con cURL

### Listar todas tus órdenes

```bash
curl -X GET \
  "https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api?page=1&limit=10" \
  -H "X-API-Key: TU-PARTNER-ID-UUID"
```

### Obtener una orden específica

```bash
curl -X GET \
  "https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api/ORDER-ID-UUID" \
  -H "X-API-Key: TU-PARTNER-ID-UUID"
```

### Filtrar por status

```bash
curl -X GET \
  "https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api?status=completed&limit=20" \
  -H "X-API-Key: TU-PARTNER-ID-UUID"
```

### Filtrar por fecha

```bash
curl -X GET \
  "https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api?from=2025-10-01T00:00:00Z&to=2025-10-17T23:59:59Z" \
  -H "X-API-Key: TU-PARTNER-ID-UUID"
```

---

## 🟢 Ejemplos con JavaScript/Node.js

### Fetch API (Browser/Node 18+)

```javascript
// Configuración
const SUPABASE_URL = 'https://zkgiwamycbjcogcgqhff.supabase.co';
const API_KEY = 'tu-partner-id-uuid';

// Listar órdenes
async function getOrders(page = 1, limit = 10) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/orders-api?page=${page}&limit=${limit}`,
    {
      headers: {
        'X-API-Key': API_KEY
      }
    }
  );

  const data = await response.json();
  return data;
}

// Obtener orden específica
async function getOrder(orderId) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/orders-api/${orderId}`,
    {
      headers: {
        'X-API-Key': API_KEY
      }
    }
  );

  const data = await response.json();
  return data.data.order;
}

// Uso
const orders = await getOrders();
console.log('Órdenes:', orders.data.orders);

const order = await getOrder('uuid-orden');
console.log('Orden:', order);
```

### Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1',
  headers: {
    'X-API-Key': 'tu-partner-id-uuid'
  }
});

// Listar órdenes
const { data } = await api.get('/orders-api', {
  params: {
    page: 1,
    limit: 10,
    status: 'completed'
  }
});

console.log('Órdenes:', data.data.orders);

// Obtener orden
const { data: orderData } = await api.get(`/orders-api/${orderId}`);
console.log('Orden:', orderData.data.order);
```

---

## 🐍 Ejemplos con Python

### Requests

```python
import requests

SUPABASE_URL = 'https://zkgiwamycbjcogcgqhff.supabase.co'
API_KEY = 'tu-partner-id-uuid'

headers = {
    'X-API-Key': API_KEY
}

# Listar órdenes
response = requests.get(
    f'{SUPABASE_URL}/functions/v1/orders-api',
    headers=headers,
    params={'page': 1, 'limit': 10}
)

orders = response.json()
print('Órdenes:', orders['data']['orders'])

# Obtener orden específica
order_id = 'uuid-orden'
response = requests.get(
    f'{SUPABASE_URL}/functions/v1/orders-api/{order_id}',
    headers=headers
)

order = response.json()['data']['order']
print('Orden:', order)
```

### HTTPX (Async)

```python
import httpx
import asyncio

async def get_orders():
    async with httpx.AsyncClient() as client:
        response = await client.get(
            'https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api',
            headers={'X-API-Key': 'tu-partner-id-uuid'},
            params={'page': 1, 'limit': 10}
        )
        return response.json()

# Uso
orders = await get_orders()
print(orders['data']['orders'])
```

---

## 🔔 Configurar Webhook

### Paso 1: Generar Secret Key

```bash
# En Linux/Mac
openssl rand -hex 32

# En Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Paso 2: Registrar Webhook

```sql
-- En Supabase SQL Editor
INSERT INTO webhook_subscriptions (
  partner_id,
  webhook_url,
  events,
  secret_key,
  is_active
) VALUES (
  'tu-partner-id-uuid',
  'https://tu-dominio.com/webhooks/dogcatify',
  '["order.created", "order.updated", "order.cancelled", "order.completed"]'::jsonb,
  'tu-secret-key-generada',
  true
);
```

### Paso 3: Implementar Endpoint

#### Node.js + Express

```javascript
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const SECRET = 'tu-secret-key-generada';

function verifySignature(payload, signature) {
  const expected = crypto
    .createHmac('sha256', SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

app.post('/webhooks/dogcatify', (req, res) => {
  const signature = req.headers['x-dogcatify-signature'];

  if (!verifySignature(req.body, signature)) {
    return res.status(401).json({ error: 'Firma inválida' });
  }

  // Responder rápido
  res.status(200).json({ received: true });

  // Procesar webhook
  const { event, order_id, data } = req.body;

  switch (event) {
    case 'order.created':
      console.log('Nueva orden:', order_id);
      // Tu lógica aquí
      break;
    case 'order.updated':
      console.log('Orden actualizada:', order_id);
      break;
    case 'order.cancelled':
      console.log('Orden cancelada:', order_id);
      break;
    case 'order.completed':
      console.log('Orden completada:', order_id);
      break;
  }
});

app.listen(3000);
```

#### Python + Flask

```python
from flask import Flask, request
import hmac
import hashlib
import json

app = Flask(__name__)
SECRET = 'tu-secret-key-generada'

def verify_signature(payload, signature):
    expected = hmac.new(
        SECRET.encode(),
        json.dumps(payload, separators=(',', ':')).encode(),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected)

@app.route('/webhooks/dogcatify', methods=['POST'])
def webhook():
    signature = request.headers.get('X-DogCatiFy-Signature')

    if not verify_signature(request.json, signature):
        return {'error': 'Firma inválida'}, 401

    # Responder rápido
    event = request.json['event']
    order_id = request.json['order_id']
    data = request.json['data']

    # Procesar webhook
    if event == 'order.created':
        print(f'Nueva orden: {order_id}')
        # Tu lógica aquí
    elif event == 'order.updated':
        print(f'Orden actualizada: {order_id}')
    # etc...

    return {'received': True}, 200

if __name__ == '__main__':
    app.run(port=3000)
```

---

## 🧪 Probar Webhooks Localmente

### Usando ngrok

```bash
# 1. Instalar ngrok
# https://ngrok.com/download

# 2. Ejecutar tu servidor local
node webhook-server.js

# 3. Exponer con ngrok
ngrok http 3000

# 4. Copiar la URL HTTPS de ngrok
# Ejemplo: https://abc123.ngrok.io

# 5. Registrar en la base de datos
# webhook_url: https://abc123.ngrok.io/webhooks/dogcatify
```

---

## 📊 Ejemplos de Uso Común

### Dashboard de Órdenes

```javascript
async function getDashboardStats() {
  const [pending, completed, cancelled] = await Promise.all([
    getOrders({ status: 'pending' }),
    getOrders({ status: 'completed' }),
    getOrders({ status: 'cancelled' })
  ]);

  return {
    pending: pending.data.pagination.total,
    completed: completed.data.pagination.total,
    cancelled: cancelled.data.pagination.total,
    total: pending.data.pagination.total +
           completed.data.pagination.total +
           cancelled.data.pagination.total
  };
}

const stats = await getDashboardStats();
console.log('Estadísticas:', stats);
```

### Reporte Diario

```javascript
async function getDailyReport() {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
  const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/orders-api?from=${startOfDay}&to=${endOfDay}`,
    { headers: { 'X-API-Key': API_KEY } }
  );

  const data = await response.json();
  const orders = data.data.orders;

  const totalSales = orders.reduce((sum, order) =>
    sum + parseFloat(order.total_amount), 0
  );

  return {
    ordersToday: orders.length,
    totalSales,
    avgOrderValue: totalSales / orders.length
  };
}
```

### Sincronizar con Sistema Externo

```javascript
// Cuando recibes un webhook de orden creada
async function syncOrderToExternalSystem(orderId) {
  // 1. Obtener detalles completos de la orden
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/orders-api/${orderId}`,
    { headers: { 'X-API-Key': API_KEY } }
  );

  const { data } = await response.json();
  const order = data.order;

  // 2. Transformar a formato de tu sistema
  const externalOrder = {
    external_id: order.id,
    customer_name: order.customer.full_name,
    customer_email: order.customer.email,
    total: order.total_amount,
    items: order.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price
    }))
  };

  // 3. Enviar a tu sistema
  await fetch('https://tu-sistema.com/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(externalOrder)
  });
}
```

---

## 🔐 Mejores Prácticas

### 1. Manejo de Errores

```javascript
async function getOrderSafe(orderId) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/orders-api/${orderId}`,
      {
        headers: { 'X-API-Key': API_KEY },
        timeout: 10000 // 10 segundos
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Error desconocido');
    }

    return data.data.order;
  } catch (error) {
    console.error('Error obteniendo orden:', error);
    // Implementar lógica de reintento o notificación
    throw error;
  }
}
```

### 2. Rate Limiting

```javascript
// Implementar cola de peticiones
class OrdersAPIClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.queue = [];
    this.processing = false;
    this.maxRequestsPerSecond = 10;
  }

  async request(url) {
    return new Promise((resolve, reject) => {
      this.queue.push({ url, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const { url, resolve, reject } = this.queue.shift();

      try {
        const response = await fetch(url, {
          headers: { 'X-API-Key': this.apiKey }
        });
        const data = await response.json();
        resolve(data);
      } catch (error) {
        reject(error);
      }

      // Esperar para respetar rate limit
      await new Promise(resolve =>
        setTimeout(resolve, 1000 / this.maxRequestsPerSecond)
      );
    }

    this.processing = false;
  }
}

// Uso
const client = new OrdersAPIClient(API_KEY);
const order = await client.request(`${SUPABASE_URL}/functions/v1/orders-api/${orderId}`);
```

### 3. Caché

```javascript
class CachedOrdersAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutos
  }

  async getOrder(orderId) {
    const cached = this.cache.get(orderId);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/orders-api/${orderId}`,
      { headers: { 'X-API-Key': this.apiKey } }
    );

    const data = await response.json();

    this.cache.set(orderId, {
      data: data.data.order,
      timestamp: Date.now()
    });

    return data.data.order;
  }

  invalidate(orderId) {
    this.cache.delete(orderId);
  }
}
```

---

## 📞 Soporte

- Documentación completa: `DOCUMENTACION_API_ORDENES.md`
- Scripts de prueba: `scripts/test-orders-api.js`
- Servidor de ejemplo: `scripts/webhook-server-example.js`

¿Necesitas ayuda? Contacta a soporte@dogcatify.com
