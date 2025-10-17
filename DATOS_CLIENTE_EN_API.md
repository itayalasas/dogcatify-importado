# 📋 Datos del Cliente en la API de Órdenes

## ✅ Cambios Implementados

Se ha actualizado la **API de Órdenes** y el **Sistema de Webhooks** para incluir automáticamente los datos del cliente en todas las respuestas.

### 🎯 Beneficios

1. **Integración CRM Simplificada**: Ya no necesitas hacer consultas adicionales para obtener los datos del cliente
2. **Información Completa**: Cada orden incluye todos los datos necesarios del cliente
3. **Webhooks Mejorados**: Los webhooks ahora envían los datos del cliente automáticamente

---

## 📦 Estructura de Datos del Cliente

Cada orden ahora incluye un objeto `customer` con la siguiente información:

```json
{
  "id": "uuid-del-cliente",
  "full_name": "Nombre Completo",
  "email": "cliente@email.com",
  "phone": "+1234567890",
  "address": "Calle Principal 123",
  "city": "Ciudad",
  "country": "País"
}
```

### 🔗 Mapeo con tu CRM

Estos datos se mapean directamente a tu tabla `clients`:

| Campo API | Campo CRM | Descripción |
|-----------|-----------|-------------|
| `customer.id` | `external_id` | ID único del cliente en DogCatiFy |
| `customer.full_name` | `contact_name` | Nombre completo del cliente |
| `customer.email` | `email` | Correo electrónico |
| `customer.phone` | `phone` | Número de teléfono |
| `customer.address` | `address` | Dirección completa |
| `customer.city` | `city` | Ciudad |
| `customer.country` | `country` | País |

---

## 🔌 API Endpoints Actualizados

### 1. Obtener Orden Específica

```bash
GET /functions/v1/orders-api/{order_id}
```

**Headers:**
```
X-API-Key: tu-api-key-aqui
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "orden-uuid",
      "partner_id": "partner-uuid",
      "customer_id": "customer-uuid",
      "status": "pending",
      "total_amount": 150.00,
      "order_type": "product",
      "items": [...],
      "created_at": "2025-10-17T00:00:00Z",

      "customer": {
        "id": "customer-uuid",
        "full_name": "Juan Pérez",
        "email": "juan@example.com",
        "phone": "+1234567890",
        "address": "Calle Principal 123",
        "city": "Buenos Aires",
        "country": "Argentina"
      }
    }
  }
}
```

### 2. Listar Órdenes

```bash
GET /functions/v1/orders-api?page=1&limit=10
```

**Headers:**
```
X-API-Key: tu-api-key-aqui
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "orden-uuid",
        "status": "pending",
        "total_amount": 150.00,
        "customer": {
          "id": "customer-uuid",
          "full_name": "Juan Pérez",
          "email": "juan@example.com",
          "phone": "+1234567890",
          "address": "Calle Principal 123",
          "city": "Buenos Aires",
          "country": "Argentina"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "total_pages": 3
    }
  }
}
```

---

## 🪝 Webhooks con Datos del Cliente

Cuando se dispara un webhook, el payload ahora incluye los datos del cliente:

### Ejemplo de Payload

```json
{
  "event": "order.created",
  "order_id": "orden-uuid",
  "timestamp": "2025-10-17T00:00:00Z",
  "data": {
    "id": "orden-uuid",
    "partner_id": "partner-uuid",
    "customer_id": "customer-uuid",
    "status": "pending",
    "total_amount": 150.00,
    "order_type": "product",
    "items": [...],

    "customer": {
      "id": "customer-uuid",
      "full_name": "Juan Pérez",
      "email": "juan@example.com",
      "phone": "+1234567890",
      "address": "Calle Principal 123",
      "city": "Buenos Aires",
      "country": "Argentina"
    }
  }
}
```

### Ejemplo de Handler en tu Webhook

