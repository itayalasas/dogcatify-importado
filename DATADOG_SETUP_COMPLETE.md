# DataDog - Configuración Completa ✅

## Estado: IMPLEMENTADO

La integración completa de DataDog con Expo ha sido configurada correctamente.

## Paquetes Instalados

### Dependencies
```json
{
  "@datadog/mobile-react-native": "^2.13.0",
  "@datadog/mobile-react-native-navigation": "^2.13.0",
  "expo-datadog": "^54.0.0"
}
```

### Dev Dependencies
```json
{
  "@datadog/datadog-ci": "^4.1.0"
}
```

## Configuración en app.json

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      ["expo-notifications", {...}],
      "expo-updates",
      "expo-datadog"  ← ✅ Plugin agregado
    ],
    "extra": {
      "DATADOG_CLIENT_TOKEN": "068208a98b131a96831ca92a86d4f158",
      "DATADOG_APPLICATION_ID": "dogcatify-app",
      "DATADOG_ENV": "production"
    }
  }
}
```

## Configuración en eas.json

```json
{
  "build": {
    "production": {
      "env": {
        "DATADOG_API_KEY": "068208a98b131a96831ca92a86d4f158",
        "DATADOG_SITE": "datadoghq.com"
      }
    }
  }
}
```

## ¿Qué se subió automáticamente?

Durante cada build de EAS, el plugin `expo-datadog` subirá automáticamente:

1. **iOS dSYMs** - Símbolos de debug para iOS
2. **Android ProGuard mapping files** - Mapeo de ofuscación de Android
3. **Source Maps** - Para ambas plataformas (iOS y Android)

## Funcionalidades Habilitadas

### ✅ Runtime (Ya funcionaba)
- Logs enviados a DataDog
- Métricas de rendimiento
- Tracking de usuarios
- Atributos personalizados

### ✅ Nuevo: Error Tracking Completo
- **Stack traces legibles** en crashes
- **Mapeo de código minificado** a código fuente
- **Líneas exactas** donde ocurren errores
- **Contexto completo** de errores en producción

## Inicialización del SDK

El código en `utils/datadogLogger.ts` ya está correctamente configurado:

```typescript
const config = new DdSdkReactNativeConfiguration(
  DATADOG_CLIENT_TOKEN,
  DATADOG_ENV,
  DATADOG_APPLICATION_ID,
  true, // trackInteractions
  true, // trackResources
  true  // trackErrors
);

config.site = 'US1';
config.uploadFrequency = UploadFrequency.FREQUENT;
config.trackInteractions = true;
config.trackResources = true;
config.trackErrors = true;

await DdSdkReactNative.initialize(config);
```

## Uso del Logger

```typescript
import { logger } from '@/utils/datadogLogger';

// Logs básicos
logger.debug('Debug message', { context: 'data' });
logger.info('Info message', { userId: '123' });
logger.warn('Warning message', { component: 'Cart' });
logger.error('Error occurred', error, { screen: 'Payment' });

// Tracking de errores
logger.trackError(error, 'PaymentScreen', { 
  orderId: '123',
  amount: 100 
});

// Usuario
logger.setUser(userId, { 
  email: 'user@example.com',
  plan: 'premium' 
});

// Atributos
logger.addAttribute('app_version', '9.0.0');
```

## Verificación en DataDog

Después de un build exitoso, verás en los logs de EAS:

```
✅ expo-datadog: Uploading iOS dSYMs...
✅ expo-datadog: Uploading Android ProGuard files...
✅ expo-datadog: Uploading source maps...
✅ expo-datadog: Upload complete!
```

## Comando para Build

```bash
eas build --profile production --platform android
```

## Diferencia Antes vs Después

### ANTES (Sin expo-datadog)
```
Error in PaymentScreen.tsx
  at anonymous (index.android.bundle:2345:15)
  at anonymous (index.android.bundle:8976:42)
  at anonymous (index.android.bundle:1234:9)
```
❌ No sabes qué línea del código fuente causó el error

### DESPUÉS (Con expo-datadog)
```
Error in PaymentScreen.tsx:145:18
  at processPayment (app/payment/success.tsx:145:18)
  at handleSubmit (components/PaymentModal.tsx:89:12)
  at onPress (app/cart/index.tsx:234:5)
```
✅ Ves exactamente dónde ocurrió el error en tu código fuente

## Enlaces Útiles

- **DataDog Dashboard:** https://app.datadoghq.com/
- **RUM (Real User Monitoring):** https://app.datadoghq.com/rum
- **Error Tracking:** https://app.datadoghq.com/error-tracking
- **Logs:** https://app.datadoghq.com/logs

## Notas Importantes

1. **API Key vs Client Token:**
   - **API Key** (`DATADOG_API_KEY`): Para subir archivos durante el build (server-side)
   - **Client Token** (`DATADOG_CLIENT_TOKEN`): Para enviar datos desde la app (client-side)

2. **Site Configuration:**
   - Configurado para `datadoghq.com` (US1)
   - Si usas otra región, cambia en `eas.json`

3. **Environment:**
   - Configurado como `production`
   - Cambia `DATADOG_ENV` en `app.json > extra` si necesitas otro ambiente

## Resumen

✅ **expo-datadog**: Instalado (v54.0.0)
✅ **@datadog/datadog-ci**: Instalado (v4.1.0)
✅ **Plugin configurado**: En app.json
✅ **API Key configurada**: En eas.json
✅ **Client Token configurado**: En app.json
✅ **Inicialización**: Ya estaba en datadogLogger.ts
✅ **JSON válidos**: Verificados

**Estado:** 🚀 Listo para build con DataDog completo

---

**Fecha de configuración:** 31 de Octubre 2025
