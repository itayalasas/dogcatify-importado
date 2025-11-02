# Corrección: IVA Duplicado al Enviar al CRM

## 🐛 Problema Identificado

El cliente pagaba correctamente en la app ($1,450 con IVA incluido), pero al enviar la orden al CRM, se estaba enviando el precio **con IVA** como si fuera el **subtotal sin IVA**, causando que el CRM volviera a aplicar el IVA.

### Ejemplo del Problema:

```
❌ ANTES (INCORRECTO):

Cliente ve en app: $1,450 (IVA incluido)
Cliente paga: $1,450 ✅ CORRECTO

Datos enviados al CRM:
  subtotal: $1,450  ❌ INCORRECTO (es el precio CON IVA)
  iva_rate: 22%

CRM calcula:
  subtotal: $1,450
  + IVA (22%): $319
  = Total: $1,769  ❌ INCORRECTO
```

**Resultado**: El CRM mostraba $1,769 en lugar de $1,450.

---

## ✅ Solución Implementada

Se corrigió el cálculo para que el `partner_breakdown` y los `items` de la orden guarden correctamente el **subtotal sin IVA** por separado.

### Cambios Realizados:

#### 1. **Archivo**: `utils/mercadoPago.ts`

**Ubicación**: Línea 587-616

**Cambio**: Modificar `partner_breakdown` para usar `itemsWithIVA` (que tiene subtotal e IVA separados) en lugar de `cartItems` (que tiene precio con IVA).

**ANTES:**
```typescript
partner_breakdown: {
  partners: cartItems.reduce((acc, item) => {
    acc[item.partnerId].items.push({
      id: item.id,
      name: item.name,
      price: item.price,  // ❌ Con IVA incluido
      quantity: item.quantity,
      total: item.price * item.quantity  // ❌ Con IVA incluido
    });
    acc[item.partnerId].subtotal += item.price * item.quantity;  // ❌ INCORRECTO
    return acc;
  }, {})
}
```

**DESPUÉS:**
```typescript
partner_breakdown: {
  partners: itemsWithIVA.reduce((acc, item) => {
    acc[item.partnerId].items.push({
      id: item.id,
      name: item.name,
      price: item.price,  // Precio original (con IVA)
      quantity: item.quantity,
      subtotal: item.subtotal,  // ✅ Sin IVA
      iva_amount: item.iva_amount,  // ✅ IVA separado
      total: item.price * item.quantity
    });
    // ✅ Acumular subtotal SIN IVA para el partner
    acc[item.partnerId].subtotal += item.subtotal;
    return acc;
  }, {})
}
```

#### 2. **Archivo**: `supabase/functions/notify-order-webhook/index.ts`

**Ubicación**: Línea 81-103

**Cambio**: Leer el `subtotal` (sin IVA) de los items en lugar de calcular desde `price` (con IVA).

**ANTES:**
```typescript
if (partnerItems.length > 0) {
  subtotal = partnerItems.reduce((sum: number, item: any) =>
    sum + (item.price * item.quantity), 0);  // ❌ Usando precio con IVA
}
```

**DESPUÉS:**
```typescript
if (partnerItems.length > 0) {
  subtotal = partnerItems.reduce((sum: number, item: any) => {
    // ✅ Si el item tiene subtotal (sin IVA), usarlo
    if (item.subtotal !== undefined && item.subtotal !== null) {
      return sum + item.subtotal;
    }
    // Fallback para compatibilidad con órdenes antiguas
    return sum + (item.price * item.quantity);
  }, 0);
}
```

---

## 📊 Resultado Correcto

```
✅ DESPUÉS (CORRECTO):

Cliente ve en app: $1,450 (IVA incluido)
Cliente paga: $1,450 ✅ CORRECTO

Datos enviados al CRM:
  subtotal: $1,188.52  ✅ CORRECTO (sin IVA)
  iva_amount: $261.48  ✅ CORRECTO (IVA separado)
  iva_rate: 22%
  total_amount: $1,450.00

CRM recibe:
  Base imponible: $1,188.52
  IVA (22%): $261.48
  Total: $1,450.00  ✅ CORRECTO
```

---

## 🧮 Cálculo Detallado

### IVA Incluido en el Precio (caso más común)

```
Precio con IVA: $1,450.00
Tasa de IVA: 22%

Fórmula:
  subtotal = precio_con_iva / (1 + tasa_iva/100)
  subtotal = 1450 / (1 + 22/100)
  subtotal = 1450 / 1.22
  subtotal = $1,188.52

  iva_amount = precio_con_iva - subtotal
  iva_amount = 1450 - 1188.52
  iva_amount = $261.48

Verificación:
  subtotal + iva = 1188.52 + 261.48 = $1,450.00 ✅
```

### Datos Enviados al CRM:

```json
{
  "partners": [{
    "items": [{
      "id": "prod-123",
      "name": "BF Cachorros Razas pequeñas 3kg",
      "price": 1450.00,         // Precio original (con IVA)
      "quantity": 1,
      "subtotal": 1188.52,      // ✅ Base sin IVA
      "iva_amount": 261.48,     // ✅ IVA separado
      "total": 1450.00
    }],
    "subtotal": 1188.52,        // ✅ Total sin IVA del partner
    "iva_amount": 261.48,       // ✅ IVA total del partner
    "total": 1188.52
  }],
  "totals": {
    "subtotal": 1188.52,        // ✅ Base para facturar
    "iva_amount": 261.48,       // ✅ IVA a declarar
    "iva_rate": 22.00,
    "iva_included_in_price": true,
    "total_amount": 1450.00     // ✅ Lo que pagó el cliente
  }
}
```

---

## 🔍 Verificación

Para verificar que la corrección funciona:

1. **Crear una orden de prueba** con un producto que tenga IVA incluido
2. **Verificar en la orden** (`orders` table):
   - `subtotal`: debe ser el precio sin IVA
   - `iva_amount`: debe ser el IVA calculado
   - `total_amount`: debe ser el precio que pagó el cliente
   - `items[0].subtotal`: debe existir y ser sin IVA
   - `partner_breakdown.partners[id].subtotal`: debe ser sin IVA

3. **Verificar en el webhook enviado al CRM**:
   - `totals.subtotal`: debe ser sin IVA
   - `partners[0].subtotal`: debe ser sin IVA
   - `partners[0].items[0].subtotal`: debe ser sin IVA

---

## 📝 Archivos Modificados

1. ✅ `utils/mercadoPago.ts` (líneas 587-616)
   - Modificado: `partner_breakdown` para usar subtotales sin IVA

2. ✅ `supabase/functions/notify-order-webhook/index.ts` (líneas 81-103)
   - Modificado: Lectura del subtotal de items

3. ✅ Edge Function desplegada: `notify-order-webhook`

---

## 🎯 Impacto

### ✅ Beneficios:
- El cliente paga el precio correcto en la app
- El CRM recibe el subtotal sin IVA correctamente
- El CRM NO duplica el IVA al facturar
- Los totales coinciden entre app y CRM

### 🔄 Compatibilidad:
- Las órdenes antiguas (sin `item.subtotal`) siguen funcionando
- Las órdenes nuevas usan el cálculo correcto
- No se requiere migración de datos existentes

### 🚫 Sin Impacto:
- No afecta el flujo de pago
- No afecta las comisiones
- No afecta los servicios gratuitos (ya filtrados)

---

## 📅 Fecha de Implementación

**2025-11-02**

## 🔖 Versión

**v2.0** - Corrección de IVA duplicado en webhooks al CRM
