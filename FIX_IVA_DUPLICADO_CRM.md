# Corrección: IVA Duplicado al Enviar al CRM

## 🐛 Problema Identificado

Al enviar órdenes al CRM, el sistema estaba enviando el flag `iva_included_in_price` con el valor real de configuración del producto, pero el CRM interpretaba este flag para decidir si calcular o no el IVA nuevamente, causando duplicación del IVA cuando el valor era `false`.

### Escenarios del Problema:

#### Caso 1: IVA Incluido en Precio (`iva_included_in_price = true`)
```
✅ FUNCIONABA CORRECTAMENTE:

Cliente ve en app: $1,450 (IVA incluido)
Cliente paga: $1,450

Sistema calcula:
  subtotal (sin IVA): $1,188.52
  iva_amount: $261.48
  total: $1,450

Datos enviados al CRM:
  subtotal: $1,188.52
  iva_amount: $261.48
  iva_included_in_price: true
  total_amount: $1,450

CRM procesa correctamente:
  Base: $1,188.52
  IVA: $261.48
  Total: $1,450 ✅
```

#### Caso 2: IVA NO Incluido en Precio (`iva_included_in_price = false`)
```
❌ PROBLEMA:

Partner ingresa precio SIN IVA: $1,450
Cliente debe pagar: $1,450 + 22% = $1,769

Sistema calcula correctamente:
  subtotal (sin IVA): $1,450
  iva_amount: $319
  total: $1,769

Datos enviados al CRM:
  subtotal: $1,450
  iva_amount: $319
  iva_included_in_price: false  ❌ PROBLEMA
  total_amount: $1,769

CRM interpreta el flag=false como "debo calcular IVA":
  Base recibida: $1,450
  CRM calcula IVA: $1,450 × 0.22 = $319
  CRM suma IVA: $1,450 + $319 = $1,769

Pero el total REAL que pagó el cliente ya era $1,769
Entonces el CRM está contando el IVA dos veces en su contabilidad.
```

**Resultado**: El CRM duplicaba el IVA cuando `iva_included_in_price = false` porque ya recibía el IVA calculado pero el flag le indicaba que debía calcularlo.

---

## ✅ Solución Implementada

La solución correcta es enviar **SIEMPRE** `iva_included_in_price: true` al CRM, porque en nuestro sistema el IVA **SIEMPRE está calculado y separado** antes de enviar al webhook, independientemente de si estaba incluido en el precio original del producto o no.

### Cambios Realizados:

#### 1. **Archivo**: `utils/mercadoPago.ts` (Líneas 587-616)

**Cambio**: Modificar `partner_breakdown` para usar `itemsWithIVA` (que tiene subtotal e IVA separados) en lugar de `cartItems`.

**ANTES:**
```typescript
partner_breakdown: {
  partners: cartItems.reduce((acc, item) => {
    acc[item.partnerId].items.push({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      total: item.price * item.quantity
    });
    acc[item.partnerId].subtotal += item.price * item.quantity;  // ❌ Puede tener IVA mezclado
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
      price: item.price,
      quantity: item.quantity,
      subtotal: item.subtotal,      // ✅ Subtotal sin IVA
      iva_amount: item.iva_amount,  // ✅ IVA separado
      total: item.price * item.quantity
    });
    acc[item.partnerId].subtotal += item.subtotal;  // ✅ Acumula sin IVA
    return acc;
  }, {})
}
```

#### 2. **Archivo**: `supabase/functions/notify-order-webhook/index.ts` (Línea 180)

**Cambio Principal**: Enviar SIEMPRE `iva_included_in_price: true` al CRM.

**ANTES:**
```typescript
totals: {
  subtotal: orderData.subtotal,
  iva_amount: orderData.iva_amount,
  iva_rate: orderData.iva_rate,
  iva_included_in_price: orderData.iva_included_in_price,  // ❌ Variable según producto
  //...
}
```

**DESPUÉS:**
```typescript
totals: {
  subtotal: orderData.subtotal,
  iva_amount: orderData.iva_amount,
  iva_rate: orderData.iva_rate,
  iva_included_in_price: true,  // ✅ SIEMPRE true porque el IVA ya está calculado
  //...
}
```

#### 3. **Archivo**: `supabase/functions/notify-order-webhook/index.ts` (Líneas 87-103)

**Cambio Adicional**: Mejorar lectura del subtotal de items.

**ANTES:**
```typescript
if (partnerItems.length > 0) {
  subtotal = partnerItems.reduce((sum: number, item: any) =>
    sum + (item.price * item.quantity), 0);  // ❌ Usaba price (puede tener IVA)
}
```

**DESPUÉS:**
```typescript
if (partnerItems.length > 0) {
  subtotal = partnerItems.reduce((sum: number, item: any) => {
    // ✅ Usar subtotal sin IVA si está disponible
    if (item.subtotal !== undefined && item.subtotal !== null) {
      return sum + item.subtotal;
    }
    // Fallback para órdenes antiguas
    return sum + (item.price * item.quantity);
  }, 0);
}
```

---

## 📊 Resultado Correcto

### Caso 1: IVA Incluido (`iva_included_in_price` original = true)
```
✅ DESPUÉS (CORRECTO):

Cliente ve: $1,450 (con IVA)
Cliente paga: $1,450

Datos al CRM:
  subtotal: $1,188.52       (sin IVA)
  iva_amount: $261.48
  iva_included_in_price: true
  total_amount: $1,450

CRM interpreta:
  Base: $1,188.52
  IVA: $261.48 (ya calculado, no recalcula)
  Total: $1,450 ✅ CORRECTO
```

