# Fix: Error de Foreign Key en Webhooks del CRM

## Problema Original

Error al procesar webhooks:
```
❌ Error procesando webhook: {
  code: "23503",
  details: 'Key (partner_id)=(8dfe492a-688c-4abe-b079-2533d14f3a64) is not present in table "partners".',
  hint: null,
  message: 'insert or update on table "orders" violates foreign key constraint "orders_partner_id_fkey"'
}
```

## Causa Raíz

El trigger `trigger_webhook_notification()` estaba usando el **ANON KEY** hardcoded en lugar del **SERVICE_ROLE_KEY**:

```sql
-- ❌ PROBLEMA: Usaba ANON KEY
supabase_service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; -- Este es el ANON KEY
```

El ANON key está sujeto a las **políticas RLS** (Row Level Security), lo que causaba que:

1. Las consultas a la tabla `partners` desde la Edge Function fallaran
2. El webhook no podía acceder a los datos del partner
3. Se generaban errores de foreign key constraint

## Solución Aplicada

✅ **Migración aplicada**: `fix_webhook_trigger_use_service_role_key`

### Cambios realizados:

1. **Eliminado el ANON KEY hardcoded del trigger**
2. **El trigger ahora llama a la Edge Function sin autenticación especial**
3. **La Edge Function usa automáticamente el SERVICE_ROLE_KEY** que tiene acceso completo sin RLS

### Código actualizado:

```sql
-- ✅ SOLUCIÓN: Sin autenticación hardcoded
PERFORM net.http_post(
  url := function_url,
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-webhook-trigger', 'true'  -- Solo header identificador
  ),
  body := payload
);
```

### Cómo funciona ahora:

```
1. Trigger ejecuta →
2. Llama a Edge Function (sin auth especial) →
3. Edge Function usa SERVICE_ROLE_KEY automáticamente →
4. Consultas sin RLS →
5. ✅ Success
```

## Verificación

### 1. Verificar que el partner existe:

```sql
SELECT id, business_name
FROM partners
WHERE id = '8dfe492a-688c-4abe-b079-2533d14f3a64';
```

**Resultado esperado**: El partner debe existir

### 2. Verificar órdenes existentes:

```sql
SELECT id, partner_id, status, created_at
FROM orders
WHERE partner_id = '8dfe492a-688c-4abe-b079-2533d14f3a64'
ORDER BY created_at DESC
LIMIT 5;
```

**Resultado esperado**: Deberían aparecer órdenes con ese partner_id

### 3. Probar creación de nueva orden:

Crea una orden de prueba desde la app con productos del partner "Animal Shop" (`8dfe492a-688c-4abe-b079-2533d14f3a64`).

**Resultado esperado**:
- ✅ La orden se crea correctamente
- ✅ El webhook se dispara sin errores
- ✅ El CRM recibe la notificación

### 4. Verificar logs del webhook:

```sql
SELECT
  id,
  order_id,
  event_type,
  success,
  response_status,
  created_at
FROM webhook_logs
ORDER BY created_at DESC
LIMIT 10;
```

**Resultado esperado**:
- `success = true`
- `response_status = 200`
- Sin mensajes de error de foreign key

## Cambios Adicionales Relacionados

También se agregó el campo `discount_amount` a todos los items en el JSON del webhook:

### Estructura actualizada del item:

```json
{
  "id": "item-id",
  "name": "Producto",
  "price": 532.79,
  "original_price": 650,
  "price_original": 650,      // ← NUEVO CAMPO (precio original unitario)
  "discount_percentage": 18,
  "discount_amount": 117.21,  // ← NUEVO CAMPO (monto del descuento)
  "currency": "UYU",
  "currency_code_dgi": "858"
}
```

### Diferencia entre campos:

- **`price`**: Precio final después del descuento (lo que se cobra)
- **`original_price`**: Precio original antes del descuento (legacy)
- **`price_original`**: Precio original unitario (para trazabilidad en CRM)
- **`discount_percentage`**: Porcentaje de descuento aplicado
- **`discount_amount`**: Monto del descuento por unidad

### Cálculo del descuento:

```
discount_amount = original_price - price
discount_amount = 650 - 532.79 = 117.21
```

## Archivos Modificados

1. ✅ **Migration**: `fix_webhook_trigger_use_service_role_key.sql` - Fix del trigger
2. ✅ **CartContext**: Agregado campo `discount_amount` al CartItem interface
3. ✅ **products/[id].tsx**: Calcula `discount_amount` al agregar al carrito
4. ✅ **shop.tsx**: Inicializa `discount_amount` en 0
5. ✅ **services/booking/[serviceId].tsx**: Calcula `discount_amount` para servicios
6. ✅ **mercadoPago.ts**: Incluye `discount_amount` en items de productos y servicios
7. ✅ **notify-order-webhook**: Incluye `discount_amount` y `price_original` en el JSON enviado al CRM

## Testing

### Escenario 1: Producto sin descuento
```json
{
  "price": 1000,
  "original_price": 1000,
  "price_original": 1000,
  "discount_percentage": 0,
  "discount_amount": 0
}
```

### Escenario 2: Producto con 25% descuento
```json
{
  "price": 1087.50,
  "original_price": 1450.00,
  "price_original": 1450.00,
  "discount_percentage": 25,
  "discount_amount": 362.50
}
```

### Escenario 3: Servicio con 18% descuento
```json
{
  "price": 532.79,
  "original_price": 650,
  "price_original": 650,
  "discount_percentage": 18,
  "discount_amount": 117.21
}
```

## Notas Importantes

1. **El SERVICE_ROLE_KEY nunca debe exponerse** al cliente
2. **El trigger se ejecuta en el servidor**, por eso es seguro
3. **La Edge Function tiene acceso automático** al SERVICE_ROLE_KEY vía `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`
4. **Los webhooks se envían solo para órdenes con costo** (excluye `payment_method = 'free'` o `total_amount = 0`)

## Próximos Pasos

1. ✅ Migración aplicada - El fix está activo
2. 🧪 Probar con una orden real de productos con descuento
3. 🧪 Verificar que el CRM recibe correctamente el `discount_amount`
4. 📊 Monitorear logs de webhook para confirmar que no hay más errores de foreign key
