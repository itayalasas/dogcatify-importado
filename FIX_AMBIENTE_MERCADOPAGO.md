# Fix: Separación de Ambientes MercadoPago y Datos Completos del Payer

## Problemas Detectados

### 1. Mezcla de Ambientes (TEST vs PRODUCCIÓN)

La aplicación estaba mezclando los ambientes de MercadoPago cuando se realizaban pagos:
- Se creaban preferencias con credenciales de **TEST** (`TEST-xxxx`)
- Pero se usaba el URL de **producción** (`init_point`)
- Esto causaba el error: *"Una de las partes con la que intentas hacer el pago es de prueba."*

### 2. Datos Incompletos del Payer

Los datos del pagador (payer) en las preferencias estaban incompletos:
- Faltaba información de dirección
- Número de teléfono mal formateado
- No se validaba la disponibilidad de datos antes de crear la preferencia

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

## Soluciones Implementadas

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

### 3. Carga Completa de Datos del Cliente

Para servicios, ahora se cargan los datos completos del perfil del usuario desde la base de datos:

```javascript
// Get complete customer profile data from database
const { data: customerProfile, error: profileError } = await supabaseClient
  .from('profiles')
  .select('display_name, email, phone, calle, numero, address_locality, barrio, codigo_postal')
  .eq('id', bookingData.customerId)
  .single();

// Merge customer data
const completeCustomerInfo = {
  ...bookingData.customerInfo,
  displayName: customerProfile?.display_name || bookingData.customerInfo.displayName || 'Cliente',
  email: customerProfile?.email || bookingData.customerInfo.email,
  phone: customerProfile?.phone || bookingData.customerInfo.phone,
  street: customerProfile?.calle,
  number: customerProfile?.numero,
  locality: customerProfile?.address_locality,
  neighborhood: customerProfile?.barrio,
  zipCode: customerProfile?.codigo_postal
};
```

### 4. Formateo y Validación de Teléfono

Se implementó lógica para formatear correctamente el número de teléfono:

```javascript
// Format phone number (remove non-digits and ensure it's 8 digits)
const rawPhone = customerInfo.phone || '99999999';
const cleanPhone = rawPhone.replace(/\D/g, '');
const phoneNumber = cleanPhone.length >= 8 ? cleanPhone.slice(-8) : '99999999';
```

### 5. Inclusión de Dirección en el Payer

Ahora se incluye la dirección completa del cliente cuando está disponible:

```javascript
// Build complete payer object with all available data
const payerData: any = {
  name: customerInfo.displayName || 'Cliente',
  email: customerInfo.email,
  phone: {
    area_code: '598',
    number: phoneNumber
  }
};

// Add address if available
if (customerInfo.street && customerInfo.number) {
  payerData.address = {
    street_name: customerInfo.street,
    street_number: parseInt(customerInfo.number) || null,
    zip_code: customerInfo.zipCode || ''
  };
}
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
2. **Datos completos del pagador**: MercadoPago recibe toda la información disponible del cliente
3. **Mejor experiencia de usuario**: El checkout pre-llena datos de dirección y teléfono
4. **Logs mejorados**: Se registra claramente qué ambiente se está usando y qué datos se envían
5. **Consistencia**: La misma lógica se aplica en productos y servicios
6. **Sin configuración manual**: La detección es automática basada en las credenciales
7. **Validación de datos**: Se valida y formatea correctamente el número de teléfono

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

## Ejemplo de Payer Completo

### Antes (Incompleto)
```json
{
  "name": "Abraham Ociel",
  "email": "abrahamuci@gmail.com",
  "phone": {
    "area_code": "598",
    "number": "095123625"
  }
}
```

### Ahora (Completo)
```json
{
  "name": "Abraham Ociel",
  "email": "abrahamuci@gmail.com",
  "phone": {
    "area_code": "598",
    "number": "95123625"
  },
  "address": {
    "street_name": "Av. Italia",
    "street_number": 1234,
    "zip_code": "11300"
  }
}
```

## Próximos Pasos

1. Asegurar que los perfiles de usuario tengan datos de dirección completos
2. Probar en ambiente de desarrollo con credenciales TEST
3. Validar que se abra el checkout de sandbox con datos pre-llenados
4. Probar en producción con credenciales APP
5. Validar que se abra el checkout productivo con datos completos
6. Verificar que no aparezca más el error de mezcla de ambientes
7. Confirmar que el checkout de MercadoPago muestra los datos del cliente correctamente
