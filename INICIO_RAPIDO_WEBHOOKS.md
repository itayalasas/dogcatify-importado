# 🚀 Inicio Rápido: Webhooks en 5 Minutos

Guía express para conectar tu CRM y recibir órdenes automáticamente.

---

## ⚡ Pasos Rápidos

### 1. Generar Secret Key (30 segundos)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado. Ejemplo: `a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3a4b5c6d7e8f9`

---

### 2. Iniciar Servidor (1 minuto)

```bash
# Configurar secret
export WEBHOOK_SECRET="pega-tu-secret-key-aqui"

# Iniciar servidor
node scripts/webhook-server-example.js
```

Deberías ver:
```
✅ Servidor corriendo en: http://localhost:3001
```

---

### 3. Exponer Públicamente (1 minuto)

**Si usas ngrok:**
```bash
ngrok http 3001
```

Copia la URL que te da, ejemplo: `https://abc123.ngrok.io`

---

### 4. Registrar Webhook (1 minuto)

Ejecuta en **Supabase SQL Editor**:

```sql
INSERT INTO webhook_subscriptions (
  partner_id,
  webhook_url,
  events,
  secret_key,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'https://abc123.ngrok.io/webhooks/dogcatify',  -- ⚠️ Reemplaza con TU URL de ngrok
  '["order.created", "order.updated", "order.cancelled", "order.completed"]'::jsonb,
  'a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3a4b5c6d7e8f9',  -- ⚠️ Reemplaza con TU secret
  true
);
```

---

### 5. Probar (1 minuto)

```bash
node scripts/test-webhook-integration.js
```

Verifica que en tu servidor veas:
```
📥 Webhook recibido:
  Evento: order.created
✅ Firma verificada correctamente
🆕 NUEVA ORDEN CREADA
  ID: ...
✅ Webhook procesado exitosamente
```

---

## ✅ ¡Listo!

Ahora cada vez que:
- Se crea una orden → Recibes `order.created`
- Se actualiza → Recibes `order.updated`
- Se cancela → Recibes `order.cancelled`
- Se completa → Recibes `order.completed`

---

## 🎯 Siguiente Paso

Edita `scripts/webhook-server-example.js` para conectar con tu CRM:

```javascript
'order.created': async (orderId, data) => {
  // Conecta con tu base de datos o API
  await tuCRM.guardarOrden({
    id: orderId,
    cliente: data.customer.full_name,
    email: data.customer.email,
    total: data.total_amount,
    items: data.items
  });
}
```

---

## 📚 Documentación Completa

Para más detalles, ver:
- **GUIA_WEBHOOKS_PASO_A_PASO.md** - Guía detallada completa
- **CONECTAR_CRM_AUTOMATICO.md** - Todas las opciones disponibles
- **CONFIGURACION_API_CRM.md** - Uso del token administrativo

---

## 🆘 Problemas Comunes

**No llegan webhooks:**
```sql
-- Verificar que esté registrado
SELECT * FROM webhook_subscriptions WHERE is_active = true;
```

**Firma inválida:**
- Asegúrate de usar el MISMO secret_key en la base de datos y en `WEBHOOK_SECRET`

**Servidor no responde:**
```bash
# Verificar que esté corriendo
curl http://localhost:3001/health
```

---

## 🎉 ¡Todo funciona!

Ya tienes tu CRM conectado y recibiendo órdenes en tiempo real automáticamente.
