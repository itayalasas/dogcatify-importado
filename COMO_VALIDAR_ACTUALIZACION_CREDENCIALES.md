# ✅ Cómo Validar que las Credenciales se Actualicen Correctamente

## Cambios Implementados

### 1. Logs Mejorados

Ahora verás logs detallados en cada paso:

**Al cargar la pantalla de configuración:**
```
📥 MP config loaded from DB: {
  access_token_prefix: 'TEST-1624486...',
  public_key_prefix: 'TEST-6f0383f...',
  is_test_mode: true,
  is_oauth: false,
  connected_at: '2025-10-26T...'
}
```

**Al guardar credenciales nuevas:**
```
💾 Saving NEW MP config: {
  public_key_prefix: 'APP_USR-xxx...',
  access_token_prefix: 'APP_USR-xxx...',
  is_test_mode: false,
  connected_at: '2025-10-26T...',
  partner_id: 'xxx',
  partner_name: 'Veterinaria PetLife'
}
```

**Al obtener config para crear un pago:**
```
✅ MP config returned: {
  business_name: 'Veterinaria PetLife',
  access_token_prefix: 'APP_USR-xxx...',
  public_key_prefix: 'APP_USR-xxx...',
  is_test_mode: false,
  is_oauth: false,
  connected_at: '2025-10-26T...'
}
```

### 2. Refresh Automático

- Después de **guardar** credenciales → recarga datos desde BD
- Después de **desconectar** → recarga datos desde BD
- Esto asegura que siempre se muestre la info más actualizada

## Pasos para Validar

### Paso 1: Desconectar Credenciales Actuales

1. Abrir app Android
2. Ir a **Perfil → Configuración de Mercado Pago**
3. Presionar **"Desconectar Cuenta"**
4. Confirmar la desconexión

**Verificar en logs:**
```
Desconectando cuenta de Mercado Pago...
Partner updated: mercadopago_connected = false
Loading partner data...
No MP config found
```

### Paso 2: Configurar Nuevas Credenciales

Tienes dos opciones:

#### Opción A: Credenciales de Producción (Recomendado)

1. Ir a: https://www.mercadopago.com.uy/developers/panel
2. Copiar:
   - **Access Token**: `APP_USR-xxxxxxxxx`
   - **Public Key**: `APP_USR-xxxxxxxxx`
3. En la app, pegar las credenciales
4. **NO marcar** "Modo de prueba"
5. Guardar

#### Opción B: Credenciales TEST Reales (Si tienes)

1. Ir a: https://test.mercadopago.com.uy/
2. Crear cuenta TEST (si no tienes)
3. Copiar credenciales TEST de esa cuenta
4. En la app, pegar las credenciales
5. **Marcar** "Modo de prueba"
6. Guardar

**Verificar en logs:**
```
💾 Saving NEW MP config: {
  access_token_prefix: 'APP_USR-xxx...' (o TEST-xxx si usaste Opción B),
  is_test_mode: false (o true),
  ...
}

MP config saved successfully
Loading partner data...

📥 MP config loaded from DB: {
  access_token_prefix: 'APP_USR-xxx...',
  ...
}
```

### Paso 3: Probar un Pago

1. Crear una reserva de servicio (ej: Consulta veterinaria)
2. Seleccionar fecha y hora
3. Presionar "Reservar y Pagar"

**Verificar en logs:**
```
Getting MP config for partner: xxx

✅ MP config returned: {
  business_name: 'Veterinaria PetLife',
  access_token_prefix: 'APP_USR-xxx...',  ← Debe coincidir con lo que guardaste
  is_test_mode: false,                     ← Debe coincidir con lo que marcaste
  ...
}

Creating service payment preference: {
  isTestMode: false,  ← Detectado correctamente
  tokenPrefix: 'APP_USR-xxx'
}

Service payment preference created successfully: {
  isTestMode: false,
  shouldUseUrl: 'init_point'  ← Producción
}
```

### Paso 4: Validar el Checkout

**Si usaste Opción A (Producción):**
- ✅ Se debe abrir checkout de MercadoPago productivo (sin "Sandbox")
- ✅ NO debe aparecer error "Una de las partes es de prueba"
- ⚠️ Los pagos serán REALES

**Si usaste Opción B (TEST Real):**
- ✅ Se debe abrir checkout de Sandbox (con banner "Sandbox")
- ✅ NO debe aparecer error "Una de las partes es de prueba"
- ✅ Puedes usar tarjetas de prueba

## Qué Verificar en Cada Paso

### ✅ Checklist de Validación

- [ ] Las credenciales se guardan correctamente en la BD
- [ ] La pantalla de configuración muestra las credenciales correctas
- [ ] Los logs muestran el `access_token_prefix` correcto al crear pago
- [ ] El checkout que se abre coincide con el ambiente (TEST/PROD)
- [ ] NO aparece el error "Una de las partes es de prueba"

### ❌ Problemas Conocidos (Que Ya NO Deben Pasar)

- ❌ Las credenciales no se actualizan después de guardar
- ❌ Al crear un pago, usa credenciales viejas
- ❌ El checkout se abre en el ambiente incorrecto
- ❌ Aparece error de mezcla de credenciales

## Troubleshooting

### Si las Credenciales No se Actualizan

1. **Cerrar completamente la app** (no solo minimizar)
2. **Volver a abrir la app**
3. Ir a configuración de Mercado Pago
4. Verificar que muestre las credenciales nuevas

### Si Sigue Apareciendo el Error

El problema es con las **credenciales mismas**, no con el código:

1. Verificar que el `access_token` sea válido:
   ```bash
   curl -H "Authorization: Bearer TU_ACCESS_TOKEN" \
     https://api.mercadopago.com/users/me
   ```

2. Si el `id` del response NO coincide con el prefijo del token (TEST vs número), **tienes mezcla de ambientes**

3. **Solución**: Usar credenciales de producción (`APP_USR-xxx`) o crear cuenta TEST real

## Logs de Ejemplo (Flujo Exitoso)

```
# 1. Desconexión
Desconectando cuenta...
Partner updated successfully
Loading partner data...
No MP config found

# 2. Guardar nuevas credenciales
💾 Saving NEW MP config: {
  access_token_prefix: 'APP_USR-187...',
  is_test_mode: false
}
MP config saved successfully
Loading partner data...
📥 MP config loaded from DB: {
  access_token_prefix: 'APP_USR-187...',
  is_test_mode: false
}

# 3. Crear pago
Getting MP config for partner: xxx
✅ MP config returned: {
  access_token_prefix: 'APP_USR-187...',
  is_test_mode: false
}
Creating service payment preference: {
  isTestMode: false,
  tokenPrefix: 'APP_USR-187'
}
Service payment preference created successfully: {
  isTestMode: false,
  shouldUseUrl: 'init_point'
}
Payment URL selected: {
  isTestMode: false,
  url: 'https://www.mercadopago.com.uy/checkout/...'
}

# 4. Checkout abierto
✅ Checkout de producción
✅ Sin error de "partes de prueba"
```

## Resumen

Los cambios implementados aseguran que:
1. ✅ Las credenciales se guarden correctamente
2. ✅ Se refresque la info desde BD después de guardar/desconectar
3. ✅ Los logs permitan rastrear qué credenciales se usan
4. ✅ Se detecte correctamente TEST vs PRODUCCIÓN

**Ahora prueba desconectar y reconectar con credenciales de producción.**
