# DataDog - Guía de Uso

## Configuración

DataDog ha sido configurado para gestionar logs en toda la aplicación.

### Variables de Entorno

Las credenciales están configuradas en dos lugares:

1. **Archivo `.env`** (para desarrollo web):
```env
EXPO_PUBLIC_DATADOG_CLIENT_TOKEN=068208a98b131a96831ca92a86d4f158
EXPO_PUBLIC_DATADOG_APPLICATION_ID=dogcatify-app
EXPO_PUBLIC_DATADOG_ENV=production
```

2. **Archivo `app.json`** (para iOS/Android):
```json
{
  "expo": {
    "extra": {
      "DATADOG_CLIENT_TOKEN": "068208a98b131a96831ca92a86d4f158",
      "DATADOG_APPLICATION_ID": "dogcatify-app",
      "DATADOG_ENV": "production"
    }
  }
}
```

### Metro Config

El `metro.config.js` está configurado para incluir el plugin de DataDog que permite el source mapping correcto.

## Importar el Logger

```typescript
import { logger } from '@/utils/datadogLogger';
```

## Métodos Disponibles

### 1. Logs de Información

```typescript
logger.info('Usuario inició sesión', {
  userId: user.id,
  email: user.email
});
```

### 2. Logs de Debug

```typescript
logger.debug('Procesando solicitud', {
  requestId: '123',
  method: 'POST'
});
```

### 3. Logs de Advertencia

```typescript
logger.warn('Configuración faltante', {
  missingField: 'apiKey'
});
```

### 4. Logs de Error

```typescript
try {
  // código que puede fallar
} catch (error) {
  logger.error('Error procesando pago', error as Error, {
    orderId: '456',
    amount: 100
  });
}
```

### 5. Tracking de Errores

```typescript
logger.trackError(error, 'PaymentProcessor', {
  orderId: '789',
  userId: 'user123'
});
```

## Configurar Usuario

Cuando un usuario inicia sesión, se debe configurar su información en DataDog:

```typescript
logger.setUser(userId, {
  email: userEmail,
  displayName: userName,
  isPartner: false
});
```

Esto ya está implementado automáticamente en `AuthContext`.

## Limpiar Usuario

Cuando un usuario cierra sesión:

```typescript
logger.clearUser();
```

Esto también está implementado automáticamente en `AuthContext`.

## Agregar Atributos Personalizados

```typescript
logger.addAttribute('version', '9.0.0');
logger.addAttribute('feature_flag', 'new_checkout');
```

## Ejemplo Completo

```typescript
import { logger } from '@/utils/datadogLogger';

async function processPayment(orderId: string, amount: number) {
  logger.info('Iniciando proceso de pago', {
    orderId,
    amount
  });

  try {
    const result = await paymentAPI.charge(amount);

    logger.info('Pago procesado exitosamente', {
      orderId,
      transactionId: result.id
    });

    return result;
  } catch (error) {
    logger.error('Error procesando pago', error as Error, {
      orderId,
      amount
    });

    throw error;
  }
}
```

## Plataformas y Compatibilidad

### ✅ Builds Nativos (iOS/Android)
- DataDog está **completamente funcional** en builds nativos de producción
- Los logs se envían automáticamente al servidor de DataDog
- Incluye tracking de errores, performance y sesiones de usuario

### 🔧 Expo Go (Desarrollo)
- DataDog **NO funciona** en Expo Go porque requiere módulos nativos
- Los logs se muestran solo en la consola durante el desarrollo
- Esto es **normal** y no afecta la funcionalidad en producción

### 🌐 Web
- Los logs se muestran en la consola del navegador solamente
- DataDog SDK no es compatible con plataformas web

**Nota Técnica**: El SDK de DataDog se carga dinámicamente usando `require()` solo en plataformas nativas (iOS/Android), evitando errores de importación en web. Los errores durante el desarrollo en Expo Go son esperados y se pueden ignorar.

## Contextos con Logging Integrado

Los siguientes contextos ya tienen DataDog integrado:

1. **AuthContext**: Logs de login, logout, errores de autenticación
2. **RootLayout**: Logs de navegación, deep links, errores globales
3. **MercadoPago Utils**: Logs de pagos, configuración de MP, errores de API

## Verificar Configuración

Para verificar que DataDog está correctamente configurado:

```bash
npm run test:datadog
```

Este script verificará:
- ✅ Variables de entorno en `.env`
- ✅ Configuración en `app.json`
- ✅ Metro config para DataDog
- ✅ Logger correctamente implementado
- ✅ Dependencias instaladas

## Ver Logs en DataDog

1. Accede a tu dashboard de DataDog: https://app.datadoghq.com/
2. Navega a **Logs** en el menú lateral
3. Filtra por:
   - `env:production` - Ver logs de producción
   - `@userId:<id>` - Ver logs de un usuario específico
   - `status:error` - Ver solo errores
   - `source:<nombre>` - Ver logs de una fuente específica

## Probar DataDog en Producción

Para probar DataDog en un dispositivo real, necesitas hacer un build nativo:

### Android (Development Build)
```bash
# Crear un build de desarrollo
eas build --profile development --platform android

# O si no usas EAS
npx expo run:android
```

### iOS (Development Build)
```bash
# Crear un build de desarrollo
eas build --profile development --platform ios

# O si no usas EAS
npx expo run:ios
```

Una vez que la app esté instalada en un dispositivo físico o emulador con el build nativo, DataDog funcionará correctamente y verás el mensaje:
```
✅ DataDog initialized successfully
```

## Best Practices

1. **Incluye contexto relevante**: Siempre agrega información útil en el objeto de contexto
2. **No loguees información sensible**: Evita loguear contraseñas, tokens completos, etc.
3. **Usa niveles apropiados**:
   - `debug`: Información detallada para debugging
   - `info`: Eventos importantes del flujo normal
   - `warn`: Situaciones inusuales pero manejables
   - `error`: Errores que necesitan atención
4. **Prefijos consistentes**: Usa prefijos para identificar módulos fácilmente

## Solución de Problemas

### Error: "Failed to initialize DataDog"
- ✅ **Normal en Expo Go**: Este error es esperado durante el desarrollo
- ✅ **Solución**: Ignora el error, los logs funcionarán en consola
- ✅ **Para probar DataDog**: Crea un build nativo (ver sección anterior)

### Warning: "Debug ID not found"
- ✅ **Normal en desarrollo**: Este warning puede ser ignorado
- ✅ **Se resuelve en producción**: Los source maps se generan correctamente en builds de producción
