# ✅ Checklist: Integración de Auditoría en App Móvil

**Tiempo estimado:** 30 minutos

## Paso 1: Verificar que el sistema está configurado (5 min)

- [ ] La tabla `audit_logs` existe en Supabase
- [ ] Las políticas RLS están activas
- [ ] El servicio `auditService.ts` existe en el proyecto

**Verificar:**
```sql
-- En SQL Editor de Supabase
SELECT * FROM audit_logs LIMIT 1;
```

Si la tabla no existe, ejecuta primero: `supabase/migrations/20260207000000_create_audit_logs_system.sql`

## Paso 2: Importar el servicio (2 min)

En los archivos donde quieras registrar acciones:

```typescript
import { logAction, logError, logResourceAction } from '../services/auditService';
```

## Paso 3: Registrar Login/Logout (5 min)

### En el archivo de autenticación (AuthContext.tsx o similar):

#### Login exitoso:
```typescript
// Después de autenticar exitosamente
await logAction('LOGIN', {
  status: 'success',
  details: { 
    email: user.email,
    method: 'email_password',
    platform: Platform.OS, // 'ios' o 'android'
    app_version: Constants.expoConfig?.version
  }
});
```

#### Login fallido:
```typescript
// En el catch del login
await logAction('LOGIN_FAILED', {
  status: 'error',
  error_message: error.message,
  details: { 
    email,
    reason: error.message,
    platform: Platform.OS
  }
});
```

#### Logout:
```typescript
// Antes de cerrar sesión
await logAction('LOGOUT', {
  status: 'success',
  details: { email: currentUser.email }
});
```

## Paso 4: Registrar creación de Bookings (10 min)

### En el componente/servicio de bookings:

```typescript
// Después de crear el booking exitosamente
await logResourceAction('BOOKING_CREATE', 'booking', bookingId, {
  status: 'success',
  details: {
    service_name: serviceName,
    pet_name: petName,
    date: appointmentDate,
    platform: Platform.OS,
    app_version: Constants.expoConfig?.version
  }
});

// En caso de error
try {
  const booking = await createBooking(data);
  await logResourceAction('BOOKING_CREATE', 'booking', booking.id, { status: 'success' });
} catch (error) {
  await logError(error, {
    action: 'BOOKING_CREATE',
    resource_type: 'booking',
    details: { service_id: serviceId, pet_id: petId }
  });
  throw error;
}
```

## Paso 5: Registrar transacciones de pago (8 min)

### En el componente de pagos (payment/success.tsx, payment/failure.tsx):

#### Pago exitoso:
```typescript
// En payment/success.tsx
await logResourceAction('PAYMENT_SUCCESS', 'payment', orderId, {
  status: 'success',
  details: {
    amount: totalAmount,
    method: 'mercadopago',
    order_type: type, // 'booking' o 'product'
    platform: Platform.OS
  }
});
```

#### Pago fallido:
```typescript
// En payment/failure.tsx
await logResourceAction('PAYMENT_FAILED', 'payment', orderId, {
  status: 'error',
  error_message: 'Payment declined',
  details: {
    amount: totalAmount,
    method: 'mercadopago',
    platform: Platform.OS
  }
});
```

## ✅ Verificación (5 min)

1. **Hacer login** en la app
2. **Crear un booking** de prueba
3. **Completar un pago** (o simular fallo)
4. **Ver los logs** en Supabase:

```sql
SELECT 
  created_at,
  action,
  status,
  details->>'platform' as platform,
  details->>'app_version' as version,
  user_agent
FROM audit_logs
WHERE user_agent LIKE '%DogCatify-Mobile%'
ORDER BY created_at DESC
LIMIT 10;
```

Deberías ver:
- ✅ Registro de LOGIN
- ✅ Registro de BOOKING_CREATE
- ✅ Registro de PAYMENT_SUCCESS (o PAYMENT_FAILED)

## 🎯 Ubicaciones Específicas en tu Proyecto

Basándome en tu estructura:

| Acción | Archivo | Línea aproximada | Código |
|--------|---------|------------------|--------|
| Login | `contexts/AuthContext.tsx` | Línea ~745 | Después de `setCurrentUser(user)` |
| Logout | `contexts/AuthContext.tsx` | Línea ~820 | Antes de `signOut()` |
| Booking Create | `utils/mercadoPago.ts` | Línea ~1135 | Después de `insertedOrder` |
| Payment Success | `app/payment/success.tsx` | Línea ~80 | En `fetchOrderDetails()` |
| Payment Failed | `app/payment/failure.tsx` | Línea ~70 | En el catch |

## 📱 Información de Platform

```typescript
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Agregar a los details de cada log:
{
  platform: Platform.OS,              // 'ios' o 'android'
  app_version: Constants.expoConfig?.version,
  device_name: Constants.deviceName,
  os_version: Platform.Version
}
```

## 🔍 Monitoreo en el Dashboard

Una vez implementado, podrás:
- Ver todos los logs en el Panel de Seguridad Admin
- Filtrar por platform (iOS/Android)
- Ver errores en tiempo real
- Detectar problemas antes de que los usuarios reporten

## ⚠️ Importante: User Agent

El sistema diferencia logs móviles por el User Agent. Asegúrate de que tu app configure:

```typescript
// En utils/supabase.ts o similar
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'User-Agent': `DogCatify-Mobile/${Constants.expoConfig?.version} (${Platform.OS})`,
    },
  },
});
```

## 🚀 Siguiente Paso

Después de implementar esto:
1. ✅ Sistema de auditoría funcionando
2. 📊 Datos fluyendo al panel de seguridad
3. 🔔 Alertas automáticas activadas
4. 🎯 Compliance y debugging mejorados

---

**¿Problemas?** Ver `TROUBLESHOOTING_ALERTAS.md`  
**Más detalles?** Ver `INTEGRACION_APP_MOBILE.md`
