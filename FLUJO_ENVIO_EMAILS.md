# 📧 Flujo de Envío de Emails en DogCatiFy

## 📋 Índice
1. [Registro de Usuario](#1-registro-de-usuario)
2. [Recuperación de Contraseña](#2-recuperación-de-contraseña)
3. [Componentes del Sistema](#3-componentes-del-sistema)
4. [Edge Functions](#4-edge-functions)

---

## 1. Registro de Usuario

### Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│                     REGISTRO DE USUARIO                              │
└─────────────────────────────────────────────────────────────────────┘

1. Usuario completa formulario
   ├─ Nombre completo
   ├─ Email
   ├─ Contraseña
   └─ Acepta términos

2. app/auth/register.tsx
   └─ handleRegister()
      ├─ Valida campos
      └─ Llama a Edge Function "create-user"

3. Supabase Edge Function: create-user
   ├─ Crea usuario en auth.users
   ├─ Genera token de confirmación
   ├─ Almacena token en email_confirmations
   └─ Envía email de confirmación

4. utils/emailConfirmation.ts
   ├─ generateConfirmationToken()
   ├─ createEmailConfirmationToken()
   │  └─ Expira en 24 horas
   └─ generateConfirmationUrl()

5. utils/notifications.ts
   └─ NotificationService.sendCustomConfirmationEmail()
      └─ Llama a Edge Function "send-email"

6. supabase/functions/send-email/index.ts
   ├─ Configura SMTP (Nodemailer)
   │  ├─ Host: smtpout.secureserver.net
   │  ├─ Port: 465
   │  └─ User: info@dogcatify.com
   ├─ Usa template de emailTemplates.ts
   └─ Envía email

7. Usuario recibe email
   └─ Hace clic en link de confirmación

8. app/auth/confirm.tsx
   ├─ Extrae token de URL
   └─ Llama a confirmEmailCustom()

9. utils/emailConfirmation.ts
   └─ confirmEmailCustom()
      ├─ Verifica token en email_confirmations
      ├─ Valida que no esté expirado
      ├─ Marca token como confirmado
      ├─ Actualiza auth.users (email_confirm = true)
      └─ Actualiza profiles (email_confirmed = true)

10. Usuario es redirigido a login
    └─ Puede iniciar sesión
```

### Clases y Archivos Involucrados

| Archivo | Responsabilidad |
|---------|-----------------|
| `app/auth/register.tsx` | UI del formulario de registro |
| `utils/emailConfirmation.ts` | Gestión de tokens y confirmación |
| `utils/emailTemplates.ts` | Templates HTML de emails |
| `utils/notifications.ts` | Servicio de notificaciones por email |
| `supabase/functions/send-email/index.ts` | Edge Function para enviar emails vía SMTP |
| `supabase/functions/create-user/index.ts` | Edge Function para crear usuarios |
| `app/auth/confirm.tsx` | Página de confirmación de email |

---

## 2. Recuperación de Contraseña

### Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│              RECUPERACIÓN DE CONTRASEÑA                              │
└─────────────────────────────────────────────────────────────────────┘

1. Usuario ingresa email
   └─ app/auth/forgot-password.tsx

2. app/auth/forgot-password.tsx
   └─ handleResetPassword()
      ├─ Valida que el email exista
      ├─ Busca usuario en tabla profiles
      └─ Si existe, continúa

3. utils/emailConfirmation.ts
   ├─ createEmailConfirmationToken()
   │  ├─ type: 'password_reset'
   │  └─ Expira en 24 horas
   └─ generateConfirmationUrl()
      └─ /auth/reset-password?token=xxx

4. utils/notifications.ts
   └─ NotificationService.sendPasswordResetEmail()
      ├─ Usa template personalizado
      └─ Llama a Edge Function "send-email"

5. supabase/functions/send-email/index.ts
   ├─ Configura SMTP
   ├─ Usa template HTML
   └─ Envía email con link de reset

6. Usuario recibe email
   └─ Hace clic en link de reset

7. app/auth/reset-password.tsx
   ├─ Extrae token de URL
   ├─ Usuario ingresa nueva contraseña
   └─ Llama a Edge Function "reset-password"

8. supabase/functions/reset-password/index.ts
   ├─ Verifica token en email_confirmations
   ├─ Valida que no esté expirado
   ├─ Valida que no esté usado (is_confirmed = false)
   ├─ Actualiza contraseña en auth.users
   │  └─ supabase.auth.admin.updateUserById()
   └─ Marca token como usado

9. Usuario es redirigido a login
   └─ Puede iniciar sesión con nueva contraseña
```

### Clases y Archivos Involucrados

| Archivo | Responsabilidad |
|---------|-----------------|
| `app/auth/forgot-password.tsx` | UI para solicitar reset de contraseña |
| `app/auth/reset-password.tsx` | UI para establecer nueva contraseña |
| `utils/emailConfirmation.ts` | Gestión de tokens de reset |
| `utils/notifications.ts` | Envío de email de reset |
| `supabase/functions/reset-password/index.ts` | Edge Function para actualizar contraseña |
| `supabase/functions/send-email/index.ts` | Edge Function para enviar emails |

---

## 3. Componentes del Sistema

### 3.1 Email Templates (`utils/emailTemplates.ts`)

Contiene templates HTML para diferentes tipos de emails:

```typescript
EmailTemplates {
  welcome(name, activationLink)
  bookingConfirmation(name, serviceName, partnerName, date, time, petName)
  bookingCancellation(name, serviceName, partnerName, date, time)
  bookingReminder(name, serviceName, partnerName, date, time, petName)
  partnerRegistration(businessName, businessType)
  partnerApproved(businessName, businessType)
  partnerRejected(businessName, reason)
}
```

**Características:**
- HTML con inline CSS para compatibilidad
- Diseño responsive
- Logo de DogCatiFy
- Colores de marca (#2D6A6F)

### 3.2 Email Confirmation (`utils/emailConfirmation.ts`)

Gestiona la lógica de confirmación y tokens:

```typescript
// Funciones principales
generateConfirmationToken(): Promise<string>
createEmailConfirmationToken(userId, email, type): Promise<string>
confirmEmailCustom(token, type): Promise<{success, userId, email, error}>
isEmailConfirmed(userId): Promise<boolean>
completeUserRegistration(userId, email, displayName): Promise<{success, error}>
generateConfirmationUrl(token, type): string
resendConfirmationEmail(email): Promise<{success, error}>
```

**Características:**
- Tokens únicos y seguros
- Expiración de 24 horas
- Soporte para múltiples tipos (signup, password_reset)
- Validación de tokens usados y expirados

### 3.3 Notification Service (`utils/notifications.ts`)

Servicio centralizado para envío de notificaciones:

```typescript
NotificationService {
  sendCustomConfirmationEmail(email, name, confirmationUrl)
  sendPasswordResetEmail(email, name, resetUrl)
  sendPushNotification(token, title, body, data)
  // ... otros métodos
}
```

### 3.4 Tabla: email_confirmations

Estructura de la tabla en Supabase:

```sql
CREATE TABLE email_confirmations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  type TEXT NOT NULL, -- 'signup' | 'password_reset'
  is_confirmed BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);
```

---

## 4. Edge Functions

### 4.1 send-email

**Ruta:** `supabase/functions/send-email/index.ts`

**Propósito:** Enviar emails usando SMTP (Nodemailer)

**Request:**
```typescript
{
  to: string,
  subject: string,
  text?: string,
  html?: string,
  attachment?: string // Base64 para PDFs
}
```

**Configuración SMTP:**
- Host: `smtpout.secureserver.net`
- Port: `465` (SSL)
- User: `info@dogcatify.com`
- Password: Almacenada en variables de entorno

**Response:**
```typescript
{
  success: boolean,
  messageId?: string,
  timestamp: string
}
```

### 4.2 reset-password

**Ruta:** `supabase/functions/reset-password/index.ts`

**Propósito:** Actualizar contraseña de usuario

**Request:**
```typescript
{
  userId: string,
  newPassword: string,
  token: string
}
```

**Flujo:**
1. Verifica token en `email_confirmations`
2. Valida que no esté expirado
3. Valida que no esté usado
4. Actualiza contraseña usando `supabase.auth.admin.updateUserById()`
5. Marca token como usado

**Response:**
```typescript
{
  success: boolean,
  error?: string
}
```

---

## 5. Diagrama de Secuencia - Registro

```
Usuario          register.tsx     create-user      emailConfirmation    send-email       SMTP
  |                  |                 |                   |                 |            |
  |-- Complete form->|                 |                   |                 |            |
  |                  |-- POST -------->|                   |                 |            |
  |                  |                 |-- Generate token->|                 |            |
  |                  |                 |                   |-- Save DB ----->|            |
  |                  |                 |                   |                 |            |
  |                  |                 |-- Send email -------------------->|             |
  |                  |                 |                   |                 |-- SMTP -->|
  |                  |                 |                   |                 |            |
  |<--------- Success alert ----------|                   |                 |            |
  |                  |                 |                   |                 |            |
  |<-------------- Email -----------------------------------------------------------|    |
  |                  |                 |                   |                 |            |
  |-- Click link --->|                 |                   |                 |            |
  |                  |-- Verify token----------------->|                 |            |
  |                  |                 |                   |-- Mark confirmed             |
  |                  |                 |                   |-- Update auth.users          |
  |<-- Login page ---|                 |                   |                 |            |
```

## 6. Diagrama de Secuencia - Reset Password

```
Usuario      forgot-password.tsx   emailConfirmation    send-email    reset-password.tsx    reset-password (edge)
  |                  |                   |                 |                 |                      |
  |-- Enter email -->|                   |                 |                 |                      |
  |                  |-- Verify user --->|                 |                 |                      |
  |                  |-- Generate token->|                 |                 |                      |
  |                  |                   |-- Save DB ----->|                 |                      |
  |                  |-- Send email ---------->|           |                 |                      |
  |                  |                   |                 |-- SMTP -------->|                      |
  |<--------- Email sent ----------------------------------------------------|                      |
  |                  |                   |                 |                 |                      |
  |<-------------- Email with link ------------------------------------------------|                |
  |                  |                   |                 |                 |                      |
  |-- Click link ------------------------------------------------>|           |                      |
  |-- Enter new pwd->|                   |                 |                 |                      |
  |                  |-- POST -------------------------------------------------------->|            |
  |                  |                   |                 |                 |                      |-- Verify token
  |                  |                   |                 |                 |                      |-- Update password
  |                  |                   |                 |                 |                      |-- Mark token used
  |<-- Success ----------------------------------------------------------------------|              |
  |-- Redirect to login                                                                              |
```

---

## 7. Variables de Entorno Requeridas

```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx
EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=xxx

# SMTP (en Supabase Edge Functions)
SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=465
SMTP_USER=info@dogcatify.com
SMTP_PASSWORD=xxx

# App
EXPO_PUBLIC_APP_DOMAIN=http://localhost:8081
```

---

## 8. Mejoras Sugeridas

1. **Rate Limiting:** Limitar intentos de envío de emails
2. **Queue System:** Usar cola para emails (ej: BullMQ)
3. **Email Templates:** Separar templates en archivos HTML individuales
4. **Logging:** Mejorar logs de envío de emails
5. **Retry Logic:** Reintentos automáticos si falla el envío
6. **Email Tracking:** Rastrear aperturas y clics
7. **Multi-language:** Templates en español e inglés
8. **Unsubscribe:** Link para cancelar suscripción a notificaciones

---

## 9. Troubleshooting

### Email no llega

1. Verificar configuración SMTP en Edge Function
2. Verificar que el email no esté en spam
3. Verificar logs de Supabase Edge Functions
4. Verificar que el token no haya expirado (24 horas)

### Token inválido

1. Verificar que el token en la URL esté completo
2. Verificar que no haya expirado
3. Verificar que no se haya usado antes
4. Verificar en tabla `email_confirmations`

### Usuario no puede iniciar sesión después de confirmar

1. Verificar que `email_confirmed = true` en `profiles`
2. Verificar que `email_confirm = true` en `auth.users`
3. Verificar que el usuario exista en ambas tablas

---

## 10. Testing

### Test de Registro

```bash
# 1. Registrar usuario
POST /functions/v1/create-user
{
  "email": "test@example.com",
  "password": "test123",
  "displayName": "Test User"
}

# 2. Verificar email en email_confirmations
SELECT * FROM email_confirmations WHERE email = 'test@example.com';

# 3. Extraer token y confirmar
GET /auth/confirm?token_hash=xxx&type=signup

# 4. Verificar usuario confirmado
SELECT email_confirmed FROM profiles WHERE email = 'test@example.com';
```

### Test de Reset Password

```bash
# 1. Solicitar reset
POST /auth/forgot-password
{
  "email": "test@example.com"
}

# 2. Verificar token en email_confirmations
SELECT * FROM email_confirmations
WHERE email = 'test@example.com' AND type = 'password_reset';

# 3. Usar token para cambiar contraseña
POST /functions/v1/reset-password
{
  "userId": "xxx",
  "newPassword": "newpass123",
  "token": "xxx"
}

# 4. Login con nueva contraseña
POST /auth/v1/token
{
  "email": "test@example.com",
  "password": "newpass123"
}
```
