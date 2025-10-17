# 📚 Documentación Completa: Webhooks para CRM

Toda la documentación para conectar tu CRM con DogCatiFy y recibir órdenes automáticamente.

---

## 🚀 Inicio Rápido (5 minutos)

**¿Primera vez? Empieza aquí:**

📄 **[INICIO_RAPIDO_WEBHOOKS.md](./INICIO_RAPIDO_WEBHOOKS.md)**

Setup básico en 5 pasos:
1. Generar secret key
2. Iniciar servidor
3. Exponer públicamente
4. Registrar webhook
5. Probar

---

## 📖 Guías Principales

### 1. Guía Completa Paso a Paso

📄 **[GUIA_WEBHOOKS_PASO_A_PASO.md](./GUIA_WEBHOOKS_PASO_A_PASO.md)**

Guía detallada que cubre:
- ✅ Configuración desde cero
- ✅ Seguridad y firmas HMAC
- ✅ Deployment en producción
- ✅ Troubleshooting
- ✅ Monitoreo y logs
- ✅ Reintentos automáticos

**Recomendado para:** Implementación seria en producción

---

### 2. Todas las Opciones de Conexión

📄 **[CONECTAR_CRM_AUTOMATICO.md](./CONECTAR_CRM_AUTOMATICO.md)**

Compara las 3 formas de conectar tu CRM:
- ⭐ **Opción 1: Webhooks** (Recomendada)
- 📊 **Opción 2: Polling** (Consultas periódicas)
- 🔄 **Opción 3: Realtime** (Supabase Realtime)

Con ejemplos de código para cada una.

**Recomendado para:** Decidir qué opción usar

---

### 3. API REST para CRM

📄 **[CONFIGURACION_API_CRM.md](./CONFIGURACION_API_CRM.md)**

Documentación del token administrativo:
- 🔑 Token: `dogcatify_admin_2025_secure`
- 📍 Endpoint: `/functions/v1/orders-api`
- ✅ Acceso a TODAS las órdenes
- 📊 Filtros y paginación

**Recomendado para:** Integración con sistemas legacy que no soportan webhooks

---

## 💻 Ejemplos de Código

### 4. Ejemplos Multi-Lenguaje

📄 **[EJEMPLOS_WEBHOOK_MULTILENGUAJE.md](./EJEMPLOS_WEBHOOK_MULTILENGUAJE.md)**

Implementaciones listas para copiar/pegar en:
- JavaScript / Node.js + Express
- Python + Flask
- Python + FastAPI
- PHP + Laravel
- Ruby + Sinatra
- C# + ASP.NET Core
- Go + Gin
- Java + Spring Boot
- TypeScript + Express

**Recomendado para:** Implementar en tu lenguaje favorito

---

## 🧪 Testing y Pruebas

### Scripts Disponibles

**1. Servidor de Ejemplo (Ya incluido)**

```bash
# Iniciar servidor de prueba
export WEBHOOK_SECRET="tu-secret-key"
node scripts/webhook-server-example.js
```

Características:
- ✅ Verificación de firmas HMAC
- ✅ Handlers para todos los eventos
- ✅ Logs detallados
- ✅ Página web de configuración

**2. Script de Prueba Integración**

```bash
# Probar webhook end-to-end
node scripts/test-webhook-integration.js

# Probar todos los eventos
node scripts/test-webhook-integration.js --all
```

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐
│  App DogCatiFy  │
│   (Expo/React)  │
└────────┬────────┘
         │
         │ Crea orden
         ▼
┌─────────────────┐
│   Supabase DB   │
│   (PostgreSQL)  │
└────────┬────────┘
         │
         │ TRIGGER automático
         ▼
┌─────────────────────────┐
│  Edge Function:         │
│  notify-order-webhook   │
└────────┬────────────────┘
         │
         │ HTTP POST con firma HMAC
         ▼
┌────────────────────┐
│   TU SERVIDOR CRM  │
│  (Cualquier stack) │
└────────────────────┘
         │
         │ Guarda en tu DB
         ▼
