# Configuración API para CRM - Acceso Administrativo

## 🎯 Problema Resuelto

La API ahora soporta **dos tipos de acceso**:

1. **Token de Partner** (Partner ID) - Solo ve sus propias órdenes
2. **Token Administrativo** (para CRM) - Ve **TODAS** las órdenes de todos los partners

## 🔐 Token Administrativo

### Token por Defecto

```
dogcatify_admin_2025_secure
```

**⚠️ IMPORTANTE:** Este es el token por defecto. Cámbialo inmediatamente en producción.

### Cómo Cambiar el Token

Para mayor seguridad, puedes configurar tu propio token mediante la variable de entorno `ADMIN_API_TOKEN` en Supabase:

1. Ve a tu proyecto en Supabase
2. Settings > Edge Functions > Secrets
3. Agrega: `ADMIN_API_TOKEN` = `tu-token-super-seguro-aqui`

Si no configuras esta variable, se usará el token por defecto.

---

## 🚀 Uso para CRM

### Obtener TODAS las Órdenes

```bash
curl -X GET \
  "https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api?page=1&limit=100" \
  -H "X-API-Key: dogcatify_admin_2025_secure"
```

### Respuesta

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "uuid",
        "partner_id": "partner-uuid",
        "customer_id": "customer-uuid",
        "status": "completed",
        "total_amount": 5000,
        "items": [...],
        "customer": {
          "full_name": "Juan Pérez",
          "email": "juan@example.com",
          "phone": "+598 99 123 456"
        },
        "partner": {
          "full_name": "María García",
          "email": "maria@example.com",
          "business_name": "Veterinaria Central"
        },
        "service": {...},
        "pet": {...},
        "created_at": "2025-10-17T10:00:00Z",
        "updated_at": "2025-10-17T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 250,
      "total_pages": 3
    },
    "retrieved_at": "2025-10-17T10:00:00Z"
  }
}
```

---

## 📊 Filtros Disponibles

### Filtrar por Status

```bash
curl -X GET \
  "https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api?status=completed" \
  -H "X-API-Key: dogcatify_admin_2025_secure"
```

### Filtrar por Rango de Fechas

```bash
curl -X GET \
  "https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api?from=2025-10-01T00:00:00Z&to=2025-10-31T23:59:59Z" \
  -H "X-API-Key: dogcatify_admin_2025_secure"
```

### Filtrar por Partner Específico (solo admin)

```bash
curl -X GET \
  "https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api?partner_id=PARTNER-UUID" \
  -H "X-API-Key: dogcatify_admin_2025_secure"
```

### Combinando Filtros

```bash
curl -X GET \
  "https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api?status=completed&from=2025-10-01T00:00:00Z&page=1&limit=50" \
  -H "X-API-Key: dogcatify_admin_2025_secure"
```

---

## 💻 Ejemplos de Código

### JavaScript/Node.js

```javascript
const ADMIN_TOKEN = 'dogcatify_admin_2025_secure';
const API_URL = 'https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api';

async function getAllOrders() {
  const response = await fetch(API_URL, {
    headers: {
      'X-API-Key': ADMIN_TOKEN
    }
  });

  const data = await response.json();
  return data.data.orders;
}

// Obtener órdenes con filtros
async function getFilteredOrders(status, fromDate, toDate) {
  const params = new URLSearchParams({
    status: status,
    from: fromDate,
    to: toDate,
    limit: '100'
  });

  const response = await fetch(`${API_URL}?${params}`, {
    headers: {
      'X-API-Key': ADMIN_TOKEN
    }
  });

  const data = await response.json();
  return data.data.orders;
}

// Uso
const allOrders = await getAllOrders();
console.log(`Total de órdenes: ${allOrders.length}`);

const completedOrders = await getFilteredOrders(
  'completed',
  '2025-10-01T00:00:00Z',
  '2025-10-31T23:59:59Z'
);
console.log(`Órdenes completadas en octubre: ${completedOrders.length}`);
```

### Python

```python
import requests

ADMIN_TOKEN = 'dogcatify_admin_2025_secure'
API_URL = 'https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api'

headers = {
    'X-API-Key': ADMIN_TOKEN
}

def get_all_orders():
    response = requests.get(API_URL, headers=headers)
    data = response.json()
    return data['data']['orders']

def get_filtered_orders(status=None, from_date=None, to_date=None, limit=100):
    params = {'limit': limit}
    if status:
        params['status'] = status
    if from_date:
        params['from'] = from_date
    if to_date:
        params['to'] = to_date

    response = requests.get(API_URL, headers=headers, params=params)
    data = response.json()
    return data['data']['orders']

# Uso
all_orders = get_all_orders()
print(f'Total de órdenes: {len(all_orders)}')

