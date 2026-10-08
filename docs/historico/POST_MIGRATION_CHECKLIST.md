# Checklist de Verificación Post-Migración

Usa este checklist después de migrar a producción para asegurarte de que todo funcione correctamente.

---

## 1. Base de Datos

### Verificar estructura
- [ ] **51 tablas creadas correctamente**
  ```sql
  SELECT count(*) FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  -- Debe retornar: 51
  ```

- [ ] **RLS habilitado en todas las tablas**
  ```sql
  SELECT count(*) FROM pg_tables
  WHERE schemaname = 'public' AND rowsecurity = false;
  -- Debe retornar: 0
  ```

- [ ] **Funciones creadas correctamente**
  ```sql
  SELECT count(*) FROM information_schema.routines
  WHERE routine_schema = 'public';
  -- Debe retornar: 20+ funciones
  ```

- [ ] **Triggers activos**
  ```sql
  SELECT count(*) FROM information_schema.triggers
  WHERE trigger_schema = 'public';
  -- Debe retornar: 15+ triggers
  ```

- [ ] **Extensiones instaladas**
  ```sql
  SELECT extname FROM pg_extension
  WHERE extname IN ('uuid-ossp', 'pgcrypto', 'pg_net');
  -- Debe retornar las 3 extensiones
  ```

### Verificar funciones críticas
- [ ] `generate_medical_alerts()` existe
- [ ] `update_updated_at_column()` existe
- [ ] `handle_new_user()` existe
- [ ] `cleanup_expired_cache()` existe

### Verificar triggers críticos
- [ ] `trigger_medical_alerts_on_health_insert` existe
- [ ] `trigger_update_updated_at` existe en múltiples tablas
- [ ] `trigger_create_profile_on_signup` existe

### Verificar índices únicos
- [ ] `idx_medical_alerts_unique_pending` existe
- [ ] Índices en tablas principales creados

---

## 2. Edge Functions

### Verificar despliegue
- [ ] **31 funciones desplegadas**
  ```bash
  supabase functions list --project-ref <ref>
  ```

### Funciones críticas activas
- [ ] `mercadopago-webhook` (ACTIVE)
- [ ] `send-notification-fcm-v1` (ACTIVE)
- [ ] `orders-api` (ACTIVE)
- [ ] `medical-history` (ACTIVE)
- [ ] `generate-vaccine-recommendations` (ACTIVE)

### JWT configurado correctamente
- [ ] Funciones públicas sin JWT: `send-email`, `mercadopago-webhook`, `orders-api`
- [ ] Funciones privadas con JWT: `create-user`, `delete-user`, `medical-history`

---

## 3. Secrets (Variables de Entorno)

Verifica que todos los secrets estén configurados:

```bash
supabase secrets list --project-ref <ref>
```

### Secrets obligatorios
- [ ] `SUPABASE_URL` (auto-configurado)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (auto-configurado)
- [ ] `FIREBASE_SERVICE_ACCOUNT` (para notificaciones)
- [ ] `FIREBASE_PROJECT_ID` (para FCM)
- [ ] `OPENAI_API_KEY` (para IA)
- [ ] `RESEND_API_KEY` (para emails)
- [ ] `MERCADOPAGO_ACCESS_TOKEN` (para pagos)
- [ ] `MERCADOPAGO_PUBLIC_KEY` (para frontend)

### Secrets opcionales (pero recomendados)
- [ ] `DATADOG_API_KEY` (monitoreo)
- [ ] `DATADOG_APP_KEY` (monitoreo)
- [ ] `SENTRY_DSN` (errores)

---

## 4. Cron Jobs

Configura estos cron jobs en el Dashboard de Supabase:

### Cron jobs necesarios
- [ ] **cancel-expired-orders**
  - Frecuencia: Cada hora (`0 * * * *`)
  - URL: `https://<project-ref>.supabase.co/functions/v1/cancel-expired-orders`
  - Método: POST

- [ ] **send-scheduled-notifications**
  - Frecuencia: Cada 15 minutos (`*/15 * * * *`)
  - URL: `https://<project-ref>.supabase.co/functions/v1/send-scheduled-notifications`
  - Método: POST

- [ ] **send-booking-confirmations**
  - Frecuencia: Cada hora (`0 * * * *`)
  - URL: `https://<project-ref>.supabase.co/functions/v1/send-booking-confirmations`
  - Método: POST

---

## 5. Configuración de MercadoPago

### Webhooks de MercadoPago
- [ ] Webhook configurado en panel de MercadoPago
- [ ] URL: `https://<project-ref>.supabase.co/functions/v1/mercadopago-webhook`
- [ ] Eventos habilitados:
  - [ ] `payment`
  - [ ] `merchant_order`

### Credenciales
- [ ] Access Token de producción configurado
- [ ] Public Key de producción en app

---

## 6. Firebase Cloud Messaging

### Configuración
- [ ] Service Account JSON configurado como secret
- [ ] Project ID configurado
- [ ] FCM habilitado en proyecto Firebase
- [ ] google-services.json actualizado en app (Android)
- [ ] GoogleService-Info.plist actualizado en app (iOS)

---

## 7. Políticas RLS

### Verificar políticas críticas
- [ ] **profiles**: Usuarios pueden ver/editar su propio perfil
- [ ] **pets**: Usuarios solo ven sus mascotas
- [ ] **medical_alerts**: Usuarios solo ven alertas de sus mascotas
- [ ] **orders**: Usuarios solo ven sus propias órdenes
- [ ] **partners**: Políticas correctas para partners y admins

