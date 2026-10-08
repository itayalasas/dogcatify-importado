# 🚀 Exportar Edge Functions y Secrets a Producción

## 📦 Estado Actual

Tu proyecto tiene **31 Edge Functions** desplegadas:

| # | Función | Verificación JWT |
|---|---------|------------------|
| 1 | send-email | ❌ No |
| 2 | upload-image | ✅ Sí |
| 3 | mercadopago-webhook | ❌ No |
| 4 | reset-password | ✅ Sí |
| 5 | medical-notifications | ✅ Sí |
| 6 | medical-history | ✅ Sí |
| 7 | medical-history-data | ✅ Sí |
| 8 | save-medical-record | ❌ No |
| 9 | delete-user | ✅ Sí |
| 10 | create-user | ✅ Sí |
| 11 | send-push-notification | ✅ Sí |
| 12 | generate-promotion-invoice | ✅ Sí |
| 13 | send-invoice-email | ✅ Sí |
| 14 | cancel-expired-orders | ❌ No |
| 15 | orders-api | ❌ No |
| 16 | notify-order-webhook | ❌ No |
| 17 | dogcatify-order-webhook | ❌ No |
| 18 | generate-behavior-recommendations | ✅ Sí |
| 19 | get-vaccine-info | ✅ Sí |
| 20 | generate-vaccine-recommendations | ✅ Sí |
| 21 | generate-dewormer-recommendations | ✅ Sí |
| 22 | generate-illness-recommendations | ✅ Sí |
| 23 | generate-treatment-recommendations | ✅ Sí |
| 24 | generate-allergy-recommendations | ✅ Sí |
| 25 | send-medical-reminders | ✅ Sí |
| 26 | send-scheduled-notifications | ❌ No |
| 27 | send-notification-fcm-v1 | ✅ Sí |
| 28 | send-booking-confirmations | ❌ No |
| 29 | confirm-booking | ✅ Sí |
| 30 | scan-vaccination-card | ✅ Sí |
| 31 | extract-medical-card-info | ✅ Sí |

---

## 📝 Secrets Necesarios

Basándome en tu código, estos son los secrets que debes configurar:

### 1. Firebase (Notificaciones Push)
- `FIREBASE_PRIVATE_KEY_ID`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_CLIENT_ID`
- `FIREBASE_CLIENT_CERT_URL`

### 2. Resend (Email)
- `RESEND_API_KEY`

### 3. MercadoPago
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_PUBLIC_KEY`

### 4. OpenAI (IA para recomendaciones médicas)
- `OPENAI_API_KEY`

### 5. Google Cloud (OCR de carnets)
- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_CLOUD_PRIVATE_KEY`
- `GOOGLE_CLOUD_CLIENT_EMAIL`

---

## 🔧 MÉTODO 1: Exportar Edge Functions (Manual)

### Opción A: Ya tienes las funciones localmente

Si ya tienes las funciones en `supabase/functions/`, simplemente despliégalas:

```bash
# Conectar al proyecto de producción
supabase link --project-ref gfazxronwllqcswdaimh

# Desplegar TODAS las funciones
supabase functions deploy

# O desplegar una función específica
supabase functions deploy nombre-funcion
```

### Opción B: Exportar desde desarrollo

Si necesitas copiar las funciones de desarrollo a producción:

```bash
# 1. Las funciones ya están en tu carpeta supabase/functions/
# Solo necesitas copiar esa carpeta al proyecto de producción

# 2. Conectar al proyecto de producción
supabase link --project-ref gfazxronwllqcswdaimh

# 3. Desplegar todas
supabase functions deploy
```

---

## 🔑 MÉTODO 2: Exportar y Configurar Secrets

### Ver Secrets Actuales (Desarrollo)

```bash
# Conectar a desarrollo
supabase link --project-ref zkgiwamycbjcogcgqhff

# Ver todos los secrets (NO mostrará los valores, solo los nombres)
supabase secrets list
```

### Copiar Secrets a Producción

**IMPORTANTE:** No hay forma de exportar los VALORES de los secrets directamente. Debes configurarlos manualmente.

#### Opción A: Configurar uno por uno

```bash
# Conectar a producción
supabase link --project-ref gfazxronwllqcswdaimh

# Configurar cada secret
supabase secrets set FIREBASE_PRIVATE_KEY_ID=tu_valor_aqui
supabase secrets set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ntu_key_aqui\n-----END PRIVATE KEY-----"
supabase secrets set FIREBASE_CLIENT_EMAIL=tu_email@proyecto.iam.gserviceaccount.com
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxx
supabase secrets set MERCADOPAGO_ACCESS_TOKEN=APP-xxxxxxxxxx
supabase secrets set OPENAI_API_KEY=sk-xxxxxxxxxx
```

#### Opción B: Usar archivo .env

```bash
# 1. Crear archivo con los secrets (secrets.env)
cat > secrets.env << EOF
FIREBASE_PRIVATE_KEY_ID=tu_valor_aqui
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ntu_key\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=tu_email@proyecto.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=tu_client_id
FIREBASE_CLIENT_CERT_URL=tu_cert_url
RESEND_API_KEY=re_xxxxxxxxxx
MERCADOPAGO_ACCESS_TOKEN=APP-xxxxxxxxxx
MERCADOPAGO_PUBLIC_KEY=APP_USR-xxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxx
GOOGLE_CLOUD_PROJECT_ID=tu_proyecto
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ntu_key\n-----END PRIVATE KEY-----"
GOOGLE_CLOUD_CLIENT_EMAIL=tu_email@proyecto.iam.gserviceaccount.com
EOF

