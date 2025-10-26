# ⚠️ Problema: Credenciales TEST con Collector ID de Producción

## El Problema Detectado

Estás viendo este error en el sandbox de MercadoPago:
```
"Una de las partes con la que intentas hacer el pago es de prueba."
```

### Análisis del JSON de la Preferencia

Al consultar la preferencia creada, vemos:

```json
{
  "client_id": "1624486229466072",   // ← TEST (tiene sufijo TEST)
  "collector_id": 1876395148,         // ← PRODUCCIÓN (ID numérico)
  "marketplace": "NONE",
  "marketplace_fee": 0
}
```

**El problema**: El `access_token` TEST que estás usando tiene asociado un `collector_id` de **producción**. Esto causa mezcla de ambientes y MercadoPago lo rechaza.

## Por Qué Sucede Esto

Cuando obtienes un `access_token` TEST desde tu dashboard de MercadoPago de **producción**, ese token:
- ✅ Tiene prefijo `TEST-` (es reconocido como testing)
- ❌ Pero está vinculado a tu `user_id` de **producción**
- ❌ MercadoPago detecta la mezcla y bloquea el pago

## Soluciones

### Opción 1: Usar Cuenta TEST Completa (Recomendado)

1. **Crear cuenta TEST de usuario**:
   - Ir a: https://test.mercadopago.com.uy/
   - Crear una cuenta TEST completamente nueva
   - Esta tendrá su propio `collector_id` TEST

2. **Obtener credenciales TEST reales**:
   - Ingresar al dashboard TEST
   - Obtener `access_token` y `public_key` TEST
   - Estos sí tendrán un `collector_id` TEST válido

3. **Configurar en la app**:
   - Usar esas credenciales en lugar de las actuales
   - Marcar como "Modo TEST" en la configuración

### Opción 2: NO Usar Modo TEST (Más Simple)

Si solo quieres probar el flujo sin crear cuentas TEST:

1. **Usar credenciales de PRODUCCIÓN**:
   - Usar tu `access_token` normal (APP_USR-xxx)
   - Usar tu `public_key` normal
   - **NO marcar "Modo TEST"**

2. **Hacer pruebas con montos pequeños reales**:
   - Usar tarjetas reales con montos mínimos (ej: $10)
   - El pago será real pero pequeño
   - Puedes devolver el dinero después

### Opción 3: Esperar al Fix de OAuth (Futuro)

Cuando implementemos el flujo OAuth completo:
- El partner autorizará su cuenta via OAuth
- MercadoPago devolverá credenciales 100% consistentes
- No habrá mezcla de ambientes

## Lo Que Ya Hicimos en el Código

Eliminamos el uso de `application_fee` en modo TEST para evitar el error cuando sea posible:

```javascript
// Detectar si es TEST
const isTestMode = partnerConfig.access_token?.startsWith('TEST-');

// NO agregar application_fee en TEST
if (!isTestMode) {
  preferenceData.application_fee = commissionAmount;
}
```

**Pero**: Esto NO soluciona el problema si el `access_token` TEST tiene un `collector_id` de producción vinculado. El error seguirá apareciendo porque MercadoPago lo detecta automáticamente.

## Recomendación Final

### Para Desarrollo/Testing:
**Usa Opción 2**: Credenciales de producción + montos pequeños reales.

### Para Testing Sandbox Real:
**Usa Opción 1**: Crear cuenta TEST completa en https://test.mercadopago.com.uy/

## Cómo Validar Tus Credenciales

Puedes verificar si tus credenciales tienen mezcla de ambientes:

```bash
# Obtener info del usuario
curl -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  https://api.mercadopago.com/users/me
```

Respuesta esperada:

```json
{
  "id": 1876395148,           // ← Este es tu collector_id
  "site_id": "MLU",
  "email": "tu@email.com",
  ...
}
```

Si tu `access_token` empieza con `TEST-` pero el `id` NO tiene sufijo TEST o es un número simple, **tienes mezcla de ambientes**.

## Resumen Visual

```
╔═══════════════════════════════════════════════════════╗
║ ❌ NO FUNCIONA (Mezcla de Ambientes)                 ║
╠═══════════════════════════════════════════════════════╣
║ access_token: TEST-1234567890-xxx                    ║
║ collector_id: 1876395148 (producción)                ║
║                                                       ║
║ Resultado: "Una de las partes es de prueba"          ║
╚═══════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════╗
║ ✅ FUNCIONA (TEST Real)                               ║
╠═══════════════════════════════════════════════════════╣
║ access_token: TEST-9999999999-xxx                    ║
║ collector_id: 999999999 (cuenta TEST)                ║
║                                                       ║
║ Resultado: Pago funciona en sandbox                  ║
╚═══════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════╗
║ ✅ FUNCIONA (Producción)                              ║
╠═══════════════════════════════════════════════════════╣
║ access_token: APP_USR-1876395148-xxx                 ║
║ collector_id: 1876395148 (producción)                ║
║                                                       ║
║ Resultado: Pago funciona en producción               ║
╚═══════════════════════════════════════════════════════╝
```

## Próximos Pasos

1. **Inmediato**: Decide qué opción usar (1 o 2)
2. **Si eliges Opción 1**: Crear cuenta TEST en test.mercadopago.com.uy
3. **Si eliges Opción 2**: Usar credenciales de producción con montos pequeños
4. **Actualizar credenciales** en la app
5. **Probar el flujo** nuevamente

¿Con cuál opción quieres continuar?
