# 📝 Cambios en CRM - Datos del Partner

## 🎯 Objetivo
Agregar el campo RUT a los negocios (partners) y modificar el webhook y API de órdenes para enviar datos completos del partner al CRM, similar a cómo se envían los datos del cliente.

---

## ✅ Cambios Realizados

### 1. Base de Datos

#### Nueva Columna: `rut`
- **Tabla**: `partners`
- **Tipo**: `TEXT`
- **Nullable**: Sí (para compatibilidad con registros existentes)
- **Índice**: Sí (`idx_partners_rut`)

```sql
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS rut TEXT;

CREATE INDEX IF NOT EXISTS idx_partners_rut ON partners(rut);
```

**Migración aplicada**: `add_rut_to_partners`

---

### 2. Frontend - Formulario de Registro

#### Archivo: `app/(tabs)/partner-register.tsx`

**Cambios realizados:**

1. **Nuevo Estado**:
```typescript
const [rut, setRut] = useState('');
```

2. **Validación Actualizada**:
```typescript
if (!selectedType || !businessName || !description || !calle ||
    !numero || !selectedCountry || !selectedDepartment || !phone || !rut) {
  Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
  return;
}
```

3. **Nuevo Input en el Formulario**:
```typescript
<Input
  label="RUT *"
  placeholder="12345678-9"
  value={rut}
  onChangeText={setRut}
  leftIcon={<FileText size={20} color="#6B7280" />}
/>
```
*Ubicación*: Después del campo "Email de contacto"

4. **Insert en Base de Datos**:
```typescript
await supabaseClient
  .from('partners')
  .insert({
    // ... otros campos
    rut: rut.trim(),
    // ... más campos
  });
```

---

### 3. Frontend - Formulario de Edición

#### Archivo: `app/partner/edit-business.tsx`

**Cambios realizados:**

1. **Nuevo Estado**:
```typescript
const [rut, setRut] = useState('');
```

2. **Carga de Datos**:
```typescript
setRut(data.rut || '');
```

3. **Validación Actualizada**:
```typescript
if (!businessName.trim() || !selectedType || !description.trim() ||
    !phone.trim() || !email.trim() || !rut.trim()) {
  Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
  return;
}
```

4. **Nuevo Input en el Formulario**:
```typescript
<Input
  label="RUT *"
  placeholder="12345678-9"
  value={rut}
  onChangeText={setRut}
  leftIcon={<FileText size={20} color="#6B7280" />}
/>
```
*Ubicación*: Después del campo "Email de contacto"

5. **Update en Base de Datos**:
```typescript
const updateData = {
  // ... otros campos
  rut: rut.trim(),
  // ... más campos
};
```

---

### 4. Backend - Webhook de Órdenes

#### Archivo: `supabase/functions/notify-order-webhook/index.ts`

**Cambio Principal**: Agregar JOIN a tabla `partners` para incluir datos completos del negocio.

**Query Modificada**:
```typescript
const { data: order, error: orderError } = await supabase
  .from("orders")
  .select(`
    id,
    partner_id,
    customer_id,
    // ... otros campos de orden
    customer:profiles!orders_customer_id_fkey(
      id,
      display_name,
      email,
      phone,
      calle,
      numero,
      barrio,
      codigo_postal,
      location
    ),
    partner:partners(
      id,
      business_name,
      email,
      phone,
      calle,
      numero,
      barrio,
      codigo_postal,
      rut,
      location
    )
  `)
  .eq("id", order_id)
  .single();
```

