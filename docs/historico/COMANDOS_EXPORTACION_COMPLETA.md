# 📦 Guía Rápida: Exportar TODO a Producción

## 🎯 Resumen: 3 Componentes a Exportar

1. **Base de Datos** (estructura + funciones SQL)
2. **Edge Functions** (31 funciones serverless)
3. **Secrets** (credenciales y API keys)

---

## ⚡ Opción Rápida: Scripts Automatizados

### 1️⃣ Exportar Base de Datos

```cmd
# Ejecutar el script de migración
MIGRATE_WINDOWS.bat
```

**Esto hace:**
- ✅ Conecta al proyecto de producción
- ✅ Aplica todas las 65+ migraciones
- ✅ Crea 50+ tablas
- ✅ Instala 47 funciones SQL
- ✅ Configura RLS

**Tiempo:** 5 minutos

---

### 2️⃣ Exportar Edge Functions + Secrets

```cmd
# Paso 1: Crear archivo de secrets desde tu .env actual
create-secrets-env.bat

# Paso 2: Editar secrets.env y completar los valores faltantes
notepad secrets.env

# Paso 3: Desplegar funciones y secrets
deploy-functions-production.bat
```

**Esto hace:**
- ✅ Extrae secrets de tu .env
- ✅ Configura todos los secrets en producción
- ✅ Despliega las 31 Edge Functions
- ✅ Verifica el despliegue

**Tiempo:** 5-10 minutos

---

## 📋 Opción Manual: Comandos Individuales

### Base de Datos

```bash
# Conectar a producción
supabase link --project-ref gfazxronwllqcswdaimh

# Aplicar migraciones
supabase db push

# Verificar
supabase db diff
```

### Edge Functions

```bash
# Ya conectado al proyecto...

# Ver funciones actuales
supabase functions list

# Desplegar todas las funciones
supabase functions deploy

# O desplegar una específica
supabase functions deploy send-email
```

### Secrets

```bash
# Ver secrets actuales (solo nombres, no valores)
supabase secrets list

# Configurar un secret individual
supabase secrets set NOMBRE_SECRET=valor

# Configurar desde archivo
supabase secrets set --env-file secrets.env

# Eliminar un secret
supabase secrets unset NOMBRE_SECRET
```

---

## 🔑 Secrets Necesarios

Crea un archivo `secrets.env` con estos valores:

```env
# Firebase (Notificaciones Push)
FIREBASE_PRIVATE_KEY_ID=tu_valor
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@tu-proyecto.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=tu_client_id
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/...

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxx

# Pagos (MercadoPago)
MERCADOPAGO_ACCESS_TOKEN=APP-xxxxxxxx
MERCADOPAGO_PUBLIC_KEY=APP_USR-xxxxxxxx

# IA (OpenAI)
OPENAI_API_KEY=sk-xxxxxxxx

# OCR (Google Cloud)
GOOGLE_CLOUD_PROJECT_ID=tu-proyecto
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_CLOUD_CLIENT_EMAIL=tu@tu-proyecto.iam.gserviceaccount.com
```

Luego:

```bash
supabase secrets set --env-file secrets.env
```

---

## 📊 Listado Completo de Edge Functions

Tu proyecto tiene **31 Edge Functions**:

### Autenticación y Usuarios
1. `create-user` - Crear usuario
2. `delete-user` - Eliminar usuario
3. `reset-password` - Reset contraseña

### Comunicaciones
4. `send-email` - Enviar emails
5. `send-push-notification` - Notificaciones push
6. `send-notification-fcm-v1` - FCM v1
7. `send-scheduled-notifications` - Notificaciones programadas
8. `send-medical-reminders` - Recordatorios médicos
9. `send-booking-confirmations` - Confirmaciones de reserva

### Pagos y Órdenes
10. `mercadopago-webhook` - Webhook de MercadoPago
11. `orders-api` - API de órdenes
12. `cancel-expired-orders` - Cancelar órdenes vencidas
13. `notify-order-webhook` - Notificar webhook de orden
14. `dogcatify-order-webhook` - Webhook CRM

### Facturación
15. `generate-promotion-invoice` - Factura promociones
16. `send-invoice-email` - Enviar factura por email

### Historial Médico
17. `medical-history` - Historial médico
18. `medical-history-data` - Datos médicos
19. `medical-notifications` - Notificaciones médicas
20. `save-medical-record` - Guardar registro médico

### IA - Recomendaciones Médicas
21. `generate-vaccine-recommendations` - Recomendaciones vacunas
22. `generate-dewormer-recommendations` - Recomendaciones antiparasitarios
23. `generate-illness-recommendations` - Recomendaciones enfermedades
24. `generate-treatment-recommendations` - Recomendaciones tratamientos
25. `generate-allergy-recommendations` - Recomendaciones alergias
26. `generate-behavior-recommendations` - Recomendaciones comportamiento
27. `get-vaccine-info` - Info de vacunas

