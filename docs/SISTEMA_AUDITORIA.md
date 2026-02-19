# Sistema de Auditoría - Documentación Técnica Completa

## 📋 Índice

1. [Introducción](#introducción)
2. [Arquitectura](#arquitectura)
3. [Tabla audit_logs](#tabla-audit_logs)
4. [Servicio de Auditoría](#servicio-de-auditoría)
5. [Acciones Registradas](#acciones-registradas)
6. [Políticas RLS](#políticas-rls)
7. [Integración](#integración)
8. [Consultas Útiles](#consultas-útiles)
9. [Mantenimiento](#mantenimiento)

## Introducción

El sistema de auditoría registra todas las acciones importantes en la plataforma para:
- **Seguridad:** Detectar actividad sospechosa
- **Compliance:** Cumplir con regulaciones
- **Debugging:** Rastrear problemas
- **Analytics:** Entender el comportamiento del usuario

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    Aplicaciones                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Web App    │  │  iOS App     │  │ Android App  │  │
│  │  (React)     │  │ (Swift/RN)   │  │(Kotlin/RN)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │           │
│         └──────────────────┼──────────────────┘           │
│                            │                              │
│                  ┌─────────▼─────────┐                    │
│                  │  auditService.ts  │                    │
│                  │  - logAction()    │                    │
│                  │  - logError()     │                    │
│                  │  - logResource()  │                    │
│                  └─────────┬─────────┘                    │
└────────────────────────────┼──────────────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │   Supabase DB    │
                    │  ┌────────────┐  │
                    │  │audit_logs  │◄─┼──── RLS Policies
                    │  │  table     │  │
                    │  └────────────┘  │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  Edge Function   │
                    │ check-alert-     │
                    │  thresholds      │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  Email Alerts    │
                    │  (send-email)    │
                    └──────────────────┘
```

## Tabla audit_logs

### Estructura

```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  status text NOT NULL DEFAULT 'success', -- success, error, warning
  ip_address inet,
  user_agent text,
  details jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz DEFAULT now()
);
```

### Columnas

| Columna | Tipo | Descripción | Ejemplo |
|---------|------|-------------|---------|
| `id` | uuid | ID único del log | `550e8400-e29b-41d4-a716-446655440000` |
| `user_id` | uuid | ID del usuario (NULL para anónimos) | `123e4567-e89b-12d3-a456-426614174000` |
| `action` | text | Tipo de acción | `LOGIN`, `BOOKING_CREATE`, `PAYMENT_SUCCESS` |
| `resource_type` | text | Tipo de recurso afectado | `booking`, `order`, `payment`, `profile` |
| `resource_id` | text | ID del recurso | `abc123-def456` |
| `status` | text | Estado de la acción | `success`, `error`, `warning` |
| `ip_address` | inet | IP del cliente | `192.168.1.1` |
| `user_agent` | text | Navegador/App | `Mozilla/5.0...` o `DogCatify-Mobile/1.0` |
| `details` | jsonb | Info adicional (JSON) | `{"platform": "ios", "app_version": "1.0.0"}` |
| `error_message` | text | Mensaje de error | `Invalid credentials` |
| `created_at` | timestamptz | Fecha y hora | `2026-02-07 14:30:00+00` |

### Índices

```sql
-- Optimizar búsquedas por usuario
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

-- Optimizar búsquedas por acción
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Optimizar búsquedas por fecha
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Índice compuesto para búsquedas comunes
CREATE INDEX idx_audit_logs_user_action_time 
  ON audit_logs(user_id, action, created_at DESC);

-- Índice GIN para búsquedas en JSON
CREATE INDEX idx_audit_logs_details ON audit_logs USING gin(details);
```

## Servicio de Auditoría

### Funciones Principales

#### `logAction(action, options)`

Registra cualquier acción en el sistema.

```typescript
await logAction('LOGIN', {
  status: 'success',
  details: { method: 'email' }
});
```

**Parámetros:**
- `action`: Tipo de acción (ver lista completa abajo)
- `options`: Objeto con opciones adicionales
  - `status`: 'success' | 'error' | 'warning'
  - `resource_type`: Tipo de recurso
  - `resource_id`: ID del recurso
  - `details`: Información adicional
  - `error_message`: Mensaje de error

#### `logError(error, context)`

Registra un error con contexto.

```typescript
try {
  await createBooking(data);
} catch (error) {
  await logError(error, {
    resource_type: 'booking',
    resource_id: bookingId,
    details: { step: 'create', data }
  });
  throw error;
}
```

#### `logResourceAction(action, resourceType, resourceId, options)`

Registra una acción sobre un recurso específico.

```typescript
await logResourceAction('BOOKING_CREATE', 'booking', bookingId, {
  status: 'success',
  details: {
    service_name: 'Paseo Premium',
    pet_name: 'Luna',
    date: '2026-02-10'
  }
});
```

#### `logSensitiveAccess(resourceType, resourceId, reason)`

Registra acceso a datos sensibles (compliance).

```typescript
await logSensitiveAccess('profile', userId, 'Revisión de soporte');
```

#### `logSettingChange(settingName, oldValue, newValue)`

Registra cambios en la configuración.

```typescript
await logSettingChange('commission_rate', 5, 10);
```

## Acciones Registradas

### Autenticación

| Acción | Descripción | Ejemplo de uso |
|--------|-------------|----------------|
| `LOGIN` | Login exitoso | Usuario inicia sesión |
| `LOGIN_FAILED` | Login fallido | Credenciales incorrectas |
| `LOGIN_ERROR` | Error en login | Error de sistema |
| `LOGIN_ATTEMPT` | Intento de login | Antes de autenticar |
| `LOGOUT` | Cierre de sesión | Usuario sale |
| `PASSWORD_RESET` | Contraseña cambiada | Reseteo completado |
| `PASSWORD_RESET_REQUESTED` | Solicitud de reset | Email enviado |
| `PASSWORD_CHANGED` | Cambio de contraseña | Usuario cambió password |
| `EMAIL_VERIFIED` | Email verificado | Confirmación de email |

### Recursos - Bookings

| Acción | Descripción | Ejemplo de uso |
|--------|-------------|----------------|
| `BOOKING_CREATE` | Booking creado | Nueva reserva |
| `BOOKING_UPDATE` | Booking actualizado | Cambio de fecha/hora |
| `BOOKING_CANCEL` | Booking cancelado | Usuario cancela |
| `BOOKING_VIEW` | Booking visualizado | Ver detalles |

### Recursos - Orders

| Acción | Descripción | Ejemplo de uso |
|--------|-------------|----------------|
| `ORDER_CREATE` | Orden creada | Nueva compra |
| `ORDER_UPDATE` | Orden actualizada | Cambio de estado |
| `ORDER_CANCEL` | Orden cancelada | Usuario cancela |
| `ORDER_VIEW` | Orden visualizada | Ver detalles |

### Recursos - Payments

| Acción | Descripción | Ejemplo de uso |
|--------|-------------|----------------|
| `PAYMENT_INITIATED` | Pago iniciado | Redirige a MP |
| `PAYMENT_SUCCESS` | Pago exitoso | Pago confirmado |
| `PAYMENT_FAILED` | Pago fallido | Error en pago |
| `PAYMENT_CANCELLED` | Pago cancelado | Usuario cancela |
| `PAYMENT_PENDING` | Pago pendiente | Esperando confirmación |

### Recursos - Profile

| Acción | Descripción | Ejemplo de uso |
|--------|-------------|----------------|
| `PROFILE_CREATE` | Perfil creado | Nuevo registro |
| `PROFILE_UPDATE` | Perfil actualizado | Cambio de datos |
| `PROFILE_VIEW` | Perfil visualizado | Ver perfil |

### Recursos - Pets

| Acción | Descripción | Ejemplo de uso |
|--------|-------------|----------------|
| `PET_CREATE` | Mascota creada | Nueva mascota |
| `PET_UPDATE` | Mascota actualizada | Cambio de datos |
| `PET_DELETE` | Mascota eliminada | Usuario borra |
| `PET_VIEW` | Mascota visualizada | Ver detalles |

### Administración

| Acción | Descripción | Ejemplo de uso |
|--------|-------------|----------------|
| `ADMIN_ACCESS` | Acceso a admin | Login como admin |
| `ADMIN_DASHBOARD_VIEW` | Dashboard visto | Entra a admin |
| `SETTINGS_CHANGE` | Config cambiada | Cambio de setting |
| `SENSITIVE_DATA_VIEW` | Datos sensibles | Compliance |
| `EXPORT_DATA` | Datos exportados | Descarga CSV |
| `PARTNER_APPROVED` | Partner aprobado | Admin aprueba |
| `PARTNER_REJECTED` | Partner rechazado | Admin rechaza |
| `USER_BLOCKED` | Usuario bloqueado | Admin bloquea |
| `USER_UNBLOCKED` | Usuario desbloqueado | Admin desbloquea |

### Sistema

| Acción | Descripción | Ejemplo de uso |
|--------|-------------|----------------|
| `ERROR` | Error general | Error no esperado |
| `API_ERROR` | Error de API | Fallo en endpoint |
| `SYSTEM_ERROR` | Error de sistema | Error crítico |

## Políticas RLS

### Ver logs (SELECT)

```sql
CREATE POLICY "Solo admins pueden ver logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

### Crear logs (INSERT)

```sql
-- Usuarios autenticados pueden crear sus propios logs
CREATE POLICY "Usuarios pueden crear sus propios logs"
  ON audit_logs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() IS NOT NULL
  );

-- Permitir logs de fallos de login sin autenticación
CREATE POLICY "Permitir logs de fallos de login anónimos"
  ON audit_logs FOR INSERT
  WITH CHECK (
    action IN ('LOGIN_FAILED', 'LOGIN_ERROR', 'LOGIN_ATTEMPT')
    AND user_id IS NULL
  );
```

### Modificar/Eliminar logs (UPDATE/DELETE)

```sql
-- Solo admins pueden modificar o eliminar logs
CREATE POLICY "Solo admins pueden modificar logs"
  ON audit_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

## Integración

### React Native / Web

```typescript
import { logAction, logError, logResourceAction } from '../services/auditService';

// En un componente de login
const handleLogin = async (email, password) => {
  try {
    await logAction('LOGIN_ATTEMPT', {
      details: { email, method: 'email_password' }
    });
    
    const user = await signIn(email, password);
    
    await logAction('LOGIN', {
      status: 'success',
      details: { email, method: 'email_password' }
    });
    
    return user;
  } catch (error) {
    await logAction('LOGIN_FAILED', {
      status: 'error',
      error_message: error.message,
      details: { email, reason: error.message }
    });
    throw error;
  }
};

// En un componente de booking
const createBooking = async (data) => {
  try {
    const booking = await supabase.from('bookings').insert(data);
    
    await logResourceAction('BOOKING_CREATE', 'booking', booking.id, {
      status: 'success',
      details: {
        service_name: data.serviceName,
        date: data.date
      }
    });
    
    return booking;
  } catch (error) {
    await logError(error, {
      action: 'BOOKING_CREATE',
      resource_type: 'booking',
      details: { data }
    });
    throw error;
  }
};
```

### Hook de React

```typescript
import { useAudit } from '../services/auditService';

const AdminDashboard = () => {
  // Audita automáticamente al montar
  useAudit('ADMIN_DASHBOARD_VIEW');
  
  return <div>...</div>;
};
```

## Consultas Útiles

### Ver últimos logins

```sql
SELECT 
  al.created_at,
  al.action,
  al.status,
  p.email,
  p.display_name,
  al.details->>'method' as method,
  al.error_message
FROM audit_logs al
LEFT JOIN profiles p ON al.user_id = p.id
WHERE al.action IN ('LOGIN', 'LOGIN_FAILED', 'LOGOUT')
ORDER BY al.created_at DESC
LIMIT 50;
```

### Ver errores recientes

```sql
SELECT 
  created_at,
  action,
  user_agent,
  error_message,
  details
FROM audit_logs
WHERE status = 'error'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Ver actividad de un usuario

```sql
SELECT 
  created_at,
  action,
  resource_type,
  resource_id,
  status,
  details
FROM audit_logs
WHERE user_id = '123e4567-e89b-12d3-a456-426614174000'
ORDER BY created_at DESC
LIMIT 100;
```

### Estadísticas de las últimas 24h

```sql
SELECT * FROM get_audit_stats('24 hours');
```

### Detectar intentos de hackeo

```sql
-- Múltiples fallos de login desde la misma IP
SELECT 
  ip_address,
  COUNT(*) as failed_attempts,
  array_agg(DISTINCT details->>'email') as attempted_emails,
  MIN(created_at) as first_attempt,
  MAX(created_at) as last_attempt
FROM audit_logs
WHERE action = 'LOGIN_FAILED'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address
HAVING COUNT(*) >= 5
ORDER BY failed_attempts DESC;
```

## Mantenimiento

### Limpiar logs antiguos

```sql
-- Eliminar logs con más de 90 días
SELECT cleanup_old_audit_logs(90);
```

### Configurar limpieza automática

```sql
-- Crear cron job para limpieza mensual
SELECT cron.schedule(
  'cleanup-audit-logs',
  '0 0 1 * *', -- Primer día de cada mes a las 00:00
  $$ SELECT cleanup_old_audit_logs(90); $$
);
```

### Espacio usado

```sql
SELECT 
  pg_size_pretty(pg_total_relation_size('audit_logs')) as total_size,
  COUNT(*) as total_logs,
  MIN(created_at) as oldest_log,
  MAX(created_at) as newest_log
FROM audit_logs;
```

## Buenas Prácticas

### ✅ Qué SÍ hacer

- Registrar todas las acciones importantes
- Incluir contexto relevante en `details`
- Usar el `status` apropiado (`success`, `error`, `warning`)
- Registrar errores con `logError()`
- Usar `logResourceAction()` para recursos específicos

### ❌ Qué NO hacer

- **NUNCA** registrar contraseñas
- **NUNCA** registrar tokens de autenticación
- **NUNCA** registrar API keys completas
- **NUNCA** registrar números de tarjeta completos
- **NUNCA** registrar CVV o códigos de seguridad
- No registrar datos binarios grandes
- No registrar información médica sin anonimizar

### 🔐 Datos Sensibles

Para cumplir con GDPR/LGPD:
- Hash de emails en lugar de emails completos (opcional)
- Usar `logSensitiveAccess()` para compliance
- Implementar "derecho al olvido" (eliminar logs del usuario)
- Anonimizar datos después de 90 días

---

**Última actualización:** 2026-02-07  
**Versión:** 1.0  
**Autor:** DogCatify Dev Team
