# API de Órdenes - DogCatiFy

Sistema completo de APIs REST y Webhooks para gestionar órdenes en tiempo real.

## 🎯 Características

- ✅ **API REST** para consultar órdenes
- 🔔 **Webhooks** para notificaciones en tiempo real
- 🔐 **Autenticación** mediante API Key
- 📝 **Logs** completos de todas las peticiones
- 🔄 **Reintentos** automáticos para webhooks
- 🔒 **Firma HMAC SHA256** para seguridad
- 📊 **Paginación** y filtros avanzados

## 📚 Documentación

### Documentos Principales

1. **[DOCUMENTACION_API_ORDENES.md](./DOCUMENTACION_API_ORDENES.md)**
   - Documentación completa y detallada
   - Todos los endpoints disponibles
   - Sistema de webhooks explicado paso a paso
   - Ejemplos en múltiples lenguajes
   - Guía de seguridad

2. **[EJEMPLOS_RAPIDOS_API.md](./EJEMPLOS_RAPIDOS_API.md)**
   - Ejemplos listos para copiar y pegar
   - Código en JavaScript, Python, cURL
   - Casos de uso comunes
   - Mejores prácticas

### Scripts de Prueba

1. **[scripts/test-orders-api.js](./scripts/test-orders-api.js)**
   - Script para probar la API de órdenes
   - Ejecuta todos los casos de prueba
   - Verifica autenticación y permisos

2. **[scripts/webhook-server-example.js](./scripts/webhook-server-example.js)**
   - Servidor de ejemplo para recibir webhooks
   - Verificación de firmas implementada
   - Handlers para todos los eventos
   - UI web con instrucciones

## 🚀 Inicio Rápido

### 1. Obtener API Key

Tu API Key es tu Partner ID (UUID):

```sql
SELECT id FROM profiles WHERE email = 'tu-email@example.com';
```

### 2. Consultar Órdenes

```bash
curl -X GET \
  "https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api" \
  -H "X-API-Key: TU-PARTNER-ID-UUID"
```

### 3. Configurar Webhook (Opcional)

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
  '["order.created", "order.updated"]',
  'secret-key-generada-con-openssl',
  true
);
```

## 📋 Endpoints Disponibles

### API REST

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/orders-api` | Listar todas las órdenes |
| GET | `/orders-api/:id` | Obtener orden específica |

**Query Parameters:**
- `page`: Número de página (default: 1)
- `limit`: Órdenes por página (default: 10, max: 100)
- `status`: Filtrar por status (pending, completed, cancelled)
- `from`: Fecha inicio (ISO 8601)
- `to`: Fecha fin (ISO 8601)

### Eventos Webhook

| Evento | Descripción |
|--------|-------------|
| `order.created` | Nueva orden creada |
| `order.updated` | Orden actualizada |
| `order.cancelled` | Orden cancelada |
| `order.completed` | Orden completada |

## 🔐 Autenticación

Todas las peticiones requieren el header:

```
X-API-Key: tu-partner-id-uuid
```

## 🏗️ Arquitectura

### Base de Datos

#### Tablas Principales

1. **`orders`** - Almacena las órdenes
   - Campos: id, partner_id, customer_id, status, total_amount, items, etc.

2. **`webhook_subscriptions`** - Suscripciones de webhooks
   - Campos: id, partner_id, webhook_url, events, secret_key, is_active

3. **`webhook_logs`** - Logs de intentos de webhooks
   - Campos: id, webhook_subscription_id, order_id, event_type, success, attempt_number

### Edge Functions

1. **`orders-api`** - API REST para consultar órdenes
   - GET /orders-api - Listar órdenes
   - GET /orders-api/:id - Obtener orden específica

2. **`notify-order-webhook`** - Notificar webhooks
   - POST con order_id y event_type
   - Envía notificaciones a todos los webhooks suscritos

### Triggers

1. **`order_created_webhook`** - Se dispara al crear una orden
2. **`order_updated_webhook`** - Se dispara al actualizar una orden

## 🧪 Probar el Sistema

### Probar API

```bash
# Ejecutar script de pruebas
node scripts/test-orders-api.js
```

### Probar Webhooks Localmente

```bash
# 1. Iniciar servidor de ejemplo
node scripts/webhook-server-example.js

# 2. En otra terminal, exponer con ngrok
ngrok http 3001

# 3. Copiar URL de ngrok y registrar en webhook_subscriptions

# 4. Crear/actualizar una orden en la app para probar
```

## 📊 Ejemplo Completo

### JavaScript

```javascript
const SUPABASE_URL = 'https://zkgiwamycbjcogcgqhff.supabase.co';
const API_KEY = 'tu-partner-id-uuid';

// Obtener órdenes
async function getOrders() {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/orders-api?page=1&limit=10`,
    {
      headers: { 'X-API-Key': API_KEY }
    }
  );

  const data = await response.json();
  console.log('Órdenes:', data.data.orders);
}

