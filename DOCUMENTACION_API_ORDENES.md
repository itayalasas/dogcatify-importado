# Documentación API de Órdenes - DogCatiFy

Esta documentación describe cómo consumir las APIs de órdenes y configurar webhooks para recibir notificaciones en tiempo real cuando se crean o actualizan órdenes.

## Tabla de Contenidos

1. [Autenticación](#autenticación)
2. [API de Consulta de Órdenes](#api-de-consulta-de-órdenes)
3. [Sistema de Webhooks](#sistema-de-webhooks)
4. [Ejemplos de Código](#ejemplos-de-código)
5. [Seguridad](#seguridad)
6. [Solución de Problemas](#solución-de-problemas)

---

## Autenticación

Todas las peticiones a la API requieren autenticación mediante una API Key.

### Obtener tu API Key

Tu API Key es tu ID de usuario (UUID) que puedes obtener desde:
1. Tu perfil en la aplicación
2. La base de datos en la tabla `profiles`

### Cómo usar la API Key

Incluye tu API Key en el header de todas las peticiones:

```
X-API-Key: tu-partner-id-uuid-aqui
```

**Ejemplo:**
```bash
X-API-Key: 48bcaa28-23f5-4b92-b7cd-cd21c746e3a2
```

**⚠️ Importante:**
- Mantén tu API Key segura y nunca la compartas públicamente
- Solo los usuarios con rol `partner` pueden acceder a la API
- Solo puedes acceder a las órdenes de tu propio negocio

---

## API de Consulta de Órdenes

### URL Base

```
https://[tu-proyecto].supabase.co/functions/v1/orders-api
```

### 1. Obtener una Orden Específica

Obtiene los detalles completos de una orden por su ID.

**Endpoint:** `GET /orders-api/{order_id}`

**Headers:**
```
X-API-Key: tu-partner-id-uuid
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "uuid-de-la-orden",
      "partner_id": "uuid-del-partner",
      "customer_id": "uuid-del-cliente",
      "status": "pending",
      "total_amount": 5000,
      "items": [
        {
          "product_id": "uuid",
          "name": "Producto 1",
          "quantity": 2,
          "price": 2500
        }
      ],
      "payment_status": "pending",
      "payment_method": "mercadopago",
      "shipping_address": "Calle 123, Ciudad",
      "order_type": "product",
      "created_at": "2025-10-17T10:00:00Z",
      "updated_at": "2025-10-17T10:00:00Z",
      "customer": {
        "id": "uuid",
        "full_name": "Juan Pérez",
        "email": "juan@example.com",
        "phone": "+598 99 123 456"
      },
      "partner": {
        "id": "uuid",
        "full_name": "Maria García",
        "email": "maria@example.com",
        "business_name": "Veterinaria Central"
      },
      "service": {
        "id": "uuid",
        "name": "Consulta Veterinaria",
        "description": "Consulta general"
      },
      "pet": {
        "id": "uuid",
        "name": "Max",
        "species": "dog",
        "breed": "Golden Retriever"
      }
    },
    "retrieved_at": "2025-10-17T10:00:00Z"
  }
}
```

**Errores:**

- `401`: API Key inválida o no autorizada
- `404`: Orden no encontrada o sin permiso para acceder
- `500`: Error interno del servidor

**Ejemplo cURL:**
```bash
curl -X GET \
  https://tu-proyecto.supabase.co/functions/v1/orders-api/uuid-orden \
  -H "X-API-Key: tu-partner-id-uuid"
```

### 2. Listar Órdenes

Obtiene un listado paginado de todas tus órdenes.

**Endpoint:** `GET /orders-api`

**Headers:**
```
X-API-Key: tu-partner-id-uuid
```

**Query Parameters:**

| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `page` | integer | No | 1 | Número de página |
| `limit` | integer | No | 10 | Órdenes por página (máx 100) |
| `status` | string | No | - | Filtrar por status (pending, completed, cancelled) |
| `from` | datetime | No | - | Fecha inicio (ISO 8601) |
| `to` | datetime | No | - | Fecha fin (ISO 8601) |

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "uuid",
        "status": "completed",
        "total_amount": 5000,
        "created_at": "2025-10-17T10:00:00Z",
        "customer": {
          "full_name": "Juan Pérez",
          "email": "juan@example.com"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "total_pages": 5
    },
    "retrieved_at": "2025-10-17T10:00:00Z"
  }
}
```

**Ejemplo cURL:**
```bash
# Listar órdenes con paginación
curl -X GET \
  "https://tu-proyecto.supabase.co/functions/v1/orders-api?page=1&limit=20" \
  -H "X-API-Key: tu-partner-id-uuid"

# Filtrar por status y fecha
curl -X GET \
  "https://tu-proyecto.supabase.co/functions/v1/orders-api?status=completed&from=2025-10-01T00:00:00Z&to=2025-10-17T23:59:59Z" \
  -H "X-API-Key: tu-partner-id-uuid"
```

---

## Sistema de Webhooks

Los webhooks te permiten recibir notificaciones en tiempo real cuando ocurren eventos en las órdenes.

### Eventos Disponibles

| Evento | Descripción | Cuándo se dispara |
|--------|-------------|-------------------|
| `order.created` | Nueva orden creada | Cuando un cliente crea una nueva orden |
| `order.updated` | Orden actualizada | Cuando cualquier campo de la orden cambia |
| `order.cancelled` | Orden cancelada | Cuando una orden es cancelada |
| `order.completed` | Orden completada | Cuando una orden se marca como completada |

### 1. Registrar un Webhook

Para recibir notificaciones, primero debes registrar tu webhook en la base de datos.

**Tabla:** `webhook_subscriptions`

**Campos:**

```sql
INSERT INTO webhook_subscriptions (
  partner_id,
  webhook_url,
  events,
  secret_key,
  is_active
) VALUES (
  'tu-partner-id-uuid',
  'https://tu-servidor.com/webhooks/dogcatify',
  '["order.created", "order.updated", "order.cancelled", "order.completed"]',
  'tu-secret-key-segura-aqui',
  true
);
```

**⚠️ Importante:**
- `webhook_url` debe ser HTTPS
- `secret_key` debe ser una cadena segura y aleatoria (mínimo 32 caracteres)
- Guarda tu `secret_key` de forma segura para verificar las firmas

**Ejemplo en JavaScript:**
```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Registrar webhook
const { data, error } = await supabase
  .from('webhook_subscriptions')
  .insert({
    partner_id: 'tu-partner-id-uuid',
    webhook_url: 'https://tu-servidor.com/webhooks/dogcatify',
    events: ['order.created', 'order.updated', 'order.cancelled', 'order.completed'],
    secret_key: 'tu-secret-key-super-segura-123456789',
    is_active: true
  });
```

### 2. Recibir Notificaciones Webhook

Cuando ocurre un evento, DogCatiFy enviará un POST a tu `webhook_url`.

**Headers Enviados:**
```
Content-Type: application/json
X-DogCatiFy-Signature: firma-hmac-sha256-del-payload
X-DogCatiFy-Event: order.created
User-Agent: DogCatiFy-Webhook/1.0
```

**Payload:**
```json
{
  "event": "order.created",
  "order_id": "uuid-de-la-orden",
  "data": {
    "id": "uuid-de-la-orden",
    "partner_id": "uuid-del-partner",
    "customer_id": "uuid-del-cliente",
    "status": "pending",
    "total_amount": 5000,
    "items": [...],
    "customer": {
      "full_name": "Juan Pérez",
      "email": "juan@example.com"
    },
    "created_at": "2025-10-17T10:00:00Z",
    "updated_at": "2025-10-17T10:00:00Z"
  },
  "timestamp": "2025-10-17T10:00:00Z"
}
```

### 3. Verificar la Firma del Webhook

**CRÍTICO:** Siempre verifica la firma para asegurar que la petición proviene de DogCatiFy.

**Algoritmo de Verificación:**

1. Obtén el payload completo como string
2. Calcula HMAC SHA256 del payload usando tu `secret_key`
3. Compara el resultado con el header `X-DogCatiFy-Signature`

**Ejemplo en Node.js:**
```javascript
import crypto from 'crypto';

function verifyWebhookSignature(payload, signature, secretKey) {
  const payloadString = JSON.stringify(payload);
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(payloadString)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// En tu endpoint
app.post('/webhooks/dogcatify', (req, res) => {
  const signature = req.headers['x-dogcatify-signature'];
  const secretKey = process.env.DOGCATIFY_WEBHOOK_SECRET;

  if (!verifyWebhookSignature(req.body, signature, secretKey)) {
    return res.status(401).json({ error: 'Firma inválida' });
  }

  // Procesar el webhook de forma segura
  const { event, order_id, data } = req.body;

  console.log(`Received ${event} for order ${order_id}`);

  // Tu lógica aquí

  res.status(200).json({ received: true });
});
```

**Ejemplo en Python (Flask):**
```python
import hmac
import hashlib
import json
from flask import Flask, request

app = Flask(__name__)

def verify_webhook_signature(payload, signature, secret_key):
    payload_string = json.dumps(payload, separators=(',', ':'))
    expected_signature = hmac.new(
        secret_key.encode(),
        payload_string.encode(),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected_signature)

@app.route('/webhooks/dogcatify', methods=['POST'])
def dogcatify_webhook():
    signature = request.headers.get('X-DogCatiFy-Signature')
    secret_key = 'tu-secret-key'

    if not verify_webhook_signature(request.json, signature, secret_key):
        return {'error': 'Firma inválida'}, 401

    event = request.json['event']
    order_id = request.json['order_id']
    data = request.json['data']

    print(f"Received {event} for order {order_id}")

    # Tu lógica aquí

    return {'received': True}, 200
```

### 4. Reintentos

Si tu servidor no responde con un código 2xx, DogCatiFy reintentará el envío:

- **Intento 1:** Inmediato
- **Intento 2:** Después de 2 segundos
- **Intento 3:** Después de 4 segundos
- **Intento 4:** Después de 8 segundos

**Recomendaciones:**
- Responde con `200 OK` lo más rápido posible
- Procesa el webhook de forma asíncrona en tu servidor
- No realices operaciones largas en el endpoint del webhook

### 5. Logs de Webhooks

Todos los intentos de envío se registran en la tabla `webhook_logs`.

**Consultar logs:**
```sql
SELECT
  wl.id,
  wl.event_type,
  wl.response_status,
  wl.success,
  wl.attempt_number,
  wl.created_at,
  o.id as order_id,
  o.status as order_status
FROM webhook_logs wl
JOIN orders o ON o.id = wl.order_id
WHERE wl.webhook_subscription_id = 'tu-webhook-subscription-id'
ORDER BY wl.created_at DESC
LIMIT 100;
```

**Ejemplo en JavaScript:**
```javascript
// Ver logs de tus webhooks
const { data: logs } = await supabase
  .from('webhook_logs')
  .select(`
    *,
    webhook_subscriptions!inner(partner_id)
  `)
  .eq('webhook_subscriptions.partner_id', 'tu-partner-id')
  .order('created_at', { ascending: false })
  .limit(100);
```

---

## Ejemplos de Código

### Ejemplo Completo: Servidor Node.js con Express

```javascript
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.DOGCATIFY_WEBHOOK_SECRET;
const API_KEY = process.env.DOGCATIFY_API_KEY;
const SUPABASE_URL = 'https://tu-proyecto.supabase.co';

// Middleware para verificar firma
function verifyWebhook(req, res, next) {
  const signature = req.headers['x-dogcatify-signature'];
  const payloadString = JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payloadString)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return res.status(401).json({ error: 'Firma inválida' });
  }

  next();
}

// Endpoint para recibir webhooks
app.post('/webhooks/dogcatify', verifyWebhook, async (req, res) => {
  // Responder rápido
  res.status(200).json({ received: true });

  // Procesar asíncronamente
  const { event, order_id, data } = req.body;

  try {
    switch (event) {
      case 'order.created':
        await handleOrderCreated(order_id, data);
        break;
      case 'order.updated':
        await handleOrderUpdated(order_id, data);
        break;
      case 'order.cancelled':
        await handleOrderCancelled(order_id, data);
        break;
      case 'order.completed':
        await handleOrderCompleted(order_id, data);
        break;
    }
  } catch (error) {
    console.error(`Error processing webhook ${event}:`, error);
  }
});

// Función para obtener orden completa
async function getOrder(orderId) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/orders-api/${orderId}`,
    {
      headers: {
        'X-API-Key': API_KEY
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Error fetching order: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data.order;
}

// Handlers para cada tipo de evento
async function handleOrderCreated(orderId, data) {
  console.log(`Nueva orden creada: ${orderId}`);
  console.log(`Cliente: ${data.customer.full_name}`);
  console.log(`Total: $${data.total_amount}`);

  // Tu lógica aquí: enviar email, actualizar inventario, etc.
}

async function handleOrderUpdated(orderId, data) {
  console.log(`Orden actualizada: ${orderId}`);
  console.log(`Nuevo status: ${data.status}`);

  // Tu lógica aquí
}

async function handleOrderCancelled(orderId, data) {
  console.log(`Orden cancelada: ${orderId}`);

  // Tu lógica aquí: reintegrar stock, procesar reembolso, etc.
}

async function handleOrderCompleted(orderId, data) {
  console.log(`Orden completada: ${orderId}`);

  // Tu lógica aquí: generar factura, enviar confirmación, etc.
}

// Endpoint para consultar órdenes
app.get('/orders', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    let url = `${SUPABASE_URL}/functions/v1/orders-api?page=${page}&limit=${limit}`;
    if (status) url += `&status=${status}`;

    const response = await fetch(url, {
      headers: {
        'X-API-Key': API_KEY
      }
    });

    const result = await response.json();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

## Seguridad

### Mejores Prácticas

1. **Protege tu API Key**
   - Nunca la expongas en código cliente
   - Usa variables de entorno
   - Rota regularmente

2. **Verifica SIEMPRE las firmas**
   - No confíes en webhooks sin verificar la firma
   - Usa `crypto.timingSafeEqual` para comparar firmas

3. **Usa HTTPS**
   - Tu webhook URL debe ser HTTPS
   - No uses HTTP en producción

4. **Valida los datos**
   - Verifica que los datos del webhook son válidos
   - Sanitiza antes de usar en bases de datos

5. **Rate Limiting**
   - Implementa límites de tasa en tus endpoints
   - Previene abuso de tu API

6. **Logs y Monitoreo**
   - Registra todos los eventos
   - Monitorea fallos en webhooks
   - Configura alertas para errores repetidos

### Ejemplo de Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite de 100 peticiones por ventana
  message: 'Demasiadas peticiones, intenta más tarde'
});

app.use('/api/', apiLimiter);
```

---

## Solución de Problemas

### Webhook no llega

1. **Verifica que el webhook está activo:**
   ```sql
   SELECT * FROM webhook_subscriptions WHERE partner_id = 'tu-id' AND is_active = true;
   ```

2. **Revisa los logs:**
   ```sql
   SELECT * FROM webhook_logs
   WHERE webhook_subscription_id = 'tu-webhook-id'
   ORDER BY created_at DESC LIMIT 10;
   ```

3. **Verifica que tu servidor es accesible:**
   - Asegúrate de que tu URL es pública
   - Prueba con herramientas como `webhook.site`

4. **Revisa los eventos suscritos:**
   - Asegúrate de estar suscrito al evento correcto
   - Ejemplo: `["order.created", "order.updated"]`

### Error 401: API Key inválida

- Verifica que estás usando tu Partner ID como API Key
- Confirma que tu rol es `partner` en la base de datos
- Verifica que el header es `X-API-Key` (case sensitive)

### Error 404: Orden no encontrada

- La orden puede pertenecer a otro partner
- Verifica el UUID de la orden
- Confirma que la orden existe en la base de datos

### Webhook recibe firma inválida

- Verifica que estás usando el `secret_key` correcto
- Asegúrate de calcular el HMAC sobre el payload **exacto** recibido
- No modifiques el JSON antes de verificar

### Reintentos excesivos

Si ves muchos reintentos:
1. Asegúrate de responder con `200 OK`
2. Verifica que tu servidor no está caído
3. Revisa los logs de tu servidor
4. Considera desactivar temporalmente el webhook si hay problemas

---

## Contacto y Soporte

Para soporte técnico o preguntas:
- Email: soporte@dogcatify.com
- Documentación: https://docs.dogcatify.com
- GitHub Issues: https://github.com/dogcatify/api

---

## Changelog

### v1.0.0 (2025-10-17)
- Release inicial
- API de consulta de órdenes
- Sistema de webhooks
- Eventos: created, updated, cancelled, completed
