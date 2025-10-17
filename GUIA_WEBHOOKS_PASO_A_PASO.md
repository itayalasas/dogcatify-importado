# 🚀 Guía Paso a Paso: Configurar Webhooks para tu CRM

Esta guía te ayudará a conectar tu CRM con DogCatiFy usando webhooks para recibir órdenes automáticamente en tiempo real.

---

## 📋 Requisitos Previos

- Node.js instalado (versión 16 o superior)
- Acceso a Supabase SQL Editor
- Un servidor o computadora donde ejecutar el webhook receiver

---

## Paso 1: Generar una Clave Secreta

La clave secreta se usa para firmar los webhooks y verificar que vengan de DogCatiFy.

**Opción A: Usar OpenSSL (Linux/Mac)**
```bash
openssl rand -hex 32
```

**Opción B: Usar Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Opción C: Generador Online**
Ir a: https://generate-random.org/api-key-generator (seleccionar 256-bit)

**Ejemplo de clave generada:**
```
a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3a4b5c6d7e8f9
```

⚠️ **IMPORTANTE**: Guarda esta clave de forma segura. La necesitarás en los siguientes pasos.

---

## Paso 2: Iniciar el Servidor de Webhooks

Ya tienes un servidor de ejemplo listo para usar.

### 2.1. Configurar el Secret Key

```bash
# En la raíz del proyecto
export WEBHOOK_SECRET="tu-clave-secreta-del-paso-1"
```

### 2.2. Iniciar el servidor

```bash
node scripts/webhook-server-example.js
```

Verás algo como:
```
╔═══════════════════════════════════════════════════════════╗
║        🐾 DogCatiFy Webhook Server - INICIADO 🐾         ║
╚═══════════════════════════════════════════════════════════╝

✅ Servidor corriendo en: http://localhost:3001
📥 Webhook URL: http://localhost:3001/webhooks/dogcatify
🔐 Secret configurado: ✅ Sí
```

### 2.3. Verificar que funcione

Abre tu navegador en: `http://localhost:3001`

Deberías ver una página con información del servidor.

---

## Paso 3: Exponer el Servidor Públicamente (para pruebas)

Si tu CRM está en tu computadora local, necesitas exponerlo públicamente para que Supabase pueda enviarte webhooks.

### Opción A: Usar ngrok (RECOMENDADO)

```bash
# Instalar ngrok (solo una vez)
# Linux/Mac
brew install ngrok

# O descargar desde: https://ngrok.com/download

# Exponer el puerto 3001
ngrok http 3001
```

ngrok te dará una URL pública como:
```
https://abc123.ngrok.io
```

Tu webhook URL será: `https://abc123.ngrok.io/webhooks/dogcatify`

### Opción B: Usar Cloudflare Tunnel

```bash
# Instalar cloudflared
brew install cloudflare/cloudflare/cloudflared

# Exponer el puerto
cloudflared tunnel --url http://localhost:3001
```

### Opción C: Desplegar en producción

Si tienes un servidor en producción, despliega el código allí:
- Heroku
- DigitalOcean
- AWS
- Google Cloud
- etc.

---

## Paso 4: Registrar el Webhook en la Base de Datos

Ahora necesitas decirle a DogCatiFy dónde enviar las notificaciones.

### 4.1. Obtener tu Partner ID (si es para un partner específico)

```sql
-- Ejecuta en Supabase SQL Editor
SELECT id, full_name, business_name, role
FROM profiles
WHERE role = 'partner';
```

Copia el `id` del partner.

### 4.2. Registrar el webhook

Si es **para tu CRM global** (recibe TODAS las órdenes):

```sql
-- Ejecuta en Supabase SQL Editor
INSERT INTO webhook_subscriptions (
  partner_id,
  webhook_url,
  events,
  secret_key,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000000',  -- UUID especial para CRM global
  'https://abc123.ngrok.io/webhooks/dogcatify',  -- ⚠️ Reemplaza con tu URL de ngrok
  '["order.created", "order.updated", "order.cancelled", "order.completed"]'::jsonb,
  'tu-clave-secreta-del-paso-1',  -- ⚠️ Reemplaza con tu secret key
  true
);
```

Si es **para un partner específico**:

```sql
-- Ejecuta en Supabase SQL Editor
INSERT INTO webhook_subscriptions (
  partner_id,
  webhook_url,
  events,
  secret_key,
  is_active
) VALUES (
  'partner-uuid-aqui',  -- ⚠️ Reemplaza con el ID del paso 4.1
  'https://abc123.ngrok.io/webhooks/dogcatify',  -- ⚠️ Reemplaza con tu URL
  '["order.created", "order.updated", "order.cancelled", "order.completed"]'::jsonb,
  'tu-clave-secreta-del-paso-1',  -- ⚠️ Reemplaza con tu secret key
  true
);
```

