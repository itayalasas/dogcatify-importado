# Sistema de Auditoría y Seguridad - Índice de Documentación

## Navegación Rápida

### 🚀 Para Empezar

| Documento | Descripción | Audiencia |
|-----------|-------------|-----------|
| **`SETUP_SEGURIDAD.md`** | Guía de configuración inicial del sistema de seguridad (5 minutos) | Administradores / DevOps |

### 📚 Documentación del Sistema

| Documento | Descripción | Audiencia |
|-----------|-------------|-----------|
| **`SISTEMA_AUDITORIA.md`** | Documentación completa del sistema de auditoría | Desarrolladores / Administradores |
| **`SISTEMA_ALERTAS.md`** | Sistema de alertas automáticas de seguridad | Administradores / DevOps |

### 📱 Integración Móvil

| Documento | Descripción | Audiencia |
|-----------|-------------|-----------|
| **`APP_MOBILE_CHECKLIST.md`** | ⭐ **Checklist rápido** (30 minutos) para implementar en la app | Desarrolladores móvil |

## Flujo de Implementación

### Para Web (✅ Ya implementado)

1. ✅ Tabla `audit_logs` creada
2. ✅ RLS policies configuradas
3. ✅ Servicio de auditoría implementado
4. ✅ Login tracking implementado
5. ✅ Panel de seguridad disponible en `components/SecurityPanel.tsx`
6. ✅ Sistema de alertas configurado

### Para App Móvil (⏳ Listo para implementar)

1. [ ] Leer **`APP_MOBILE_CHECKLIST.md`**
2. [ ] Implementar tracking de login (5 min)
3. [ ] Implementar tracking de bookings (10 min)
4. [ ] Implementar tracking de pagos (8 min)
5. [ ] Verificar logs en Panel Admin

## Archivos Creados

### Base de Datos
- `supabase/migrations/20260207000000_create_audit_logs_system.sql` - Tabla, índices y RLS policies

### Servicios
- `services/auditService.ts` - Servicio de auditoría (logAction, logError, logResourceAction)

### Componentes
- `components/SecurityPanel.tsx` - Panel de administración de seguridad

### Edge Functions
- `supabase/functions/check-alert-thresholds/index.ts` - Sistema de alertas automáticas

### Integración
- `contexts/AuthContext.tsx` - Tracking de login/logout implementado

### Documentación
- `docs/SETUP_SEGURIDAD.md` - Guía de configuración
- `docs/SISTEMA_AUDITORIA.md` - Documentación técnica completa
- `docs/SISTEMA_ALERTAS.md` - Sistema de alertas
- `docs/APP_MOBILE_CHECKLIST.md` - Checklist de integración móvil
- `docs/README_AUDITORIA.md` - Este archivo (índice)

## Preguntas Frecuentes

### ¿Cómo funciona el sistema?

El sistema registra todas las acciones importantes en la tabla `audit_logs`. Cada acción incluye:
- Usuario que la realizó
- Tipo de acción (LOGIN, BOOKING_CREATE, PAYMENT_SUCCESS, etc.)
- Estado (success, error, warning)
- Detalles adicionales (JSON)
- Timestamp

### ¿Qué acciones se registran automáticamente?

Actualmente implementado:
- ✅ LOGIN exitoso
- ✅ LOGIN_FAILED (fallos de autenticación)
- ✅ LOGOUT

Pendiente de implementar en más lugares:
- BOOKING_CREATE, BOOKING_UPDATE, BOOKING_CANCEL
- PAYMENT_SUCCESS, PAYMENT_FAILED
- ORDER_CREATE, ORDER_UPDATE
- Y más... (ver lista completa en SISTEMA_AUDITORIA.md)

### ¿Los usuarios pueden ver sus propios logs?

No. Solo los administradores pueden ver logs. Las políticas RLS lo garantizan.

### ¿Cómo funcionan las alertas?

Un cron job ejecuta cada 15 minutos una función que revisa si se superaron umbrales críticos:
- 5 LOGIN_FAILED en 10 minutos → Alerta de posible ataque
- 10 PAYMENT_FAILED en 30 minutos → Alerta de problemas de pago
- 20 ERROR en 10 minutos → Alerta de problemas del sistema

Cuando se detecta, envía un email al admin automáticamente.

### ¿Qué no debo registrar en los logs?

❌ **NUNCA registrar:**
- Contraseñas
- Tokens de autenticación
- API keys
- Números de tarjeta completos
- CVV / códigos de seguridad

### ¿Cuánto espacio ocupan los logs?

Cada log ocupa ~1-2 KB. Con el plan gratuito de Supabase (500 MB), puedes almacenar 250,000-500,000 logs.

Recomendación: Ejecutar limpieza mensual de logs mayores a 90 días:
```sql
SELECT cleanup_old_audit_logs(90);
```

## Arquitectura General

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
│                    ┌───────▼────────┐                     │
│                    │  auditService  │                     │
│                    └───────┬────────┘                     │
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

## Estado del Sistema

| Componente | Estado | Notas |
|------------|--------|-------|
| Tabla audit_logs | ✅ Creada | Migración disponible |
| RLS Policies | ✅ Configuradas | Solo admins ven logs |
| auditService | ✅ Implementado | Funciones disponibles |
| Login Tracking | ✅ Implementado | AuthContext integrado |
| Panel Admin | ✅ Disponible | SecurityPanel.tsx |
| Alertas Email | ✅ Funcional | Edge Function desplegada |
| Cron Job | ⏳ Por configurar | Ver SETUP_SEGURIDAD.md |
| App Móvil | ⏳ Pendiente | Ver APP_MOBILE_CHECKLIST.md |

## Próximos Pasos Recomendados

### Inmediato (Hoy)

1. [ ] Ejecutar migración: `supabase/migrations/20260207000000_create_audit_logs_system.sql`
2. [ ] Desplegar Edge Function: `supabase functions deploy check-alert-thresholds`
3. [ ] Configurar cron job (ver SETUP_SEGURIDAD.md)
4. [ ] Agregar SecurityPanel al dashboard admin
5. [ ] Verificar que los logins se registran correctamente

### Corto Plazo (Esta Semana)

1. [ ] Implementar tracking en app móvil (APP_MOBILE_CHECKLIST.md)
2. [ ] Agregar tracking de bookings
3. [ ] Agregar tracking de pagos
4. [ ] Revisar alertas diariamente

### Mediano Plazo (Este Mes)

1. [ ] Expandir tracking a más acciones
2. [ ] Ajustar umbrales de alerta según datos reales
3. [ ] Implementar dashboard de métricas
4. [ ] Configurar limpieza automática de logs antiguos

## Soporte y Contacto

**Para problemas técnicos:**
- Ver documentación en `docs/`
- Revisar logs en Dashboard de Supabase
- Contactar al equipo de desarrollo

**Para configuración de alertas:**
- Ver `SISTEMA_ALERTAS.md`
- Dashboard Admin → Seguridad

**Para integración móvil:**
- Ver `APP_MOBILE_CHECKLIST.md`
- Contactar al equipo móvil

---

**Última actualización:** 2026-02-07  
**Versión del sistema:** 1.0  
**Estado web:** ✅ Implementado  
**Estado móvil:** ⏳ Listo para implementar

**Mantenido por:** DogCatify Dev Team
