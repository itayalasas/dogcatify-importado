# Cómo Obtener tus Credenciales de Mercado Pago

## El Problema Actual

La app muestra este error:
```
ERROR: invalid access token
```

**Causa:** Las credenciales que usamos de ejemplo no son válidas para tu cuenta.

**Solución:** Necesitas usar TUS propias credenciales de Mercado Pago.

---

## Paso 1: Accede a tu Cuenta de Mercado Pago

1. Ve a: https://www.mercadopago.com.uy/developers/panel
2. Inicia sesión con tu cuenta de Mercado Pago

Si no tienes cuenta:
- Ve a https://www.mercadopago.com.uy/
- Crea una cuenta nueva (es gratis)

---

## Paso 2: Crea una Aplicación (si no tienes)

1. En el panel de desarrolladores, ve a **"Tus aplicaciones"**
2. Si no tienes ninguna aplicación, haz clic en **"Crear aplicación"**
3. Dale un nombre (ejemplo: "DogCatify")
4. Selecciona el modelo de integración: **"Checkout Pro"**
5. Haz clic en **"Crear aplicación"**

---

## Paso 3: Obtén tus Credenciales de PRODUCCIÓN

1. En tu aplicación, ve al menú izquierdo y haz clic en **"Credenciales"**

2. Verás dos pestañas:
   - **Prueba** (Test) ← NO uses estas
   - **Producción** ← ✅ Usa ESTAS

3. Haz clic en la pestaña **"Producción"**

4. Verás dos credenciales:
   - **Access Token**: Empieza con `APP_USR-XXXXXXXXX`
   - **Public Key**: Empieza con `APP_USR-XXXXXXXXX`

5. **Copia ambas credenciales** (haz clic en el ícono de copiar)

---

## Paso 4: Actualiza las Credenciales en el Proyecto

### Opción A: Usando el Script (Recomendado)

1. Abre el archivo `scripts/update-mercadopago-credentials.js`

2. En las líneas 12-13, pega tus credenciales:

```javascript
const YOUR_ACCESS_TOKEN = 'APP_USR-5351471068765342-102713-XXXXXXXXXX';
const YOUR_PUBLIC_KEY = 'APP_USR-88a45b7d-f0f0-453c-XXXXXXXXXX';
```

3. Guarda el archivo

4. Ejecuta el script:
```bash
node scripts/update-mercadopago-credentials.js
```

5. Verás un mensaje de éxito:
```
✅ Partners actualizados: 13
🎉 ¡Credenciales actualizadas exitosamente!
```

### Opción B: Manualmente en Supabase

1. Ve a tu proyecto de Supabase
2. Abre el **Table Editor**
3. Ve a la tabla **`partners`**
4. Para cada partner, actualiza el campo **`mercadopago_config`** con:

```json
{
  "access_token": "APP_USR-TU-ACCESS-TOKEN-AQUI",
  "public_key": "APP_USR-TU-PUBLIC-KEY-AQUI",
  "is_test_mode": true,
  "is_oauth": false,
  "connected_at": "2025-10-26T23:54:10.243Z"
}
```

---

## Paso 5: Prueba la Integración

### 1. Reinicia la App

Cierra completamente la app y vuelve a abrirla.

### 2. Agrega un Producto al Carrito

1. Ve a la tienda
2. Selecciona un producto
3. Agrégalo al carrito
4. Ve al carrito
5. Presiona **"Pagar"**

### 3. Verifica que Funciona

Deberías ver:
- ✅ Loader "Procesando pago..."
- ✅ Se abre la app de Mercado Pago automáticamente
- ✅ Puedes completar el pago

### 4. Usa Tarjetas de Prueba

Mercado Pago provee tarjetas de prueba que funcionan con credenciales de producción:

**VISA:**
```
Número: 4509 9535 6623 3704
CVV: 123
Vencimiento: 11/25
Nombre: APRO (para aprobar)
```

**Mastercard:**
```
Número: 5031 7557 3453 0604
CVV: 123
Vencimiento: 11/25
Nombre: APRO (para aprobar)
```

**Para probar rechazo:**
```
Usar nombre: OCHO (rechazará el pago)
```

---

## Importante: Diferencia entre Test y Producción

### ❌ Credenciales de TEST (TEST-XXX)

- Empiezan con `TEST-`
- Generan URLs de sandbox: `sandbox.mercadopago.com.uy`
- **NO abren la app de Mercado Pago**
- Se abren en el navegador web
- No se pueden usar para pagos reales

### ✅ Credenciales de PRODUCCIÓN (APP_USR-XXX)

- Empiezan con `APP_USR-`
- Generan URLs de producción: `www.mercadopago.com.uy`
- **SÍ abren la app de Mercado Pago**
- Se abren automáticamente en la app si está instalada
- Permiten pagos reales Y pagos de prueba (con tarjetas de test)

---

## Solución de Problemas

### Error: "invalid access token"

**Causa:** Las credenciales no son correctas.

**Solución:**
1. Verifica que copiaste las credenciales completas (sin espacios extra)
2. Asegúrate de usar las credenciales de **PRODUCCIÓN**, no de **Test**
3. Verifica que empiecen con `APP_USR-`
4. Revisa que no haya errores de tipeo

### Error: "unauthorized"

**Causa:** La aplicación no tiene permisos.

**Solución:**
1. Ve a tu aplicación en Mercado Pago
2. Verifica que esté activa
3. Verifica que tenga permisos de **Checkout Pro**

### La app no se abre (se abre el navegador)

**Causa:** Estás usando credenciales de TEST en lugar de PRODUCCIÓN.

**Solución:**
1. Verifica que las credenciales empiecen con `APP_USR-` (no `TEST-`)
2. Ejecuta el script de diagnóstico:
```bash
node scripts/check-mercadopago-config.js
```
3. Debe mostrar: "Partners en PRODUCTION: 13"

---

## Verificación Final

Después de actualizar las credenciales, ejecuta este comando para verificar:

```bash
node scripts/check-mercadopago-config.js
```

Deberías ver:

```
📊 RESUMEN:
  Partners en SANDBOX: 0 (abre navegador)
  Partners en PRODUCTION: 13 (abre app)

✅ TODOS tus partners están en PRODUCTION
✅ La app debería abrirse correctamente
```

---

## ¿Necesitas Ayuda?

Si sigues teniendo problemas:

1. Ejecuta el diagnóstico completo:
```bash
node scripts/check-mercadopago-config.js
```

2. Verifica los logs en la consola cuando intentas pagar

3. Busca estos mensajes:
   - ✅ "Opened in Mercado Pago app via deep link"
   - ❌ "invalid access token"
   - ❌ "unauthorized"

4. Comparte los logs para ayudarte mejor