```javascript
app.post('/webhooks/dogcatify', webhookVerification, async (req, res) => {
  res.status(200).json({ received: true });

  const { event, order_id, data } = req.body;

  if (event === 'order.created' && data.customer) {
    // Crear o actualizar cliente en tu CRM
    await crm.upsertClient({
      external_id: data.customer.id,
      contact_name: data.customer.full_name,
      email: data.customer.email,
      phone: data.customer.phone,
      address: data.customer.address,
      city: data.customer.city,
      country: data.customer.country,
      source: 'dogcatify',
      status: 'active',
    });

    // Crear orden en tu CRM vinculada al cliente
    await crm.createOrder({
      external_id: order_id,
      client_external_id: data.customer.id,
      total: data.total_amount,
      status: data.status,
    });
  }
});
```

---

## 🧪 Script de Prueba

Ejecuta el siguiente script para probar la API con datos del cliente:

```bash
node scripts/test-orders-api-with-customer.js
```

Este script:
- Obtiene una lista de órdenes con datos del cliente
- Muestra una orden específica con todos los detalles del cliente
- Crea una orden de prueba si no hay órdenes existentes
- Muestra el formato JSON para integrar con tu CRM

---

## 📊 Ejemplo de Integración Completa

### Flujo Automático

1. **Cliente crea una orden** en DogCatiFy
2. **Se dispara webhook** `order.created` con datos del cliente
3. **Tu sistema recibe el webhook** y extrae los datos del cliente
4. **Crea/actualiza el cliente** en tu CRM automáticamente
5. **Crea la orden** vinculada al cliente en tu CRM

### Código de Ejemplo

```javascript
const eventHandlers = {
  'order.created': async (orderId, orderData) => {
    console.log('Nueva orden creada:', orderId);

    // 1. Guardar/Actualizar Cliente en CRM
    if (orderData.customer) {
      const client = await crmApi.upsertClient({
        external_id: orderData.customer.id,
        contact_name: orderData.customer.full_name,
        email: orderData.customer.email,
        phone: orderData.customer.phone,
        address: orderData.customer.address,
        city: orderData.customer.city,
        country: orderData.customer.country,
        source: 'dogcatify',
      });

      console.log('Cliente sincronizado:', client.id);

      // 2. Crear Orden en CRM
      const order = await crmApi.createOrder({
        external_id: orderId,
        client_id: client.id,
        total_amount: orderData.total_amount,
        status: orderData.status,
        order_type: orderData.order_type,
        items: orderData.items,
        created_at: orderData.created_at,
      });

      console.log('Orden sincronizada:', order.id);
    }
  },

  'order.updated': async (orderId, orderData) => {
    // Actualizar status de la orden en tu CRM
    await crmApi.updateOrder(orderId, {
      status: orderData.status,
      payment_status: orderData.payment_status,
    });
  },
};
```

---

## ✨ Ventajas de esta Implementación

### Para Desarrolladores
- ✅ Menos consultas a la base de datos
- ✅ Código más simple y limpio
- ✅ Sincronización automática con CRM
- ✅ Datos completos en un solo request

### Para el Negocio
- ✅ Integración más rápida con sistemas externos
- ✅ Datos del cliente siempre disponibles
- ✅ Menor latencia en las integraciones
- ✅ Experiencia de integración mejorada

---

## 📝 Notas Importantes

1. **Privacidad**: Los datos del cliente solo se incluyen en órdenes que pertenecen al partner autenticado
2. **Admin Access**: Los administradores pueden ver los datos de todos los clientes
3. **Seguridad**: Todos los datos viajan por HTTPS y requieren autenticación
4. **Performance**: La consulta con JOIN está optimizada y no afecta el rendimiento

---

## 🔧 Próximos Pasos

1. Ejecuta el script de prueba para verificar los datos
2. Actualiza tu webhook handler para procesar los datos del cliente
3. Implementa la sincronización automática con tu CRM
4. Prueba el flujo completo de creación de orden

---

## 📞 Soporte

Si necesitas ayuda con la integración:
- Revisa la documentación completa en `/DOCUMENTACION_API_ORDENES.md`
- Consulta ejemplos en `/EJEMPLOS_RAPIDOS_API.md`
- Prueba el webhook con `/scripts/webhook-server-simple.js`
