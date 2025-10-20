#!/usr/bin/env node
/**
 * Servidor simple de webhooks SIN dependencias externas
 * Solo usa módulos nativos de Node.js
 */

import http from 'http';
import crypto from 'crypto';

const PORT = process.env.PORT || 3001;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'Kzdr7C4ef9I54EIgmH8IARdMJ-vH+jCBMDQTM1SHofZNdDHp1FEYH3Mb5Gz';

function verifyWebhookSignature(rawBody, signature, secretKey) {
  try {
    // Usar el body RAW tal como llega, NO re-serializarlo
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Error verificando firma:', error);
    return false;
  }
}

const eventHandlers = {
  'order.created': async (orderId, data) => {
    console.log('\n🆕 NUEVA ORDEN CREADA');
    console.log(`  ID: ${orderId}`);
    console.log(`  Cliente: ${data.customer_id}`);
    console.log(`  Total: $${data.total_amount}`);
    console.log(`  Items:`, data.items?.length || 0);
  },
  'order.updated': async (orderId, data) => {
    console.log('\n🔄 ORDEN ACTUALIZADA');
    console.log(`  ID: ${orderId}`);
    console.log(`  Nuevo status: ${data.status}`);
  },
  'order.cancelled': async (orderId, data) => {
    console.log('\n❌ ORDEN CANCELADA');
    console.log(`  ID: ${orderId}`);
    console.log(`  Total cancelado: $${data.total_amount}`);
  },
  'order.completed': async (orderId, data) => {
    console.log('\n✅ ORDEN COMPLETADA');
    console.log(`  ID: ${orderId}`);
    console.log(`  Total: $${data.total_amount}`);
  }
};

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-DogCatiFy-Signature, X-DogCatiFy-Event');

  // OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // GET / - Home page
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>DogCatiFy Webhook Server</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          h1 { color: #2D6A6F; }
          code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
          .success { background: #D1FAE5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>🐾 DogCatiFy Webhook Server</h1>
        <div class="success">
          <strong>✅ Servidor activo</strong><br>
          Webhook URL: <code>http://localhost:${PORT}/webhooks/dogcatify</code>
        </div>
        <h2>Secret configurado:</h2>
        <p>${WEBHOOK_SECRET !== 'tu-secret-key-super-segura-aqui' ? '✅ Sí' : '❌ No'}</p>
      </body>
      </html>
    `);
    return;
  }

  // GET /health
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      webhook_secret_configured: !!WEBHOOK_SECRET
    }));
    return;
  }

  // POST /webhooks/dogcatify
  if (req.method === 'POST' && req.url === '/webhooks/dogcatify') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const signature = req.headers['x-dogcatify-signature'];
        const eventType = req.headers['x-dogcatify-event'];

        console.log('\n📥 Webhook recibido:');
        console.log(`  Evento: ${eventType}`);
        console.log(`  Firma: ${signature?.substring(0, 16)}...`);

        if (!signature) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Sin firma de seguridad' }));
          return;
        }

        // IMPORTANTE: Verificar firma con el body RAW antes de parsearlo
        if (!verifyWebhookSignature(body, signature, WEBHOOK_SECRET)) {
          console.error('❌ Firma inválida');
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }

        console.log('✅ Firma verificada correctamente');

        // Ahora sí podemos parsear el payload
        const payload = JSON.parse(body);

        // Responder inmediatamente
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));

        // Procesar webhook async
        const { event, order_id, data, timestamp } = payload;
        console.log(`⏱️  Timestamp: ${timestamp}`);

        const handler = eventHandlers[event];
        if (handler) {
          await handler(order_id, data);
          console.log('✅ Webhook procesado exitosamente');
        } else {
          console.warn(`⚠️  No hay handler para: ${event}`);
        }
      } catch (error) {
        console.error('❌ Error procesando webhook:', error);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Error interno' }));
        }
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║        🐾 DogCatiFy Webhook Server - INICIADO 🐾         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\n✅ Servidor corriendo en: http://localhost:${PORT}`);
  console.log(`📥 Webhook URL: http://localhost:${PORT}/webhooks/dogcatify`);
  console.log(`🔐 Secret configurado: ${WEBHOOK_SECRET ? '✅ Sí' : '❌ No'}`);
  console.log('\n📖 Abre http://localhost:' + PORT + ' en tu navegador');
  console.log('🚀 Para exponer públicamente, usa: ngrok http ' + PORT);
  console.log('════════════════════════════════════════════════════════════\n');
});

process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Promesa rechazada:', reason);
});
