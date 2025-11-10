# Edge Functions - Guía de Despliegue a Producción

## Lista Completa de Edge Functions (31)

### Comandos de Despliegue

#### Opción 1: Desplegar todas las funciones a la vez
```bash
supabase functions deploy --project-ref <tu-project-ref-produccion>
```

#### Opción 2: Desplegar función por función

```bash
# 1. Autenticación y Usuario
supabase functions deploy create-user --project-ref <ref>
supabase functions deploy delete-user --project-ref <ref>
supabase functions deploy reset-password --project-ref <ref>

# 2. Email
supabase functions deploy send-email --project-ref <ref>
supabase functions deploy send-invoice-email --project-ref <ref>

# 3. Notificaciones
supabase functions deploy send-push-notification --project-ref <ref>
supabase functions deploy send-notification-fcm-v1 --project-ref <ref>
supabase functions deploy send-scheduled-notifications --project-ref <ref>
supabase functions deploy send-medical-reminders --project-ref <ref>

# 4. Médico/Historial
supabase functions deploy medical-history --project-ref <ref>
supabase functions deploy medical-history-data --project-ref <ref>
supabase functions deploy save-medical-record --project-ref <ref>
supabase functions deploy medical-notifications --project-ref <ref>
supabase functions deploy extract-medical-card-info --project-ref <ref>
supabase functions deploy scan-vaccination-card --project-ref <ref>

# 5. IA y Recomendaciones
supabase functions deploy generate-vaccine-recommendations --project-ref <ref>
supabase functions deploy generate-dewormer-recommendations --project-ref <ref>
supabase functions deploy generate-illness-recommendations --project-ref <ref>
supabase functions deploy generate-treatment-recommendations --project-ref <ref>
supabase functions deploy generate-allergy-recommendations --project-ref <ref>
supabase functions deploy generate-behavior-recommendations --project-ref <ref>
supabase functions deploy get-vaccine-info --project-ref <ref>

# 6. Órdenes y Pagos
supabase functions deploy orders-api --project-ref <ref>
supabase functions deploy cancel-expired-orders --project-ref <ref>
supabase functions deploy mercadopago-webhook --project-ref <ref>
supabase functions deploy notify-order-webhook --project-ref <ref>
supabase functions deploy dogcatify-order-webhook --project-ref <ref>

# 7. Reservas
supabase functions deploy send-booking-confirmations --project-ref <ref>
supabase functions deploy confirm-booking --project-ref <ref>

# 8. Facturación
supabase functions deploy generate-promotion-invoice --project-ref <ref>

# 9. Utilidades
supabase functions deploy upload-image --project-ref <ref>
```

---

## Detalle de Cada Función

### 1. AUTENTICACIÓN Y USUARIO

#### `create-user` (JWT required)
- **Propósito**: Crear nuevo usuario en el sistema
- **Método**: POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: `SUPABASE_SERVICE_ROLE_KEY`

#### `delete-user` (JWT required)
- **Propósito**: Eliminar cuenta de usuario
- **Método**: DELETE
- **Auth**: Requiere JWT
- **Secrets necesarios**: `SUPABASE_SERVICE_ROLE_KEY`

#### `reset-password` (JWT required)
- **Propósito**: Iniciar proceso de reseteo de contraseña
- **Método**: POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`

---

### 2. EMAIL

#### `send-email` (Público)
- **Propósito**: Enviar emails genéricos
- **Método**: POST
- **Auth**: No requiere JWT
- **Secrets necesarios**: `RESEND_API_KEY`

#### `send-invoice-email` (JWT required)
- **Propósito**: Enviar facturas por email
- **Método**: POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: `RESEND_API_KEY`

---

### 3. NOTIFICACIONES

#### `send-push-notification` (JWT required)
- **Propósito**: Enviar notificaciones push a dispositivos
- **Método**: POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: `FIREBASE_SERVICE_ACCOUNT`

#### `send-notification-fcm-v1` (JWT required)
- **Propósito**: Enviar notificaciones usando FCM v1 API
- **Método**: POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`

#### `send-scheduled-notifications` (Público - Cron)
- **Propósito**: Enviar notificaciones programadas (ejecutado por cron)
- **Método**: POST
- **Auth**: No requiere JWT (llamado por sistema)
- **Secrets necesarios**: `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_SERVICE_ACCOUNT`

