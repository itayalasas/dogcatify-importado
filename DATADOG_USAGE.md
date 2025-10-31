# DataDog - Guía de Uso

## Configuración

DataDog ha sido configurado para gestionar logs en toda la aplicación. El token de cliente está configurado en el archivo `.env`:

```env
EXPO_PUBLIC_DATADOG_CLIENT_TOKEN=068208a98b131a96831ca92a86d4f158
EXPO_PUBLIC_DATADOG_APPLICATION_ID=dogcatify-app
EXPO_PUBLIC_DATADOG_ENV=production
```

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

## Plataformas

- **iOS/Android**: DataDog está completamente funcional y envía logs automáticamente al servidor de DataDog
- **Web**: Los logs se muestran en la consola del navegador solamente (DataDog SDK no es compatible con web)

**Nota Técnica**: El SDK de DataDog se carga dinámicamente usando `require()` solo en plataformas nativas (iOS/Android), evitando errores de importación en web.

## Contextos con Logging Integrado

Los siguientes contextos ya tienen DataDog integrado:

1. **AuthContext**: Logs de login, logout, errores de autenticación
2. **RootLayout**: Logs de navegación, deep links, errores globales
3. **MercadoPago Utils**: Logs de pagos, configuración de MP, errores de API

## Ver Logs en DataDog

1. Accede a tu dashboard de DataDog: https://app.datadoghq.com/
2. Navega a **Logs** en el menú lateral
3. Filtra por:
   - `env:production` - Ver logs de producción
   - `@userId:<id>` - Ver logs de un usuario específico
   - `status:error` - Ver solo errores
   - `source:<nombre>` - Ver logs de una fuente específica

## Best Practices

1. **Incluye contexto relevante**: Siempre agrega información útil en el objeto de contexto
2. **No loguees información sensible**: Evita loguear contraseñas, tokens completos, etc.
3. **Usa niveles apropiados**:
   - `debug`: Información detallada para debugging
   - `info`: Eventos importantes del flujo normal
   - `warn`: Situaciones inusuales pero manejables
   - `error`: Errores que necesitan atención
4. **Prefijos consistentes**: Usa prefijos para identificar módulos fácilmente
