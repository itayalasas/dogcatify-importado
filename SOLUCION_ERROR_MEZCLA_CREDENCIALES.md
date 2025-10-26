# ✅ Solución: Error "Una de las partes es de prueba"

## El Problema Real

Cuando usabas credenciales TEST, aparecía este error incluso en el sandbox:

```
"Una de las partes con la que intentas hacer el pago es de prueba."
```

## Causa Raíz

El problema era la **mezcla de credenciales** al usar `application_fee`:

```json
{
  "items": [...],
  "payer": {...},
  "application_fee": 21.5,  // ← Este era el problema
  ...
}
```

Cuando agregamos `application_fee` (comisión de marketplace), MercadoPago requiere que:
- El `access_token` usado
- El `collector_id` (user_id del partner)
- El marketplace

**TODOS estén en el mismo ambiente** (TEST o PRODUCCIÓN).

Pero teníamos:
- ✅ `access_token`: `TEST-xxx` (testing)
- ❌ `collector_id`: `1876395148` (producción)
- ❌ `application_fee`: presente (intenta hacer split)

Resultado: **Mezcla de credenciales = Error**

## La Solución

**NO agregar `application_fee` en modo TEST:**

### Antes (Incorrecto):

```javascript
// ❌ Siempre agregaba application_fee
const preferenceData = {
  items: [...],
  payer: {...},
  application_fee: commissionAmount  // Causaba error en TEST
};
```

### Ahora (Correcto):

```javascript
// ✅ Solo agrega application_fee en PRODUCCIÓN
const preferenceData = {
  items: [...],
  payer: {...}
};

// Detect if we're using test credentials
const isTestMode = partnerConfig.access_token?.startsWith('TEST-');

// Add application fee ONLY in production mode
if (!isTestMode) {
  preferenceData.application_fee = commissionAmount;
}
```

## Comportamiento por Ambiente

### Modo TEST (Desarrollo)
```javascript
{
  "items": [{"title": "Consultas", "unit_price": 430}],
  "payer": {...},
  // ❌ NO incluye application_fee
  "notification_url": "...",
  "statement_descriptor": "DOGCATIFY"
}
```

**Resultado**:
- ✅ Pago funciona correctamente en sandbox
- ✅ Partner recibe 100% del monto de prueba
- ✅ Sin error de mezcla de credenciales

### Modo PRODUCCIÓN (Real)
```javascript
{
  "items": [{"title": "Consultas", "unit_price": 430}],
  "payer": {...},
  "application_fee": 21.5,  // ✅ SÍ incluye comisión
  "notification_url": "...",
  "statement_descriptor": "DOGCATIFY"
}
```

**Resultado**:
- ✅ Pago funciona correctamente en producción
- ✅ DogCatiFy recibe 21.5 (5% comisión)
- ✅ Partner recibe 408.5 (95% del monto)

## Archivos Modificados

### 1. `createServicePaymentPreference` (Servicios)

**Línea ~1084-1096:**
```javascript
// Add marketplace fee ONLY if:
// 1. Partner has OAuth configuration
// 2. NOT in test mode (application_fee doesn't work in test mode with mixed credentials)
if (!isTestMode && partnerConfig.is_oauth && partnerConfig.user_id && !isNaN(parseInt(partnerConfig.user_id))) {
  preferenceData.application_fee = commissionAmount;
  console.log('Using OAuth marketplace split for service booking (PRODUCTION)');
} else {
  if (isTestMode) {
    console.log('Test mode: skipping application_fee to avoid mixed credentials');
  } else {
    console.log('Manual configuration: no marketplace split');
  }
}
```

### 2. `createUnifiedPaymentPreference` (Productos)

**Línea ~717-724:**
```javascript
// Detect if we're using test credentials
const isTestMode = partnerConfig.access_token?.startsWith('TEST-');

// Add application fee ONLY in production mode
// In test mode, we skip it to avoid "mixed credentials" error
if (!isTestMode) {
  preferenceData.application_fee = commissionAmount;
}
```

## Cómo Validar el Fix

### 1. Verificar Logs

En modo TEST verás:
```
Creating service payment preference: {
  isTestMode: true,
  tokenPrefix: 'TEST-1624486229466...'
}

Test mode: skipping application_fee to avoid mixed credentials

Service payment preference created successfully: {
  isTestMode: true,
  shouldUseUrl: 'sandbox_init_point'
}

Payment URL selected: {
  isTestMode: true,
  url: 'https://sandbox.mercadopago.com.uy/...'
}
```

### 2. Probar Pago en Sandbox

1. Usa credenciales TEST del partner
2. Crea una reserva de servicio o compra un producto
3. Se abrirá el checkout de sandbox
4. ✅ **Ya NO aparece el error "Una de las partes es de prueba"**
5. Completa el pago con tarjeta de prueba
6. Pago se aprueba correctamente

### 3. Verificar en Producción

1. Cambia a credenciales APP del partner
2. Crea una orden real
3. Se abrirá el checkout de producción
4. ✅ La comisión se aplica correctamente
5. DogCatiFy recibe su comisión
6. Partner recibe el monto restante

## Resumen Visual

```
┌─────────────────────────────────────────────────┐
│ ANTES (Con Error)                               │
├─────────────────────────────────────────────────┤
│ Token: TEST-xxx                                 │
│ application_fee: ✓ (presente)                   │
│ collector_id: 1876395148 (producción)           │
│                                                 │
│ ❌ Resultado: "Una de las partes es de prueba" │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ AHORA (Sin Error)                               │
├─────────────────────────────────────────────────┤
│ Token: TEST-xxx                                 │
│ application_fee: ✗ (NO presente)                │
│ collector_id: no importa                        │
│                                                 │
│ ✅ Resultado: Pago funciona correctamente      │
└─────────────────────────────────────────────────┘
```

## Notas Importantes

1. **En TEST**: La comisión no se prueba. El partner recibe 100% del monto de prueba.

2. **En PRODUCCIÓN**: La comisión funciona normalmente. DogCatiFy recibe su %.

3. **Esto es correcto y esperado**: En ambientes de testing, lo importante es probar el flujo de pago, no el split de comisión.

4. **MercadoPago lo hace así por diseño**: No permite mezclar credenciales TEST y PRODUCCIÓN en marketplace splits.

## Conclusión

✅ **El error está resuelto**

La solución es simple pero crítica:
- Detectar el ambiente (`TEST` vs `PRODUCCIÓN`)
- Solo usar `application_fee` en producción
- En testing, probar el flujo sin splits

Esto permite:
- ✅ Testear pagos en sandbox sin errores
- ✅ Aplicar comisiones correctamente en producción
- ✅ Mantener el código limpio y mantenible