#### `send-medical-reminders` (JWT required)
- **Propósito**: Enviar recordatorios médicos
- **Método**: POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: `FIREBASE_SERVICE_ACCOUNT`

---

### 4. MÉDICO/HISTORIAL

#### `medical-history` (JWT required)
- **Propósito**: Obtener historial médico completo en PDF
- **Método**: GET
- **Auth**: Requiere JWT
- **Secrets necesarios**: Ninguno

#### `medical-history-data` (JWT required)
- **Propósito**: Obtener datos de historial médico en JSON
- **Método**: GET
- **Auth**: Requiere JWT
- **Secrets necesarios**: Ninguno

#### `save-medical-record` (Público)
- **Propósito**: Guardar registro médico desde token compartido
- **Método**: POST
- **Auth**: No requiere JWT (usa token)
- **Secrets necesarios**: `SUPABASE_SERVICE_ROLE_KEY`

#### `medical-notifications` (JWT required)
- **Propósito**: Gestionar notificaciones médicas
- **Método**: GET/POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: Ninguno

#### `extract-medical-card-info` (JWT required)
- **Propósito**: Extraer información de tarjetas médicas con OCR
- **Método**: POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: `OPENAI_API_KEY`

#### `scan-vaccination-card` (JWT required)
- **Propósito**: Escanear tarjeta de vacunación con OCR
- **Método**: POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: `OPENAI_API_KEY`

---

### 5. IA Y RECOMENDACIONES

#### `generate-vaccine-recommendations` (JWT required)
- **Propósito**: Generar recomendaciones de vacunas con IA
- **Método**: POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: `OPENAI_API_KEY`

#### `generate-dewormer-recommendations` (JWT required)
- **Propósito**: Generar recomendaciones de desparasitantes
- **Método**: POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: `OPENAI_API_KEY`

#### `generate-illness-recommendations` (JWT required)
- **Propósito**: Generar recomendaciones de enfermedades
- **Método**: POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: `OPENAI_API_KEY`

#### `generate-treatment-recommendations` (JWT required)
- **Propósito**: Generar recomendaciones de tratamientos
- **Método**: POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: `OPENAI_API_KEY`

#### `generate-allergy-recommendations` (JWT required)
- **Propósito**: Generar recomendaciones de alergias
- **Método**: POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: `OPENAI_API_KEY`

#### `generate-behavior-recommendations` (JWT required)
- **Propósito**: Generar recomendaciones de comportamiento
- **Método**: POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: `OPENAI_API_KEY`

#### `get-vaccine-info` (JWT required)
- **Propósito**: Obtener información de vacunas
- **Método**: GET
- **Auth**: Requiere JWT
- **Secrets necesarios**: Ninguno

---

### 6. ÓRDENES Y PAGOS

#### `orders-api` (Público)
- **Propósito**: API REST para gestionar órdenes
- **Método**: GET/POST/PUT/DELETE
- **Auth**: No requiere JWT
- **Secrets necesarios**: `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`

#### `cancel-expired-orders` (Público - Cron)
- **Propósito**: Cancelar órdenes expiradas (ejecutado por cron)
- **Método**: POST
- **Auth**: No requiere JWT
- **Secrets necesarios**: `SUPABASE_SERVICE_ROLE_KEY`

#### `mercadopago-webhook` (Público)
- **Propósito**: Recibir webhooks de MercadoPago
- **Método**: POST
- **Auth**: No requiere JWT (validado por firma)
- **Secrets necesarios**: `SUPABASE_SERVICE_ROLE_KEY`

#### `notify-order-webhook` (Público)
- **Propósito**: Notificar webhooks de órdenes a partners
- **Método**: POST
- **Auth**: No requiere JWT
- **Secrets necesarios**: `SUPABASE_SERVICE_ROLE_KEY`

#### `dogcatify-order-webhook` (Público)
- **Propósito**: Webhook interno de órdenes de DogCatiFy
- **Método**: POST
- **Auth**: No requiere JWT
- **Secrets necesarios**: `SUPABASE_SERVICE_ROLE_KEY`

---

### 7. RESERVAS

