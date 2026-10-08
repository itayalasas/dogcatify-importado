# Secretos Faltantes en Base de Datos Nueva

## 📋 Comparación de Secretos

### ✅ Secretos que YA TIENES (Base de datos actual):
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_DB_URL
- EMAIL_API_URL
- EMAIL_API_KEY
- OPENAI_API_KEY
- ACCOUNTING_EMPRESA_ID
- ACCOUNTING_API_KEY
- ACCOUNTING_WEBHOOK_URL
- ACCOUNTING_PROMOTION_WEBHOOK_URL (nuevo recomendado para facturas de promociones)

### ❌ Secretos que FALTAN (Están en la base de datos vieja pero no en la nueva):

#### 1. **SMTP_PASSWORD**
- **Propósito**: Contraseña para servidor SMTP (envío directo de correos)
- **Usado en**: Posiblemente en funciones de email legacy
- **Urgencia**: 🟡 Media (si no usas SMTP directo, no es necesario)

#### 2. **FIREBASE_SERVICE_ACCOUNT**
- **Propósito**: Credenciales completas de Firebase para notificaciones push
- **Usado en**: `send-notification-fcm-v1`, notificaciones push
- **Urgencia**: 🔴 ALTA - Sin esto NO funcionan las notificaciones push

#### 3. **FIREBASE_PRIVATE_KEY_ID**
- **Propósito**: ID de la clave privada de Firebase
- **Usado en**: Autenticación con Firebase
- **Urgencia**: 🔴 ALTA

#### 4. **FIREBASE_CLIENT_EMAIL**
- **Propósito**: Email del service account de Firebase
- **Usado en**: Autenticación con Firebase
- **Urgencia**: 🔴 ALTA

#### 5. **FIREBASE_CLIENT_ID**
- **Propósito**: ID del cliente de Firebase
- **Usado en**: Autenticación con Firebase
- **Urgencia**: 🔴 ALTA

#### 6. **FIREBASE_CLIENT_CERT_URL**
- **Propósito**: URL del certificado del cliente de Firebase
- **Usado en**: Verificación de autenticación
- **Urgencia**: 🔴 ALTA

#### 7. **FIREBASE_PRIVATE_KEY**
- **Propósito**: Clave privada de Firebase para firmar tokens
- **Usado en**: Envío de notificaciones push FCM v1
- **Urgencia**: 🔴 ALTA

#### 8. **CRON_SECRET**
- **Propósito**: Secreto para validar llamadas a trabajos cron programados
- **Usado en**: 
  - `send-scheduled-notifications` (notificaciones programadas)
  - `send-medical-reminders` (recordatorios médicos)
  - `send-booking-confirmations` (confirmaciones de reservas)
  - `cancel-expired-orders` (cancelar órdenes expiradas)
- **Urgencia**: 🟡 Media (las funciones funcionan pero sin validación de seguridad)

#### 9. **WEBHOOK_SECRET**
- **Propósito**: Secreto para firmar webhooks salientes (HMAC)
- **Usado en**: `notify-order-webhook` para firmar peticiones
- **Urgencia**: 🟡 Media (el webhook funciona pero sin firma de seguridad)
- **Valor sugerido**: Genera uno nuevo seguro
- **Ejemplo**: `Kzdr7C4eF9IS4EIgmH8LARdwWrvH4jCBMDOTM1SHofZNdDUHpiFEYH3WhRWx`

#### 10. **MERCADOPAGO_WEBHOOK_SECRET**
- **Propósito**: Secreto para validar webhooks entrantes de Mercado Pago
- **Usado en**: `mercadopago-webhook` para verificar autenticidad
- **Urgencia**: 🔴 ALTA - Sin esto, los pagos de Mercado Pago NO se procesarán correctamente
- **Dónde obtenerlo**: Dashboard de Mercado Pago → Webhooks

#### 11. **CRM_WEBHOOK_URL**
- **Propósito**: URL del webhook de tu CRM externo
- **Usado en**: `send-order-to-crm` para enviar órdenes al CRM
- **Urgencia**: 🟢 Baja (solo si usas integración con CRM)

#### 12. **CRM_API_KEY**
- **Propósito**: API Key para autenticar con tu CRM
- **Usado en**: `send-order-to-crm`
- **Urgencia**: 🟢 Baja (solo si usas integración con CRM)

---