**Estructura del Payload del Webhook**:
```json
{
  "event": "order.created",
  "order_id": "uuid",
  "data": {
    "id": "uuid",
    "partner_id": "uuid",
    "customer_id": "uuid",
    "status": "pending",
    "total_amount": 1000,
    // ... otros campos de orden

    // DATOS DEL CLIENTE
    "customer": {
      "id": "uuid",
      "display_name": "Juan Pérez",
      "email": "juan@example.com",
      "phone": "099123456",
      "calle": "Benigno Paiva",
      "numero": "1165",
      "barrio": "Buceo",
      "codigo_postal": "11600",
      "location": {
        "type": "Point",
        "coordinates": [-56.1234, -34.9012]
      }
    },

    // DATOS DEL PARTNER (NUEVO)
    "partner": {
      "id": "uuid",
      "business_name": "Veterinaria Patitas",
      "email": "info@veterinariapatitas.com",
      "phone": "099654321",
      "calle": "Av. Italia",
      "numero": "2500",
      "barrio": "Pocitos",
      "codigo_postal": "11300",
      "rut": "12345678-9",
      "location": {
        "type": "Point",
        "coordinates": [-56.1567, -34.9123]
      }
    },

    "shipping_info": {
      // ... info de envío
    }
  },
  "timestamp": "2025-10-20T12:00:00.000Z"
}
```

---

### 5. Backend - API de Órdenes

#### Archivo: `supabase/functions/orders-api/index.ts`

**Endpoint Afectado**: `GET /orders-api/{orderId}`

**Query Modificada**:
```typescript
let orderQuery = supabase
  .from("orders")
  .select(`
    *,
    customer:profiles!orders_customer_id_fkey(
      id,
      display_name,
      email,
      phone,
      calle,
      numero,
      barrio,
      codigo_postal,
      location
    ),
    partner:partners(
      id,
      business_name,
      email,
      phone,
      calle,
      numero,
      barrio,
      codigo_postal,
      rut,
      location
    )
  `)
  .eq("id", orderId);
```

**Respuesta de la API**:
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "uuid",
      "partner_id": "uuid",
      "customer_id": "uuid",
      // ... todos los campos de orden

      // DATOS DEL CLIENTE
      "customer": {
        "id": "uuid",
        "display_name": "Juan Pérez",
        "email": "juan@example.com",
        "phone": "099123456",
        "calle": "Benigno Paiva",
        "numero": "1165",
        "barrio": "Buceo",
        "codigo_postal": "11600",
        "location": {...}
      },

      // DATOS DEL PARTNER (NUEVO)
      "partner": {
        "id": "uuid",
        "business_name": "Veterinaria Patitas",
        "email": "info@veterinariapatitas.com",
        "phone": "099654321",
        "calle": "Av. Italia",
        "numero": "2500",
        "barrio": "Pocitos",
        "codigo_postal": "11300",
        "rut": "12345678-9",
        "location": {...}
      }
    },
    "retrieved_at": "2025-10-20T12:00:00.000Z"
  }
}
```

---

## 📋 Campos del Partner Enviados al CRM

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `id` | UUID | ID único del partner | `"8b0ac28e-1095-4b66-bb4a-181128870e85"` |
| `business_name` | String | Nombre del negocio | `"Veterinaria Patitas"` |
| `email` | String | Email del negocio | `"info@veterinariapatitas.com"` |
| `phone` | String | Teléfono del negocio | `"099654321"` |
| `calle` | String | Calle de la dirección | `"Av. Italia"` |
| `numero` | String | Número de puerta | `"2500"` |
| `barrio` | String | Barrio | `"Pocitos"` |
| `codigo_postal` | String | Código postal | `"11300"` |
| `rut` | String | RUT del negocio | `"12345678-9"` |
| `location` | GeoJSON | Coordenadas geográficas | `{"type": "Point", "coordinates": [-56.1567, -34.9123]}` |

---

## 🔄 Comparación: Antes vs Después

### ANTES
```json
{
  "event": "order.created",
  "data": {
    "partner_id": "uuid",
    "customer": {
      "id": "uuid",
      "display_name": "Juan Pérez",
      "email": "juan@example.com",
      // ... más datos
    }
    // ❌ NO había datos del partner
  }
}
```

### DESPUÉS
```json
{
  "event": "order.created",
  "data": {
    "partner_id": "uuid",
    "customer": {
      "id": "uuid",
      "display_name": "Juan Pérez",
      "email": "juan@example.com",
      // ... más datos
    },
    "partner": {
      "id": "uuid",
      "business_name": "Veterinaria Patitas",
      "email": "info@veterinariapatitas.com",
      "phone": "099654321",
      "rut": "12345678-9",
      // ... más datos
    }
  }
}
```

---

## 🧪 Testing

### 1. Verificar Campo RUT en Base de Datos
```sql
SELECT id, business_name, rut
FROM partners
LIMIT 5;
```

### 2. Probar Registro de Nuevo Partner
1. Ir a "Partner Register" en la app
2. Completar todos los campos incluyendo RUT
3. Verificar que se guarda correctamente

### 3. Probar Edición de Partner Existente
1. Ir a "Edit Business"
2. Modificar el campo RUT
3. Guardar y verificar cambios

### 4. Probar Webhook
```bash
# Crear una orden de prueba y verificar el webhook
curl -X POST https://your-url.supabase.co/functions/v1/notify-order-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "order_id": "uuid-de-orden-existente",
    "event_type": "order.created"
  }'