#### `send-booking-confirmations` (Público - Cron)
- **Propósito**: Enviar confirmaciones de reservas (ejecutado por cron)
- **Método**: POST
- **Auth**: No requiere JWT
- **Secrets necesarios**: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`

#### `confirm-booking` (JWT required)
- **Propósito**: Confirmar una reserva con token
- **Método**: POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: `SUPABASE_SERVICE_ROLE_KEY`

---

### 8. FACTURACIÓN

#### `generate-promotion-invoice` (JWT required)
- **Propósito**: Generar factura de promoción
- **Método**: POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: Ninguno

---

### 9. UTILIDADES

#### `upload-image` (JWT required)
- **Propósito**: Subir imágenes a storage
- **Método**: POST
- **Auth**: Requiere JWT
- **Secrets necesarios**: Ninguno

---

## Variables de Entorno (Secrets)

### Configurar secrets en producción:

```bash
# Firebase (Notificaciones Push)
supabase secrets set FIREBASE_SERVICE_ACCOUNT='<json-completo>' --project-ref <ref>
supabase secrets set FIREBASE_PROJECT_ID='<project-id>' --project-ref <ref>

# OpenAI (IA)
supabase secrets set OPENAI_API_KEY='<key>' --project-ref <ref>

# Resend (Emails)
supabase secrets set RESEND_API_KEY='<key>' --project-ref <ref>

# MercadoPago (Pagos)
supabase secrets set MERCADOPAGO_ACCESS_TOKEN='<token-produccion>' --project-ref <ref>
supabase secrets set MERCADOPAGO_PUBLIC_KEY='<public-key>' --project-ref <ref>

# Supabase (Auto-configurado, pero por si acaso)
supabase secrets set SUPABASE_URL='<url>' --project-ref <ref>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY='<key>' --project-ref <ref>

# Datadog (Monitoreo)
supabase secrets set DATADOG_API_KEY='<key>' --project-ref <ref>
supabase secrets set DATADOG_APP_KEY='<app-key>' --project-ref <ref>

# Sentry (Errores)
supabase secrets set SENTRY_DSN='<dsn>' --project-ref <ref>
```

### Ver secrets configurados:
```bash
supabase secrets list --project-ref <ref>
```

---

## Verificar Despliegue

Después de desplegar, verifica que todas las funciones estén activas:

```bash
supabase functions list --project-ref <ref>
```

O desde el Dashboard:
1. Ve a dashboard.supabase.com
2. Selecciona tu proyecto
3. Ve a "Edge Functions"
4. Verifica que todas estén con status "ACTIVE"

---

## Cron Jobs Necesarios

Algunas funciones deben ejecutarse periódicamente. Configúralas en el Dashboard:

### 1. Cancelar órdenes expiradas (cada hora)
```
0 * * * * (cada hora)
URL: https://<project-ref>.supabase.co/functions/v1/cancel-expired-orders
```

### 2. Enviar notificaciones programadas (cada 15 minutos)
```
*/15 * * * * (cada 15 minutos)
URL: https://<project-ref>.supabase.co/functions/v1/send-scheduled-notifications
```

### 3. Enviar confirmaciones de reservas (cada hora)
```
0 * * * * (cada hora)
URL: https://<project-ref>.supabase.co/functions/v1/send-booking-confirmations
```

Configura estos cron jobs en el Dashboard de Supabase:
Settings → API → Webhooks → Add new webhook

---

## Troubleshooting

### Función no se despliega
```bash
# Ver logs detallados
supabase functions deploy <nombre> --debug --project-ref <ref>
```

### Función desplegada pero no funciona
```bash
# Ver logs en tiempo real
supabase functions logs <nombre> --project-ref <ref>
```

### Error de permisos
Verifica que los secrets estén configurados correctamente:
```bash
supabase secrets list --project-ref <ref>
```

### Error de CORS
Verifica que las Edge Functions tengan configurados los headers CORS correctamente en el código.

---

## Checklist de Despliegue

- [ ] Todas las 31 funciones desplegadas
- [ ] Todos los secrets configurados
- [ ] Cron jobs configurados
- [ ] Funciones públicas sin JWT verificado
- [ ] Funciones privadas con JWT habilitado
- [ ] Logs monitoreados
- [ ] Webhooks de MercadoPago configurados
- [ ] Firebase configurado para notificaciones
- [ ] OpenAI configurado para IA

