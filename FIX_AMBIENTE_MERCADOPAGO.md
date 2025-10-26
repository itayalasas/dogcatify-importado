# Fix: Separación de Ambientes MercadoPago (TEST vs PRODUCCIÓN)

## Problema Detectado

La aplicación estaba mezclando los ambientes de MercadoPago cuando se realizaban pagos:
- Se creaban preferencias con credenciales de **TEST** (`TEST-xxxx`)
- Pero se usaba el URL de **producción** (`init_point`)
- Esto causaba el error: *"Una de las partes con la que intentas hacer el pago es de prueba."*

### Ejemplo del Problema

Al consultar una preferencia con token TEST:
```bash
Bearer TEST-1624486229466072-102600-62686a01a9ab41e8fc19800544564374-1876395148
```

La respuesta contenía ambos URLs:
- `sandbox_init_point`: https://sandbox.mercadopago.com.uy/...
- `init_point`: https://www.mercadopago.com.uy/...

Y la app siempre usaba:
```javascript
const initPoint = preference.sandbox_init_point || preference.init_point;
```

Esto causaba que con credenciales TEST se abriera el checkout de producción.

## Solución Implementada

### 1. Detección de Ambiente

Se agregó lógica para detectar automáticamente el ambiente basándose en el `access_token` del partner:

```javascript
// Detectar si estamos usando credenciales de test
const isTestMode = partnerConfig.access_token?.startsWith('TEST-');
```

### 2. Selección Correcta de URL

Ahora se selecciona la URL apropiada según el ambiente:

```javascript
// TEST → sandbox_init_point
// PRODUCTION → init_point
const paymentUrl = isTestMode ? preference.sandbox_init_point : preference.init_point;
```

## Archivos Modificados

### 1. `/utils/mercadoPago.ts`

#### a) Función `createServiceBookingOrder` (línea ~878)
```javascript
// Determine if we're using test credentials
const isTestMode = partnerConfig.access_token?.startsWith('TEST-');

// Get payment URL based on environment
const paymentUrl = isTestMode ? preference.sandbox_init_point : preference.init_point;

console.log('Payment URL selected:', {
  isTestMode,
  urlType: isTestMode ? 'sandbox_init_point' : 'init_point',
  url: paymentUrl
});
```

#### b) Función `createUnifiedPaymentPreference` (línea ~688)
```javascript
// Determine if we're using test credentials
const isTestMode = partnerConfig.access_token?.startsWith('TEST-');

console.log('Split payment preference created successfully:', {
  id: preference.id,
  application_fee: commissionAmount,
  partner_receives: totalAmount - commissionAmount,
  commission_percentage: partnerConfig.commission_percentage || 5.0,
  isTestMode,
  hasInitPoint: !!preference.init_point,
  hasSandboxInitPoint: !!preference.sandbox_init_point
});
```

#### c) Función `createMultiPartnerOrder` (línea ~590)
```javascript
// Detect if we're in test mode
const isTestMode = primaryPartnerConfig.access_token?.startsWith('TEST-');

console.log('Multi-partner order completed:', {
  isTestMode,
  ordersCount: orders.length,
  preferencesCount: paymentPreferences.length
});

return { orders, paymentPreferences, isTestMode };
```

### 2. `/app/cart/index.tsx`

```javascript
// Create orders and payment preferences using Mercado Pago
const { orders, paymentPreferences, isTestMode } = await createMultiPartnerOrder(
  cart,
  currentUser,
  fullAddress,
  totalShippingCost
);

console.log('Orders created:', orders.length);
console.log('Payment preferences created:', paymentPreferences.length);
console.log('Environment detected:', isTestMode ? 'TEST' : 'PRODUCTION');

if (paymentPreferences.length > 0) {
  const preference = paymentPreferences[0];

  // Clear cart before redirecting to payment
  clearCart();

  // Get the appropriate init point based on environment
  const initPoint = isTestMode ? preference.sandbox_init_point : preference.init_point;

  console.log('Payment URL selection:', {
    isTestMode,
    hasSandboxUrl: !!preference.sandbox_init_point,
    hasProductionUrl: !!preference.init_point,
    selectedUrl: initPoint
  });

  if (initPoint) {
    console.log('Redirecting to Mercado Pago:', initPoint);
    await Linking.openURL(initPoint);
  }
}
```

## Lógica de Detección

### Credenciales TEST
```
TEST-1624486229466072-102600-62686a01a9ab41e8fc19800544564374-1876395148
↓
isTestMode = true
↓
Usar: sandbox_init_point
URL: https://sandbox.mercadopago.com.uy/...
```

### Credenciales PRODUCCIÓN
```
APP-1624486229466072-102600-62686a01a9ab41e8fc19800544564374-1876395148
O sin prefijo
↓
isTestMode = false
↓
Usar: init_point
URL: https://www.mercadopago.com.uy/...
```

## Beneficios

1. **Separación automática de ambientes**: No se mezclan credenciales TEST con checkout de producción
2. **Logs mejorados**: Se registra claramente qué ambiente se está usando
3. **Consistencia**: La misma lógica se aplica en productos y servicios
4. **Sin configuración manual**: La detección es automática basada en las credenciales

## Validación

Para validar el fix, ejecutar:
```bash
node scripts/test-environment-detection.js
```

Este script valida:
- ✅ Tokens TEST → sandbox_init_point
- ✅ Tokens APP → init_point
- ✅ Tokens legacy → init_point

## Qué Esperar Ahora

### Con Credenciales TEST
1. Partner tiene `access_token` que comienza con `TEST-`
2. Se crea la preferencia con ese token
3. Se detecta automáticamente modo TEST
4. Se abre `sandbox_init_point`
5. Checkout funciona en ambiente sandbox

### Con Credenciales PRODUCCIÓN
1. Partner tiene `access_token` que comienza con `APP-` o sin prefijo
2. Se crea la preferencia con ese token
3. Se detecta automáticamente modo PRODUCCIÓN
4. Se abre `init_point`
5. Checkout funciona en ambiente productivo

## Próximos Pasos

1. Probar en ambiente de desarrollo con credenciales TEST
2. Validar que se abra el checkout de sandbox
3. Probar en producción con credenciales APP
4. Validar que se abra el checkout productivo
5. Verificar que no aparezca más el error de mezcla de ambientes
