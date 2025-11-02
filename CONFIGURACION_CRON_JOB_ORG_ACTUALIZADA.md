# Configuración Actualizada para Cron-Job.org

## 🔧 Cambios Implementados

### ✅ Problema 1: Error de Relación con `partner_services`
**Resuelto:** La query ahora obtiene los datos de `partner_services` por separado usando el `service_id`.

### ✅ Problema 2: Error 401/500 en Cron-Job.org
**Resuelto:** Agregada autenticación mediante header `X-Cron-Secret`.

---

## 📋 Configuración Completa en Cron-Job.org

### Paso 1: Crear Nueva Tarea

Ve a https://console.cron-job.org/ y crea un nuevo cronjob.

### Paso 2: Configuración Básica

**Título:**
```
Dogcatify - Enviar Confirmaciones de Reservas
```

**URL:**
```
https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/send-booking-confirmations
```

**Método:**
```
POST
```

### Paso 3: Headers (IMPORTANTE)

Debes agregar estos **2 headers obligatorios**:

#### Header 1:
```
Nombre:  Content-Type
Valor:   application/json
```

#### Header 2: ⚠️ **NUEVO - OBLIGATORIO**
```
Nombre:  X-Cron-Secret
Valor:   
```

### Paso 4: Body (Request)

```json
{}
```
_(Puede estar vacío o con un objeto JSON vacío)_

### Paso 5: Programación

**Opción Recomendada - Cada Hora:**
```
Expresión cron: 0 * * * *
```

O en formato visual:
```
Minuto:    0
Hora:      *
Día:       *
Mes:       *
Día sem:   *
```

### Paso 6: Configuración Adicional

**Zona horaria:**
```
America/Montevideo
```

**Estado:**
- ✅ Activado (Enabled)

**Notificaciones:**
- ✅ En caso de fallo (On failure)
- ⬜ En caso de éxito (desactivar después de probar)

**Guardar respuestas:**
- ✅ Sí (últimas 10 ejecuciones)

---

## 🔑 Token de Seguridad

### Token Actual
```
dogcatify-cron-2024-secure-key
```

### ¿Cómo Funciona?
La edge function valida que el header `X-Cron-Secret` coincida con el token configurado. Si no coincide, devuelve:

```json
{
  "success": false,
  "error": "Unauthorized: Invalid or missing cron secret"
}
```

### Cambiar el Token (Opcional)

Si quieres usar un token diferente:

1. **Configura la variable de entorno en Supabase:**
   - Ve a: Project Settings → Edge Functions → Secrets
   - Agrega: `CRON_SECRET = tu-nuevo-token-secreto`

2. **Actualiza el header en cron-job.org:**
   - Cambia `X-Cron-Secret` al nuevo valor

---

## 📊 Configuración Visual

```
┌─────────────────────────────────────────────────────────────┐
│ CREAR CRONJOB                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Título:                                                     │
│ [Dogcatify - Enviar Confirmaciones de Reservas]            │
│                                                             │
│ URL:                                                        │
│ [https://drhbcmithlrldtjlhnee.supabase.co/                 │
│  functions/v1/send-booking-confirmations]                  │
│                                                             │
│ Método:     [POST ▼]                                        │
│                                                             │
│ ┌─ Headers ────────────────────────────────────────────┐   │
│ │ Content-Type: application/json                       │   │
│ │ X-Cron-Secret: dogcatify-cron-2024-secure-key        │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ Body (Request):                                             │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ {}                                                    │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─ Programación ──────────────────────────────────────┐   │
│ │ Expresión cron: 0 * * * *                            │   │
│ │                                                       │   │
│ │ (Cada hora en punto)                                 │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ Zona horaria: [America/Montevideo ▼]                       │
│                                                             │
│ Estado:       ☑ Activado                                    │
│                                                             │
│ Notificaciones:                                             │
│ ☑ En caso de fallo                                          │
│ ☐ En caso de éxito                                          │
│                                                             │
│          [Cancelar]  [Guardar Cronjob]                      │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Verificación

### Probar Manualmente desde Cron-Job.org

1. Después de guardar, click en ⚡ **"Run now"** / **"Ejecutar ahora"**
2. Espera el resultado en el popup

### Respuestas Esperadas

#### ✅ Éxito (Sin reservas pendientes)
```json
{
  "success": true,
  "message": "No bookings need confirmation emails",
  "processed": 0
}
```

#### ✅ Éxito (Con reservas procesadas)
```json
{
  "success": true,
  "message": "Processed 2 bookings, 0 errors",
  "processed": 2,
  "errors": 0
}
```

#### ❌ Error (Sin token)
```json
{
  "success": false,
  "error": "Unauthorized: Invalid or missing cron secret"
}
```

#### ❌ Error (Token incorrecto)
```json
{
  "success": false,
  "error": "Unauthorized: Invalid or missing cron secret"
}
```

---

## 🧪 Probar Manualmente con cURL

Si quieres probar desde tu terminal:

```bash
curl -X POST \
  https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/send-booking-confirmations \
  -H "Content-Type: application/json" \
  -H "X-Cron-Secret: dogcatify-cron-2024-secure-key" \
  -d '{}'
