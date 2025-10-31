# 📊 Logging Implementado con DataDog

## Resumen General

Se ha implementado logging exhaustivo en los componentes más críticos de la aplicación. Todos los logs se envían a DataDog en producción y se muestran en consola durante el desarrollo.

## ✅ Módulos con Logging Completo

### 1. Sistema de Autenticación
**Archivo**: `contexts/AuthContext.tsx`

Eventos registrados:
- ✅ Login de usuario (exitoso/fallido)
- ✅ Logout de usuario
- ✅ Registro de nuevos usuarios
- ✅ Cambio de contraseña
- ✅ Restauración de sesión
- ✅ Errores de autenticación
- ✅ Actualización de perfil de usuario

Ejemplo de logs:
```typescript
logger.info('User logged in successfully', { userId, email });
logger.error('Login failed', error, { email, provider });
```

### 2. Carrito de Compras
**Archivo**: `contexts/CartContext.tsx`

Eventos registrados:
- ✅ Carga del carrito desde Supabase
- ✅ Guardado del carrito
- ✅ Agregar productos al carrito
- ✅ Actualizar cantidades
- ✅ Eliminar productos
- ✅ Limpiar carrito
- ✅ Validaciones de stock
- ✅ Errores de sincronización con base de datos

Ejemplo de logs:
```typescript
logger.info('Adding item to cart', { itemId, itemName, quantity, price, partnerId });
logger.warn('Cannot add item - exceeds stock', { itemId, maxStock, currentQuantity });
```

### 3. Sistema de Ubicación
**Archivo**: `contexts/LocationContext.tsx`

Eventos registrados:
- ✅ Verificación de permisos de ubicación
- ✅ Solicitud de permisos
- ✅ Obtención de ubicación actual
- ✅ Errores de geolocalización
- ✅ Diferenciación entre plataformas (web/móvil)

Ejemplo de logs:
```typescript
logger.info('Location permission status checked', { status, platform });
logger.info('Location obtained successfully', { latitude, longitude, accuracy });
```

### 4. Subida de Imágenes
**Archivo**: `utils/imageUpload.ts`

Eventos registrados:
- ✅ Inicio de subida de imagen
- ✅ Validación de URI
- ✅ Fetch de imagen local
- ✅ Conversión a blob y ArrayBuffer
- ✅ Upload a Supabase Storage
- ✅ Generación de URL pública
- ✅ Todos los errores en el proceso

Ejemplo de logs:
```typescript
logger.info('Starting image upload', { path, bucket });
logger.info('Image uploaded successfully', { path, publicUrl });
logger.error('Supabase storage upload error', error, { path, bucket });
```

### 5. Sistema de Pagos (MercadoPago)
**Archivo**: `utils/mercadoPago.ts`

Eventos registrados:
- ✅ Creación de preferencias de pago
- ✅ Configuración de credenciales
- ✅ Detección de ambiente (sandbox/production)
- ✅ Actualización de configuración de partners
- ✅ Errores de API de MercadoPago
- ✅ Procesamiento de webhooks

Ejemplo de logs:
```typescript
logger.info('Creating MercadoPago preference', { orderId, amount, items: itemCount });
logger.error('MercadoPago API error', error, { orderId, partner_id });
```

### 6. Navegación y Ciclo de Vida
**Archivo**: `app/_layout.tsx`

Eventos registrados:
- ✅ Inicialización de la aplicación
- ✅ Errores globales no capturados
- ✅ Eventos de navegación
- ✅ Deep links
- ✅ Inicialización de DataDog

Ejemplo de logs:
```typescript
logger.info('App initialized successfully');
logger.error('Uncaught error in app', error, { route: currentRoute });
```

## 📈 Tipos de Logs Implementados

### Debug (logger.debug)
- Información detallada para debugging
- Estados intermedios en procesos complejos
- Verificaciones internas

### Info (logger.info)
- Eventos importantes del flujo normal
- Acciones de usuario exitosas
- Transiciones de estado relevantes

### Warning (logger.warn)
- Situaciones inusuales pero manejables
- Validaciones fallidas (ej: stock excedido)
- Configuraciones faltantes

### Error (logger.error)
- Errores que requieren atención
- Fallos en operaciones críticas
- Excepciones capturadas

## 🔍 Contexto en los Logs

Cada log incluye información contextual relevante:

```typescript
// Ejemplo de contexto rico
logger.info('Order created', {
  orderId: order.id,
  userId: user.id,
  totalAmount: order.total,
  itemCount: order.items.length,
  partnerId: order.partner_id,
  paymentMethod: order.payment_method
});
```

## 📊 Métricas Rastreadas

### Autenticación
- Tasa de éxito/fallo de logins
- Tiempo de sesión de usuarios
- Errores de autenticación por tipo

### Carrito
- Productos más agregados/eliminados
- Stock insuficiente (frecuencia)
- Tiempo de permanencia en carrito

### Ubicación
- Permisos otorgados vs denegados
- Precisión de ubicación obtenida
- Errores de geolocalización

### Imágenes
- Tamaño promedio de imágenes
- Tiempo de subida
- Tasa de éxito/fallo

### Pagos
- Preferencias creadas vs pagos completados
- Errores de MercadoPago por tipo
- Webhooks recibidos y procesados

## 🎯 Cómo Usar los Logs en DataDog

### Ver Logs en Tiempo Real
1. Accede a https://app.datadoghq.com/
2. Ve a **Logs** en el menú lateral
3. Filtros útiles:
   ```
   env:production
   status:error
   @userId:<user-id>
   service:mobile-app
   ```

### Crear Alertas
Puedes crear alertas en DataDog para:
- Errores de autenticación > 10 en 5 minutos
- Fallos de pago > 5 en 10 minutos
- Errores de subida de imágenes > 20 en 15 minutos

### Dashboards Recomendados
1. **Usuario Activity**: Logins, logouts, acciones en carrito
2. **Payment Funnel**: Desde crear orden hasta pago completado
3. **Error Tracking**: Todos los errores agrupados por tipo
4. **Performance**: Tiempos de respuesta de operaciones críticas

## 🔐 Seguridad y Privacidad

### ✅ Lo que SÍ se loguea:
- IDs de usuarios, productos, órdenes
- Tipos de errores y códigos
- Métricas numéricas (cantidades, montos)
- Estados y transiciones

### ❌ Lo que NO se loguea:
- Contraseñas
- Tokens completos (solo primeros caracteres)
- Información de tarjetas de crédito
- Datos personales sensibles (teléfono, dirección completa)

## 📚 Próximos Pasos

Para agregar logging a otros módulos, sigue este patrón:

```typescript
import { logger } from '../utils/datadogLogger';

async function importantFunction() {
  logger.info('Starting important function', { param1, param2 });

  try {
    // tu código aquí
    const result = await someOperation();

    logger.info('Operation completed', { result });
    return result;
  } catch (error) {
    logger.error('Operation failed', error as Error, { param1, param2 });
    throw error;
  }
}
```

## 📖 Referencias

- **Configuración**: `DATADOG_SETUP_COMPLETE.md`
- **Guía de Uso**: `DATADOG_USAGE.md`
- **Script de Verificación**: `npm run test:datadog`
