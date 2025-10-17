/**
 * Servidor de ejemplo para recibir webhooks de DogCatiFy
 *
 * Este es un servidor de ejemplo que muestra cómo:
 * - Recibir webhooks de DogCatiFy
 * - Verificar la firma HMAC SHA256
 * - Procesar diferentes tipos de eventos
 *
 * Uso:
 *   1. Instalar dependencias: npm install express
 *   2. Configurar WEBHOOK_SECRET con tu secret_key de la base de datos
 *   3. Ejecutar: node scripts/webhook-server-example.js
 *   4. Exponer el puerto 3001 (usar ngrok para pruebas: ngrok http 3001)
 *   5. Registrar la URL en webhook_subscriptions en la base de datos
 */

import express from 'express';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3001;

// IMPORTANTE: Esta debe ser la misma secret_key que registraste en la base de datos
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'tu-secret-key-super-segura-aqui';

// Middleware para parsear JSON
app.use(express.json());

/**
 * Verifica la firma HMAC SHA256 del webhook
 */
function verifyWebhookSignature(payload, signature, secretKey) {
  try {
    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(payloadString)
      .digest('hex');

    // Usar timingSafeEqual para evitar timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Error verificando firma:', error);
    return false;
  }
}

/**
 * Middleware para verificar webhooks
 */
function webhookVerification(req, res, next) {
  const signature = req.headers['x-dogcatify-signature'];
  const eventType = req.headers['x-dogcatify-event'];

  console.log('\n📥 Webhook recibido:');
  console.log(`  Evento: ${eventType}`);
  console.log(`  Firma: ${signature?.substring(0, 16)}...`);

  if (!signature) {
    console.error('❌ Sin firma de seguridad');
    return res.status(401).json({ error: 'Sin firma de seguridad' });
  }

  if (!verifyWebhookSignature(req.body, signature, WEBHOOK_SECRET)) {
    console.error('❌ Firma inválida');
    return res.status(401).json({ error: 'Firma inválida' });
  }

  console.log('✅ Firma verificada correctamente');
  next();
}

/**
 * Handlers para cada tipo de evento
 */
const eventHandlers = {
  'order.created': async (orderId, data) => {
    console.log('\n🆕 NUEVA ORDEN CREADA');
    console.log(`  ID: ${orderId}`);
    console.log(`  Cliente: ${data.customer?.full_name} (${data.customer?.email})`);
    console.log(`  Total: $${data.total_amount}`);
    console.log(`  Tipo: ${data.order_type}`);
    console.log(`  Items:`, data.items?.length || 0);

    // Aquí puedes:
    // - Enviar email de confirmación
    // - Actualizar inventario
    // - Notificar a tu equipo
    // - Sincronizar con tu sistema
    // - etc.

    // Ejemplo: Guardar en tu base de datos
    // await saveOrderToDatabase(data);

    // Ejemplo: Enviar notificación
    // await sendOrderNotification(data.customer.email, orderId);
  },

  'order.updated': async (orderId, data) => {
    console.log('\n🔄 ORDEN ACTUALIZADA');
    console.log(`  ID: ${orderId}`);
    console.log(`  Nuevo status: ${data.status}`);
    console.log(`  Método de pago: ${data.payment_method}`);
    console.log(`  Estado de pago: ${data.payment_status}`);

    // Aquí puedes:
    // - Actualizar el status en tu sistema
    // - Notificar al cliente si cambió el status
    // - Actualizar tracking
    // - etc.
  },

  'order.cancelled': async (orderId, data) => {
    console.log('\n❌ ORDEN CANCELADA');
    console.log(`  ID: ${orderId}`);
    console.log(`  Cliente: ${data.customer?.full_name}`);
    console.log(`  Total cancelado: $${data.total_amount}`);

    // Aquí puedes:
    // - Reintegrar inventario
    // - Procesar reembolso
    // - Enviar email de cancelación
    // - Actualizar métricas
    // - etc.

    // Ejemplo: Reintegrar stock
    // for (const item of data.items) {
    //   await restoreInventory(item.product_id, item.quantity);
    // }
  },

  'order.completed': async (orderId, data) => {
    console.log('\n✅ ORDEN COMPLETADA');
    console.log(`  ID: ${orderId}`);
    console.log(`  Cliente: ${data.customer?.full_name}`);
    console.log(`  Total: $${data.total_amount}`);
    console.log(`  Completada en: ${data.updated_at}`);

    // Aquí puedes:
    // - Generar factura
    // - Enviar email de confirmación
    // - Actualizar estadísticas
    // - Solicitar review del cliente
    // - etc.

    // Ejemplo: Generar y enviar factura
    // const invoice = await generateInvoice(orderId, data);
    // await sendInvoiceEmail(data.customer.email, invoice);
  }
};

/**
 * Endpoint principal para recibir webhooks
 */