### OCR y Procesamiento
28. `scan-vaccination-card` - Escanear carnet vacunación
29. `extract-medical-card-info` - Extraer info carnet médico

### Reservas
30. `confirm-booking` - Confirmar reserva

### Utilidades
31. `upload-image` - Subir imágenes

---

## ✅ Verificación Post-Despliegue

### 1. Verificar Base de Datos

```sql
-- En SQL Editor de Supabase

-- Contar tablas (debe ser 50+)
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public';

-- Contar funciones SQL (debe ser 47)
SELECT count(*) FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

-- Verificar RLS activo
SELECT count(*) FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;
```

### 2. Verificar Edge Functions

```bash
# Listar funciones desplegadas
supabase functions list

# Ver logs de una función
supabase functions logs send-email

# Probar una función
supabase functions invoke send-email --method POST --body '{"to":"test@example.com","subject":"Test"}'
```

### 3. Verificar Secrets

```bash
# Listar secrets configurados (solo nombres)
supabase secrets list

# Debe mostrar aproximadamente:
# - FIREBASE_PRIVATE_KEY_ID
# - FIREBASE_PRIVATE_KEY
# - FIREBASE_CLIENT_EMAIL
# - RESEND_API_KEY
# - MERCADOPAGO_ACCESS_TOKEN
# - etc.
```

---

## 🔄 Actualizar Después de Cambios

### Actualizar Base de Datos

```bash
# Crear nueva migración
supabase db diff -f nombre_cambio

# Aplicar a producción
supabase link --project-ref gfazxronwllqcswdaimh
supabase db push
```

### Actualizar Edge Functions

```bash
# Desplegar todas
supabase functions deploy

# O solo una
supabase functions deploy nombre-funcion
```

### Actualizar Secrets

```bash
# Actualizar un secret
supabase secrets set NOMBRE=nuevo_valor

# O desde archivo
supabase secrets set --env-file secrets.env
```

---

## 📁 Archivos de Ayuda Creados

1. **MIGRATE_WINDOWS.bat** - Script Windows para migrar BD
2. **deploy-functions-production.bat** - Script Windows para Edge Functions
3. **create-secrets-env.bat** - Crear archivo secrets.env
4. **secrets.env.template** - Template de secrets
5. **MIGRATE_TO_PRODUCTION.md** - Guía completa migración BD
6. **EXPORTAR_EDGE_FUNCTIONS.md** - Guía completa Edge Functions
7. **CONEXION_CORRECTA.md** - Cómo conectar con psql
8. **RESUMEN_MIGRACION.md** - Resumen ejecutivo
9. **PRODUCTION_COMPLETE_EXPORT.sql** - Lista de migraciones
10. **FUNCTIONS_EXPORT.sql** - Backup de funciones SQL

---

## 🎯 Proceso Completo (10-15 minutos)

```
1. Migrar Base de Datos (5 min)
   └─> MIGRATE_WINDOWS.bat

2. Crear archivo de secrets (2 min)
   └─> create-secrets-env.bat
   └─> Editar secrets.env

3. Desplegar Edge Functions (5 min)
   └─> deploy-functions-production.bat

4. Verificar (3 min)
   └─> Probar funciones críticas
   └─> Revisar logs
   └─> Verificar en Dashboard
```

---

## 🆘 Problemas Comunes

### "Wrong password"
**Solución:** Obtén la contraseña desde Dashboard → Settings → Database

### "Function deployment failed"
**Solución:** Revisa los logs con `supabase functions logs nombre-funcion`

### "Secret value is invalid"
**Solución:** Verifica que los private keys estén en una línea con `\n`

### "No schema changes detected" al hacer db diff
**Esto es BUENO**, significa que todo está sincronizado ✅

---

## 📞 Comandos de Ayuda

```bash
# Ver ayuda general
supabase help

# Ayuda de base de datos
supabase db help

# Ayuda de funciones
supabase functions help

# Ayuda de secrets
supabase secrets help

# Ver estado del proyecto
supabase status

# Ver logs completos
supabase logs
```

---

## 🎉 Checklist Final

- [ ] Base de datos migrada (65+ migraciones aplicadas)
- [ ] 50+ tablas creadas
- [ ] 47 funciones SQL instaladas
- [ ] RLS activo en todas las tablas
- [ ] 31 Edge Functions desplegadas
- [ ] ~12 Secrets configurados
- [ ] Funciones críticas probadas
- [ ] Logs revisados sin errores
- [ ] Variables de entorno actualizadas en la app
- [ ] Webhooks externos configurados (MercadoPago)

---

**✨ ¡Tu proyecto está listo para producción!**

---

**Referencias rápidas:**
- Dashboard Producción: https://supabase.com/dashboard/project/gfazxronwllqcswdaimh
- Documentación Supabase CLI: https://supabase.com/docs/guides/cli
- Project Ref: `gfazxronwllqcswdaimh`

---

**Última actualización:** 2025-11-10