┌────────────────────┐
│   TU BASE DE DATOS │
│   (MySQL, etc.)    │
└────────────────────┘
```

---

## 📊 Eventos Disponibles

| Evento | Descripción | Cuándo se dispara |
|--------|-------------|-------------------|
| `order.created` | Nueva orden creada | Al crear una orden desde la app |
| `order.updated` | Orden actualizada | Al cambiar cualquier campo de la orden |
| `order.cancelled` | Orden cancelada | Al cambiar status a 'cancelled' |
| `order.completed` | Orden completada | Al cambiar status a 'completed' |

---

## 🔒 Seguridad

### Verificación de Firma HMAC

Todos los webhooks incluyen una firma HMAC SHA-256 en el header `X-DogCatiFy-Signature`.

**Ejemplo de verificación:**

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

⚠️ **SIEMPRE verifica la firma** antes de procesar un webhook.

---

## 📦 Estructura del Payload

```json
{
  "event": "order.created",
  "order_id": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "partner_id": "uuid",
    "customer_id": "uuid",
    "status": "pending",
    "total_amount": 5000,
    "items": [
      {
        "product_id": "uuid",
        "quantity": 2,
        "price": 2500
      }
    ],
    "payment_method": "mercadopago",
    "payment_status": "pending",
    "created_at": "2025-10-17T10:00:00Z",
    "updated_at": "2025-10-17T10:00:00Z"
  },
  "timestamp": "2025-10-17T10:00:00Z"
}
```

---

## 🔧 Base de Datos

### Tablas Relacionadas

**webhook_subscriptions** - Configuración de webhooks
```sql
id              uuid
partner_id      uuid
webhook_url     text
events          jsonb
secret_key      text
is_active       boolean
created_at      timestamptz
updated_at      timestamptz
```

**webhook_logs** - Historial de envíos
```sql
id                          uuid
webhook_subscription_id     uuid
order_id                    uuid
event_type                  text
payload                     jsonb
response_status             integer
response_body               text
attempt_number              integer
success                     boolean
created_at                  timestamptz
```

### Consultas Útiles

**Ver webhooks activos:**
```sql
SELECT * FROM webhook_subscriptions WHERE is_active = true;
```

**Ver últimos 10 webhooks enviados:**
```sql
SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 10;
```

**Ver webhooks fallidos:**
```sql
SELECT * FROM webhook_logs WHERE success = false ORDER BY created_at DESC;
```

---

## 🌐 Deployment

### Opciones de Hosting

**Cloud Platforms:**
- Heroku
- DigitalOcean App Platform
- Railway
- Render
- Fly.io

**Serverless:**
- AWS Lambda
- Google Cloud Functions
- Azure Functions
- Vercel (Node.js/Python)
- Netlify Functions

**VPS/Dedicado:**
- DigitalOcean Droplet
- Linode
- AWS EC2
- Google Compute Engine

### Variables de Entorno Requeridas

```bash
WEBHOOK_SECRET=tu-clave-secreta-de-32-caracteres-minimo
PORT=3001
NODE_ENV=production
```

---

## 📞 Troubleshooting

### No llegan webhooks

1. **Verificar webhook registrado:**
```sql
SELECT * FROM webhook_subscriptions WHERE is_active = true;
```

2. **Verificar servidor corriendo:**
```bash
curl http://tu-servidor.com/health
```

3. **Ver logs de errores:**
```sql
SELECT * FROM webhook_logs WHERE success = false ORDER BY created_at DESC LIMIT 5;
```

### Firma inválida

- Asegúrate de usar el MISMO `secret_key` en:
  - Base de datos (`webhook_subscriptions.secret_key`)
  - Servidor (`WEBHOOK_SECRET` env var)

### Timeout

Responde HTTP 200 INMEDIATAMENTE, procesa después:

```javascript
app.post('/webhook', (req, res) => {
  res.status(200).json({ received: true }); // Responder YA

  // Procesar después
  processWebhook(req.body).catch(console.error);
});
```

---

## 📈 Monitoreo

### Métricas Recomendadas

- ✅ Webhooks exitosos vs fallidos
- ⏱️ Tiempo de respuesta del endpoint
- 🔄 Reintentos necesarios
- 📊 Eventos por tipo

### Alertas Recomendadas

- ❌ Tasa de fallos > 5%
- ⚠️ Tiempo de respuesta > 5 segundos
- 🔴 Endpoint caído > 5 minutos

---

## ✅ Checklist de Producción

- [ ] Secret key seguro (32+ caracteres aleatorios)
- [ ] HTTPS habilitado (no HTTP)
- [ ] Verificación de firma implementada
- [ ] Rate limiting configurado
- [ ] Logs y monitoreo activos
- [ ] Alertas configuradas
- [ ] Respuestas rápidas (< 1 segundo)
- [ ] Procesamiento asíncrono
- [ ] Base de datos respaldada
- [ ] PM2 o similar para keep-alive
- [ ] Variables de entorno seguras

---

## 🎓 Recursos Adicionales

### Documentación Oficial

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [PostgreSQL Triggers](https://www.postgresql.org/docs/current/sql-createtrigger.html)
- [HMAC SHA-256](https://en.wikipedia.org/wiki/HMAC)

### Tools Útiles

- [ngrok](https://ngrok.com/) - Exponer localhost públicamente
- [Webhook.site](https://webhook.site/) - Debugger de webhooks
- [Postman](https://www.postman.com/) - Testing de APIs
- [PM2](https://pm2.keymetrics.io/) - Process manager para Node.js

---

## 💬 Soporte

Si necesitas ayuda:

1. Revisa la sección de **Troubleshooting** arriba
2. Consulta los logs en `webhook_logs`
3. Verifica la configuración en `webhook_subscriptions`
4. Prueba con el script de test: `node scripts/test-webhook-integration.js`

---

## 🎉 ¡Éxito!

Una vez configurado, tu CRM recibirá automáticamente:
- Nuevas órdenes en tiempo real
- Actualizaciones de status
- Cancelaciones
- Completaciones

**Sin necesidad de consultar constantemente la API.**

---

_Última actualización: 2025-10-17_
