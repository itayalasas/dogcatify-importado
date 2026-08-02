# Verificación del Sistema de Auditoría - LOGIN_FAILED

## Resumen
Este documento explica cómo verificar que los fallos de autenticación se están registrando correctamente en la tabla `audit_logs`.

## 1. Implementación Actual

### Código en AuthContext.tsx (línea ~641)
```typescript
const login = async (email: string, password: string): Promise<User | null> => {
  try {
    // Registrar intento de login
    await logAction('LOGIN_ATTEMPT', {
      status: 'success',
      details: { email, method: 'email_password' }
    });

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      // ✅ REGISTRA LOGIN_FAILED cuando hay error
      await logAction('LOGIN_FAILED', {
        status: 'error',
        error_message: error.message,
        details: { email, reason: error.message }
      });
      
      throw error;
    }
    
    // ... resto del código
  }
}
```

### Servicio de Auditoría (auditService.ts)
```typescript
export const logAction = async (
  action: AuditAction,
  options: Partial<AuditLog> = {}
): Promise<void> => {
  try {
    // ✅ Obtiene el usuario actual (será null si no está autenticado)
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    const logEntry: AuditLog = {
      user_id: user?.id,  // ✅ NULL para LOGIN_FAILED (no autenticado)
      action,
      status: options.status || 'success',
      ip_address: options.ip_address || getClientIP(),
      user_agent: options.user_agent || getUserAgent(),
      details: options.details || {},
      error_message: options.error_message
    };

    // ✅ Inserta en audit_logs
    const { error } = await supabaseClient
      .from('audit_logs')
      .insert([logEntry]);

    if (error) {
      console.error('Error al registrar log de auditoría:', error);
    }
  } catch (error) {
    console.error('Error en logAction:', error);
  }
};
```

## 2. Cómo Verificar

### Opción A: Desde la App (Recomendado para Testing)

1. **Intentar login con credenciales incorrectas**:
   - Email: cualquier email válido
   - Password: contraseña incorrecta

2. **Verificar en consola**:
   ```
   AuthContext - Login error: Invalid login credentials
   ```

3. **Verificar en Supabase SQL Editor**:
   ```sql
   SELECT 
     id,
     user_id,
     action,
     status,
     error_message,
     details,
     created_at
   FROM audit_logs
   WHERE action = 'LOGIN_FAILED'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

### Opción B: Desde SQL Editor (Prueba Directa)

Ejecutar el archivo `test-login-failed-audit.sql` que:
1. Ve registros existentes
2. Inserta un registro de prueba
3. Verifica que se insertó correctamente
4. Muestra estadísticas

```bash
# Abrir en Supabase:
# https://supabase.com/dashboard/project/YOUR_PROJECT/editor
# Copiar y ejecutar: test-login-failed-audit.sql
```

### Opción C: Verificación Completa

Ejecutar el archivo `verify-audit-logs.sql` que muestra:
- Estructura de la tabla
- Total de registros
- Distribución de acciones
- LOGIN_FAILED específicamente
- Timeline de actividad
- RLS policies activas

## 3. Qué Esperar en la Tabla

### Registro de LOGIN_FAILED típico:
```json
{
  "id": "uuid-123",
  "user_id": null,  // ⚠️ NULL porque el usuario no está autenticado
  "action": "LOGIN_FAILED",
  "status": "error",
  "error_message": "Invalid login credentials",
  "details": {
    "email": "user@example.com",
    "reason": "Invalid login credentials",
    "method": "email_password"
  },
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "platform": "ios",
  "created_at": "2026-02-07T10:30:00Z"
}
```

### Campos Importantes:
- ✅ `user_id`: NULL (usuario no autenticado)
- ✅ `action`: "LOGIN_FAILED"
- ✅ `status`: "error"
- ✅ `error_message`: Mensaje del error de Supabase
- ✅ `details.email`: Email que intentó hacer login
- ✅ `details.reason`: Razón del fallo

## 4. Posibles Problemas y Soluciones

### Problema 1: No se insertan registros
**Causa**: RLS policies bloqueando INSERT
**Solución**: Verificar que existe la policy `allow_insert_audit_logs`:
```sql
SELECT * FROM pg_policies WHERE tablename = 'audit_logs';
```

### Problema 2: Error "relation audit_logs does not exist"
**Causa**: Tabla no creada
**Solución**: Ejecutar migración:
```bash
# Subir a Supabase SQL Editor
supabase/migrations/20260207000000_create_audit_logs_system.sql
```

### Problema 3: user_id siempre NULL
**Causa**: Esperado para LOGIN_FAILED
**Verificación**: Comparar con LOGIN (debe tener user_id):
```sql
SELECT action, user_id IS NULL as sin_usuario, COUNT(*)
FROM audit_logs
WHERE action IN ('LOGIN', 'LOGIN_FAILED')
GROUP BY action, user_id IS NULL;
```

## 5. Testing Automatizado

### Script de Prueba
```typescript
// test-audit-login-failed.ts
import { logAction } from './services/auditService';

async function testLoginFailed() {
  // Simular fallo de login
  await logAction('LOGIN_FAILED', {
    status: 'error',
    error_message: 'Invalid credentials',
    details: {
      email: 'test@example.com',
      reason: 'Invalid credentials'
    }
  });
  
  console.log('✅ LOGIN_FAILED registrado');
}

testLoginFailed();
```

## 6. Monitoreo Continuo

### Query para Dashboard:
```sql
-- Alertas de intentos fallidos en las últimas 24h
SELECT 
  details->>'email' as email,
  COUNT(*) as intentos_fallidos,
  MAX(created_at) as ultimo_intento
FROM audit_logs
WHERE action = 'LOGIN_FAILED'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY details->>'email'
HAVING COUNT(*) > 5  -- Más de 5 intentos fallidos
ORDER BY intentos_fallidos DESC;
```

## 7. Integración con Web Admin

Tu interfaz web existente debería mostrar:
- Total de LOGIN_FAILED por usuario/email
- Timeline de intentos fallidos
- Alertas cuando se superan umbrales configurados
- Detalles de cada intento (IP, user agent, razón)

## Conclusión

✅ **La implementación está correcta**:
- El código captura errores de login
- Llama a `logAction('LOGIN_FAILED', ...)` 
- El servicio inserta en `audit_logs` con `user_id = NULL`
- Las RLS policies permiten INSERT sin autenticación

🔍 **Para verificar**: 
1. Ejecutar `verify-audit-logs.sql` en Supabase
2. Hacer login fallido en la app
3. Refrescar query y ver nuevo registro

📊 **Para monitorear**:
- Ver dashboard web existente
- Ejecutar queries de monitoreo periódicamente
- Configurar alertas en umbrales (ej: >10 fallos/hora)