### Probar RLS
```sql
-- Como usuario normal, no deberías ver datos de otros
SET ROLE authenticated;
SELECT count(*) FROM pets; -- Solo tus mascotas
SELECT count(*) FROM orders; -- Solo tus órdenes
```

---

## 8. Pruebas Funcionales

### Autenticación
- [ ] Registro de usuario funciona
- [ ] Login funciona
- [ ] Reset de contraseña funciona
- [ ] Perfil se crea automáticamente

### Mascotas
- [ ] Crear mascota funciona
- [ ] Editar mascota funciona
- [ ] Ver historial médico funciona
- [ ] Alertas médicas se generan correctamente

### Órdenes
- [ ] Crear orden funciona
- [ ] Webhook de MercadoPago procesa pagos
- [ ] Estados de orden se actualizan
- [ ] Notificaciones de pago funcionan

### Notificaciones
- [ ] Push notifications llegan a dispositivos
- [ ] Emails se envían correctamente
- [ ] Notificaciones programadas funcionan

### IA y Recomendaciones
- [ ] Recomendaciones de vacunas funcionan
- [ ] OCR de tarjetas médicas funciona
- [ ] Caché de IA se guarda correctamente

---

## 9. Monitoreo

### Configurar monitoreo
- [ ] Datadog conectado (si aplica)
- [ ] Sentry conectado (si aplica)
- [ ] Alertas configuradas para errores críticos

### Logs
- [ ] Logs de Edge Functions accesibles:
  ```bash
  supabase functions logs <function-name> --project-ref <ref>
  ```

---

## 10. Seguridad

### Verificaciones de seguridad
- [ ] Service Role Key NO está en código frontend
- [ ] Secrets sensibles NO están en repositorio Git
- [ ] RLS habilitado en todas las tablas
- [ ] Webhooks validan firmas (MercadoPago)
- [ ] JWT requerido en funciones privadas

### Auditoría de políticas
- [ ] Admin tiene acceso completo a tablas administrativas
- [ ] Usuarios normales NO pueden acceder a datos de otros
- [ ] Partners solo ven sus propios datos
- [ ] Datos sensibles están protegidos

---

## 11. Rendimiento

### Índices
- [ ] Índices en columnas frecuentemente consultadas
- [ ] `idx_medical_alerts_unique_pending` existe
- [ ] Índices en foreign keys

### Caché
- [ ] Sistema de caché de IA funcionando
- [ ] Tablas de caché poblándose correctamente

---

## 12. Backups

### Configurar backups
- [ ] Backups automáticos habilitados en Supabase
- [ ] Frecuencia de backup configurada
- [ ] Retención de backups configurada

---

## 13. Dominios y URLs

### URLs de producción
- [ ] URL de Supabase correcta en app
- [ ] Edge Functions URLs correctas
- [ ] Webhooks URLs correctas

---

## 14. Documentación

### Documentación actualizada
- [ ] Variables de entorno documentadas
- [ ] Edge Functions documentadas
- [ ] Procesos críticos documentados
- [ ] Contactos de emergencia documentados

---

## 15. Plan de Rollback

### Preparación para rollback
- [ ] Backup de base de datos antes de migración
- [ ] Plan de rollback documentado
- [ ] Credenciales de desarrollo guardadas
- [ ] Scripts de rollback probados

---

## Pruebas de Integración End-to-End

### Flujo completo de usuario
- [ ] Registrar usuario → Crear perfil → Agregar mascota → Ver alertas
- [ ] Crear orden → Pagar con MercadoPago → Recibir notificación
- [ ] Compartir historial médico → Recibir notificación → Ver datos
- [ ] Reservar servicio → Confirmar → Recibir confirmación

---

## Checklist Final

Antes de declarar la migración exitosa:

- [ ] **Todos los items críticos verificados**
- [ ] **Pruebas funcionales pasadas**
- [ ] **Monitoreo activo**
- [ ] **Equipo notificado**
- [ ] **Documentación actualizada**
- [ ] **Plan de rollback listo**

---

## En Caso de Problemas

### Logs para revisar
```bash
# Ver logs de Edge Function
supabase functions logs <function-name> --project-ref <ref>

# Ver logs de base de datos
# Dashboard → Logs → Postgres Logs
```

### Rollback de emergencia
```bash
# Si necesitas hacer rollback
supabase db reset --project-ref <ref>
# Luego aplica el backup anterior
```

### Contactos de emergencia
- **Supabase Support**: support@supabase.io
- **Tu equipo**: [agregar contactos]

---

## Métricas a Monitorear Post-Migración

### Primeras 24 horas
- [ ] Tasa de error < 1%
- [ ] Tiempo de respuesta < 500ms promedio
- [ ] 0 errores críticos
- [ ] Webhooks procesándose correctamente
- [ ] Notificaciones enviándose correctamente

### Primera semana
- [ ] Usuarios creándose correctamente
- [ ] Órdenes procesándose
- [ ] Pagos completándose
- [ ] Sin degradación de rendimiento

---

## Firma de Completitud

**Migración completada por**: _________________

**Fecha**: _________________

**Project Ref Producción**: _________________

**Todas las verificaciones pasadas**: [ ] SÍ [ ] NO

**Observaciones**:
_____________________________________________________________________________
_____________________________________________________________________________
_____________________________________________________________________________