// Obtener orden específica
async function getOrder(orderId) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/orders-api/${orderId}`,
    {
      headers: { 'X-API-Key': API_KEY }
    }
  );

  const data = await response.json();
  console.log('Orden:', data.data.order);
}

// Ejecutar
await getOrders();
await getOrder('uuid-orden');
```

### Python

```python
import requests

SUPABASE_URL = 'https://zkgiwamycbjcogcgqhff.supabase.co'
API_KEY = 'tu-partner-id-uuid'

# Obtener órdenes
response = requests.get(
    f'{SUPABASE_URL}/functions/v1/orders-api',
    headers={'X-API-Key': API_KEY},
    params={'page': 1, 'limit': 10}
)

orders = response.json()
print('Órdenes:', orders['data']['orders'])
```

## 🔔 Recibir Webhooks

### Node.js + Express

```javascript
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const SECRET = 'tu-secret-key';

app.post('/webhooks/dogcatify', (req, res) => {
  // Verificar firma
  const signature = req.headers['x-dogcatify-signature'];
  const expected = crypto
    .createHmac('sha256', SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Firma inválida' });
  }

  // Procesar webhook
  const { event, order_id, data } = req.body;
  console.log(`Evento: ${event}, Orden: ${order_id}`);

  res.json({ received: true });
});

app.listen(3000);
```

## 📈 Casos de Uso

### 1. Dashboard de Ventas

```javascript
// Obtener estadísticas del día
const today = new Date().toISOString().split('T')[0];
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/orders-api?from=${today}T00:00:00Z&to=${today}T23:59:59Z`,
  { headers: { 'X-API-Key': API_KEY } }
);
```

### 2. Sincronización con Sistema Externo

```javascript
// En tu webhook handler
app.post('/webhooks/dogcatify', async (req, res) => {
  res.json({ received: true });

  const { order_id } = req.body;

  // Obtener datos completos
  const order = await getOrder(order_id);

  // Sincronizar con tu sistema
  await yourSystem.createOrder(order);
});
```

### 3. Notificaciones Personalizadas

```javascript
// Cuando se crea una orden
if (event === 'order.created') {
  await sendEmail(data.customer.email, 'Orden Confirmada', {
    orderId: order_id,
    total: data.total_amount
  });
}
```

## 🔒 Seguridad

### Mejores Prácticas

1. ✅ **Protege tu API Key**
   - No la expongas en código cliente
   - Usa variables de entorno
   - Rota regularmente

2. ✅ **Verifica firmas de webhooks**
   - SIEMPRE verifica la firma HMAC SHA256
   - Usa `crypto.timingSafeEqual` para comparar

3. ✅ **Usa HTTPS**
   - Nunca uses HTTP en producción
   - Tu webhook URL debe ser HTTPS

4. ✅ **Implementa Rate Limiting**
   - Limita peticiones por minuto
   - Previene abuso

5. ✅ **Valida datos**
   - Sanitiza inputs
   - Verifica tipos de datos

## 🐛 Solución de Problemas

### Webhook no llega

1. Verifica que está activo:
   ```sql
   SELECT * FROM webhook_subscriptions WHERE is_active = true;
   ```

2. Revisa los logs:
   ```sql
   SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 10;
   ```

3. Confirma que tu servidor responde con 200 OK

### Error 401

- Verifica tu API Key
- Confirma que tu rol es `partner`
- Revisa que el header es `X-API-Key` (case sensitive)

### Error 404

- La orden puede no existir
- Puede pertenecer a otro partner
- Verifica el UUID de la orden

## 📞 Soporte

- **Documentación**: Ver archivos en este repositorio
- **Email**: soporte@dogcatify.com
- **Scripts de prueba**: `scripts/`

## 📝 Changelog

### v1.0.0 (2025-10-17)

#### Agregado
- ✅ API REST para consultar órdenes
- ✅ Sistema de webhooks con eventos
- ✅ Autenticación mediante API Key
- ✅ Logs de webhooks
- ✅ Reintentos automáticos
- ✅ Firma HMAC SHA256
- ✅ Documentación completa
- ✅ Scripts de ejemplo y prueba

#### Endpoints
- `GET /orders-api` - Listar órdenes
- `GET /orders-api/:id` - Obtener orden específica
- `POST /notify-order-webhook` - Notificar webhooks (interno)

#### Base de Datos
- Tabla `webhook_subscriptions`
- Tabla `webhook_logs`
- Triggers en tabla `orders`

#### Edge Functions
- `orders-api` - API REST
- `notify-order-webhook` - Sistema de webhooks

---

## 🎉 ¡Listo para usar!

El sistema está completamente configurado y listo para usar. Lee la documentación completa en [DOCUMENTACION_API_ORDENES.md](./DOCUMENTACION_API_ORDENES.md) para más detalles.

**Próximos pasos:**
1. Obtén tu API Key
2. Prueba la API con `scripts/test-orders-api.js`
3. Configura webhooks si los necesitas
4. Integra en tu sistema

¡Éxito! 🚀