completed_orders = get_filtered_orders(
    status='completed',
    from_date='2025-10-01T00:00:00Z',
    to_date='2025-10-31T23:59:59Z'
)
print(f'Órdenes completadas en octubre: {len(completed_orders)}')
```

---

## 🔄 Sincronizar con CRM

### Opción 1: Polling (Consulta Periódica)

```javascript
// Ejecutar cada 5 minutos
setInterval(async () => {
  const lastSync = localStorage.getItem('lastOrderSync');
  const fromDate = lastSync || new Date(Date.now() - 24*60*60*1000).toISOString();

  const response = await fetch(
    `${API_URL}?from=${fromDate}&limit=1000`,
    { headers: { 'X-API-Key': ADMIN_TOKEN } }
  );

  const data = await response.json();
  const orders = data.data.orders;

  // Sincronizar con tu CRM
  for (const order of orders) {
    await syncOrderToCRM(order);
  }

  localStorage.setItem('lastOrderSync', new Date().toISOString());
}, 5 * 60 * 1000); // 5 minutos
```

### Opción 2: Webhooks (Recomendado)

Para recibir notificaciones en tiempo real cuando se crea o actualiza una orden, configura un webhook:

```sql
INSERT INTO webhook_subscriptions (
  partner_id,
  webhook_url,
  events,
  secret_key,
  is_active
) VALUES (
  'cualquier-partner-id', -- No importa para el CRM
  'https://tu-crm.com/webhooks/dogcatify',
  '["order.created", "order.updated", "order.cancelled", "order.completed"]',
  'secret-key-generada-con-openssl',
  true
);
```

Ver `DOCUMENTACION_API_ORDENES.md` para más detalles sobre webhooks.

---

## 🔒 Seguridad

### Mejores Prácticas

1. **Cambia el Token por Defecto**
   - Genera un token seguro: `openssl rand -hex 32`
   - Configúralo en Supabase como `ADMIN_API_TOKEN`

2. **Usa HTTPS**
   - Nunca uses HTTP en producción
   - Todas las peticiones deben ser por HTTPS

3. **No Expongas el Token**
   - Guárdalo en variables de entorno
   - No lo incluyas en código cliente
   - No lo commits a Git

4. **Monitorea el Uso**
   - Revisa los logs regularmente
   - Configura alertas para accesos anómalos

5. **Rota el Token Periodicamente**
   - Cambia el token cada 3-6 meses
   - Ten un plan de rotación

---

## 📝 Diferencias con Partner API

| Característica | Token Admin | Token Partner |
|----------------|-------------|---------------|
| Ve todas las órdenes | ✅ Sí | ❌ No, solo las propias |
| Necesita registro en DB | ❌ No | ✅ Sí, debe ser partner |
| Puede filtrar por partner_id | ✅ Sí | ❌ No |
| Ideal para | CRM, Reportes, Admin | Partners individuales |

---

## 🧪 Probar

### Prueba Rápida

```bash
# Probar con token administrativo
curl -X GET \
  "https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api?limit=5" \
  -H "X-API-Key: dogcatify_admin_2025_secure"

# Deberías ver TODAS las órdenes de todos los partners
```

### Código de Prueba

Ejecuta el script de pruebas modificado:

```bash
# Edita el script para usar el token admin
# En scripts/test-orders-api.js cambia:
const API_KEY = 'dogcatify_admin_2025_secure';

# Luego ejecuta:
node scripts/test-orders-api.js
```

---

## ❓ FAQ

### ¿Por qué necesito un token diferente para el CRM?

Porque el CRM necesita ver **todas las órdenes** de **todos los partners**, mientras que cada partner individual solo debe ver sus propias órdenes.

### ¿Puedo tener múltiples tokens admin?

Actualmente solo hay un token admin. Si necesitas múltiples tokens, puedes crear una tabla de tokens administrativos en la base de datos.

### ¿El token admin afecta la seguridad de los partners?

No, los partners siguen usando su Partner ID y solo ven sus propias órdenes. El token admin es adicional y no interfiere con el acceso de los partners.

### ¿Puedo deshabilitar el token por defecto?

Sí, simplemente configura `ADMIN_API_TOKEN` en Supabase. El token por defecto solo se usa si no hay variable de entorno configurada.

---

## 📞 Soporte

- Documentación completa: `DOCUMENTACION_API_ORDENES.md`
- Ejemplos rápidos: `EJEMPLOS_RAPIDOS_API.md`
- README general: `API_ORDENES_README.md`

---

## ✅ Checklist

- [ ] Cambié el token por defecto por uno seguro
- [ ] Configuré `ADMIN_API_TOKEN` en Supabase
- [ ] Probé la API con el token admin
- [ ] Implementé sincronización con mi CRM
- [ ] Configuré webhooks (opcional)
- [ ] Monitore el uso de la API