```

Debería devolver:
```json
{"success":true,"message":"No bookings need confirmation emails","processed":0}
```

---

## 🔍 Monitoreo y Logs

### En Cron-Job.org

1. Ve a la sección **"History"** o **"Historial"**
2. Verifica:
   - ✅ Status: 200 OK
   - ✅ Response: `{"success":true,...}`
   - ✅ Execution time: < 5 segundos

### En Supabase Dashboard

1. Ve a: **Edge Functions** → **send-booking-confirmations** → **Logs**
2. Busca:
   - `booted (time: XXms)` - Función iniciada
   - `Processed X bookings` - Reservas procesadas
   - `Confirmation email sent successfully` - Emails enviados
   - ❌ Errores si hay problemas

---

## 🚨 Troubleshooting

### Error: "500 Internal Server Error"

**Causa:** Falta el header `X-Cron-Secret`

**Solución:** Agregar el header en cron-job.org:
```
X-Cron-Secret: dogcatify-cron-2024-secure-key
```

---

### Error: "401 Unauthorized"

**Causa:** Token incorrecto o mal escrito

**Solución:** Verificar que el header sea exactamente:
```
X-Cron-Secret: dogcatify-cron-2024-secure-key
```

---

### Error: "Could not find a relationship..."

**Causa:** Ya resuelto en la nueva versión

**Solución:** Redesplegar la función (ya hecho) ✅

---

### No se están enviando emails

**Posibles causas:**

1. **No hay reservas con status='reserved'**
   - Verificar en DB: `SELECT * FROM orders WHERE status='reserved';`

2. **Las reservas no tienen `confirmation_hours` configurado**
   - Verificar en partner_services que el campo exista

3. **El timing no coincide**
   - La función solo envía cuando falta exactamente `confirmation_hours` (±1h)
   - Si el servicio tiene `confirmation_hours=48`, solo enviará 47-49h antes de la cita

4. **El template de email no existe**
   - Verificar que exista el template `confirmar_cita` en pending-communication

---

## 📝 Expresiones Cron Útiles

### Cada Hora
```
0 * * * *
```
Ejecuta: 00:00, 01:00, 02:00, 03:00...

### Cada 2 Horas
```
0 */2 * * *
```
Ejecuta: 00:00, 02:00, 04:00, 06:00...

### Cada 30 Minutos
```
*/30 * * * *
```
Ejecuta: 00:00, 00:30, 01:00, 01:30...

### Cada Hora de 8am a 8pm
```
0 8-20 * * *
```
Ejecuta: 08:00, 09:00... 20:00 (solo durante el día)

### Una Vez al Día a las 9am
```
0 9 * * *
```
Ejecuta: 09:00 cada día

---

## 🎯 Checklist Final

Antes de activar el cron, verifica:

- [ ] URL correcta: `https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/send-booking-confirmations`
- [ ] Método: `POST`
- [ ] Header 1: `Content-Type: application/json`
- [ ] Header 2: `X-Cron-Secret: dogcatify-cron-2024-secure-key`
- [ ] Programación: `0 * * * *` (cada hora)
- [ ] Zona horaria: `America/Montevideo`
- [ ] Estado: Activado
- [ ] Test Run exitoso (status 200)
- [ ] Respuesta JSON válida

---

## 📚 Documentos Relacionados

- `SISTEMA_CONFIRMACION_RESERVAS.md` - Documentación completa del sistema
- `supabase/functions/send-booking-confirmations/index.ts` - Código de la función
- `supabase/functions/confirm-booking/index.ts` - Endpoint de confirmación

---

## ✅ Estado Actual

**Edge Function:** ✅ Desplegada con autenticación
**Errores:** ✅ Resueltos
**Token:** ✅ `dogcatify-cron-2024-secure-key`
**Listo para configurar en cron-job.org:** ✅ SÍ

---

## 🔐 Seguridad

### Token Actual (Público)
El token actual `dogcatify-cron-2024-secure-key` es un token básico para desarrollo.

### Para Producción (Recomendado)

Genera un token más seguro:

```bash
# En tu terminal
openssl rand -hex 32
```

Ejemplo de resultado:
```
a8f5f167f44f4964e6c998dee827110c53f8f9f5a1e3f1d7b1e3f1d7b1e3f1d7
```

Luego:
1. Actualiza en Supabase: `CRON_SECRET`
2. Actualiza en cron-job.org: header `X-Cron-Secret`

---

## 🚀 ¡Todo Listo!

Con esta configuración, el sistema enviará automáticamente emails de confirmación cada hora para las reservas de servicios sin costo que lo requieran.

**Próximos pasos:**
1. Configurar el cron en https://console.cron-job.org/
2. Crear el template de email `confirmar_cita`
3. Probar con una reserva real
