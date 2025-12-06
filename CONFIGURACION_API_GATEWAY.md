# Configuración API Gateway para Multi-Ambiente

## Arquitectura de Configuración

La aplicación está diseñada para cargar su configuración de manera diferente según el entorno:

### 🔧 Desarrollo Local (expo dev)
- Usa variables del archivo `.env`
- NO requiere API Gateway
- Permite desarrollo rápido sin conexión externa

### 📱 Producción (APK/AAB compilados)
- **SOLO** usa API Gateway
- NO usa variables de .env ni expo.dev
- Permite cambiar ambientes sin recompilar el APK

## Ventajas de Este Enfoque

### ✅ Multi-Ambiente Sin Recompilar
- Un solo APK puede conectarse a diferentes ambientes (dev, staging, prod)
- Cambias el ambiente desde el API Gateway sin recompilar
- Ideal para testing en diferentes ambientes

### ✅ Seguridad
- Variables sensibles nunca se embeben en el APK
- Las variables se cargan dinámicamente
- Puedes rotar credenciales sin redistribuir el APK

### ✅ Flexibilidad
- Puedes tener múltiples configuraciones en el API Gateway
- Cambias entre ambientes mediante headers o parámetros
- Actualizaciones de configuración sin actualizar la app

## Configuración del API Gateway

### Estructura del API Gateway

Tu API Gateway debe:

1. **Recibir requests GET con autenticación**
2. **Retornar configuración en formato JSON**
3. **Soportar múltiples ambientes**

### Formato de Response Requerido

```json
{
  "project_name": "DogCatify",
  "description": "Production Environment",
  "variables": {
    "EXPO_PUBLIC_SUPABASE_URL": "https://xxx.supabase.co",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJhbGc...",
    "EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY": "eyJhbGc...",
    "EXPO_ROUTER_APP_ROOT": "app",
    "EXPO_PUBLIC_PROJECT_ID": "xxx",
    "EXPO_PUBLIC_PRIVACY_POLICY_URL": "https://...",
    "EXPO_PUBLIC_TERMS_OF_SERVICE_URL": "https://...",
    "EXPO_PUBLIC_APP_DOMAIN": "https://...",
    "EXPO_PUBLIC_NOMINATIM_BASE_URL": "https://nominatim.openstreetmap.org",
    "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "xxx",
    "FIREBASE_PRIVATE_KEY_ID": "xxx",
    "FIREBASE_PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----\n...",
    "FIREBASE_CLIENT_EMAIL": "xxx@xxx.iam.gserviceaccount.com",
    "FIREBASE_CLIENT_ID": "xxx",
    "FIREBASE_CLIENT_CERT_URL": "https://...",
    "EXPO_PUBLIC_EMAIL_API_URL": "https://...",
    "EXPO_PUBLIC_EMAIL_API_KEY": "xxx"
  },
  "updated_at": "2025-12-06T00:00:00Z"
}
```

### Implementación del API Gateway

#### Opción 1: Supabase Edge Function

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const environments = {
  production: {
    EXPO_PUBLIC_SUPABASE_URL: 'https://production.supabase.co',
    // ... resto de variables de producción
  },
  staging: {
    EXPO_PUBLIC_SUPABASE_URL: 'https://staging.supabase.co',
    // ... resto de variables de staging
  },
  development: {
    EXPO_PUBLIC_SUPABASE_URL: 'https://dev.supabase.co',
    // ... resto de variables de desarrollo
  }
};