app.post('/webhooks/dogcatify', webhookVerification, async (req, res) => {
  // Responder rápidamente para evitar timeouts
  res.status(200).json({ received: true });

  // Procesar el webhook de forma asíncrona
  const { event, order_id, data, timestamp } = req.body;

  try {
    console.log(`\n⏱️  Timestamp del evento: ${timestamp}`);

    const handler = eventHandlers[event];
    if (handler) {
      await handler(order_id, data);
      console.log('✅ Webhook procesado exitosamente');
    } else {
      console.warn(`⚠️  No hay handler para el evento: ${event}`);
    }
  } catch (error) {
    console.error('\n❌ Error procesando webhook:', error);
    // En producción, aquí deberías:
    // - Registrar el error en tu sistema de logs
    // - Enviar alerta al equipo
    // - Guardar para reintentar después
  }
});

/**
 * Endpoint de health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    webhook_secret_configured: !!WEBHOOK_SECRET && WEBHOOK_SECRET !== 'tu-secret-key-super-segura-aqui'
  });
});

/**
 * Endpoint para probar la verificación de firma
 */
app.post('/test-signature', express.json(), (req, res) => {
  const { payload, signature } = req.body;

  if (!payload || !signature) {
    return res.status(400).json({
      error: 'Se requieren payload y signature'
    });
  }

  const isValid = verifyWebhookSignature(payload, signature, WEBHOOK_SECRET);

  res.json({
    valid: isValid,
    message: isValid ? 'Firma válida ✅' : 'Firma inválida ❌'
  });
});

/**
 * Página de inicio con instrucciones
 */
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>DogCatiFy Webhook Server</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #2D6A6F; }
        code {
          background: #f4f4f4;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
        }
        .warning {
          background: #FEF3C7;
          border-left: 4px solid #F59E0B;
          padding: 15px;
          margin: 20px 0;
        }
        .success {
          background: #D1FAE5;
          border-left: 4px solid #10B981;
          padding: 15px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🐾 DogCatiFy Webhook Server</h1>
        <p>Este servidor está corriendo y listo para recibir webhooks.</p>

        <h2>📋 Configuración</h2>
        <p><strong>Webhook URL:</strong> <code>${req.protocol}://${req.get('host')}/webhooks/dogcatify</code></p>
        <p><strong>Secret configurado:</strong> ${WEBHOOK_SECRET !== 'tu-secret-key-super-segura-aqui' ? '✅ Sí' : '❌ No (usar variable de entorno)'}</p>

        <div class="${WEBHOOK_SECRET !== 'tu-secret-key-super-segura-aqui' ? 'success' : 'warning'}">
          ${WEBHOOK_SECRET !== 'tu-secret-key-super-segura-aqui'
            ? '<strong>✅ Configuración válida</strong><br>El servidor está listo para recibir webhooks.'
            : '<strong>⚠️ Configuración requerida</strong><br>Debes configurar la variable de entorno WEBHOOK_SECRET antes de usar este servidor en producción.'
          }
        </div>

        <h2>🔧 Pasos para configurar</h2>
        <ol>
          <li>Genera una clave secreta segura (mínimo 32 caracteres)</li>
          <li>Registra el webhook en la base de datos:
            <pre style="background:#f4f4f4;padding:15px;border-radius:5px;overflow:auto;">
INSERT INTO webhook_subscriptions (
  partner_id,
  webhook_url,
  events,
  secret_key,
  is_active
) VALUES (
  'tu-partner-id-uuid',
  '${req.protocol}://${req.get('host')}/webhooks/dogcatify',
  '["order.created", "order.updated", "order.cancelled", "order.completed"]',
  'tu-secret-key-aqui',
  true
);</pre>
          </li>
          <li>Configura la variable de entorno:
            <pre style="background:#f4f4f4;padding:15px;border-radius:5px;">
export WEBHOOK_SECRET="tu-secret-key-aqui"</pre>
          </li>
          <li>Reinicia el servidor</li>
        </ol>

        <h2>🧪 Endpoints de prueba</h2>
        <ul>
          <li><code>GET /health</code> - Health check</li>
          <li><code>POST /webhooks/dogcatify</code> - Recibir webhooks</li>
          <li><code>POST /test-signature</code> - Probar verificación de firma</li>
        </ul>

        <p style="margin-top:40px;color:#666;font-size:14px;">
          Para producción, considera usar un servicio como <a href="https://ngrok.com" target="_blank">ngrok</a>
          para exponer este servidor de forma segura.
        </p>
      </div>
    </body>
    </html>
  `);
});

/**
 * Iniciar servidor
 */
app.listen(PORT, () => {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║        🐾 DogCatiFy Webhook Server - INICIADO 🐾         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\n✅ Servidor corriendo en: http://localhost:${PORT}`);
  console.log(`📥 Webhook URL: http://localhost:${PORT}/webhooks/dogcatify`);
  console.log(`🔐 Secret configurado: ${WEBHOOK_SECRET !== 'tu-secret-key-super-segura-aqui' ? '✅ Sí' : '❌ No'}`);

  if (WEBHOOK_SECRET === 'tu-secret-key-super-segura-aqui') {
    console.log('\n⚠️  ADVERTENCIA: Debes configurar WEBHOOK_SECRET antes de usar en producción');
    console.log('   Usa: export WEBHOOK_SECRET="tu-clave-secreta-segura"');
  }

  console.log('\n📖 Abre http://localhost:${PORT} en tu navegador para más información');
  console.log('\n🚀 Para exponer públicamente, usa: ngrok http ${PORT}');
  console.log('════════════════════════════════════════════════════════════\n');
});

// Manejo de errores
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
});