### 4.3. Verificar que se creó correctamente

```sql
SELECT * FROM webhook_subscriptions WHERE is_active = true;
```

---

## Paso 5: Probar el Webhook

Ahora vamos a crear una orden de prueba para verificar que todo funcione.

### 5.1. Disparar el webhook manualmente

Puedes usar la función edge `notify-order-webhook` directamente:

```bash
# Necesitas un order_id existente
# Primero, consulta una orden:
curl -X GET \
  "https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api?limit=1" \
  -H "X-API-Key: dogcatify_admin_2025_secure"
```

Copia el `id` de la orden y luego:

```bash
curl -X POST \
  "https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/notify-order-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "uuid-de-la-orden-aqui",
    "event_type": "order.created"
  }'
```

### 5.2. Verificar en el servidor

En la terminal donde corre tu servidor deberías ver:

```
📥 Webhook recibido:
  Evento: order.created
  Firma: a8b9c0d1e2f3g4h5...
✅ Firma verificada correctamente

🆕 NUEVA ORDEN CREADA
  ID: uuid-de-la-orden
  Cliente: Juan Pérez (juan@email.com)
  Total: $5000
  Tipo: product
  Items: 2
✅ Webhook procesado exitosamente
```

### 5.3. Revisar logs en la base de datos

```sql
-- Ver los últimos webhooks enviados
SELECT
  wl.*,
  ws.webhook_url,
  o.status as order_status
FROM webhook_logs wl
JOIN webhook_subscriptions ws ON ws.id = wl.webhook_subscription_id
JOIN orders o ON o.id = wl.order_id
ORDER BY wl.created_at DESC
LIMIT 10;
```

---

## Paso 6: Conectar con tu Sistema CRM Real

Ahora que ya funciona el servidor de ejemplo, necesitas adaptar el código para guardar en tu CRM.

### 6.1. Modificar los handlers

Edita `scripts/webhook-server-example.js`:

```javascript
// Ejemplo: Conectar con tu base de datos MySQL
import mysql from 'mysql2/promise';

const dbConnection = mysql.createPool({
  host: 'localhost',
  user: 'tu_usuario',
  password: 'tu_password',
  database: 'tu_crm_db'
});

const eventHandlers = {
  'order.created': async (orderId, data) => {
    // Guardar en tu CRM
    await dbConnection.execute(
      `INSERT INTO ordenes (id, cliente_nombre, cliente_email, total, items, fecha_creacion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        data.customer?.full_name,
        data.customer?.email,
        data.total_amount,
        JSON.stringify(data.items),
        new Date()
      ]
    );

    console.log(`✅ Orden ${orderId} guardada en CRM`);
  },

  // ... otros handlers
};
```

### 6.2. Ejemplo con PostgreSQL

```javascript
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  user: 'tu_usuario',
  password: 'tu_password',
  database: 'tu_crm_db',
  port: 5432
});

const eventHandlers = {
  'order.created': async (orderId, data) => {
    await pool.query(
      `INSERT INTO ordenes (id, cliente_nombre, total, status, datos_completos)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        orderId,
        data.customer?.full_name,
        data.total_amount,
        data.status,
        JSON.stringify(data)
      ]
    );

    console.log(`✅ Orden ${orderId} guardada en CRM`);
  }
};
```

### 6.3. Ejemplo con API REST de tu CRM

```javascript
const eventHandlers = {
  'order.created': async (orderId, data) => {
    // Enviar a tu API de CRM
    const response = await fetch('https://tu-crm.com/api/ordenes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer tu-api-key'
      },
      body: JSON.stringify({
        orden_id: orderId,
        cliente: {
          nombre: data.customer?.full_name,
          email: data.customer?.email,
          telefono: data.customer?.phone
        },
        items: data.items,
        total: data.total_amount,
        status: data.status
      })
    });

    if (response.ok) {
      console.log(`✅ Orden ${orderId} enviada a CRM`);
    } else {
      console.error(`❌ Error enviando a CRM: ${response.statusText}`);
    }
  }
};
```

---

## Paso 7: Triggers Automáticos (Ya Configurados)

Los triggers ya están configurados en la base de datos. Cuando:

1. **Se crea una orden** → Dispara automáticamente `order.created`
2. **Se actualiza una orden** → Dispara automáticamente `order.updated`
3. **Se cancela una orden** → Dispara automáticamente `order.cancelled`
4. **Se completa una orden** → Dispara automáticamente `order.completed`

**No necesitas hacer nada más** - el sistema ya funciona automáticamente.

---

## Paso 8: Desplegar en Producción

### 8.1. Variables de entorno

Crea un archivo `.env`:

```bash
WEBHOOK_SECRET=tu-clave-secreta-del-paso-1
PORT=3001
NODE_ENV=production
```

### 8.2. Usar PM2 para mantener el servidor corriendo

```bash
# Instalar PM2
npm install -g pm2

# Iniciar el servidor
pm2 start scripts/webhook-server-example.js --name "dogcatify-webhooks"

# Ver logs
pm2 logs dogcatify-webhooks

# Reiniciar
pm2 restart dogcatify-webhooks

# Detener
pm2 stop dogcatify-webhooks
```

### 8.3. Configurar reinicio automático

```bash
# Guardar configuración
pm2 save

# Configurar inicio automático al reiniciar el servidor
pm2 startup
```

---

## 🔒 Seguridad en Producción

### 1. Usar HTTPS

⚠️ **NUNCA uses HTTP en producción**. Solo HTTPS.

### 2. Verificar siempre la firma

El servidor de ejemplo ya lo hace, pero asegúrate de no eliminar esta verificación.

### 3. Rate Limiting

Agrega protección contra abuso:

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100 // máximo 100 requests por minuto
});

app.use('/webhooks', limiter);
```

### 4. Monitoreo

Implementa alertas si los webhooks fallan:

```javascript
// En eventHandlers
'order.created': async (orderId, data) => {
  try {
    await tuFuncion(data);
  } catch (error) {
    // Enviar alerta
    await enviarAlertaAlEquipo({
      tipo: 'webhook_error',
      orden: orderId,
      error: error.message
    });
    throw error;
  }
}
```

---

## 🧪 Testing

### Probar firma manualmente

```bash
curl -X POST http://localhost:3001/test-signature \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {"test": "data"},
    "signature": "tu-firma-aqui"
  }'