## 🚨 Secretos CRÍTICOS que debes agregar INMEDIATAMENTE:

### 1. Firebase (Para notificaciones push)
```
FIREBASE_SERVICE_ACCOUNT
FIREBASE_PRIVATE_KEY_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_CLIENT_ID
FIREBASE_CLIENT_CERT_URL
FIREBASE_PRIVATE_KEY
```

**Cómo obtenerlos:**
1. Ve a Firebase Console → Project Settings → Service Accounts
2. Click en "Generate new private key"
3. Descarga el archivo JSON
4. Extrae cada campo del JSON a los secretos correspondientes

**Ejemplo del JSON de Firebase:**
```json
{
  "type": "service_account",
  "project_id": "tu-proyecto",
  "private_key_id": "abc123...",  // ← FIREBASE_PRIVATE_KEY_ID
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",  // ← FIREBASE_PRIVATE_KEY
  "client_email": "firebase-adminsdk@tu-proyecto.iam.gserviceaccount.com",  // ← FIREBASE_CLIENT_EMAIL
  "client_id": "123456789",  // ← FIREBASE_CLIENT_ID
  "client_x509_cert_url": "https://..."  // ← FIREBASE_CLIENT_CERT_URL
}
```

**Para FIREBASE_SERVICE_ACCOUNT:**
- Copia TODO el contenido del archivo JSON como un string

### 2. Mercado Pago Webhook Secret
```
MERCADOPAGO_WEBHOOK_SECRET
```

**Cómo obtenerlo:**
1. Ve a Mercado Pago Dashboard
2. Integraciones → Webhooks
3. Copia el secret que te proporciona Mercado Pago

### 3. Webhook Secret (para firmar tus propios webhooks)
```
WEBHOOK_SECRET
```

**Genera uno nuevo:**
```bash
openssl rand -base64 48
```

O usa este de ejemplo (pero genera uno nuevo por seguridad):
```
Kzdr7C4eF9IS4EIgmH8LARdwWrvH4jCBMDOTM1SHofZNdDUHpiFEYH3WhRWx
```

### 4. Cron Secret (para validar llamadas a trabajos programados)
```
CRON_SECRET
```

**Genera uno nuevo:**
```bash
openssl rand -base64 32
```

---

## 📝 Resumen de Prioridades:

### 🔴 URGENTE (Sin estos NO funcionan features críticas):
1. `MERCADOPAGO_WEBHOOK_SECRET` - Pagos no se procesan
2. `FIREBASE_SERVICE_ACCOUNT` + otros Firebase - Notificaciones push no funcionan
3. `FIREBASE_PRIVATE_KEY` - Push notifications FCM v1

### 🟡 IMPORTANTE (Afectan seguridad y funcionalidad):
4. `WEBHOOK_SECRET` - Webhooks sin firma de seguridad
5. `CRON_SECRET` - Trabajos programados sin validación

### 🟢 OPCIONAL (Solo si usas estas integraciones):
6. `CRM_WEBHOOK_URL` y `CRM_API_KEY` - Integración con CRM
7. `SMTP_PASSWORD` - Solo si usas SMTP directo (probablemente no)

---

## 🛠️ Instrucciones para Agregar Secretos:

1. Ve a Supabase Dashboard de tu proyecto NUEVO
2. Settings → Edge Functions → Secrets
3. Click en "Add or replace secrets"
4. Agrega cada secreto con su valor correspondiente
5. Guarda los cambios

---

## ✅ Checklist de Verificación:

- [ ] FIREBASE_SERVICE_ACCOUNT configurado
- [ ] Todos los secretos de Firebase individuales configurados
- [ ] MERCADOPAGO_WEBHOOK_SECRET configurado
- [ ] WEBHOOK_SECRET generado y configurado
- [ ] CRON_SECRET generado y configurado
- [ ] Probar notificaciones push
- [ ] Probar pago con Mercado Pago
- [ ] Verificar que lleguen correos de confirmación

---

## 🔍 Cómo Verificar que Todo Funciona:

1. **Notificaciones Push:**
   - Haz una acción que genere notificación
   - Verifica en logs de `send-notification-fcm-v1`

2. **Pagos Mercado Pago:**
   - Haz un pago de prueba
   - Verifica en logs de `mercadopago-webhook`

3. **Correos:**
   - Haz un pago que complete una orden
   - Verifica en logs de `send-email`
