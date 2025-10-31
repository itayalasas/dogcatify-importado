# Sistema de Validación de Tokens y Sesiones

## Descripción General

El sistema de validación de tokens detecta automáticamente cuando una sesión ha expirado y redirige al usuario al login de forma segura, evitando que la aplicación se quede en estados de carga indefinidos.

## Características Principales

### 1. Validación Automática Periódica
- El sistema valida el token cada **60 segundos** cuando el usuario está autenticado
- Previene validaciones duplicadas con un sistema de debounce (30 segundos)
- Detecta y maneja automáticamente tokens expirados

### 2. Validación al Reactivar la App
- Cuando la aplicación vuelve al primer plano después de estar en background
- Valida inmediatamente el token para asegurar que sigue siendo válido

### 3. Refresh Automático de Tokens
- Intenta refrescar tokens que están por expirar (< 5 minutos)
- Si el refresh falla, redirige automáticamente al login
- Maneja tanto tokens expirados como tokens próximos a expirar

### 4. Interceptación Global de Errores
- Intercepta todos los errores JWT en llamadas a la API de Supabase
- Redirige automáticamente al login cuando detecta errores de sesión
- No requiere código adicional en cada pantalla

## Componentes del Sistema

### 1. AuthContext (contexts/AuthContext.tsx)
El contexto principal que maneja:
- Validación periódica de tokens
- Detección de expiración
- Redirección automática al login
- Refresh de sesiones

### 2. Hook useTokenValidation
```typescript
import { useTokenValidation } from '@/hooks/useTokenValidation';

function MyScreen() {
  // Valida el token al montar la pantalla
  useTokenValidation();

  // ... resto del código
}
```

### 3. Componente ProtectedScreen
```typescript
import { ProtectedScreen } from '@/components/ProtectedScreen';

function MySecureScreen() {
  return (
    <ProtectedScreen requireAuth={true}>
      {/* Contenido protegido */}
    </ProtectedScreen>
  );
}
```

**Props:**
- `requireAuth`: Requiere autenticación (default: true)
- `requirePartner`: Requiere que el usuario sea partner (default: false)
- `redirectTo`: Ruta a la que redirigir si falla validación (default: '/auth/login')

### 4. Utilidad withTokenValidation
```typescript
import { withTokenValidation } from '@/utils/secureSupabaseClient';

async function fetchData() {
  return withTokenValidation(
    async () => {
      const { data } = await supabaseClient
        .from('pets')
        .select('*');
      return data;
    },
    'fetch pets'
  );
}
```

### 5. Interceptor Global de Supabase (lib/supabase.ts)
- Automáticamente intercepta todas las llamadas a Supabase
- Detecta errores JWT y de sesión
- Dispara el callback de expiración global

## Flujo de Validación

```
Usuario autenticado
    ↓
Validación periódica cada 60s
    ↓
¿Token válido?
    ├─ Sí → Continuar
    └─ No → ¿Puede refrescar?
            ├─ Sí → Refrescar y continuar
            └─ No → Limpiar estado + Redirigir a /auth/login
```

## Situaciones Manejadas

### 1. Token Expirado
```
- Usuario inactivo por mucho tiempo
- Token expira naturalmente
→ Sistema detecta → Redirige a login
```

### 2. Sesión Perdida
```
- Sesión eliminada del servidor
- Refresh token inválido
→ Sistema detecta → Redirige a login
```

### 3. Error JWT en API Call
```
- Llamada a Supabase con token inválido
- Interceptor detecta error JWT
→ Callback global → Redirige a login
```

### 4. App en Background
```
- Usuario deja app en background
- Token expira mientras está inactivo
- Usuario regresa a la app
→ Validación automática → Detecta expiración → Redirige
```

## Errores JWT Detectados

El sistema detecta los siguientes tipos de errores:

- `JWT expired`
- `JWT invalid`
- `JWT malformed`
- `session_not_found`
- `refresh_token_not_found`
- `Invalid Refresh Token`
- Código de error PostgreSQL: `PGRST301`

## Integración en Pantallas

### Opción 1: Usar ProtectedScreen (Recomendado)
```typescript
export default function MyScreen() {
  return (
    <ProtectedScreen>
      <View>
        {/* Tu contenido aquí */}
      </View>
    </ProtectedScreen>
  );
}
```

### Opción 2: Usar Hook
```typescript
export default function MyScreen() {
  useTokenValidation(); // Valida al montar

  return (
    <View>
      {/* Tu contenido aquí */}
    </View>
  );
}
```

### Opción 3: Validación Manual
```typescript
export default function MyScreen() {
  const { checkTokenValidity } = useAuth();

  const loadData = async () => {
    const isValid = await checkTokenValidity();
    if (!isValid) {
      router.replace('/auth/login');
      return;
    }

    // Cargar datos...
  };

  useEffect(() => {
    loadData();
  }, []);
}
```

## Prevención de Estados de Carga Infinitos

El sistema previene estados de carga infinitos mediante:

1. **Timeout de Inicialización**: Auth se inicializa en máximo 10 segundos
2. **Validación Previa a Operaciones**: Valida antes de cargar datos
3. **Redirección Inmediata**: Redirige sin esperar si detecta token inválido
4. **Limpieza de Estado**: Limpia loading state antes de redirigir

## Logs de Diagnóstico

El sistema genera logs detallados:

```
- "Token expired in periodic check, redirecting to login..."
- "Token expired on app resume, redirecting to login..."
- "JWT error detected in API call"
- "Handling token expiration..."
- "Session refreshed successfully"
```

## Mejores Prácticas

1. **Usar ProtectedScreen** para pantallas que requieren autenticación
2. **No hacer llamadas a Supabase** antes de que authInitialized sea true
3. **Manejar loading states** apropiadamente en cada pantalla
4. **Confiar en el sistema automático** - no duplicar validaciones
5. **Revisar logs** si hay problemas de redirección

## Troubleshooting

### Problema: Usuario se queda en pantalla de carga
**Solución**: Verificar que la pantalla use ProtectedScreen o maneje authInitialized

### Problema: Redirecciones múltiples
**Solución**: El sistema tiene protección contra esto con isHandlingExpirationRef

### Problema: No detecta token expirado
**Solución**: Verificar que tokenCheckIntervalRef esté activo (solo cuando hay currentUser)

### Problema: Alert no aparece
**Solución**: La redirección ocurre primero, el alert es informativo después

## Configuración

### Intervalo de Validación
Cambiar en AuthContext.tsx línea ~375:
```typescript
}, 60 * 1000); // 60 segundos (default)
```

### Tiempo de Refresh Preventivo
Cambiar en AuthContext.tsx línea ~463:
```typescript
if (timeUntilExpiry < 300) { // 5 minutos (default)
```

### Debounce de Validación
Cambiar en AuthContext.tsx línea ~371:
```typescript
if (now - lastValidationRef.current < 30000) { // 30 segundos (default)
```
