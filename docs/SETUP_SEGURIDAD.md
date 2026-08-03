# Guía de Configuración del Sistema de Seguridad y Auditoría

## 🚀 Inicio Rápido (5 minutos)

### Paso 1: Crear la tabla audit_logs

Ejecuta el siguiente script en el SQL Editor de Supabase:

```bash
# Desde la raíz del proyecto
supabase db push supabase/migrations/20260207000000_create_audit_logs_system.sql
```

O copia y pega el contenido del archivo en el SQL Editor del dashboard de Supabase.

### Paso 2: Desplegar la Edge Function de alertas

```bash
supabase functions deploy check-alert-thresholds --project-ref hpvzjuionqvgxlvhyqgz
```

### Paso 3: Configurar Cron Job (opcional)

Para recibir alertas automáticas cada 15 minutos, configura un cron job en Supabase:

1. Ve a **Database** → **Cron Jobs** (extensión pg_cron)
2. Crea un nuevo job:

```sql
-- Habilitar extensión pg_cron (si no está habilitada)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Crear cron job para verificar alertas cada 15 minutos
SELECT cron.schedule(
  'check-security-alerts',
  '*/15 * * * *', -- Cada 15 minutos
  $$
  SELECT net.http_post(
    url := 'https://hpvzjuionqvgxlvhyqgz.supabase.co/functions/v1/check-alert-thresholds',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer REDACTED_CREDENTIAL'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Paso 4: Verificar funcionamiento

```bash
# Probar manualmente la función de alertas
curl -X POST https://hpvzjuionqvgxlvhyqgz.supabase.co/functions/v1/check-alert-thresholds \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### Paso 5: Acceder al panel de seguridad

El panel de seguridad está disponible en:
- **Web:** Agrega la ruta en tu dashboard de admin
- **Componente:** `<SecurityPanel />` ya está creado en `components/SecurityPanel.tsx`

## ✅ Sistema Listo

Tu sistema de auditoría ya está funcionando y registrará automáticamente:
- ✅ Todos los logins y logouts
- ✅ Intentos fallidos de autenticación
- ✅ Creación y modificación de recursos
- ✅ Pagos y transacciones
- ✅ Errores del sistema

## 📊 Verificar que funciona

1. **Hacer login** en la app
2. **Verificar en la base de datos:**

```sql
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
```

Deberías ver el registro del login reciente.

## 🔐 Seguridad

Las políticas RLS ya están configuradas:
- ❌ Usuarios normales NO pueden ver logs
- ✅ Solo admins pueden ver logs
- ✅ Todos pueden crear logs de sus propias acciones
- ✅ Logs de fallos de login sin autenticación están permitidos

## 📱 Integración en App Móvil

Para agregar auditoría en la app móvil, simplemente importa el servicio:

```typescript
import { logAction, logResourceAction, logError } from '../services/auditService';

// Ejemplo: Registrar creación de booking
await logResourceAction('BOOKING_CREATE', 'booking', bookingId, {
  status: 'success',
  details: {
    service_name: 'Paseo Premium',
    date: '2026-02-10'
  }
});
```

## 🆘 Solución de Problemas

### Los logs no se guardan

1. Verificar que la tabla existe:
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'audit_logs';
```

2. Verificar políticas RLS:
```sql
SELECT * FROM pg_policies WHERE tablename = 'audit_logs';
```

### No llegan alertas por email

1. Verificar que la función `send-email` está desplegada
2. Verificar que hay un admin en la tabla profiles:
```sql
SELECT * FROM profiles WHERE role = 'admin';
```

3. Verificar logs de la Edge Function en el dashboard de Supabase

## 📚 Documentación Completa

- `SISTEMA_AUDITORIA.md` - Documentación técnica completa
- `SISTEMA_ALERTAS.md` - Configuración de alertas
- `APP_MOBILE_CHECKLIST.md` - Integración en app móvil

## 🎯 Próximos Pasos

1. ✅ Sistema funcionando
2. 📱 Integrar en más pantallas de la app
3. 📊 Monitorear el panel de seguridad
4. 🔔 Ajustar umbrales de alerta según necesidad
5. 🗄️ Configurar limpieza automática de logs antiguos

---

**Última actualización:** 2026-02-07  
**Versión:** 1.0  
**Estado:** ✅ Listo para producción
