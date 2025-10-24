# 🚨 Sentry Quick Start - DogCatiFy

## ¿Qué es Sentry?

Sentry te permite ver EXACTAMENTE qué errores están ocurriendo en tu app, incluyendo:
- Stack traces completos
- Información del dispositivo (modelo, OS, versión)
- Contexto del usuario
- Breadcrumbs (qué hizo el usuario antes del error)

## 🎯 Configuración en 2 Pasos

### Paso 1: Crear Token de Sentry

1. Ve a: https://sentry.io/settings/ayala-it-sas/auth-tokens/
2. Click en "Create New Token"
3. Permisos necesarios:
   - ✅ `project:releases`
   - ✅ `org:read`
4. Copia el token generado

### Paso 2: Configurar en EAS

```bash
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <tu-token-aquí>
```

**¡Listo!** Ahora cuando hagas builds, Sentry capturará todos los errores.

## 🧪 Probar Ahora

Agrega este código a cualquier botón en tu app:

```tsx
import * as Sentry from '@sentry/react-native';

<Button
  title="Probar Sentry"
  onPress={() => {
    Sentry.captureException(new Error('Probando Sentry desde la app'));
  }}
/>
```

Luego:
1. Presiona el botón
2. Ve a: https://ayala-it-sas.sentry.io/issues/
3. Verás el error aparecer en segundos

## 🏗️ Hacer un Build

```bash
# Build de desarrollo
eas build --profile development --platform android

# Build de producción
eas build --profile production --platform android
```

## 🔍 Ver Errores

Dashboard: https://ayala-it-sas.sentry.io/issues/

Desde aquí puedes:
- Ver todos los errores en tiempo real
- Filtrar por versión, dispositivo, usuario
- Ver stack traces completos con código fuente
- Reproducir el error con breadcrumbs

## 💡 Tips

### Capturar errores manualmente:

```tsx
try {
  // código que puede fallar
} catch (error) {
  Sentry.captureException(error);
}
```

### Agregar contexto:

```tsx
Sentry.setContext('order', {
  id: orderId,
  amount: total,
  status: 'pending'
});
```

### Agregar tags:

```tsx
Sentry.setTag('payment_method', 'mercadopago');
```

### Agregar breadcrumbs:

```tsx
Sentry.addBreadcrumb({
  message: 'Usuario agregó producto al carrito',
  data: {
    productId: '123',
    quantity: 2
  }
});
```

## ⚠️ Debugging del Build Congelado

Con Sentry ahora activo:

1. Haz el build en EAS
2. Si se congela, ve inmediatamente a tu dashboard de Sentry
3. Verás el error exacto que causó el congelamiento
4. Obtendrás el stack trace completo
5. Podrás ver qué componente o contexto falló

## 📚 Más Info

- Docs oficiales: https://docs.sentry.io/platforms/react-native/
- Dashboard: https://ayala-it-sas.sentry.io
- Issues: https://ayala-it-sas.sentry.io/issues/

## 🆘 Problemas Comunes

### "Build falla al subir source maps"
- Verifica que el token SENTRY_AUTH_TOKEN esté configurado en EAS
- Asegúrate que el token tenga los permisos correctos

### "No veo errores en Sentry"
- Verifica que la app esté conectada a internet
- Asegúrate que no estés en Expo Go (Sentry solo funciona en builds nativos)
- Revisa que el DSN sea correcto en `app/_layout.tsx`

### "Errores sin source maps"
- Necesitas configurar el token de autenticación
- Los source maps solo se suben en builds de EAS, no en desarrollo local
