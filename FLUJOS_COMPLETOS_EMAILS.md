# 📧 Flujos Completos de Comunicación por Email - DogCatiFy

## 📋 Índice de Flujos

1. [Registro de Usuario](#1-registro-de-usuario)
2. [Recuperación de Contraseña](#2-recuperación-de-contraseña)
3. [Registro de Negocio (Partner)](#3-registro-de-negocio-partner)
4. [Aprobación de Negocio](#4-aprobación-de-negocio)
5. [Rechazo de Negocio](#5-rechazo-de-negocio)
6. [Confirmación de Reserva](#6-confirmación-de-reserva)
7. [Cancelación de Reserva](#7-cancelación-de-reserva)
8. [Recordatorio de Cita](#8-recordatorio-de-cita)
9. [Facturación de Promociones](#9-facturación-de-promociones)
10. [Mensaje de Chat de Adopción](#10-mensaje-de-chat-de-adopción)

---

## 1. Registro de Usuario

### 🎯 Objetivo
Confirmar el email del usuario cuando se registra en la plataforma.

### 📊 Flujo Completo

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         REGISTRO DE USUARIO                               │
└──────────────────────────────────────────────────────────────────────────┘

1. INICIO: Usuario completa formulario
   ├─ Nombre completo
   ├─ Email
   ├─ Contraseña
   └─ Acepta términos y condiciones

2. VALIDACIÓN FRONTEND (app/auth/register.tsx)
   ├─ handleRegister()
   ├─ Valida campos requeridos
   ├─ Verifica que las contraseñas coincidan
   ├─ Verifica longitud mínima de contraseña (6 caracteres)
   └─ Verifica aceptación de términos

3. LLAMADA A EDGE FUNCTION
   └─ POST /functions/v1/create-user
      ├─ Body: { email, password, displayName }
      └─ Headers: Authorization Bearer (ANON_KEY)

4. EDGE FUNCTION: create-user
   ├─ Crea usuario en auth.users (Supabase Auth)
   ├─ Genera token único de confirmación
   ├─ Almacena token en tabla email_confirmations
   │  ├─ user_id
   │  ├─ email
   │  ├─ token_hash
   │  ├─ type: 'signup'
   │  ├─ is_confirmed: false
   │  └─ expires_at: +24 horas
   └─ Envía email de confirmación

5. GENERACIÓN DE TOKEN (utils/emailConfirmation.ts)
   ├─ generateConfirmationToken()
   │  └─ Genera token alfanumérico único
   ├─ createEmailConfirmationToken()
   │  └─ Inserta en DB con expiración de 24h
   └─ generateConfirmationUrl()
      └─ URL: {APP_DOMAIN}/auth/confirm?token_hash={token}&type=signup

6. ENVÍO DE EMAIL (utils/notifications.ts)
   └─ NotificationService.sendCustomConfirmationEmail(email, name, url)
      ├─ Subject: "¡Confirma tu cuenta en DogCatiFy!"
      ├─ Template: HTML personalizado con botón CTA
      └─ Llama a Edge Function: send-email

7. EDGE FUNCTION: send-email
   ├─ Configuración SMTP (Nodemailer)
   │  ├─ Host: smtpout.secureserver.net
   │  ├─ Port: 465 (SSL)
   │  ├─ User: info@dogcatify.com
   │  └─ Password: desde ENV
   ├─ Crea transporter
   ├─ Prepara email con HTML
   └─ Envía vía SMTP

8. USUARIO RECIBE EMAIL
   ├─ Abre email
   ├─ Hace clic en botón "Confirmar mi correo electrónico"
   └─ Redirigido a: /auth/confirm?token_hash={token}&type=signup

9. CONFIRMACIÓN (app/auth/confirm.tsx)
   ├─ Extrae token de URL
   ├─ Llama a confirmEmailCustom(token, 'signup')
   └─ Procesa resultado

10. VERIFICACIÓN DE TOKEN (utils/emailConfirmation.ts)
    └─ confirmEmailCustom()
       ├─ Busca token en email_confirmations
       ├─ Valida que exista
       ├─ Valida que no esté usado (is_confirmed = false)
       ├─ Valida que no esté expirado (expires_at > now)
       ├─ Marca token como confirmado:
       │  ├─ is_confirmed = true
       │  └─ confirmed_at = now
       ├─ Actualiza auth.users:
       │  └─ email_confirm = true
       └─ Actualiza profiles:
          ├─ email_confirmed = true
          └─ email_confirmed_at = now

11. RESULTADO
    ├─ Usuario confirmado exitosamente
    ├─ Redirigido a login
    └─ Puede iniciar sesión
```

### 📦 Componentes Involucrados

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| UI Registro | `app/auth/register.tsx` | Formulario y validación frontend |
| UI Confirmación | `app/auth/confirm.tsx` | Procesa confirmación de email |
| Gestión Tokens | `utils/emailConfirmation.ts` | Crea y valida tokens |
| Templates Email | `utils/emailTemplates.ts` | Templates HTML |
| Servicio Email | `utils/notifications.ts` | Envío de emails |
| Edge Function Create User | `supabase/functions/create-user/` | Crea usuario y token |
| Edge Function Send Email | `supabase/functions/send-email/` | SMTP sender |

### 📋 Tabla Utilizada

```sql
email_confirmations
├─ id (uuid, PK)
├─ user_id (uuid, FK to auth.users)
├─ email (text)
├─ token_hash (text, unique)
├─ type (text: 'signup' | 'password_reset')
├─ is_confirmed (boolean, default: false)
├─ expires_at (timestamptz)
├─ created_at (timestamptz)
└─ confirmed_at (timestamptz, nullable)
```

---

## 2. Recuperación de Contraseña

### 🎯 Objetivo
Permitir al usuario restablecer su contraseña si la olvida.

### 📊 Flujo Completo

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    RECUPERACIÓN DE CONTRASEÑA                             │
└──────────────────────────────────────────────────────────────────────────┘

1. INICIO: Usuario solicita reset
   └─ Ingresa email en formulario

2. VALIDACIÓN (app/auth/forgot-password.tsx)
   └─ handleResetPassword()
      ├─ Verifica que el email exista
      └─ Busca usuario en tabla profiles

3. VERIFICACIÓN DE USUARIO
   └─ Query: SELECT id, display_name FROM profiles WHERE email = ?
      ├─ Si no existe: Error "Usuario no encontrado"
      └─ Si existe: Continúa

4. GENERACIÓN DE TOKEN
   └─ createEmailConfirmationToken(userId, email, 'password_reset')
      ├─ Genera token único
      ├─ Inserta en email_confirmations
      │  ├─ type: 'password_reset'
      │  └─ expires_at: +24 horas
      └─ Retorna token

5. GENERACIÓN DE URL
   └─ generateConfirmationUrl(token, 'password_reset')
      └─ URL: {APP_DOMAIN}/auth/reset-password?token={token}

6. ENVÍO DE EMAIL
   └─ NotificationService.sendPasswordResetEmail(email, name, resetUrl)
      ├─ Subject: "Restablecer tu contraseña - DogCatiFy"
      ├─ Template: HTML profesional con gradientes
      ├─ Incluye:
      │  ├─ Botón CTA "Restablecer mi contraseña"
      │  ├─ URL alternativa para copiar/pegar
      │  ├─ Aviso de expiración (24 horas)
      │  └─ Nota de seguridad
      └─ Llama a send-email Edge Function

7. USUARIO RECIBE EMAIL
   ├─ Abre email
   ├─ Hace clic en "Restablecer mi contraseña"
   └─ Redirigido a: /auth/reset-password?token={token}

8. FORMULARIO DE NUEVA CONTRASEÑA (app/auth/reset-password.tsx)
   ├─ Extrae token de URL
   ├─ Usuario ingresa nueva contraseña
   ├─ Usuario confirma nueva contraseña
   └─ Submit

9. ACTUALIZACIÓN DE CONTRASEÑA
   └─ POST /functions/v1/reset-password
      ├─ Body: { userId, newPassword, token }
      └─ Headers: Authorization

10. EDGE FUNCTION: reset-password
    ├─ Verifica token en email_confirmations
    ├─ Valida que:
    │  ├─ Token exista
    │  ├─ type = 'password_reset'
    │  ├─ user_id coincida
    │  ├─ is_confirmed = false (no usado)
    │  └─ No esté expirado
    ├─ Actualiza contraseña:
    │  └─ supabase.auth.admin.updateUserById(userId, { password })
    └─ Marca token como usado:
       ├─ is_confirmed = true
       └─ confirmed_at = now

11. RESULTADO
    ├─ Contraseña actualizada
    ├─ Usuario redirigido a login
    └─ Puede iniciar sesión con nueva contraseña
```

### 📦 Componentes Involucrados

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| UI Forgot Password | `app/auth/forgot-password.tsx` | Solicitud de reset |
| UI Reset Password | `app/auth/reset-password.tsx` | Nueva contraseña |
| Gestión Tokens | `utils/emailConfirmation.ts` | Tokens de reset |
| Servicio Email | `utils/notifications.ts` | Envío de email |
| Edge Function Reset | `supabase/functions/reset-password/` | Actualiza contraseña |
| Edge Function Send Email | `supabase/functions/send-email/` | SMTP sender |

---

## 3. Registro de Negocio (Partner)

### 🎯 Objetivo
Notificar al partner que su solicitud de registro fue recibida.

### 📊 Flujo Completo

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      REGISTRO DE NEGOCIO                                  │
└──────────────────────────────────────────────────────────────────────────┘

1. INICIO: Usuario completa formulario de partner
   ├─ Nombre del negocio
   ├─ Tipo de negocio (veterinaria, grooming, etc.)
   ├─ Email
   ├─ Teléfono
   ├─ Dirección
   └─ Certificaciones (opcional)

2. ENVÍO DE SOLICITUD (app/(tabs)/partner-register.tsx)
   └─ handleSubmit()
      ├─ Valida campos requeridos
      ├─ Inserta en tabla partners:
      │  ├─ user_id
      │  ├─ business_name
      │  ├─ business_type
      │  ├─ email
      │  ├─ phone
      │  ├─ address
      │  ├─ is_verified: false
      │  └─ is_active: false
      └─ Envía email de confirmación

3. ENVÍO DE EMAIL
   └─ NotificationService.sendPartnerRegistrationEmail(
        email,
        businessName,
        businessType
      )
      ├─ Subject: "Solicitud de Registro Recibida - DogCatiFy"
      ├─ Template: EmailTemplates.partnerRegistration()
      ├─ Contenido:
      │  ├─ Agradecimiento por registrarse
      │  ├─ Notifica revisión en 24-48 horas
      │  └─ Sugiere preparar información
      └─ Llama a send-email

4. PARTNER RECIBE EMAIL
   ├─ Confirmación de recepción
   ├─ Tiempo estimado de revisión
   └─ Espera aprobación del admin
```

### 📦 Componentes Involucrados

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| UI Registro Partner | `app/(tabs)/partner-register.tsx` | Formulario de registro |
| Template Email | `utils/emailTemplates.ts` | partnerRegistration() |
| Servicio Email | `utils/notifications.ts` | sendPartnerRegistrationEmail() |
| Edge Function Send Email | `supabase/functions/send-email/` | SMTP sender |

### 📋 Tabla Utilizada

```sql
partners
├─ id (uuid, PK)
├─ user_id (uuid, FK to profiles)
├─ business_name (text)
├─ business_type (text)
├─ email (text)
├─ phone (text)
├─ address (text)
├─ is_verified (boolean, default: false)
├─ is_active (boolean, default: false)
├─ created_at (timestamptz)
└─ updated_at (timestamptz)
```

---

## 4. Aprobación de Negocio

### 🎯 Objetivo
Notificar al partner que su negocio fue verificado y aprobado.

### 📊 Flujo Completo

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      APROBACIÓN DE NEGOCIO                                │
└──────────────────────────────────────────────────────────────────────────┘

1. ADMIN REVISA SOLICITUD (app/(admin-tabs)/requests.tsx)
   ├─ Ve lista de solicitudes pendientes
   ├─ Revisa detalles del negocio
   └─ Decide aprobar

2. APROBACIÓN
   └─ handleApproveRequest(requestId)
      ├─ Actualiza partner:
      │  ├─ is_verified: true
      │  ├─ is_active: true
      │  └─ updated_at: now
      ├─ Replica config de Mercado Pago (si existe)
      └─ Envía notificaciones

3. NOTIFICACIÓN PUSH
   └─ sendNotificationToUser()
      ├─ Title: "¡Negocio aprobado! 🎉"
      ├─ Body: "Tu {tipo} {nombre} ha sido verificado"
      └─ Data: { type, businessName, partnerId, deepLink }

4. OBTENCIÓN DE DATOS
   └─ Query: SELECT email, business_name FROM partners WHERE id = ?

5. ENVÍO DE EMAIL
   └─ NotificationService.sendPartnerVerificationEmail(
        email,
        businessName
      )
      ├─ Subject: "Tu negocio ha sido verificado - DogCatiFy"
      ├─ Template: EmailTemplates.partnerApproved()
      ├─ Contenido:
      │  ├─ Felicitaciones
      │  ├─ Lista de acciones disponibles:
      │  │  ├─ Configurar servicios
      │  │  ├─ Establecer disponibilidad
      │  │  ├─ Recibir reservas
      │  │  └─ Gestionar negocio
      │  └─ Botón CTA: "Acceder al Panel de Aliado"
      └─ Llama a send-email

6. PARTNER RECIBE EMAIL
   ├─ Notificación de aprobación
   ├─ Instrucciones para empezar
   └─ Acceso al dashboard de partner

7. ACTUALIZACIÓN LOCAL
   ├─ Remueve de lista de pendientes
   ├─ Agrega a lista de procesadas
   └─ UI se actualiza automáticamente
```

### 📦 Componentes Involucrados

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| UI Admin Requests | `app/(admin-tabs)/requests.tsx` | Panel de aprobación |
| Template Email | `utils/emailTemplates.ts` | partnerApproved() |
| Servicio Email | `utils/notifications.ts` | sendPartnerVerificationEmail() |
| Servicio Push | `utils/notifications.ts` | sendNotificationToUser() |
| Edge Function Send Email | `supabase/functions/send-email/` | SMTP sender |

---

## 5. Rechazo de Negocio

### 🎯 Objetivo
Notificar al partner que su solicitud no fue aprobada y explicar el motivo.

### 📊 Flujo Completo

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       RECHAZO DE NEGOCIO                                  │
└──────────────────────────────────────────────────────────────────────────┘

1. ADMIN DECIDE RECHAZAR (app/(admin-tabs)/requests.tsx)
   ├─ Hace clic en "Rechazar"
   └─ Se muestra alert de confirmación

2. MODAL DE RAZÓN
   └─ Alert.prompt("Motivo del rechazo")
      └─ Admin ingresa motivo del rechazo

3. ACTUALIZACIÓN
   └─ handleRejectRequest(requestId, reason)
      ├─ Obtiene datos del partner:
      │  └─ Query: SELECT email, business_name FROM partners WHERE id = ?
      ├─ Actualiza partner:
      │  ├─ is_verified: false
      │  └─ updated_at: now
      └─ Envía notificación

4. ENVÍO DE EMAIL
   └─ NotificationService.sendPartnerRejectionEmail(
        email,
        businessName,
        reason
      )
      ├─ Subject: "Solicitud No Aprobada - DogCatiFy"
      ├─ Template: EmailTemplates.partnerRejected()
      ├─ Contenido:
      │  ├─ Lamento por no aprobar
      │  ├─ Motivo del rechazo (destacado)
      │  ├─ Invitación a contactar soporte
      │  └─ Posibilidad de reintentar
      └─ Llama a send-email

5. PARTNER RECIBE EMAIL
   ├─ Notificación de rechazo
   ├─ Motivo específico
   └─ Opciones de seguimiento

6. ACTUALIZACIÓN LOCAL
   ├─ Remueve de lista de pendientes
   ├─ Agrega a lista de procesadas (rechazadas)
   └─ UI se actualiza
```

### 📦 Componentes Involucrados

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| UI Admin Requests | `app/(admin-tabs)/requests.tsx` | Panel de rechazo |
| Template Email | `utils/emailTemplates.ts` | partnerRejected() |
| Servicio Email | `utils/notifications.ts` | sendPartnerRejectionEmail() |
| Edge Function Send Email | `supabase/functions/send-email/` | SMTP sender |

---

## 6. Confirmación de Reserva

### 🎯 Objetivo
Confirmar al cliente que su reserva fue aceptada por el partner.

### 📊 Flujo Completo

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    CONFIRMACIÓN DE RESERVA                                │
└──────────────────────────────────────────────────────────────────────────┘

1. CLIENTE HACE RESERVA (app/services/booking/[serviceId].tsx)
   ├─ Selecciona servicio
   ├─ Elige fecha y hora
   ├─ Selecciona mascota
   ├─ Agrega notas (opcional)
   └─ Confirma reserva

2. CREACIÓN DE RESERVA
   └─ INSERT INTO bookings:
      ├─ user_id
      ├─ partner_id
      ├─ service_id
      ├─ pet_id
      ├─ booking_date
      ├─ booking_time
      ├─ status: 'pending'
      └─ notes

3. PARTNER VE SOLICITUD (app/(partner-tabs)/bookings.tsx)
   ├─ Recibe notificación push
   ├─ Ve reserva en tab "Pendiente"
   └─ Decide aceptar

4. ACEPTACIÓN DE RESERVA
   └─ handleConfirmBooking(bookingId)
      ├─ Actualiza booking:
      │  ├─ status: 'confirmed'
      │  └─ updated_at: now
      └─ Envía confirmación al cliente

5. OBTENCIÓN DE DATOS
   └─ Query datos completos:
      ├─ Cliente: email, nombre
      ├─ Servicio: nombre
      ├─ Partner: nombre
      ├─ Fecha y hora
      └─ Mascota: nombre

6. ENVÍO DE EMAIL
   └─ NotificationService.sendBookingConfirmationEmail(
        clientEmail,
        clientName,
        serviceName,
        partnerName,
        date,
        time,
        petName
      )
      ├─ Subject: "Confirmación de Reserva - DogCatiFy"
      ├─ Template: EmailTemplates.bookingConfirmation()
      ├─ Contenido:
      │  ├─ Confirmación de reserva
      │  ├─ Detalles en card destacado:
      │  │  ├─ Servicio
      │  │  ├─ Proveedor
      │  │  ├─ Fecha
      │  │  ├─ Hora
      │  │  └─ Mascota
      │  └─ Instrucciones de contacto
      └─ Llama a send-email

7. CLIENTE RECIBE EMAIL
   ├─ Confirmación de reserva
   ├─ Todos los detalles
   └─ Información de contacto del proveedor
```

### 📦 Componentes Involucrados

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| UI Booking Cliente | `app/services/booking/[serviceId].tsx` | Hacer reserva |
| UI Bookings Partner | `app/(partner-tabs)/bookings.tsx` | Gestionar reservas |
| Template Email | `utils/emailTemplates.ts` | bookingConfirmation() |
| Servicio Email | `utils/notifications.ts` | sendBookingConfirmationEmail() |
| Edge Function Send Email | `supabase/functions/send-email/` | SMTP sender |

### 📋 Tabla Utilizada

```sql
bookings
├─ id (uuid, PK)
├─ user_id (uuid, FK to profiles)
├─ partner_id (uuid, FK to partners)
├─ service_id (uuid, FK to partner_services)
├─ pet_id (uuid, FK to pets)
├─ booking_date (date)
├─ booking_time (time)
├─ status (text: 'pending' | 'confirmed' | 'completed' | 'cancelled')
├─ notes (text, nullable)
├─ created_at (timestamptz)
└─ updated_at (timestamptz)
```

---

## 7. Cancelación de Reserva

### 🎯 Objetivo
Notificar al cliente que su reserva fue cancelada.

### 📊 Flujo Completo

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    CANCELACIÓN DE RESERVA                                 │
└──────────────────────────────────────────────────────────────────────────┘

1. CANCELACIÓN (Iniciada por partner o cliente)

   OPCIÓN A - Partner cancela:
   └─ app/(partner-tabs)/bookings.tsx
      └─ handleCancelBooking(bookingId)

   OPCIÓN B - Cliente cancela:
   └─ app/orders/[id].tsx
      └─ handleCancelBooking(bookingId)

2. ACTUALIZACIÓN
   └─ UPDATE bookings SET:
      ├─ status: 'cancelled'
      ├─ cancellation_reason: (opcional)
      ├─ cancelled_by: user_id | partner_id
      └─ updated_at: now

3. OBTENCIÓN DE DATOS
   └─ Query datos completos de la reserva cancelada

4. ENVÍO DE EMAIL
   └─ NotificationService.sendBookingCancellationEmail(
        clientEmail,
        clientName,
        serviceName,
        partnerName,
        date,
        time
      )
      ├─ Subject: "Reserva Cancelada - DogCatiFy"
      ├─ Template: EmailTemplates.bookingCancellation()
      ├─ Contenido:
      │  ├─ Notificación de cancelación
      │  ├─ Detalles en card rojo:
      │  │  ├─ Servicio
      │  │  ├─ Proveedor
      │  │  ├─ Fecha
      │  │  └─ Hora
      │  └─ Sugerencia de contacto para dudas
      └─ Llama a send-email

5. CLIENTE RECIBE EMAIL
   ├─ Notificación de cancelación
   ├─ Detalles de la reserva cancelada
   └─ Información de soporte
```

### 📦 Componentes Involucrados

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| UI Bookings Partner | `app/(partner-tabs)/bookings.tsx` | Cancelar como partner |
| UI Orders Cliente | `app/orders/[id].tsx` | Cancelar como cliente |
| Template Email | `utils/emailTemplates.ts` | bookingCancellation() |
| Servicio Email | `utils/notifications.ts` | sendBookingCancellationEmail() |
| Edge Function Send Email | `supabase/functions/send-email/` | SMTP sender |

---

## 8. Recordatorio de Cita

### 🎯 Objetivo
Recordar al cliente su cita programada con 24 horas de anticipación.

### 📊 Flujo Completo

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     RECORDATORIO DE CITA                                  │
└──────────────────────────────────────────────────────────────────────────┘

1. CRON JOB / SCHEDULED TASK
   └─ Se ejecuta diariamente a las 9:00 AM
      └─ Busca reservas para mañana

2. QUERY DE RESERVAS
   └─ SELECT * FROM bookings WHERE:
      ├─ status = 'confirmed'
      ├─ booking_date = CURRENT_DATE + 1
      └─ reminder_sent = false

3. POR CADA RESERVA ENCONTRADA
   └─ Obtiene datos completos:
      ├─ Cliente: email, nombre
      ├─ Servicio: nombre
      ├─ Partner: nombre
      ├─ Fecha y hora
      └─ Mascota: nombre

4. ENVÍO DE EMAIL
   └─ NotificationService.sendBookingReminderEmail(
        clientEmail,
        clientName,
        serviceName,
        partnerName,
        date,
        time,
        petName
      )
      ├─ Subject: "Recordatorio de Cita - DogCatiFy"
      ├─ Template: EmailTemplates.bookingReminder()
      ├─ Contenido:
      │  ├─ Recordatorio para mañana
      │  ├─ Detalles en card amarillo:
      │  │  ├─ Servicio
      │  │  ├─ Proveedor
      │  │  ├─ Fecha
      │  │  ├─ Hora
      │  │  └─ Mascota
      │  └─ Opción de reprogramar/cancelar
      └─ Llama a send-email

5. ACTUALIZACIÓN DE REGISTRO
   └─ UPDATE bookings SET:
      ├─ reminder_sent: true
      └─ reminder_sent_at: now

6. CLIENTE RECIBE EMAIL
   ├─ Recordatorio 24h antes
   ├─ Todos los detalles
   └─ Opción de hacer cambios
```

### 📦 Componentes Involucrados

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| Cron Job | (Por implementar) | Ejecutar recordatorios |
| Template Email | `utils/emailTemplates.ts` | bookingReminder() |
| Servicio Email | `utils/notifications.ts` | sendBookingReminderEmail() |
| Edge Function Send Email | `supabase/functions/send-email/` | SMTP sender |

### 💡 Nota
Este flujo requiere implementación de un cron job o scheduled function en Supabase.

---

## 9. Facturación de Promociones

### 🎯 Objetivo
Enviar factura al partner por promociones publicadas.

### 📊 Flujo Completo

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   FACTURACIÓN DE PROMOCIONES                              │
└──────────────────────────────────────────────────────────────────────────┘

1. GENERACIÓN DE FACTURA (utils/promotionInvoicing.ts)
   └─ generatePromotionInvoice(promotionId)
      ├─ Obtiene datos de promoción
      ├─ Calcula métricas:
      │  ├─ Total views
      │  ├─ Total likes
      │  └─ Período de facturación
      ├─ Calcula costos:
      │  ├─ Costo por view
      │  ├─ Costo por like
      │  └─ Total a cobrar
      └─ Genera PDF con jsPDF

2. DATOS DE FACTURA
   ├─ Número de factura (auto-generado)
   ├─ Fecha de emisión
   ├─ Información del partner:
   │  ├─ Nombre del negocio
   │  ├─ Email
   │  ├─ RUT (si aplica)
   │  └─ Dirección
   ├─ Detalles de promoción:
   │  ├─ Título
   │  ├─ Período
   │  ├─ Métricas (views, likes)
   │  └─ Costos detallados
   └─ Total a pagar

3. GENERACIÓN DE PDF
   └─ Crea PDF con:
      ├─ Header con logo
      ├─ Información de empresa
      ├─ Tabla de conceptos
      ├─ Subtotales e IVA
      └─ Total final

4. CONVERSIÓN A BASE64
   └─ PDF → Base64 para adjuntar en email

5. LLAMADA A EDGE FUNCTION
   └─ POST /functions/v1/send-invoice-email
      └─ Body:
         ├─ invoiceNumber
         ├─ partnerName
         ├─ partnerEmail
         ├─ promotionTitle
         ├─ totalAmount
         ├─ pdfBase64
         ├─ billingPeriodStart
         └─ billingPeriodEnd

6. EDGE FUNCTION: send-invoice-email
   ├─ Valida RESEND_API_KEY
   ├─ Crea HTML personalizado con:
   │  ├─ Header gradiente rojo
   │  ├─ Detalles de factura
   │  ├─ Card con información destacada
   │  └─ Nota sobre generación automática
   └─ Envía vía Resend API

7. ENVÍO VÍA RESEND
   └─ POST https://api.resend.com/emails
      ├─ From: "DogCatify <facturacion@dogcatify.com>"
      ├─ To: partnerEmail
      ├─ Subject: "Factura {number} - DogCatify"
      ├─ HTML: template generado
      └─ Attachments: PDF de factura

8. PARTNER RECIBE EMAIL
   ├─ Email con diseño profesional
   ├─ Detalles de factura en HTML
   └─ PDF adjunto descargable

9. REGISTRO EN DB (opcional)
   └─ INSERT INTO invoices:
      ├─ invoice_number
      ├─ partner_id
      ├─ promotion_id
      ├─ amount
      ├─ status: 'sent'
      ├─ pdf_url (storage)
      └─ sent_at
```

### 📦 Componentes Involucrados

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| Generador de Facturas | `utils/promotionInvoicing.ts` | Genera PDF de factura |
| Edge Function Invoice | `supabase/functions/send-invoice-email/` | Envía factura por email |
| API Resend | (Externa) | Servicio de email profesional |

### 🔧 Configuración Requerida

```bash
# Edge Function Environment Variables
RESEND_API_KEY=re_xxxxx
```

### 📧 Diferencias con otros emails

Este flujo usa **Resend API** en lugar de SMTP:
- Más confiable para emails transaccionales
- Mejor deliverability
- Tracking de aperturas y clics
- Manejo de attachments más robusto

---

## 10. Mensaje de Chat de Adopción

### 🎯 Objetivo
Notificar por email cuando se recibe un mensaje sobre adopción de una mascota.

### 📊 Flujo Completo

```
┌──────────────────────────────────────────────────────────────────────────┐
│                 NOTIFICACIÓN DE CHAT DE ADOPCIÓN                          │
└──────────────────────────────────────────────────────────────────────────┘

1. USUARIO ENVÍA MENSAJE (app/chat/adoption.tsx o app/chat/[id].tsx)
   ├─ Conversación sobre adopción de mascota
   ├─ Usuario escribe mensaje
   └─ Envía mensaje

2. INSERCIÓN EN DB
   └─ INSERT INTO messages:
      ├─ conversation_id
      ├─ sender_id
      ├─ content
      └─ created_at

3. OBTENCIÓN DE DATOS
   └─ Query información completa:
      ├─ Receptor: email, nombre
      ├─ Remitente: nombre
      ├─ Mascota: nombre
      ├─ Mensaje: preview (primeros 100 caracteres)
      └─ Conversation ID

4. VERIFICACIÓN
   └─ IF receptor tiene notificaciones habilitadas:
      ├─ Envía push notification (si tiene token)
      └─ Envía email notification

5. ENVÍO DE EMAIL
   └─ NotificationService.sendChatMessageNotification(
        recipientEmail,
        senderName,
        petName,
        messagePreview,
        conversationId
      )
      ├─ Subject: "Nuevo mensaje sobre adopción de {petName}"
      ├─ Template: HTML personalizado
      ├─ Contenido:
      │  ├─ Notificación de nuevo mensaje
      │  ├─ Nombre del remitente
      │  ├─ Mascota de interés
      │  ├─ Preview del mensaje (en card)
      │  └─ Instrucción para responder en app
      └─ Llama a send-email

6. USUARIO RECIBE EMAIL
   ├─ Notificación de mensaje
   ├─ Preview del contenido
   └─ Invitación a responder en app
```

### 📦 Componentes Involucrados

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| UI Chat | `app/chat/adoption.tsx`, `app/chat/[id].tsx` | Interface de chat |
| Servicio Email | `utils/notifications.ts` | sendChatMessageNotification() |
| Servicio Push | `utils/notifications.ts` | sendPushNotification() |
| Edge Function Send Email | `supabase/functions/send-email/` | SMTP sender |

### 📋 Tablas Utilizadas

```sql
conversations
├─ id (uuid, PK)
├─ pet_id (uuid, FK to adoption_pets)
├─ owner_id (uuid, FK to profiles)
├─ interested_user_id (uuid, FK to profiles)
└─ created_at (timestamptz)

messages
├─ id (uuid, PK)
├─ conversation_id (uuid, FK to conversations)
├─ sender_id (uuid, FK to profiles)
├─ content (text)
├─ created_at (timestamptz)
└─ read_at (timestamptz, nullable)
```

---

## 📊 Comparativa de Servicios de Email

| Flujo | Servicio | Razón |
|-------|----------|-------|
| Registro Usuario | SMTP (Nodemailer) | Emails transaccionales simples |
| Reset Password | SMTP (Nodemailer) | Emails transaccionales simples |
| Partner Registration | SMTP (Nodemailer) | Emails transaccionales simples |
| Partner Approval | SMTP (Nodemailer) | Emails transaccionales simples |
| Partner Rejection | SMTP (Nodemailer) | Emails transaccionales simples |
| Booking Confirmation | SMTP (Nodemailer) | Emails transaccionales simples |
| Booking Cancellation | SMTP (Nodemailer) | Emails transaccionales simples |
| Booking Reminder | SMTP (Nodemailer) | Emails transaccionales simples |
| **Invoice Email** | **Resend API** | **Attachments pesados (PDF), mejor deliverability** |
| Chat Notification | SMTP (Nodemailer) | Emails transaccionales simples |

---

## 🔧 Configuración Centralizada

### Variables de Entorno

```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx
EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=xxx

# SMTP Configuration (Nodemailer)
SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=465
SMTP_USER=info@dogcatify.com
SMTP_PASSWORD=xxx

# Resend (para facturas)
RESEND_API_KEY=re_xxxxx

# App
EXPO_PUBLIC_APP_DOMAIN=http://localhost:8081
```

### Servicios de Email

#### 1. SMTP (Nodemailer)
- **Proveedor:** GoDaddy / Servidor propio
- **Puerto:** 465 (SSL)
- **Uso:** Todos los emails transaccionales excepto facturas
- **Ventajas:** Control total, sin límites
- **Desventajas:** Requiere mantenimiento del servidor

#### 2. Resend API
- **Proveedor:** Resend (resend.com)
- **Uso:** Facturas con PDF adjunto
- **Ventajas:**
  - Mejor deliverability
  - Tracking de emails
  - Manejo robusto de attachments
  - Sin configuración de SMTP
- **Desventajas:** Costo por email (gratis hasta 3,000/mes)

---

## 📋 Tablas de Base de Datos

### email_confirmations
```sql
CREATE TABLE email_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('signup', 'password_reset')),
  is_confirmed BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_email_confirmations_token ON email_confirmations(token_hash);
CREATE INDEX idx_email_confirmations_user ON email_confirmations(user_id);
```

### partners
```sql
CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_partners_user ON partners(user_id);
CREATE INDEX idx_partners_verified ON partners(is_verified);
```

### bookings
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES partner_services(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_partner ON bookings(partner_id);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_status ON bookings(status);
```

### invoices (opcional - para tracking)
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  promotion_id UUID REFERENCES promotions(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'paid', 'overdue', 'cancelled')),
  pdf_url TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invoices_partner ON invoices(partner_id);
CREATE INDEX idx_invoices_status ON invoices(status);
```

---

## 🔄 Próximos Pasos para Migración

### 1. Centralizar Configuración
- [ ] Crear archivo de configuración único para SMTP
- [ ] Documentar todas las variables de entorno
- [ ] Crear script de verificación de configuración

### 2. Estandarizar Templates
- [ ] Revisar todos los templates HTML
- [ ] Asegurar diseño consistente
- [ ] Optimizar para móviles
- [ ] Agregar logos y branding

### 3. Implementar Tracking
- [ ] Agregar IDs únicos a cada email
- [ ] Registrar envíos en base de datos
- [ ] Implementar webhook para aperturas (Resend)
- [ ] Dashboard de métricas de emails

### 4. Mejoras de Seguridad
- [ ] Rotación de tokens
- [ ] Rate limiting por usuario
- [ ] Verificación de dominios (SPF, DKIM, DMARC)
- [ ] Encriptación de datos sensibles

### 5. Testing
- [ ] Tests unitarios para cada flujo
- [ ] Tests de integración
- [ ] Tests de carga
- [ ] Sandbox para desarrollo

### 6. Monitoring
- [ ] Logs centralizados
- [ ] Alertas por fallos
- [ ] Métricas de deliverability
- [ ] Dashboard de estado

---

## 📚 Referencias

- [Nodemailer Documentation](https://nodemailer.com/)
- [Resend API Documentation](https://resend.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Email Template Best Practices](https://www.litmus.com/resources/)
- [SMTP Best Practices](https://www.mailgun.com/blog/email/smtp-best-practices/)

---

**Última actualización:** Octubre 2025
**Versión:** 1.0.0
**Mantenido por:** Equipo de Desarrollo DogCatiFy
