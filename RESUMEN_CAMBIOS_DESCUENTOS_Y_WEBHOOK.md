# Resumen: Cambios en Descuentos y Webhooks

## Fecha
2025-11-02

## Cambios Realizados

### 1. ✅ Agregado Campo `discount_amount`

Se agregó el campo `discount_amount` que representa el **monto del descuento por unidad** en la moneda local.

**Archivos modificados:**
- `contexts/CartContext.tsx` - Agregado al CartItem interface
- `app/products/[id].tsx` - Calculado al agregar productos al carrito
- `app/(tabs)/shop.tsx` - Inicializado en 0 para productos sin descuento
- `app/services/booking/[serviceId].tsx` - Calculado para servicios
- `utils/mercadoPago.ts` - Incluido en items de productos y servicios
- `supabase/functions/notify-order-webhook/index.ts` - Incluido en el JSON del webhook


### 2. ✅ Fix Error de Foreign Key en Webhooks

Se corrigió el error de foreign key que ocurría al procesar webhooks al CRM.

**Problema:**
```
❌ Error procesando webhook: {
  code: "23503",
  details: 'Key (partner_id)=(...) is not present in table "partners".',
  message: 'insert or update on table "orders" violates foreign key constraint "orders_partner_id_fkey"'
}
```

**Causa:**
El trigger `trigger_webhook_notification()` usaba el ANON KEY hardcoded que está sujeto a RLS.

**Solución:**
- Aplicada migración `fix_webhook_trigger_use_service_role_key`
- Eliminado el ANON KEY del trigger
- La Edge Function usa automáticamente el SERVICE_ROLE_KEY

## Estructura del JSON Actualizada

### Item con Descuento

```json
{
  "id": "product-id",
  "name": "BF Cachorros Razas pequeñas 3kg",
  "price": 1087.5,
  "quantity": 1,
  "subtotal": 891.39,
  "currency": "UYU",
  "currency_code_dgi": "858",
  "iva_rate": 22,
  "iva_amount": 196.11,
  "original_price": 1450,
  "discount_percentage": 25,
  "discount_amount": 362.5
}
```

### Campos de Precio y Descuento

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `price` | Precio final después del descuento | 1087.5 |
| `original_price` | Precio original antes del descuento | 1450 |
| `discount_percentage` | Porcentaje de descuento | 25 |
| `discount_amount` | **NUEVO** - Monto del descuento unitario | 362.5 |

## Fórmulas

### Descuento por Unidad
```
discount_amount = original_price - price
discount_amount = 1450 - 1087.5 = 362.5
```

### Descuento Total
```
discount_total = discount_amount * quantity
discount_total = 362.5 * 1 = 362.5
```

### Verificación de Porcentaje
```
discount_percentage = (discount_amount / original_price) * 100
discount_percentage = (362.5 / 1450) * 100 = 25%
```

## Archivos de Documentación

1. **`FIX_WEBHOOK_FOREIGN_KEY_ERROR.md`**
   - Explicación completa del fix del webhook
   - Instrucciones de verificación
   - Ejemplos de testing

2. **`EJEMPLO_COMPLETO_JSON_WEBHOOK_ACTUALIZADO.md`**
   - JSON completo de ejemplo
   - Explicación de todos los campos
   - Casos de uso en el CRM
   - Fórmulas de cálculo
   - Ejemplos de validación

## Testing

### Escenarios de Prueba

#### 1. Producto sin Descuento
```json
{
  "price": 1000,
  "original_price": 1000,
  "discount_percentage": 0,
  "discount_amount": 0
}
```

#### 2. Producto con 25% Descuento
```json
{
  "price": 1087.5,
  "original_price": 1450,
  "discount_percentage": 25,
  "discount_amount": 362.5
}
```

#### 3. Servicio con 18% Descuento
```json
{
  "price": 532.79,
  "original_price": 650,
  "discount_percentage": 18,
  "discount_amount": 117.21
}
```

## Validación en el CRM

Tu CRM puede validar los datos así:

```javascript
// Validar precio con descuento
const precioEsperado = item.price_original * (1 - item.discount_percentage / 100);
const esValido = Math.abs(item.price - precioEsperado) < 0.01;

// Validar monto del descuento
const descuentoEsperado = item.price_original - item.price;
const descuentoValido = Math.abs(item.discount_amount - descuentoEsperado) < 0.01;

// Calcular ahorro total del cliente
const ahorroTotal = item.discount_amount * item.quantity;
```

## Beneficios para el CRM

1. **Trazabilidad completa** de precios y descuentos
2. **Validación automática** de cálculos
3. **Reportes de promociones** más precisos
4. **Análisis de impacto** de descuentos en ventas
5. **Reconciliación contable** simplificada

## Próximos Pasos

1. ✅ Migración aplicada
2. ✅ Código actualizado
3. ✅ Documentación creada
4. 🧪 Probar con orden real que tenga descuentos
5. 🧪 Verificar en el CRM que recibe correctamente todos los campos
6. 📊 Monitorear logs de webhook para confirmar que no hay errores

## Notas Importantes

- **Los webhooks se envían solo para órdenes con costo** (excluye servicios gratuitos)
- **Todos los precios están en la moneda especificada** (UYU, USD, etc.)
- **Los montos están redondeados a 2 decimales** para evitar problemas de precisión
- **`price_original` y `discount_amount` son unitarios**, multiplicar por `quantity` para totales
- **El SERVICE_ROLE_KEY nunca se expone** al cliente, solo se usa en el servidor
