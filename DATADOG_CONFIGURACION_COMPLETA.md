# 📊 Configuración Completa de Datadog para Dogcatify

## ✅ Estado Actual

Tu proyecto **YA TIENE** Datadog integrado y configurado. Solo necesitas actualizar las credenciales correctas.

---

## 🔑 Paso 1: Obtener Credenciales de Datadog

### 1.1 Acceder a Datadog
- URL: https://us5.datadoghq.com
- Inicia sesión con tu cuenta

### 1.2 Obtener Application ID (RUM)

**Opción A: Crear Nueva Aplicación**
1. Ve a: `UX Monitoring` → `Setup & Configuration` → `RUM Applications`
2. Click en **`New Application`**
3. Selecciona: **`React Native`**
4. Nombre: `Dogcatify Mobile App`
5. Copia el **Application ID** generado

**Opción B: Usar Aplicación Existente**
1. Ve a: https://us5.datadoghq.com/rum/list
2. Busca tu aplicación existente
3. Click en el nombre de la aplicación
4. Ve a **`Setup & Configuration`**
5. Copia el **Application ID** (formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### 1.3 Obtener Client Token

1. Ve a: `Organization Settings` → `Client Tokens`
   - URL directa: https://us5.datadoghq.com/organization-settings/client-tokens
2. **Opción A:** Crea un nuevo token:
   - Click **`New Client Token`**
   - Nombre: `Dogcatify Mobile`
   - Click **`Create`**
3. **Opción B:** Usa un token existente
4. Copia el **Client Token** completo

### 1.4 Confirmar tu Site
- Tu Datadog Site es: **`US5`**
- Confirmado por tu URL: `us5.datadoghq.com`

---

## 📝 Paso 2: Actualizar Variables de Entorno

Abre tu archivo `.env` y actualiza estas líneas:

```env
# DataDog Configuration
EXPO_PUBLIC_DATADOG_CLIENT_TOKEN=pub1234567890abcdef1234567890abcd  # ← Reemplaza con tu Client Token
EXPO_PUBLIC_DATADOG_APPLICATION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  # ← Reemplaza con tu Application ID
EXPO_PUBLIC_DATADOG_ENV=production  # ← production / staging / development
EXPO_PUBLIC_DATADOG_SITE=US5  # ← Ya configurado
```

### Ejemplo de Valores Correctos:
```env
EXPO_PUBLIC_DATADOG_CLIENT_TOKEN=pub7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2
EXPO_PUBLIC_DATADOG_APPLICATION_ID=12345678-abcd-1234-efgh-567890abcdef
EXPO_PUBLIC_DATADOG_ENV=production
EXPO_PUBLIC_DATADOG_SITE=US5
```

---

## 🔧 Paso 3: Verificar Configuración

### 3.1 Archivos Ya Configurados ✅

Tu proyecto ya tiene estos archivos listos:

1. **`utils/datadogLogger.ts`** ✅
   - SDK inicializado
   - Logging configurado
   - Error tracking habilitado
   - User tracking habilitado

2. **`app/_layout.tsx`** ✅
   - Datadog inicializado en el root
   - Global error handler configurado
   - Unhandled promise rejection capturado

### 3.2 Funciones Disponibles

```typescript
import { logger } from '@/utils/datadogLogger';

// Logs básicos
logger.debug('Debug message', { key: 'value' });
logger.info('Info message', { key: 'value' });
logger.warn('Warning message', { key: 'value' });
logger.error('Error message', new Error('details'), { key: 'value' });

// Tracking de errores
logger.trackError(error, 'ComponentName', { context: 'additional info' });

// User tracking
logger.setUser(userId, {
  email: 'user@example.com',
  name: 'User Name',
  plan: 'premium'
});

// Clear user (logout)
logger.clearUser();

// Custom attributes
logger.addAttribute('customKey', 'customValue');
```

---

## 📱 Paso 4: Build para Android/iOS

### 4.1 Importante: Datadog NO funciona en Expo Go

Datadog **requiere native code** y solo funciona en:
- ✅ Development Builds (EAS Build)
- ✅ Production Builds
- ❌ Expo Go (no soportado)

### 4.2 Crear Development Build

```bash
# Android
eas build --profile development --platform android

# iOS
eas build --profile development --platform ios
```

### 4.3 Crear Production Build

```bash
# Android
eas build --profile production --platform android

# iOS
eas build --profile production --platform ios
```

---

## 📊 Paso 5: Verificar que Funciona

### 5.1 En la App (después de build)

1. Abre la app en un dispositivo real
2. Navega por varias pantallas
3. Causa algunos errores intencionales (opcional)
4. Cierra la app

### 5.2 En Datadog Dashboard

1. Ve a: https://us5.datadoghq.com/rum/explorer
2. Deberías ver:
   - **Sessions**: Sesiones de usuarios
   - **Views**: Pantallas visitadas
   - **Actions**: Clicks y interacciones
   - **Errors**: Errores capturados
   - **Resources**: Llamadas a APIs

3. Ve a: https://us5.datadoghq.com/logs/livetail
   - Verás los logs en tiempo real

---

## 🎯 Qué Monitorea Datadog en Tu App

### ✅ Ya Configurado

| Feature | Estado | Descripción |
|---------|--------|-------------|
| **RUM (Real User Monitoring)** | ✅ | Navegación, vistas, interacciones |
| **Error Tracking** | ✅ | Errores de JavaScript y crashes |
| **Logs** | ✅ | Debug, info, warn, error logs |
| **User Sessions** | ✅ | Sesiones de usuarios identificados |
| **Network Monitoring** | ✅ | Llamadas HTTP/API tracking |
| **Interactions** | ✅ | Clicks, taps, scrolls |
| **Performance** | ✅ | Tiempos de carga, lag |
| **Frustrations** | ✅ | Dead clicks, rage clicks |
| **Background Events** | ✅ | Eventos cuando app está en background |

---

## 🔍 Ejemplos de Uso en Tu Código

### Ejemplo 1: Login Screen

```typescript
// app/auth/login.tsx
import { logger } from '@/utils/datadogLogger';

const handleLogin = async (email: string, password: string) => {
  try {
    logger.info('Login attempt', { email });

    const result = await supabase.auth.signInWithPassword({ email, password });

    if (result.error) throw result.error;

    logger.setUser(result.data.user.id, {
      email: result.data.user.email,
    });

    logger.info('Login successful', { userId: result.data.user.id });
  } catch (error) {
    logger.error('Login failed', error, { email });
  }
};
```

### Ejemplo 2: API Calls

```typescript
// Anywhere in your code
const fetchProducts = async () => {
  try {
    logger.debug('Fetching products');

    const { data, error } = await supabase
      .from('products')
      .select('*');

    if (error) throw error;

    logger.info('Products fetched successfully', { count: data.length });
    return data;
  } catch (error) {
    logger.trackError(error, 'ProductsFetch', {
      operation: 'fetch',
      table: 'products'
    });
  }
};
```

### Ejemplo 3: User Actions

```typescript
// Track important user actions
const handlePurchase = async (orderId: string) => {
  logger.info('Purchase initiated', { orderId });

  try {
    // ... purchase logic
    logger.info('Purchase completed', { orderId, amount });
  } catch (error) {
    logger.error('Purchase failed', error, { orderId });
  }
};
```

---

## 🚨 Troubleshooting

### Problema: No veo logs en Datadog

**Posibles causas:**
1. ❌ Estás usando Expo Go → **Solución:** Usa EAS Build
2. ❌ Client Token incorrecto → **Solución:** Verifica en Datadog
3. ❌ Application ID incorrecto → **Solución:** Verifica en Datadog
4. ❌ Site incorrecto → **Solución:** Debe ser `US5`

### Problema: Error al inicializar

**Posibles causas:**
1. Variables de entorno no cargadas → **Solución:** Reinicia el dev server
2. Build no actualizado → **Solución:** Rebuild con `eas build`

---

## 📖 Recursos Adicionales

- **Datadog React Native Docs**: https://docs.datadoghq.com/real_user_monitoring/reactnative/
- **RUM Dashboard**: https://us5.datadoghq.com/rum/explorer
- **Logs Dashboard**: https://us5.datadoghq.com/logs/livetail
- **APM**: https://us5.datadoghq.com/apm/home

---

## 🎉 Resultado Esperado

Una vez configurado correctamente, podrás:

1. ✅ Ver sesiones de usuarios en tiempo real
2. ✅ Monitorear errores y crashes
3. ✅ Analizar performance de la app
4. ✅ Trackear flujos de usuarios
5. ✅ Recibir alertas de problemas
6. ✅ Ver logs estructurados con contexto
7. ✅ Identificar usuarios problemáticos
8. ✅ Medir KPIs de la app

---

## 📞 Siguiente Paso

1. **Obtén tus credenciales** de Datadog siguiendo el **Paso 1**
2. **Actualiza el `.env`** con las credenciales del **Paso 2**
3. **Rebuild tu app** con `eas build` (si es necesario)
4. **Verifica los logs** en Datadog Dashboard

¡Listo! Tu app estará completamente monitoreada con Datadog 🎉
