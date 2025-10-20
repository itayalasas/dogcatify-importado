# Migración Completa del Sistema de Emails a Nueva API

## Resumen
Este documento detalla todos los cambios realizados para migrar el sistema de envío de emails de la app DogCatiFy a usar la nueva API externa de emails con templates profesionales.

## 1. Cambios en Base de Datos

### 1.1 Tabla `profiles` - Campos Agregados
```sql
ALTER TABLE profiles ADD COLUMN email_confirmed boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN email_confirmed_at timestamptz;
ALTER TABLE profiles ADD COLUMN is_owner boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN is_partner boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN followers uuid[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN following uuid[] DEFAULT '{}';
```

### 1.2 Nueva Tabla `email_confirmations`
```sql
CREATE TABLE email_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('signup', 'password_reset')),
  is_confirmed boolean DEFAULT false,
  confirmed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX idx_email_confirmations_user_id ON email_confirmations(user_id);
CREATE INDEX idx_email_confirmations_token_hash ON email_confirmations(token_hash);
CREATE INDEX idx_email_confirmations_type ON email_confirmations(type);
CREATE INDEX idx_email_confirmations_is_confirmed ON email_confirmations(is_confirmed);

-- RLS
ALTER TABLE email_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage email confirmations"
  ON email_confirmations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

## 2. Variables de Entorno

### 2.1 En la App (.env)
```env
EXPO_PUBLIC_SUPABASE_URL=https://0ec90b57d6e95fcbda19832f.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key

# No se necesitan estas variables en la app
# EXPO_PUBLIC_EMAIL_API_URL
# EXPO_PUBLIC_EMAIL_API_KEY
```

### 2.2 En Supabase Edge Functions (Secrets)
Configurar en el dashboard de Supabase:
```
EMAIL_API_URL=https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/send-email
EMAIL_API_KEY=sk_bcaca188c1b16345e4d10adf403eb4e9e98d3fa9ff0bfc06a81b8ba6e2ecd72f
```

## 3. Cambios en Edge Functions

### 3.1 Edge Function `send-email` Actualizada
**Ubicación:** `supabase/functions/send-email/index.ts`

**Función:** Actúa como proxy entre la app y la API externa de emails.

**Comportamiento:**
- Intercepta requests con `template_name` y `recipient_email`
- Los reenvía a la API externa con la API key
- Rechaza requests con HTML directo (formato legacy)

**Deploy:** ✅ Ya desplegada

## 4. Cambios en el Código de la App

### 4.1 `utils/emailConfirmation.ts`
- ✅ `sendConfirmationEmailAPI()` - Envía email de confirmación usando template "confirmation"
- ✅ `sendWelcomeEmailAPI()` - Envía email de bienvenida usando template "welcome"
- Ambas funciones usan la edge function de Supabase como proxy

### 4.2 `utils/notifications.ts`
- ✅ `sendEmail()` - DEPRECATED, retorna error
- ✅ `sendWelcomeEmail()` - DEPRECATED, solo muestra warning
- ✅ `sendCustomConfirmationEmail()` - DEPRECATED, solo muestra warning

### 4.3 `contexts/AuthContext.tsx`
- ✅ Registro usa `sendConfirmationEmailAPI()`
- Registra el `log_id` de la respuesta

### 4.4 `app/auth/confirm.tsx`
- ✅ Al confirmar email, envía automáticamente el email de bienvenida
- Usa `sendWelcomeEmailAPI()`

## 5. Flujo Completo

### 5.1 Registro de Usuario
```
1. Usuario completa formulario de registro
2. App crea usuario en auth.users (Supabase Auth)
3. App crea perfil en tabla profiles
4. App crea token en tabla email_confirmations
5. App llama a sendConfirmationEmailAPI()
6. Edge Function recibe request con template_name="confirmation"
7. Edge Function reenvía a API externa
8. API externa envía email con template profesional
9. Usuario recibe email de confirmación
```

### 5.2 Confirmación de Email
```
1. Usuario hace clic en enlace del email
2. App verifica token en tabla email_confirmations
3. Si es válido:
   - Marca token como confirmado
   - Actualiza email_confirmed=true en profiles
   - Llama a sendWelcomeEmailAPI()
4. Edge Function recibe request con template_name="welcome"
5. Edge Function reenvía a API externa
6. API externa envía email de bienvenida
7. Usuario recibe email de bienvenida
```

## 6. Templates Disponibles en la API Externa

### Template "confirmation"
**Parámetros:**
```json
{
  "template_name": "confirmation",
  "recipient_email": "usuario@email.com",
  "data": {
    "client_name": "Nombre Usuario",
    "confirmation_url": "https://app-dogcatify.netlify.app/auth/confirm?token_hash=TOKEN&type=signup"
  }
}
```

### Template "welcome"
**Parámetros:**
```json
{
  "template_name": "welcome",
  "recipient_email": "usuario@email.com",
  "data": {
    "client_name": "Nombre Usuario",
    "cta_url": "dogcatify://perfil"
  }
}
```

## 7. Verificación

### ¿Cómo verificar que está funcionando?

1. **Registrar un nuevo usuario**
   - El usuario debe recibir un email de confirmación con el template profesional
   - NO debe recibir el email viejo con HTML directo

2. **Confirmar el email**
   - Al confirmar, debe recibir el email de bienvenida
   - Ambos emails deben tener el diseño profesional de la API externa

3. **Revisar logs**
   - En la edge function: `Forwarding template email: confirmation to email@ejemplo.com`
   - En el código de la app: `Confirmation email sent successfully: {log_id: "..."}`

## 8. Solución de Problemas

### Email no se envía
- Verificar que las variables EMAIL_API_URL y EMAIL_API_KEY estén configuradas en Supabase
- Verificar que la edge function esté desplegada correctamente
- Revisar logs de la edge function

### Email con formato viejo
- Verificar que la edge function esté actualizada
- Verificar que el código use `sendConfirmationEmailAPI()` y no las funciones antiguas

### Error "Email API not configured"
- Las variables EMAIL_API_URL y EMAIL_API_KEY deben estar en los secrets de Supabase, NO en el .env de la app

## 9. Checklist de Despliegue

- [x] Actualizar edge function `send-email`
- [x] Desplegar edge function `send-email`
- [ ] Aplicar migraciones de base de datos
- [x] Configurar variables en Supabase (EMAIL_API_URL, EMAIL_API_KEY)
- [x] Actualizar código de la app
- [ ] Probar flujo completo de registro
- [ ] Probar flujo completo de confirmación

## 10. Notas Importantes

- ✅ **NO se envían más emails con HTML directo desde la app**
- ✅ **Todos los emails pasan por la API externa con templates profesionales**
- ✅ **La edge function actúa como proxy para mantener segura la API key**
- ⚠️ **Las migraciones de base de datos deben aplicarse manualmente**
- ⚠️ **Las variables EMAIL_API_URL y EMAIL_API_KEY deben configurarse en Supabase Dashboard**
