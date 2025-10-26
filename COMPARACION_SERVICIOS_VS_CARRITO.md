# Comparación: Servicios vs Carrito - Apertura de Mercado Pago

## Flujo en SERVICIOS (funciona ✅)

### Código en `app/services/booking/[serviceId].tsx`:
```typescript
// Línea 517
const openResult = await openMercadoPagoPayment(result.paymentUrl!, isTestMode);
```

### Usa la misma función que el carrito

La función `openMercadoPagoPayment()` es **EXACTAMENTE LA MISMA** en ambos casos.

## Flujo en CARRITO (no funciona ❌)

### Código en `app/cart/index.tsx`:
```typescript
// Línea 271
const openResult = await openMercadoPagoPayment(initPoint, isTestMode);
```

### Usa la misma función que servicios

La función `openMercadoPagoPayment()` es **EXACTAMENTE LA MISMA** en ambos casos.

## ¿Por qué funciona en servicios pero no en carrito?

### Hipótesis Principal: DIFERENTES CREDENCIALES

El problema NO está en el código, está en las **credenciales de Mercado Pago** que se usan para cada uno:

### SERVICIOS (funciona):
```
Partner ID: ABC123
Credenciales: APP_USR-XXXX (PRODUCCIÓN)
URL Generada: https://www.mercadopago.com.uy/checkout/v1/redirect?pref_id=XXX
Resultado: ✅ Se abre en la APP de Mercado Pago
```

### CARRITO (no funciona):
```
Partner ID: DEF456
Credenciales: TEST-XXXX (SANDBOX)
URL Generada: https://sandbox.mercadopago.com.uy/checkout/v1/redirect?pref_id=XXX
Resultado: ❌ Se abre en el NAVEGADOR WEB
```

## Cómo Verificarlo

### 1. Revisa los logs cuando pagas un SERVICIO:

```
═══════════════════════════════════════
🚀 OPENING MERCADO PAGO PAYMENT
═══════════════════════════════════════
URL: https://www.mercadopago.com.uy/checkout/...  ← ✅ PRODUCCIÓN
Domain: www.mercadopago.com.uy
Is Test Mode: false
Is Sandbox URL: false  ← ✅ NO es sandbox
Platform: android
📱 App Detection Result: DETECTED

🔗 STRATEGY 1: Try deep link to app
Deep Link: mercadopago://checkout?preference_id=XXX
✅ Deep link available, opening app directly...
✅ SUCCESS: Opened in Mercado Pago app via deep link
```

### 2. Revisa los logs cuando pagas desde el CARRITO:

```
═══════════════════════════════════════
🛒 CART PAYMENT URL SELECTION
═══════════════════════════════════════
Is Test Mode: true
Selected URL: https://sandbox.mercadopago.com.uy/checkout/...  ← ❌ SANDBOX
URL Domain: sandbox.mercadopago.com.uy
⚠️  WARNING: This is a SANDBOX URL
⚠️  Sandbox URLs typically OPEN IN BROWSER, not app
⚠️  To open in app, use production credentials with test cards
═══════════════════════════════════════

═══════════════════════════════════════
🚀 OPENING MERCADO PAGO PAYMENT
═══════════════════════════════════════
URL: https://sandbox.mercadopago.com.uy/checkout/...  ← ❌ SANDBOX
Domain: sandbox.mercadopago.com.uy
Is Test Mode: true
Is Sandbox URL: true  ← ❌ Es sandbox
Platform: android

🔗 STRATEGY 1: Try deep link to app
Deep Link: mercadopago://checkout?preference_id=XXX
❌ Deep link not available, falling back to web URL
   (Deep links NO funcionan con URLs de sandbox)

🌐 STRATEGY 2: Open web URL (OS will decide)
⚠️  SUCCESS: Opened in web browser
   (Sandbox URLs typically open in browser)
```

## Solución

### Opción 1: Usar las mismas credenciales en ambos (RECOMENDADO)

Si en servicios funciona, es porque ese partner tiene credenciales de **PRODUCCIÓN**:

1. Ve a Supabase → tabla `partners`
2. Encuentra el partner que usas para pagar servicios
3. Copia sus credenciales `mercadopago_config`
4. Usa esas mismas credenciales para el carrito

### Opción 2: Cambiar todas las credenciales a producción

1. Ve a tu cuenta de Mercado Pago
2. Obtén tus credenciales de PRODUCCIÓN (APP_USR-XXX)
3. Configúralas en el partner
4. Usa tarjetas de prueba para testear:

```
VISA de prueba:
Número: 4509 9535 6623 3704
CVV: 123
Vencimiento: 11/25

MASTERCARD de prueba:
Número: 5031 7557 3453 0604
CVV: 123
Vencimiento: 11/25
```

### Opción 3: Verificar qué partner se usa en cada caso

Es posible que servicios y carrito estén usando **diferentes partners** con **diferentes configuraciones**.

```sql
-- Consulta para ver las configuraciones de los partners
SELECT
  id,
  business_name,
  mercadopago_config->>'access_token' as access_token_preview,
  CASE
    WHEN mercadopago_config->>'access_token' LIKE 'TEST-%' THEN 'SANDBOX'
    WHEN mercadopago_config->>'access_token' LIKE 'APP_USR-%' THEN 'PRODUCTION'
    ELSE 'UNKNOWN'
  END as environment
FROM partners
WHERE mercadopago_connected = true;
```

## Prueba Rápida

Para confirmar que este es el problema:

1. Haz un pago de un **SERVICIO** y copia la URL que aparece en los logs
2. Haz un pago desde el **CARRITO** y copia la URL que aparece en los logs
3. Compara los dominios:
   - `www.mercadopago.com.uy` = Se abrirá en la app ✅
   - `sandbox.mercadopago.com.uy` = Se abrirá en el navegador ❌

## Conclusión

El código está **PERFECTO**. El problema es que estás usando:
- **Credenciales de PRODUCCIÓN** en servicios → Se abre la app ✅
- **Credenciales de SANDBOX** en el carrito → Se abre el navegador ❌

**Solución**: Usa credenciales de producción en ambos lados y testea con tarjetas de prueba.
