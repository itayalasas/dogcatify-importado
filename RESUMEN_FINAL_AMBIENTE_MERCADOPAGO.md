# Resumen Final: Fix de Ambientes MercadoPago

## Aclaración Importante sobre la Respuesta de MercadoPago

### ¿Por qué la API devuelve ambos URLs?

Cuando creas una preferencia de pago con MercadoPago (ya sea con token TEST o PRODUCCIÓN), **la API siempre devuelve ambos URLs**:

```json
{
  "id": "1876395148-98be72ee-ef9b-49cc-836f-ec50484438ab",
  "init_point": "https://www.mercadopago.com.uy/checkout/v1/redirect?pref_id=...",
  "sandbox_init_point": "https://sandbox.mercadopago.com.uy/checkout/v1/redirect?pref_id=..."
}
```

**Esto es normal y esperado.** No es un error.

### ¿Cuál es la Solución?

La solución NO es cambiar la respuesta de MercadoPago (eso no es posible), sino **que nuestra aplicación seleccione el URL correcto** según el ambiente:

#### ✅ CORRECTO - Lo que hace nuestra app ahora:

```javascript
// 1. Detectar ambiente basado en el token
const isTestMode = partnerConfig.access_token?.startsWith('TEST-');

// 2. Seleccionar el URL apropiado
const paymentUrl = isTestMode
  ? preference.sandbox_init_point  // Si es TEST
  : preference.init_point;         // Si es PRODUCCIÓN

// 3. Abrir el URL correcto
await Linking.openURL(paymentUrl);
```

#### ❌ INCORRECTO - Lo que hacía antes:

```javascript
// Siempre usaba sandbox_init_point primero (fallback a init_point)
const initPoint = preference.sandbox_init_point || preference.init_point;
```

## Cambios Implementados

### 1. `createServicePaymentPreference`

**Archivo**: `utils/mercadoPago.ts` (línea ~1006)

#### Antes:
```javascript
const marketplaceAccessToken = await getMarketplaceAccessToken();
// Usaba el token del marketplace (admin)
```

#### Ahora:
```javascript
// Detect if we're using test credentials
const isTestMode = partnerConfig.access_token?.startsWith('TEST-');

console.log('Creating service payment preference:', {
  orderId,
  isTestMode,
  tokenPrefix: tokenPrefix + '...',
  commissionAmount
});

// Usa el token del partner directamente
Authorization: `Bearer ${partnerConfig.access_token}`
```

### 2. Logs Mejorados

Ahora se registra claramente:
- ✅ Si estamos en modo TEST o PRODUCCIÓN
- ✅ Qué token se está usando (primeros 20 caracteres)
- ✅ Qué URLs devolvió MercadoPago
- ✅ Qué URL debe usar la app

```javascript
console.log('Service payment preference created successfully:', {
  preferenceId: preference.id,
  isTestMode,
  hasInitPoint: !!preference.init_point,
  hasSandboxInitPoint: !!preference.sandbox_init_point,
  initPointDomain: preference.init_point ? new URL(preference.init_point).hostname : 'N/A',
  sandboxInitPointDomain: preference.sandbox_init_point ? new URL(preference.sandbox_init_point).hostname : 'N/A',
  shouldUseUrl: isTestMode ? 'sandbox_init_point' : 'init_point'
});
```

## Validación

Para verificar que todo funciona correctamente, revisa los logs en la consola:

### Con Token TEST:
```
Creating service payment preference: {
  orderId: 'dc089bf1-d4be-4da1...',
  isTestMode: true,
  tokenPrefix: 'TEST-1624486229466...',
  commissionAmount: 21.5
}

Service payment preference created successfully: {
  preferenceId: '1876395148-98be72ee-...',
  isTestMode: true,
  hasInitPoint: true,
  hasSandboxInitPoint: true,
  initPointDomain: 'www.mercadopago.com.uy',
  sandboxInitPointDomain: 'sandbox.mercadopago.com.uy',
  shouldUseUrl: 'sandbox_init_point'  ← Esto es lo importante
}

Payment URL selected: {
  isTestMode: true,
  urlType: 'sandbox_init_point',
  url: 'https://sandbox.mercadopago.com.uy/...'  ← URL correcta
}
```

### Con Token PRODUCCIÓN:
```
Creating service payment preference: {
  orderId: 'dc089bf1-d4be-4da1...',
  isTestMode: false,
  tokenPrefix: 'APP-1624486229466...',
  commissionAmount: 21.5
}

Service payment preference created successfully: {
  preferenceId: '1876395148-98be72ee-...',
  isTestMode: false,
  hasInitPoint: true,
  hasSandboxInitPoint: true,
  initPointDomain: 'www.mercadopago.com.uy',
  sandboxInitPointDomain: 'sandbox.mercadopago.com.uy',
  shouldUseUrl: 'init_point'  ← Esto es lo importante
}

Payment URL selected: {
  isTestMode: false,
  urlType: 'init_point',
  url: 'https://www.mercadopago.com.uy/...'  ← URL correcta
}
```

## Resumen de Comportamiento

| Token del Partner | API Devuelve | App Abre | Resultado |
|-------------------|--------------|----------|-----------|
| `TEST-xxx` | Ambos URLs | `sandbox_init_point` | ✅ Checkout de Sandbox |
| `APP-xxx` | Ambos URLs | `init_point` | ✅ Checkout de Producción |
| Sin prefijo | Ambos URLs | `init_point` | ✅ Checkout de Producción |

## Conclusión

**La respuesta JSON de MercadoPago SIEMPRE incluirá ambos URLs.** Esto no es un problema ni un error.

Lo que importa es:
1. ✅ Que usemos el token correcto del partner para crear la preferencia
2. ✅ Que detectemos si es TEST o PRODUCCIÓN basado en el token
3. ✅ Que abramos el URL correcto según el ambiente

Todos estos puntos están implementados correctamente en el código actual.