### Caso 2: IVA NO Incluido (`iva_included_in_price` original = false)
```
✅ DESPUÉS (CORRECTO):

Partner ingresa: $1,450 (sin IVA)
Cliente paga: $1,769 (con IVA al 22%)

Datos al CRM:
  subtotal: $1,450          (sin IVA)
  iva_amount: $319
  iva_included_in_price: true  ✅ FORZADO A true
  total_amount: $1,769

CRM interpreta:
  Base: $1,450
  IVA: $319 (ya calculado, no recalcula)
  Total: $1,769 ✅ CORRECTO
```

---

## 🧮 Cálculo Detallado

### Cuando IVA está incluido en el precio
```
Precio visible al cliente: $1,450
Tasa de IVA: 22%

Cálculo del sistema:
  subtotal_sin_iva = 1450 / (1 + 0.22) = 1450 / 1.22 = $1,188.52
  iva_amount = 1450 - 1188.52 = $261.48
  total = $1,450 (lo que paga el cliente)
```

### Cuando IVA NO está incluido en el precio
```
Precio base del producto: $1,450 (sin IVA)
Tasa de IVA: 22%

Cálculo del sistema:
  subtotal_sin_iva = $1,450 (ya es sin IVA)
  iva_amount = 1450 × 0.22 = $319
  total = 1450 + 319 = $1,769 (lo que paga el cliente)
```

### JSON Enviado al CRM (ambos casos):
```json
{
  "partners": [{
    "subtotal": 1450.00,      // Base sin IVA
    "iva_amount": 319.00,     // IVA ya calculado
    "total": 1450.00,         // Base para comisiones
    "items": [{
      "subtotal": 1450.00,    // Sin IVA
      "iva_amount": 319.00,   // IVA del item
      "total": 1769.00        // Total del item
    }]
  }],
  "totals": {
    "subtotal": 1450.00,           // Base sin IVA
    "iva_amount": 319.00,          // IVA total
    "iva_included_in_price": true, // ✅ SIEMPRE true
    "total_amount": 1769.00        // Lo que pagó el cliente
  }
}
```

---

## 🔍 Verificación

Para verificar que la corrección funciona:

1. **Producto con IVA incluido** (ej: precio $1,450 con 22% incluido):
   - Cliente paga: $1,450
   - CRM recibe subtotal: $1,188.52
   - CRM recibe IVA: $261.48
   - CRM recibe total: $1,450
   - Flag: `iva_included_in_price: true`

2. **Producto sin IVA** (ej: precio base $1,450 + 22%):
   - Cliente paga: $1,769
   - CRM recibe subtotal: $1,450
   - CRM recibe IVA: $319
   - CRM recibe total: $1,769
   - Flag: `iva_included_in_price: true` (forzado)

3. **Verificar en webhook_logs**:
   - Revisar el payload enviado
   - Confirmar que `iva_included_in_price` siempre sea `true`
   - Verificar que subtotales sean sin IVA

---

## 📝 Archivos Modificados

1. ✅ `utils/mercadoPago.ts` (líneas 587-616)
   - Modificado: `partner_breakdown` para usar `itemsWithIVA` con subtotales sin IVA

2. ✅ `supabase/functions/notify-order-webhook/index.ts` (línea 180)
   - **Modificado**: `iva_included_in_price: true` (siempre forzado)

3. ✅ `supabase/functions/notify-order-webhook/index.ts` (líneas 87-103)
   - Modificado: Lectura del subtotal de items con fallback

4. ✅ Edge Function desplegada: `notify-order-webhook`

---

## 🎯 Impacto

### ✅ Beneficios:
- El cliente paga el precio correcto en la app (sin cambios)
- El CRM recibe SIEMPRE el subtotal sin IVA y el IVA calculado
- El CRM NO duplica el IVA porque el flag `iva_included_in_price: true` le indica que no debe recalcularlo
- Los totales coinciden perfectamente entre app y CRM
- Funciona correctamente para ambos casos: IVA incluido y no incluido

### 🔄 Compatibilidad:
- Las órdenes antiguas siguen funcionando (fallback a `item.price`)
- Las órdenes nuevas usan el cálculo correcto con subtotales separados
- No se requiere migración de datos existentes
- Los servicios gratuitos siguen excluidos correctamente

### 🚫 Sin Impacto Negativo:
- No afecta el flujo de pago ni los montos cobrados
- No afecta las comisiones (se calculan sobre subtotal sin IVA)
- No afecta la experiencia del cliente
- No requiere cambios en el CRM

---

## 🔑 Conclusión

**El problema no era el cálculo del IVA**, que siempre fue correcto. **El problema era la interpretación del flag `iva_included_in_price`** por parte del CRM.

**Solución**: Enviar siempre `iva_included_in_price: true` porque en nuestro sistema el IVA **siempre está pre-calculado y separado** antes de llegar al webhook, sin importar si originalmente estaba incluido en el precio o no.

Esto garantiza que el CRM use directamente los valores de `subtotal` e `iva_amount` que le enviamos, sin recalcular nada.

---

## 📅 Fecha de Implementación

**2025-11-02**

## 🔖 Versión

**v3.0** - Corrección definitiva de IVA duplicado mediante flag `iva_included_in_price: true`