# 2. Aplicar todos los secrets a producción
supabase secrets set --env-file secrets.env

# 3. Borrar el archivo (¡IMPORTANTE por seguridad!)
rm secrets.env
```

---

## 🚀 MÉTODO 3: Script Automatizado (TODO EN UNO)

Voy a crear un script que hace todo automáticamente:

### Script para Windows (PowerShell)

```powershell
# deploy-to-production.ps1

Write-Host "==================================" -ForegroundColor Green
Write-Host "  DEPLOY A PRODUCCION - Dogcatify" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

# Verificar que existe supabase CLI
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Supabase CLI no está instalado" -ForegroundColor Red
    exit 1
}

# Conectar a producción
Write-Host "[1/4] Conectando a producción..." -ForegroundColor Cyan
supabase link --project-ref gfazxronwllqcswdaimh

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] No se pudo conectar" -ForegroundColor Red
    exit 1
}

# Configurar secrets
Write-Host "[2/4] Configurando secrets..." -ForegroundColor Cyan
Write-Host "IMPORTANTE: Debes tener un archivo secrets.env con todos los valores" -ForegroundColor Yellow
Write-Host ""

if (Test-Path "secrets.env") {
    supabase secrets set --env-file secrets.env
    Write-Host "[OK] Secrets configurados" -ForegroundColor Green
} else {
    Write-Host "[ADVERTENCIA] No se encontró secrets.env" -ForegroundColor Yellow
    Write-Host "Crea el archivo secrets.env con tus secrets y vuelve a ejecutar" -ForegroundColor Yellow
}

# Desplegar Edge Functions
Write-Host "[3/4] Desplegando Edge Functions..." -ForegroundColor Cyan
supabase functions deploy

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] No se pudieron desplegar las funciones" -ForegroundColor Red
    exit 1
}

# Verificar
Write-Host "[4/4] Verificando despliegue..." -ForegroundColor Cyan
supabase functions list

Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "  DESPLIEGUE COMPLETADO" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
```

### Script para Mac/Linux (Bash)

```bash
#!/bin/bash

echo "=================================="
echo "  DEPLOY A PRODUCCION - Dogcatify"
echo "=================================="
echo ""

# Conectar a producción
echo "[1/4] Conectando a producción..."
supabase link --project-ref gfazxronwllqcswdaimh

if [ $? -ne 0 ]; then
    echo "[ERROR] No se pudo conectar"
    exit 1
fi

# Configurar secrets
echo "[2/4] Configurando secrets..."
if [ -f "secrets.env" ]; then
    supabase secrets set --env-file secrets.env
    echo "[OK] Secrets configurados"
else
    echo "[ADVERTENCIA] No se encontró secrets.env"
fi

# Desplegar Edge Functions
echo "[3/4] Desplegando Edge Functions..."
supabase functions deploy

# Verificar
echo "[4/4] Verificando despliegue..."
supabase functions list

echo ""
echo "=================================="
echo "  DESPLIEGUE COMPLETADO"
echo "=================================="
```

---

## 📋 Checklist de Despliegue

Antes de ejecutar el despliegue:

- [ ] Tienes acceso al proyecto de producción (`gfazxronwllqcswdaimh`)
- [ ] Tienes la contraseña de la base de datos
- [ ] Tienes todos los valores de secrets (Firebase, Resend, MercadoPago, etc.)
- [ ] Las funciones están en `supabase/functions/`
- [ ] Has probado las funciones localmente

Después del despliegue:

- [ ] Verificar que todas las funciones aparecen en el Dashboard
- [ ] Probar al menos una función crítica (ej: `send-email`)
- [ ] Verificar que los secrets están configurados
- [ ] Revisar los logs por errores

---

## 🔍 Verificar Despliegue

### Ver funciones desplegadas:

```bash
supabase functions list
```

### Ver logs de una función:

```bash
supabase functions logs nombre-funcion
```

### Invocar una función para probar:

```bash
supabase functions invoke nombre-funcion --method POST --body '{"test": true}'
```

---

## 📊 Resumen de Comandos

```bash
# PASO 1: Conectar a producción
supabase link --project-ref gfazxronwllqcswdaimh

# PASO 2: Configurar secrets
supabase secrets set --env-file secrets.env

# PASO 3: Desplegar funciones
supabase functions deploy

# PASO 4: Verificar
supabase functions list
supabase secrets list
```

---

## ⚠️ IMPORTANTE: Secrets de Firebase

Para las notificaciones push, necesitas el private key de Firebase. El formato correcto es:

```bash
# Con saltos de línea literales (\n)
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADA...\n-----END PRIVATE KEY-----"
```

O en el archivo secrets.env:

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDDw3Vo0K+u1d5g
... (resto de la key)
-----END PRIVATE KEY-----"
```

---

## 🆘 Troubleshooting

### Error: "Function already exists"

No es un error, la función se actualizará automáticamente.

### Error: "Secret value is invalid"

Verifica que los valores no tengan espacios extra o caracteres especiales sin escapar.

### Error: "Failed to deploy function"

Revisa los logs: `supabase functions logs nombre-funcion`

---

## 🎯 Próximos Pasos

Después de desplegar:

1. Probar las funciones críticas
2. Configurar webhooks de MercadoPago con la URL de producción
3. Actualizar variables de entorno en la app móvil
4. Hacer un pago de prueba end-to-end

---

**Última actualización:** 2025-11-10