serve(async (req) => {
  // Verificar API Key
  const apiKey = req.headers.get('X-Integration-Key');
  if (apiKey !== Deno.env.get('EXPECTED_API_KEY')) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Obtener ambiente del header (o usar producción por defecto)
  const environment = req.headers.get('X-Environment') || 'production';

  const config = environments[environment];

  if (!config) {
    return new Response('Invalid environment', { status: 400 });
  }

  return new Response(
    JSON.stringify({
      project_name: 'DogCatify',
      description: `${environment.toUpperCase()} Environment`,
      variables: config,
      updated_at: new Date().toISOString()
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
});
```

#### Opción 2: Express/Node.js API

```javascript
const express = require('express');
const app = express();

const environments = {
  production: { /* variables de producción */ },
  staging: { /* variables de staging */ },
  development: { /* variables de desarrollo */ }
};

app.get('/config', (req, res) => {
  const apiKey = req.headers['x-integration-key'];

  if (apiKey !== process.env.EXPECTED_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const environment = req.headers['x-environment'] || 'production';
  const config = environments[environment];

  if (!config) {
    return res.status(400).json({ error: 'Invalid environment' });
  }

  res.json({
    project_name: 'DogCatify',
    description: `${environment.toUpperCase()} Environment`,
    variables: config,
    updated_at: new Date().toISOString()
  });
});

app.listen(3000);
```

## Configuración en app.json

Agrega la configuración del API Gateway en `app.json`:

```json
{
  "expo": {
    "extra": {
      "apiGateway": {
        "url": "https://tu-api-gateway.com/config",
        "apiKey": "tu_api_key_secreta_aqui"
      }
    }
  }
}
```

### Variables de Entorno en EAS Build

Para mantener las credenciales seguras, usa secrets de EAS:

```bash
# Configurar API Gateway URL
eas secret:create --scope project --name API_GATEWAY_URL --value "https://tu-api-gateway.com/config"

# Configurar API Key
eas secret:create --scope project --name API_GATEWAY_API_KEY --value "tu_api_key_secreta"
```

Luego modifica `app.json` para usar estos secrets:

```json
{
  "expo": {
    "extra": {
      "apiGateway": {
        "url": "${API_GATEWAY_URL}",
        "apiKey": "${API_GATEWAY_API_KEY}"
      }
    }
  }
}
```

## Flujo de Carga

### En Desarrollo (expo dev)

```
1. App inicia
2. Busca configuración en caché
3. Si no hay caché, carga desde .env
4. Guarda en caché
5. App lista para usar
```

### En Producción (APK)

```
1. App inicia
2. Busca configuración en caché
3. Si no hay caché:
   a. Hace request GET al API Gateway
   b. Incluye header: X-Integration-Key: [apiKey]
   c. Opcionalmente: X-Environment: [environment]
   d. Reintenta hasta 3 veces si falla
   e. Timeout de 60 segundos por intento
4. Guarda respuesta en caché
5. App lista para usar
```

### Siguientes Aperturas

```
1. App inicia
2. Carga configuración del caché (< 1 segundo)
3. App lista para usar
```

## Cambiar de Ambiente

### Opción 1: Header en Request

Modifica el API Gateway para leer el header `X-Environment`:

```typescript
// En app.json
{
  "extra": {
    "apiGateway": {
      "url": "https://tu-api-gateway.com/config",
      "apiKey": "tu_api_key",
      "environment": "staging"  // dev, staging, prod
    }
  }
}
```

Luego modifica `envConfig.ts` para enviar el header:

```typescript
const response = await fetch(url, {
  headers: {
    'X-Integration-Key': apiKey,
    'X-Environment': Constants.expoConfig?.extra?.apiGateway?.environment || 'production'
  }
});
```

### Opción 2: URLs Diferentes

Ten múltiples URLs en el API Gateway:

```
https://api-gateway.com/config/production
https://api-gateway.com/config/staging
https://api-gateway.com/config/development
```

Y cambia la URL en `app.json` según el ambiente que necesites.

### Opción 3: API Keys Diferentes

Usa diferentes API keys para diferentes ambientes:

```javascript
if (apiKey === 'prod_key_123') {
  return environments.production;
} else if (apiKey === 'staging_key_456') {
  return environments.staging;
} else if (apiKey === 'dev_key_789') {
  return environments.development;
}
```

## Limpiar Caché

Si cambias la configuración en el API Gateway, los usuarios con caché antiguo no verán los cambios hasta que:

### Opción 1: Limpiar Caché Manualmente

Los usuarios pueden:
1. Ir a Configuración del dispositivo
2. Aplicaciones → DogCatify
3. Borrar datos de la aplicación

### Opción 2: Agregar TTL a la Caché

Modifica `envConfig.ts` para agregar expiración:

```typescript
private async _saveToCache(config: EnvironmentVariables): Promise<void> {
  const cacheData = {
    config,
    expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 horas
  };
  await AsyncStorage.setItem('@env_config', JSON.stringify(cacheData));
}

private async _loadFromCache(): Promise<EnvironmentVariables | null> {
  const cached = await AsyncStorage.getItem('@env_config');
  if (cached) {
    const { config, expiresAt } = JSON.parse(cached);
    if (Date.now() < expiresAt) {
      return config;
    }
    // Cache expirado
    await this.clearCache();
  }
  return null;
}
```

### Opción 3: Botón "Actualizar Configuración"

Agrega un botón en la app que ejecute:

```typescript
await envConfig.clearCache();
await envConfig.reload();
```

## Testing

### Test en Desarrollo

```bash
# Con expo dev
npm run dev

# Debería usar .env
# Logs: "Development mode: Loading from process.env..."
```

### Test en Producción

```bash
# Compilar APK
eas build --platform android --profile preview

# Instalar en dispositivo
# Debería usar API Gateway
# Logs: "Production mode: Using API Gateway ONLY"
```

### Test del API Gateway

```bash
# Test directo
curl -H "X-Integration-Key: tu_api_key" https://tu-api-gateway.com/config

# Test con ambiente específico
curl -H "X-Integration-Key: tu_api_key" \
     -H "X-Environment: staging" \
     https://tu-api-gateway.com/config
```

## Troubleshooting

### Error: "Build de producción requiere configuración de API Gateway"

**Causa:** `app.json` no tiene la configuración del API Gateway

**Solución:**
```json
{
  "expo": {
    "extra": {
      "apiGateway": {
        "url": "https://tu-api-gateway.com/config",
        "apiKey": "tu_api_key"
      }
    }
  }
}
```

### Error: "No se pudo conectar al servidor"

**Causa:** El API Gateway no responde o hay problemas de red

**Solución:**
1. Verifica que el API Gateway esté activo
2. Verifica la URL en app.json
3. Verifica la API Key
4. Comprueba que el servidor responda correctamente:
   ```bash
   curl -I https://tu-api-gateway.com/config
   ```

### Error: "Unauthorized"

**Causa:** API Key incorrecta

**Solución:**
1. Verifica que la API Key en app.json sea correcta
2. Verifica que el API Gateway valide correctamente el header

### App se queda en "Cargando configuración..."

**Causa:** API Gateway tarda mucho o no responde

**Solución:**
1. Verifica los logs: `adb logcat | grep EnvConfig`
2. Comprueba que el API Gateway responda en < 60 segundos
3. Verifica la conexión a internet del dispositivo

## Mejores Prácticas

### 🔒 Seguridad

1. **Usa HTTPS:** El API Gateway DEBE usar HTTPS
2. **API Key segura:** Usa una API Key larga y aleatoria
3. **Rate limiting:** Implementa rate limiting en el API Gateway
4. **Rotación de keys:** Cambia la API Key periódicamente

### ⚡ Performance

1. **CDN:** Usa un CDN para el API Gateway si es posible
2. **Caché:** La app cachea la configuración automáticamente
3. **Timeout:** 60 segundos es suficiente para la mayoría de casos
4. **Reintentos:** 3 reintentos con delay de 2 segundos

### 📊 Monitoring

1. **Logs:** Monitorea los logs del API Gateway
2. **Alertas:** Configura alertas si el API Gateway falla
3. **Métricas:** Track cuántas apps solicitan configuración
4. **Versión:** Incluye versión de la app en los requests

## Conclusión

Esta arquitectura te permite:

- ✅ Un solo APK para múltiples ambientes
- ✅ Cambiar configuración sin recompilar
- ✅ Mantener credenciales seguras
- ✅ Flexibilidad total en la configuración
- ✅ Desarrollo local rápido sin API Gateway

La clave es mantener el API Gateway disponible y con buena performance, ya que es crítico para que los APKs funcionen correctamente.