```

### Simular webhook completo

```bash
# Generar firma
SECRET="tu-secret-key"
PAYLOAD='{"event":"order.created","order_id":"123","data":{},"timestamp":"2025-10-17T10:00:00Z"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

# Enviar webhook
curl -X POST http://localhost:3001/webhooks/dogcatify \
  -H "Content-Type: application/json" \
  -H "X-DogCatiFy-Signature: $SIGNATURE" \
  -H "X-DogCatiFy-Event: order.created" \
  -d "$PAYLOAD"
```

---

## 📊 Monitoreo de Webhooks

### Ver estadísticas

```sql
-- Webhooks exitosos vs fallidos
SELECT
  event_type,
  success,
  COUNT(*) as total,
  AVG(response_status) as avg_status
FROM webhook_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type, success
ORDER BY event_type, success;
```

### Ver webhooks fallidos

```sql
SELECT
  wl.created_at,
  wl.event_type,
  wl.order_id,
  wl.response_status,
  wl.response_body,
  ws.webhook_url
FROM webhook_logs wl
JOIN webhook_subscriptions ws ON ws.id = wl.webhook_subscription_id
WHERE wl.success = false
ORDER BY wl.created_at DESC
LIMIT 20;
```

---

## ❓ Troubleshooting

### Problema: No llegan webhooks

1. Verifica que el webhook esté registrado:
```sql
SELECT * FROM webhook_subscriptions WHERE is_active = true;
```

2. Verifica que el servidor esté corriendo:
```bash
curl http://localhost:3001/health
```

3. Revisa los logs:
```sql
SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 5;
```

### Problema: Firma inválida

- Asegúrate de usar el mismo `secret_key` en:
  - `webhook_subscriptions` (base de datos)
  - `WEBHOOK_SECRET` (variable de entorno del servidor)

### Problema: Timeout

Los webhooks deben responder en menos de 10 segundos. Si tu procesamiento es lento:

```javascript
app.post('/webhooks/dogcatify', webhookVerification, async (req, res) => {
  // Responder INMEDIATAMENTE
  res.status(200).json({ received: true });

  // Procesar después (asíncrono)
  processWebhookAsync(req.body).catch(console.error);
});
```

---

## ✅ Checklist Final

- [ ] Generé una clave secreta segura
- [ ] Configuré la variable `WEBHOOK_SECRET`
- [ ] El servidor corre correctamente (`node scripts/webhook-server-example.js`)
- [ ] Expuse el servidor públicamente (ngrok o producción)
- [ ] Registré el webhook en `webhook_subscriptions`
- [ ] Probé enviando un webhook manual
- [ ] Vi el webhook en los logs (`webhook_logs`)
- [ ] Mi servidor recibió y procesó el webhook correctamente
- [ ] Adapté el código para conectar con mi CRM real
- [ ] Configuré PM2 para producción
- [ ] Implementé monitoreo y alertas

---

## 🎉 ¡Listo!

Ahora cada vez que se cree, actualice, cancele o complete una orden en DogCatiFy, tu CRM recibirá automáticamente una notificación en tiempo real.

**Siguiente paso:** Adapta el código en `scripts/webhook-server-example.js` para guardar las órdenes en tu base de datos del CRM.
