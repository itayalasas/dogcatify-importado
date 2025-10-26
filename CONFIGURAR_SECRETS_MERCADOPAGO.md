# Configurar Secrets de Mercado Pago en Supabase

## ¿Por qué usar Secrets?

Los **Secrets** son variables de entorno seguras que se almacenan encriptadas en Supabase. Son el lugar correcto para guardar:
- Claves secretas de API
- Tokens de acceso
- Cualquier información sensible

**NO guardes secrets en:**
- ❌ La base de datos
- ❌ El código fuente
- ❌ Variables de entorno del .env (estas son solo para desarrollo local)

## Configurar el Secret del Webhook

### Paso 1: Acceder al Panel de Supabase

1. Ve a: https://supabase.com/dashboard/project/zkgiwamycbjcogcgqhff
2. En el menú lateral, haz click en **"Edge Functions"**
3. Luego click en **"Manage secrets"** (o "Secrets")

### Paso 2: Agregar el Secret

Haz click en **"Add new secret"** y agrega:

**Nombre del Secret:**
```
MERCADOPAGO_WEBHOOK_SECRET
```

**Valor (para TEST):**
```
5225bbcf087d4531d1d9a4f585ff586aae3d8b295180daa3f31d81b1ce7e6fb5
```

**IMPORTANTE:** Este es el valor que aparece en tu panel de Mercado Pago como "Clave secreta".

### Paso 3: Guardar

Haz click en **"Save"** o **"Add secret"**

## Cambiar a Producción

Cuando estés listo para producción:

### 1. Obtén la Clave Secreta de PRODUCCIÓN

1. Ve a: https://www.mercadopago.com.uy/developers/panel
2. Selecciona tu aplicación
3. En el menú, haz click en **"Credenciales de producción"**
4. Copia la **"Clave secreta"** (NO la "Public key")

### 2. Actualiza el Secret en Supabase

1. Ve a: https://supabase.com/dashboard/project/zkgiwamycbjcogcgqhff/settings/functions
2. Click en **"Secrets"**
3. Busca `MERCADOPAGO_WEBHOOK_SECRET`
4. Click en el botón de editar (lápiz)
5. Pega la nueva clave secreta de PRODUCCIÓN
6. Click en **"Save"**

**¡Listo!** El webhook automáticamente usará la nueva clave sin necesidad de redesplegar.

## Verificar que Funciona

### 1. Revisar Logs

Ve a: https://supabase.com/dashboard/project/zkgiwamycbjcogcgqhff/functions/mercadopago-webhook/logs

Deberías ver:
```
Received MP webhook (signature verified): {...}
```

Si ves:
```
MERCADOPAGO_WEBHOOK_SECRET not configured, skipping validation
```

Significa que el secret NO está configurado correctamente.

### 2. Hacer un Pago de Prueba

1. Realiza un pago en tu app
2. Mercado Pago enviará notificación al webhook
3. El webhook validará la firma usando el secret
4. Si la firma es válida → orden se confirma
5. Si la firma NO es válida → rechaza con error 401

## Secrets Recomendados para el Futuro

A medida que tu app crezca, considera agregar estos secrets:

### `MERCADOPAGO_ACCESS_TOKEN_TEST`
Token de acceso para ambiente TEST
```
TEST-1624486229466072-102600-62686a01a9ab41e8fc19800544564374-1876395148
```

### `MERCADOPAGO_ACCESS_TOKEN_PROD`
Token de acceso para ambiente de PRODUCCIÓN (cuando lo tengas)

### `MERCADOPAGO_PUBLIC_KEY_TEST`
Public key para ambiente TEST
```
TEST-6f0383f8-0e30-4991-bace-c2bb1c5c24c6
```

### `MERCADOPAGO_PUBLIC_KEY_PROD`
Public key para ambiente de PRODUCCIÓN

## Ventajas de Usar Secrets

✅ **Seguridad:** Están encriptados y nunca se exponen en el código
✅ **Fácil actualización:** Cambias el secret sin tocar el código
✅ **Separación de ambientes:** Diferentes secrets para TEST y PROD
✅ **No afecta la base de datos:** Los secrets no ocupan espacio en tu DB
✅ **Mejor práctica:** Es el estándar de la industria

## Resumen

### Para Ambiente TEST (actual):
```
MERCADOPAGO_WEBHOOK_SECRET=5225bbcf087d4531d1d9a4f585ff586aae3d8b295180daa3f31d81b1ce7e6fb5
```

### Para Ambiente PRODUCCIÓN (cuando estés listo):
1. Obtén la clave secreta de producción de Mercado Pago
2. Actualiza el secret `MERCADOPAGO_WEBHOOK_SECRET` en Supabase
3. ¡Listo! No necesitas hacer nada más

**Ubicación del Secret en Supabase:**
https://supabase.com/dashboard/project/zkgiwamycbjcogcgqhff/settings/functions

Click en "Secrets" → "Add new secret" o edita el existente.
