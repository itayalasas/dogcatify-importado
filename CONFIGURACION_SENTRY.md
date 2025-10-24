# Configuración de Sentry en DogCatiFy

## ✅ Configuración Completada

Se ha instalado y configurado Sentry en tu proyecto para monitorear errores en tiempo real.

### Cambios Realizados

1. **Instalado Sentry SDK**: `@sentry/react-native@^7.4.0`
2. **Configurado en `app/_layout.tsx`**: Sentry captura todos los errores globales
3. **Actualizado `app.json`**: Plugin de Sentry agregado
4. **Configurado `metro.config.js`**: Source maps habilitados para debugging
5. **Actualizado `eas.json`**: Variables de entorno para builds

### DSN de Sentry

```
https://3e97e088cc3f4f2d8e8c0eddcfe2ede4@o4510242662449152.ingest.us.sentry.io/4510242664808448
```

## 🔐 Paso Final Requerido

Para que los source maps se suban automáticamente a Sentry durante los builds, necesitas configurar tu token de autenticación:

### Opción 1: En EAS Build (Recomendado)

1. Ve a https://sentry.io/settings/ayala-it-sas/auth-tokens/
2. Crea un nuevo token con permisos:
   - `project:releases`
   - `org:read`
3. Copia el token
4. En tu proyecto, ejecuta:

```bash
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <tu-token>
```

### Opción 2: Archivo Local (Para desarrollo)

Crea un archivo `.sentryclirc` en la raíz del proyecto:

```ini
[auth]
token=<tu-token-aquí>
```

**IMPORTANTE**: Este archivo está en `.gitignore` y NO se debe subir a git.

## 🧪 Probar la Integración

### En Desarrollo Local

Agrega un botón de prueba en cualquier pantalla:

```tsx
import * as Sentry from '@sentry/react-native';

<Button
  title="Probar Sentry"
  onPress={() => {
    Sentry.captureException(new Error('Test error from app'));
  }}
/>
```

### Monitorear Errores

1. Ve a tu dashboard de Sentry: https://ayala-it-sas.sentry.io/issues/
2. Los errores deberían aparecer en segundos
3. Verás stack traces completos, información del dispositivo, y más

## 📊 Beneficios de Sentry

- **Captura automática de errores**: No crashes silenciosos
- **Stack traces completos**: Con source maps para debugging fácil
- **Información del contexto**: Dispositivo, OS, versión de la app
- **Performance monitoring**: Con `tracesSampleRate: 1.0`
- **Release tracking**: Asocia errores con versiones específicas

## 🚀 Próximos Pasos para el Build

Cuando hagas el build en EAS:

```bash
# Development build
eas build --profile development --platform android

# Production build
eas build --profile production --platform android
```

Sentry:
- ✅ Capturará errores automáticamente
- ✅ Subirá source maps (si configuraste el token)
- ✅ Asociará errores con la versión específica del build

## 🔍 Debugging del Build Congelado

Con Sentry configurado, ahora podrás:

1. Ver exactamente dónde se congela el build
2. Recibir stack traces completos
3. Identificar el componente o contexto problemático
4. Ver logs de todos los errores previos al congelamiento

Si el build se congela nuevamente, revisa tu dashboard de Sentry inmediatamente después para ver qué error ocurrió.

## 📝 Notas Adicionales

- Sentry está configurado para NO ejecutarse en Expo Go (`enableNative: !isRunningInExpoGo()`)
- El modo debug está habilitado solo en `__DEV__`
- Los errores se capturan tanto síncronos como promesas rechazadas
- El componente raíz está wrapeado con `Sentry.wrap()` para captura completa

## 🆘 Soporte

- Dashboard: https://ayala-it-sas.sentry.io
- Documentación: https://docs.sentry.io/platforms/react-native/
- Issues del proyecto: https://ayala-it-sas.sentry.io/issues/
