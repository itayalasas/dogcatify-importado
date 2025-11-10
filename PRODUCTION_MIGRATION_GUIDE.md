# Guía de Migración a Producción - DogCatiFy

Esta guía te ayudará a migrar completamente la base de datos de desarrollo/testing a producción de forma limpia y organizada.

## Índice
1. [Estructura de Base de Datos](#estructura-de-base-de-datos)
2. [Edge Functions](#edge-functions)
3. [Variables de Entorno](#variables-de-entorno)
4. [Pasos de Migración](#pasos-de-migración)

---

## Estructura de Base de Datos

### Tablas Principales (51 tablas)

**Usuarios y Perfiles:**
- `profiles` - Perfiles de usuarios
- `email_confirmations` - Confirmaciones de email

**Mascotas:**
- `pets` - Mascotas registradas
- `pet_health` - Historial médico (vacunas, desparasitaciones, enfermedades)
- `pet_albums` - Álbumes de fotos/videos
- `pet_behavior` - Historial de comportamiento
- `pet_shares` - Compartir mascotas con otros usuarios

**Partners/Negocios:**
- `partners` - Socios/proveedores de servicios
- `partner_services` - Servicios ofrecidos
- `partner_products` - Productos vendidos
- `business_schedule` - Horarios de atención

**Órdenes y Pagos:**
- `orders` - Órdenes de compra/servicio
- `bookings` - Reservas de servicios
- `booking_confirmation_tokens` - Tokens de confirmación
- `user_carts` - Carritos de compra
- `webhook_subscriptions` - Webhooks de partners
- `webhook_logs` - Logs de webhooks

**Médico:**
- `medical_alerts` - Alertas médicas automáticas
- `medical_conditions` - Catálogo de condiciones médicas
- `medical_treatments` - Catálogo de tratamientos
- `medical_history_tokens` - Tokens para compartir historial médico
- `veterinary_clinics` - Clínicas veterinarias
- `vaccines_catalog` - Catálogo de vacunas
- `dewormers_catalog` - Catálogo de desparasitantes
- `allergies_catalog` - Catálogo de alergias
- `vaccination_schedules` - Calendarios de vacunación
- `deworming_schedules` - Calendarios de desparasitación

**Caché de IA:**
- `vaccine_recommendations_cache` - Recomendaciones de vacunas
- `dewormers_ai_cache` - Recomendaciones de desparasitantes
- `illnesses_ai_cache` - Recomendaciones de enfermedades
- `treatments_ai_cache` - Recomendaciones de tratamientos
- `allergies_ai_cache` - Recomendaciones de alergias

**Adopciones:**
- `adoption_pets` - Mascotas en adopción
- `adoption_chats` - Conversaciones de adopción
- `adoption_messages` - Mensajes de adopción

**Social:**
- `posts` - Publicaciones
- `comments` - Comentarios
- `places` - Lugares pet-friendly
- `chat_conversations` - Conversaciones de chat
- `chat_messages` - Mensajes de chat

**Suscripciones:**
- `subscription_plans` - Planes de suscripción
- `subscription_settings` - Configuración de suscripciones
- `user_subscriptions` - Suscripciones de usuarios

**Promociones:**
- `promotions` - Promociones
- `promotion_billing` - Facturación de promociones

**Notificaciones:**
- `scheduled_notifications` - Notificaciones programadas

**Administración:**
- `admin_settings` - Configuración de administrador
- `app_config` - Configuración general de la app

**Ubicación:**
- `countries` - Países
- `departments` - Departamentos/Estados

**Reseñas:**
- `service_reviews` - Reseñas de servicios

---

## Edge Functions (31 funciones)

### Autenticación y Usuario
1. `create-user` - Crear usuario (JWT required)
2. `delete-user` - Eliminar usuario (JWT required)
3. `reset-password` - Restablecer contraseña (JWT required)

### Email
4. `send-email` - Enviar emails (público)
5. `send-invoice-email` - Enviar facturas por email (JWT required)

### Notificaciones
6. `send-push-notification` - Enviar notificaciones push (JWT required)
7. `send-notification-fcm-v1` - Enviar notificaciones FCM v1 (JWT required)
8. `send-scheduled-notifications` - Enviar notificaciones programadas (público)
9. `send-medical-reminders` - Enviar recordatorios médicos (JWT required)

### Médico/Historial
10. `medical-history` - Historial médico (JWT required)
11. `medical-history-data` - Datos de historial médico (JWT required)
12. `save-medical-record` - Guardar registro médico (público)
13. `medical-notifications` - Notificaciones médicas (JWT required)
14. `extract-medical-card-info` - Extraer info de tarjeta médica con OCR (JWT required)
15. `scan-vaccination-card` - Escanear tarjeta de vacunación (JWT required)

### IA y Recomendaciones
16. `generate-vaccine-recommendations` - Recomendaciones de vacunas (JWT required)
17. `generate-dewormer-recommendations` - Recomendaciones de desparasitantes (JWT required)
18. `generate-illness-recommendations` - Recomendaciones de enfermedades (JWT required)
19. `generate-treatment-recommendations` - Recomendaciones de tratamientos (JWT required)
20. `generate-allergy-recommendations` - Recomendaciones de alergias (JWT required)
21. `generate-behavior-recommendations` - Recomendaciones de comportamiento (JWT required)
22. `get-vaccine-info` - Obtener info de vacuna (JWT required)

### Órdenes y Pagos
23. `orders-api` - API de órdenes (público)
24. `cancel-expired-orders` - Cancelar órdenes expiradas (público)
25. `mercadopago-webhook` - Webhook de MercadoPago (público)
26. `notify-order-webhook` - Notificar webhook de orden (público)
27. `dogcatify-order-webhook` - Webhook de órdenes DogCatiFy (público)

### Reservas
28. `send-booking-confirmations` - Enviar confirmaciones de reservas (público)
29. `confirm-booking` - Confirmar reserva (JWT required)

### Facturación
30. `generate-promotion-invoice` - Generar factura de promoción (JWT required)

### Utilidades
31. `upload-image` - Subir imagen (JWT required)

---

## Variables de Entorno

### Supabase (Auto-configuradas)
```bash
SUPABASE_URL=<tu-url-de-supabase>
SUPABASE_ANON_KEY=<tu-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
SUPABASE_DB_URL=<tu-db-url>
```

### MercadoPago
```bash
MERCADOPAGO_ACCESS_TOKEN=<tu-access-token-de-produccion>
MERCADOPAGO_PUBLIC_KEY=<tu-public-key-de-produccion>
```

### OpenAI (para IA)
```bash
OPENAI_API_KEY=<tu-openai-key>
```

### Resend (para emails)
```bash
RESEND_API_KEY=<tu-resend-key>
```

### Firebase (para notificaciones)
```bash
FIREBASE_SERVICE_ACCOUNT=<tu-service-account-json>
FIREBASE_PROJECT_ID=<tu-project-id>
```

### Datadog (para monitoreo)
```bash
DATADOG_API_KEY=<tu-datadog-key>
DATADOG_APP_KEY=<tu-datadog-app-key>
```

### Sentry (para errores)
```bash
SENTRY_DSN=<tu-sentry-dsn>
```

---

## Pasos de Migración

### Paso 1: Exportar Schema Completo

```bash
# Desde tu proyecto local
cd /tmp/cc-agent/59944334/project

# Esto generará un archivo con todo el schema
supabase db dump --file production_schema.sql
```

### Paso 2: Limpiar y Preparar para Producción

El archivo `production_schema.sql` contiene:
- Todas las tablas con sus estructuras
- Todos los índices
- Todas las funciones y triggers
- Todas las políticas RLS
- Todas las extensiones

**IMPORTANTE:** El archivo NO incluye datos, solo estructura. Esto es lo que quieres para producción limpia.

### Paso 3: Aplicar en Producción

#### Opción A: Usando Supabase CLI

```bash
# Conectar a tu proyecto de producción
supabase link --project-ref <tu-project-ref-produccion>

# Aplicar todas las migraciones
supabase db push
```

#### Opción B: Usando el Dashboard de Supabase

1. Ve a tu proyecto de producción en dashboard.supabase.com
2. Ve a "SQL Editor"
3. Copia el contenido del archivo consolidado que crearemos
4. Ejecuta el script completo

### Paso 4: Desplegar Edge Functions

Para cada edge function, necesitas desplegarla en producción:

```bash
# Ejemplo para una función
supabase functions deploy send-email --project-ref <tu-project-ref-produccion>

# O desplegar todas
supabase functions deploy --project-ref <tu-project-ref-produccion>
```

### Paso 5: Configurar Variables de Entorno en Producción

```bash
# Para cada secret
supabase secrets set MERCADOPAGO_ACCESS_TOKEN=<valor> --project-ref <tu-project-ref-produccion>
supabase secrets set OPENAI_API_KEY=<valor> --project-ref <tu-project-ref-produccion>
# ... etc
```

### Paso 6: Verificar Migración

Después de migrar, verifica:

1. **Tablas creadas correctamente:**
   ```sql
   SELECT count(*) FROM information_schema.tables
   WHERE table_schema = 'public';
   -- Debe retornar 51
   ```

2. **RLS habilitado en todas las tablas:**
   ```sql
   SELECT tablename
   FROM pg_tables
   WHERE schemaname = 'public'
   AND rowsecurity = false;
   -- Debe retornar vacío
   ```

3. **Funciones creadas:**
   ```sql
   SELECT count(*)
   FROM information_schema.routines
   WHERE routine_schema = 'public';
   ```

4. **Edge Functions desplegadas:**
   Ve al Dashboard > Edge Functions y verifica que todas estén activas.

---

## Notas Importantes

### Datos de Testing
- NO migres datos de testing a producción
- La migración solo incluye estructura, no datos
- Empieza con base de datos limpia en producción

### Orden de Migración
Las migraciones se aplican en orden cronológico. El archivo consolidado mantiene este orden.

### Funciones Críticas
Estas funciones son críticas para el funcionamiento:
- `generate_medical_alerts()` - Genera alertas médicas automáticamente
- `update_updated_at_column()` - Actualiza timestamps
- `handle_new_user()` - Crea perfil al registrar usuario
- `cleanup_expired_cache()` - Limpia caché de IA

### Triggers Importantes
- `trigger_medical_alerts_on_health_insert` - Crea alertas al agregar salud
- `trigger_update_updated_at` - Actualiza timestamps
- `trigger_create_profile_on_signup` - Crea perfil al registrar

### Extensiones Requeridas
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_net";
```

---

## Troubleshooting

### Error: "relation already exists"
Significa que la tabla ya existe. Usa `CREATE TABLE IF NOT EXISTS` o elimina las tablas existentes.

### Error: "must be owner of extension"
Ejecuta con permisos de superusuario o usa Supabase CLI.

### Edge Functions no se despliegan
Verifica que estés autenticado correctamente y que el project-ref sea correcto.

### RLS bloqueando operaciones
Verifica que las políticas RLS estén correctamente configuradas para tu caso de uso.

---

## Checklist Final

- [ ] Schema exportado correctamente
- [ ] Todas las tablas creadas en producción
- [ ] RLS habilitado en todas las tablas
- [ ] Todas las funciones creadas
- [ ] Todos los triggers activos
- [ ] Edge Functions desplegadas
- [ ] Variables de entorno configuradas
- [ ] Pruebas de funcionalidad básica
- [ ] Monitoreo configurado (Datadog/Sentry)
- [ ] Backups configurados

---

## Soporte

Si encuentras problemas durante la migración:
1. Revisa los logs de Supabase
2. Verifica los permisos de usuario
3. Consulta la documentación de Supabase
4. Revisa los triggers y funciones en el SQL Editor

