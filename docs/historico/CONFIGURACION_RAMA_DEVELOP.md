# Configuración Rama Develop - Dogcatify

## 🎯 Información del Proyecto

### Branch: `develop`
- **Project ID:** `gfazxronwllqcswdaimh`
- **Dominio Personalizado:** `dev-db.dogcatify.com`
- **URL Supabase:** `https://gfazxronwllqcswdaimh.supabase.co`
- **Entorno:** Development

---

## ✅ Estado Actual

### Base de Datos
- ✅ Todas las tablas creadas (20+ tablas)
- ✅ Trigger `on_auth_user_created` configurado
- ✅ 24 usuarios con sus 24 profiles
- ✅ Todas las migraciones aplicadas

### Edge Functions
- ✅ 31 Edge Functions desplegadas y activas
- ✅ Funciones críticas:
  - `send-email` - Envío de emails
  - `reset-password` - Recuperación de contraseña
  - `mercadopago-webhook` - Pagos
  - `send-notification-fcm-v1` - Notificaciones push
  - `confirm-booking` - Confirmación de reservas

### Configuración
- ✅ `.env` configurado con credenciales correctas
- ✅ DataDog configurado para environment `development`
- ✅ Email API URL configurada

---

## 🔑 Credenciales (.env)

```env
EXPO_PUBLIC_SUPABASE_URL=https://gfazxronwllqcswdaimh.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_HfS3v-qThT0pqBjO2PrLWA_zkaI4UTX
EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EXPO_PUBLIC_PROJECT_ID=gfazxronwllqcswdaimh
EXPO_PUBLIC_EMAIL_API_URL=https://gfazxronwllqcswdaimh.supabase.co/functions/v1/send-email
EXPO_PUBLIC_DATADOG_ENV=development
```

---

## 📋 Configuración Requerida en Supabase Dashboard

### 1. Authentication Settings
Ir a: https://supabase.com/dashboard/project/gfazxronwllqcswdaimh/auth/providers

#### Email Provider
- ✅ **Enable email provider:** ON
- ✅ **Enable email signup:** ON
- ❌ **Confirm email:** OFF (usamos nuestra API personalizada)

#### URL Configuration
- **Site URL:** `http://localhost:8081` (desarrollo) o tu dominio en producción
- **Redirect URLs:** Agregar:
  - `exp://localhost:8081`
  - `dogcatify://`
  - `https://dogcatify.com`

---

## 🔧 Secrets de Edge Functions

Los siguientes secrets ya están configurados en Supabase (verificar en Dashboard):

### Firebase (Notificaciones Push)
```
FIREBASE_PRIVATE_KEY_ID
FIREBASE_PRIVATE_KEY
FIREBASE_CLIENT_EMAIL
FIREBASE_CLIENT_ID
FIREBASE_CLIENT_CERT_URL
```

### Resend (Email)
```
RESEND_API_KEY=re_bcaca188c1b16345e4d10adf403eb4e9e98d3fa9ff0bfc06a81b8ba6e2ecd72f
```

---

## 🚀 Cómo Usar esta Rama

### 1. Reiniciar el Servidor de Desarrollo
```bash
# Detener el servidor actual (Ctrl+C)
npm start
```

### 2. Probar Registro de Usuario
El flujo correcto será:

1. ✅ Usuario se registra en la app
2. ✅ Se crea en `auth.users`
3. ✅ El trigger auto-crea el profile en `profiles`
4. ✅ Se genera un token de confirmación
5. ✅ Se envía email de confirmación desde tu API (Edge Function `send-email`)
6. ✅ Usuario confirma email
7. ✅ Campo `email_confirmed` se actualiza a `true`

### 3. Verificar Logs
```sql
-- Ver últimos usuarios registrados
SELECT
  u.id,
  u.email,
  u.created_at as user_created,
  p.display_name,
  p.email_confirmed
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 10;
```

---

## 🔍 Troubleshooting

### Problema: No se crea el profile
**Solución:** Verificar que el trigger existe:
```sql
SELECT * FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

### Problema: No llegan los emails
**Verificar:**
1. Edge Function `send-email` está desplegada
2. Secret `RESEND_API_KEY` está configurado
3. Logs de la Edge Function en Dashboard

### Problema: Credenciales incorrectas
**Verificar:** Que el `.env` tenga las 3 credenciales del **mismo proyecto**:
- URL debe contener: `gfazxronwllqcswdaimh`
- ANON_KEY debe ser de: `gfazxronwllqcswdaimh`
- SERVICE_ROLE_KEY debe ser de: `gfazxronwllqcswdaimh`

---

## 🆚 Diferencia con Rama Main

### Rama `main` (zkgiwamycbjcogcgqhff)
- Entorno: Production
- Dominio: Supabase por defecto
- Datos: Usuarios reales

### Rama `develop` (gfazxronwllqcswdaimh) - ACTUAL
- Entorno: Development
- Dominio personalizado: `dev-db.dogcatify.com`
- Datos: Usuarios de prueba

---

## ✅ Checklist de Verificación

Antes de empezar a trabajar, verificar:

- [ ] `.env` tiene las credenciales de `gfazxronwllqcswdaimh`
- [ ] Servidor de desarrollo reiniciado
- [ ] Puedo acceder al Dashboard: https://supabase.com/dashboard/project/gfazxronwllqcswdaimh
- [ ] Auth settings configurados (email signup ON, confirm email OFF)
- [ ] Probé registro de usuario nuevo
- [ ] El profile se creó automáticamente
- [ ] Recibí el email de confirmación

---

## 📞 Soporte

Si algo no funciona:
1. Verificar logs en Supabase Dashboard > Edge Functions
2. Verificar tabla `email_confirmations` para tokens
3. Verificar que el trigger existe en la base de datos
4. Verificar que las credenciales en `.env` son correctas

---

**Última actualización:** 2025-01-11
**Estado:** ✅ Configuración completa y funcional
