# Desglose de IVA en Carrito de Compras

## 🎯 Problema Resuelto

El carrito de compras no estaba mostrando el desglose del IVA, lo que causaba confusión sobre el monto total a pagar. Los usuarios veían el total con IVA incluido pero no entendían la composición del precio.

## ✅ Solución Implementada

### 1. Nuevas Funciones en CartContext

Se agregaron dos funciones al contexto del carrito para calcular el desglose del IVA:

**`getCartSubtotalWithoutTax()`**
- Calcula el subtotal base SIN IVA (base imponible)
- Desglosa el 22% de IVA que ya está incluido en los precios
- Fórmula: `precioConIVA / (1 + tasaIVA)`

**`getCartTaxAmount()`**
- Calcula el monto total de IVA
- Fórmula: `total - subtotal`

### 2. Actualización de la Vista del Carrito

El resumen del pedido ahora muestra:

```
Resumen del Pedido
├─ Subtotal (sin IVA): $3.344,26
├─ IVA (22%):         $735,74
├─ Envío:             $200,00 (si aplica)
└─ Total:             $4.280,00
```

### 3. Cálculos Correctos

**Antes:**
```tsx
// Solo mostraba
Subtotal: $4.080  ❌ (esto ya incluía IVA)
Total: $4.080
```

**Ahora:**
```tsx
// Desglose correcto
Subtotal (sin IVA): $3.344,26  ✅
IVA (22%): $735,74              ✅
Total: $4.080,00                ✅
```

## 📊 Ejemplo Real

### Producto: BIOFRESH Alimento Cachorro (15kg)
- **Precio mostrado**: $4.080 (incluye IVA)

### Desglose en el carrito:
1. **Precio con IVA**: $4.080,00
2. **Cálculo del subtotal sin IVA**:
   ```javascript
   const taxRate = 0.22; // 22%
   const subtotal = 4080 / (1 + 0.22) = 4080 / 1.22 = $3.344,26
   ```
3. **Cálculo del IVA**:
   ```javascript
   const iva = 4080 - 3344.26 = $735,74
   ```

### Verificación:
```
Subtotal: $3.344,26
+ IVA:    $735,74
-----------------
= Total:  $4.080,00 ✅
```

## 📁 Archivos Modificados

### 1. [`contexts/CartContext.tsx`](contexts/CartContext.tsx)

**Agregado:**
```typescript
const getCartSubtotalWithoutTax = () => {
  // Subtotal SIN IVA (base imponible)
  return cart.reduce((subtotal, item) => {
    const taxRate = (item.iva_rate || 22) / 100; // Default 22%
    const priceWithTax = item.price * item.quantity;
    const priceWithoutTax = priceWithTax / (1 + taxRate);
    return subtotal + priceWithoutTax;
  }, 0);
};

const getCartTaxAmount = () => {
  // Monto total de IVA
  const total = getCartTotal();
  const subtotal = getCartSubtotalWithoutTax();
  return total - subtotal;
};
```

**Actualizado el tipo:**
```typescript
interface CartContextType {
  // ...existing methods
  getCartSubtotalWithoutTax: () => number;
  getCartTaxAmount: () => number;
}
```

### 2. [`app/cart/index.tsx`](app/cart/index.tsx)

**Importado las nuevas funciones:**
```typescript
const { cart, updateQuantity, removeFromCart, clearCart, 
        getCartTotal, getCartSubtotalWithoutTax, getCartTaxAmount } = useCart();
```

**Actualizado el resumen:**
```tsx
<Card style={styles.summaryCard}>
  <Text style={styles.summaryTitle}>Resumen del Pedido</Text>
  
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>Subtotal (sin IVA)</Text>
    <Text style={styles.summaryValue}>
      {formatCurrency(getCartSubtotalWithoutTax())}
    </Text>
  </View>
  
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>IVA (22%)</Text>
    <Text style={styles.summaryValue}>
      {formatCurrency(getCartTaxAmount())}
    </Text>
  </View>
  
  {/* ...envío si aplica... */}
  
  <View style={styles.summaryRow}>
    <Text style={styles.totalLabel}>Total</Text>
    <Text style={styles.totalValue}>
      {formatCurrency(getCartTotal() + shippingCost)}
    </Text>
  </View>
</Card>
```

## 🔑 Beneficios

1. **Transparencia**: El usuario ve exactamente cómo se compone el precio
2. **Claridad fiscal**: Se muestra el desglose del IVA
3. **Consistencia**: El total del carrito coincide con:
   - Lo que se envía a Mercado Pago ✅
   - Lo que se registra en la orden ✅
   - Lo que se envía al sistema contable ✅

## 🧪 Validación

Para verificar que los cálculos son correctos:

```javascript
// En la consola del navegador/app
const cartTotal = 4080;
const subtotal = 4080 / 1.22;
const iva = cartTotal - subtotal;

console.log('Subtotal sin IVA:', subtotal.toFixed(2)); // 3344.26
console.log('IVA:', iva.toFixed(2));                    // 735.74
console.log('Total:', cartTotal.toFixed(2));            // 4080.00
```

## 📝 Notas Importantes

- ✅ Los precios en DogCatify **siempre incluyen IVA**
- ✅ El IVA se **desglosa** en el carrito para transparencia
- ✅ Mercado Pago recibe el total **con IVA incluido**
- ✅ El sistema contable recibe el desglose correcto
- ✅ La tasa de IVA por defecto es 22% (configurable por producto)