```

Verificar que el payload incluye:
- ✅ Objeto `customer` con datos completos
- ✅ Objeto `partner` con datos completos incluyendo RUT

### 5. Probar Orders API
```bash
curl -X GET "https://your-url.supabase.co/functions/v1/orders-api/{order_id}" \
  -H "X-API-Key: YOUR_PARTNER_ID"
```

Verificar que la respuesta incluye:
- ✅ Objeto `customer` con datos completos
- ✅ Objeto `partner` con datos completos incluyendo RUT

---

## 📊 Impacto en el CRM

El CRM ahora recibirá información completa tanto del **cliente** como del **negocio** en cada orden:

### Beneficios:
1. ✅ **Facturación Completa**: El CRM tiene el RUT del partner para emitir facturas
2. ✅ **Contacto Directo**: Email y teléfono del negocio disponibles
3. ✅ **Geolocalización**: Coordenadas del negocio para mapas y logística
4. ✅ **Dirección Completa**: Todos los campos de dirección estructurados
5. ✅ **Trazabilidad**: ID único del partner para seguimiento

### Casos de Uso:
- Emisión de facturas con datos fiscales del partner
- Comunicación directa con el negocio
- Análisis geográfico de órdenes por ubicación de partners
- Reportes de ventas por negocio
- Gestión de comisiones por partner

---

## 🚀 Próximos Pasos

### Opcionales (Mejoras Futuras)

1. **Validación de RUT**:
   - Agregar validación de formato en el frontend
   - Verificar dígito verificador

2. **RUT Único**:
   - Agregar constraint UNIQUE al campo RUT si es necesario
   - Validar que no se repitan RUTs entre partners

3. **Migración de Datos**:
   - Script para rellenar RUTs de partners existentes
   - Solicitar a partners que actualicen su RUT

4. **Documentación CRM**:
   - Actualizar documentación del CRM con nuevos campos
   - Ejemplos de procesamiento de datos del partner

---

## 📚 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `supabase/migrations/add_rut_to_partners.sql` | ✅ Nueva migración con campo RUT |
| `app/(tabs)/partner-register.tsx` | ✅ Campo RUT en formulario de registro |
| `app/partner/edit-business.tsx` | ✅ Campo RUT en formulario de edición |
| `supabase/functions/notify-order-webhook/index.ts` | ✅ JOIN a partners con todos los datos |
| `supabase/functions/orders-api/index.ts` | ✅ JOIN a partners en GET order |

---

## ✅ Checklist de Implementación

- [x] Crear migración con campo RUT
- [x] Agregar campo RUT al formulario de registro
- [x] Agregar campo RUT al formulario de edición
- [x] Modificar webhook para incluir datos del partner
- [x] Modificar orders-api para incluir datos del partner
- [ ] Testing en ambiente de desarrollo
- [ ] Testing en ambiente de producción
- [ ] Actualizar documentación del CRM
- [ ] Notificar al equipo del CRM sobre nuevos campos

---

**Fecha de Implementación**: Octubre 2025
**Versión**: 1.0.0
**Estado**: ✅ Completado
