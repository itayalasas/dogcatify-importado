# ✅ Configuración SIMPLE para Cron-Job.org

## 🎯 Solución al Problema de Autenticación

Cron-job.org solicita HTTP Basic Auth (usuario/contraseña), pero nosotros usamos un **query parameter** en la URL para autenticación.

---

## 📋 Configuración en Cron-Job.org

### 1. URL (CON EL SECRET AL FINAL)

```
https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/send-booking-confirmations?secret=dogcatify-cron-2024-secure-key
```

### 2. Método

```
POST
```

### 3. HTTP Authentication

```
❌ DESACTIVAR (toggle OFF)
```

### 4. Headers

**Solo necesitas UNO:**

```
Content-Type: application/json
```

### 5. Body

```json
{}
```

### 6. Programación

```
Expresión cron: 0 * * * *
(Cada hora en punto)
```

### 7. Zona Horaria

```
America/Montevideo
```

---

## 📊 Configuración Visual

```
┌─────────────────────────────────────────────────────────────┐
│ CREAR CRONJOB                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Título:                                                     │
│ Dogcatify - Enviar Confirmaciones                           │
│                                                             │
│ URL:                                                        │
│ https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/     │
│ send-booking-confirmations?secret=dogcatify-cron-2024-      │
│ secure-key                                                  │
│                                                             │
│ Método:     [POST ▼]                                        │
│                                                             │
│ ⚙️ Requires HTTP authentication                             │
│ [ ] DESACTIVADO (toggle OFF)                                │
│                                                             │
│ ┌─ Headers ────────────────────────────────────────────┐   │
│ │ Content-Type: application/json                       │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ Body:  {}                                                   │
│                                                             │
│ Schedule: 0 * * * * (cada hora)                             │
│                                                             │
│ Timezone: America/Montevideo                                │
│                                                             │
│          [Cancelar]  [Guardar]                              │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Checklist

- [ ] URL incluye `?secret=dogcatify-cron-2024-secure-key` al final
- [ ] Método: `POST`
- [ ] HTTP Authentication: **DESACTIVADO** ❌
- [ ] Header: `Content-Type: application/json`
- [ ] Body: `{}`
- [ ] Cron: `0 * * * *`
- [ ] Zona: `America/Montevideo`

---

## 🧪 Probar

Después de guardar, click en ⚡ **"Run now"**

### ✅ Respuesta esperada:

```json
{
  "success": true,
  "message": "No bookings need confirmation emails",
  "processed": 0
}
```

---

## 🔧 Probar con cURL

```bash
curl -X POST "https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/send-booking-confirmations?secret=dogcatify-cron-2024-secure-key" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 🎯 La Clave del Éxito

**El secret va en la URL, NO en los headers:**

✅ **CORRECTO:**
```
URL: https://...send-booking-confirmations?secret=dogcatify-cron-2024-secure-key
HTTP Auth: OFF
```

❌ **INCORRECTO:**
```
URL: https://...send-booking-confirmations
HTTP Auth: ON (usuario/contraseña)
```

---

## 🚀 ¡Listo!

Con esta configuración, el cron debería funcionar perfectamente sin problemas de autenticación.
