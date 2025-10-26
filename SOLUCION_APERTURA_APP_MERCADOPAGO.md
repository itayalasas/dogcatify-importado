# Solución: Apertura de App de Mercado Pago

## Problema Identificado

El usuario reporta que al pagar desde el carrito, siempre se abre el navegador web en lugar de la app de Mercado Pago, aunque la app esté instalada.

## Causa Raíz

El sistema operativo (Android/iOS) decide automáticamente si abrir una URL en la app de Mercado Pago basándose en:

1. **El dominio de la URL**
2. **Si la app está instalada**
3. **Si la app tiene registrado ese dominio en sus deep links**

### URLs de Mercado Pago:

1. **Producción**: `https://www.mercadopago.com.uy/checkout/v1/redirect?pref_id=XXX`
   - ✅ Este dominio SÍ está registrado en la app
   - ✅ Se abre automáticamente en la app si está instalada

2. **Sandbox/Test**: `https://sandbox.mercadopago.com.uy/checkout/v1/redirect?pref_id=XXX`
   - ❌ Este dominio puede NO estar registrado en la app
   - ❌ Se abre en el navegador incluso si la app está instalada

## Comportamiento Actual

### En Servicios (funciona):
- Puede estar usando credenciales de producción
- La URL generada es `www.mercadopago.com.uy`
- El OS detecta y abre la app

### En Carrito (no funciona):
- Puede estar usando credenciales de test
- La URL generada es `sandbox.mercadopago.com.uy`
- El OS NO detecta y abre el navegador

## Solución 1: Verificar las Credenciales

Asegúrate de que estás usando las credenciales correctas:

### Credenciales de TEST:
```
Access Token: TEST-XXXX
Public Key: TEST-XXXX
```
**Comportamiento**: Genera URLs de sandbox → Abre en navegador

### Credenciales de PRODUCCIÓN:
```
Access Token: APP_USR-XXXX
Public Key: APP_USR-XXXX
```
**Comportamiento**: Genera URLs de producción → Abre en app

### Cómo Verificar:

1. Ve a la base de datos Supabase
2. Revisa la tabla `partners`
3. Busca el campo `mercadopago_config`
4. Verifica el `access_token`:
   - Si empieza con `TEST-` → Modo test
   - Si empieza con `APP_USR-` → Modo producción

## Solución 2: Forzar Apertura en App (Deep Link)

Si quieres que siempre se abra en la app, incluso en modo test, puedes usar deep links directos:

### URL Normal:
```
https://www.mercadopago.com.uy/checkout/v1/redirect?pref_id=XXX
```

### Deep Link para App:
```
mercadopago://checkout?preference_id=XXX
```

### Implementación:

```typescript
export const openMercadoPagoPayment = async (paymentUrl: string, isTestMode: boolean): Promise<{
  success: boolean;
  openedInApp: boolean;
  error?: string;
}> => {
  try {
    const { Linking } = await import('react-native');

    // Extraer el preference_id de la URL
    const preferenceId = extractPreferenceId(paymentUrl);

    // Intentar abrir primero con deep link (para forzar app)
    const deepLink = `mercadopago://checkout?preference_id=${preferenceId}`;

    try {
      const canOpenDeepLink = await Linking.canOpenURL(deepLink);
      if (canOpenDeepLink) {
        console.log('Opening in Mercado Pago app via deep link');
        await Linking.openURL(deepLink);
        return { success: true, openedInApp: true };
      }
    } catch (deepLinkError) {
      console.log('Deep link failed, falling back to web URL');
    }

    // Fallback: abrir URL web normal
    console.log('Opening in browser');
    await Linking.openURL(paymentUrl);
    return { success: true, openedInApp: false };

  } catch (error) {
    return {
      success: false,
      openedInApp: false,
      error: 'No se pudo abrir el enlace de pago'
    };
  }
};

// Helper para extraer preference_id
function extractPreferenceId(url: string): string {
  const match = url.match(/pref_id=([^&]+)/);
  return match ? match[1] : '';
}
```

## Solución 3: Usar Credenciales de Producción en Desarrollo

Mercado Pago permite usar credenciales de producción con tarjetas de prueba:

1. Usa credenciales `APP_USR-XXX` (producción)
2. Usa tarjetas de prueba de Mercado Pago
3. Las URLs serán de producción (`www.mercadopago.com.uy`)
4. La app se abrirá correctamente
5. Los pagos serán de prueba (no reales)

### Tarjetas de Prueba de Mercado Pago:

```
VISA:
Número: 4509 9535 6623 3704
CVV: 123
Vencimiento: 11/25

MASTERCARD:
Número: 5031 7557 3453 0604
CVV: 123
Vencimiento: 11/25
```

## Prueba Rápida

Para diagnosticar el problema, ejecuta este test en tu app:

```typescript
// En app/cart/index.tsx, antes de abrir el pago
console.log('=== DIAGNOSTIC INFO ===');
console.log('Payment URL:', initPoint);
console.log('Is Test Mode:', isTestMode);
console.log('URL Domain:', new URL(initPoint).hostname);
console.log('Expected behavior:',
  new URL(initPoint).hostname.includes('sandbox')
    ? 'Will open in browser (sandbox URL)'
    : 'Will open in app if installed (production URL)'
);
console.log('======================');
```

## Recomendación Final

**Para que la app se abra correctamente:**

1. **Opción A (Producción con tarjetas de prueba)**:
   - Usa credenciales `APP_USR-XXX`
   - Configura el flag `is_test_mode: false`
   - Usa tarjetas de prueba para testear
   - ✅ La app se abrirá correctamente

2. **Opción B (Deep links)**:
   - Implementa la solución con deep links
   - Intenta `mercadopago://` primero
   - Fallback a URL web si falla
   - ✅ Mayor control pero más complejo

3. **Opción C (Aceptar limitación)**:
   - En test siempre abre navegador
   - En producción abre app
   - ✅ Más simple pero menos consistente

## Testing

### Para verificar que funciona:

1. Instala la app de Mercado Pago en tu dispositivo
2. Configura credenciales de producción (`APP_USR-XXX`)
3. Intenta hacer un pago desde el carrito
4. Observa que se abre la app de Mercado Pago
5. Usa una tarjeta de prueba para completar el pago

### Logs esperados cuando funciona:

```
🚀 Opening Mercado Pago payment: {
  urlDomain: 'www.mercadopago.com.uy',  ← ✅ Dominio de producción
  platform: 'android'
}
📱 Mercado Pago app detection: {
  detected: true,  ← ✅ App detectada
  note: 'OS will automatically choose app or browser'
}
✅ Mercado Pago URL opened successfully
ℹ️ If the Mercado Pago app is installed, it will open automatically
```

### Logs cuando NO funciona:

```
🚀 Opening Mercado Pago payment: {
  urlDomain: 'sandbox.mercadopago.com.uy',  ← ❌ Dominio sandbox
  platform: 'android'
}
📱 Mercado Pago app detection: {
  detected: false,  ← ❌ App no detectada (o dominio no registrado)
  note: 'OS will automatically choose app or browser'
}
✅ Mercado Pago URL opened successfully
ℹ️ Otherwise, it will open in the web browser  ← ❌ Abre navegador
```

## Próximos Pasos

1. **Verificar credenciales en uso**: Revisa qué credenciales está usando el partner
2. **Implementar logging**: Agrega los logs de diagnóstico
3. **Testear con producción**: Prueba con credenciales de producción
4. **Considerar deep links**: Si necesitas que funcione también en test
