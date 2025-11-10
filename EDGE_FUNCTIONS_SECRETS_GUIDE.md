# 🔐 Cómo Exportar Secrets de Edge Functions en Supabase

## ⚠️ IMPORTANTE: Limitación de Seguridad

**No es posible exportar los VALORES de los secrets desde Supabase** por razones de seguridad. Supabase solo permite:

- ✅ Ver los **NOMBRES** de los secrets
- ✅ Ver el **DIGEST** (hash del valor, no el valor real)
- ✅ Ver la **FECHA** de última actualización
- ❌ **NO** puedes ver los valores reales

Esto es por diseño de seguridad - es una buena práctica.

---

## 📋 Secrets Actuales en Tu Proyecto

Según tu captura de pantalla, estos son los secrets que tienes configurados:

### Secrets Automáticos de Supabase:
1. `SUPABASE_URL`
2. `SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `SUPABASE_DB_URL`

**Estos se configuran automáticamente en cada proyecto - no necesitas copiarlos.**

### Secrets de Email (SMTP):
5. `SMTP_HOST`
6. `SMTP_PORT`
7. `SMTP_USER`
8. `SMTP_PASSWORD`

### Secrets de Firebase:
9. `FIREBASE_PRIVATE_KEY_ID`
10. `FIREBASE_CLIENT_EMAIL`
11. `FIREBASE_CLIENT_ID`

**Nota:** Faltan algunos secrets de Firebase que probablemente necesites:
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_CERT_URL`

---

## 🔄 Cómo Copiar Secrets Entre Proyectos

### Opción 1: Copiar Manualmente (RECOMENDADO)

Dado que no puedes exportar los valores, debes:

1. **Obtener los valores originales** desde donde los guardaste:
   - Firebase Console
   - Resend Dashboard
   - MercadoPago Dashboard
   - Etc.

2. **Configurarlos en el nuevo proyecto:**

```bash
# Conectar al proyecto DESTINO
supabase link --project-ref gfazxronwllqcswdaimh

# Configurar cada secret
supabase secrets set FIREBASE_PRIVATE_KEY_ID=valor_desde_firebase
supabase secrets set FIREBASE_CLIENT_EMAIL=valor_desde_firebase
supabase secrets set SMTP_HOST=smtp.resend.com
# ... etc
```

### Opción 2: Desde Archivo .env

```bash
# 1. Crear archivo con todos los secrets
cat > secrets-production.env << EOF
FIREBASE_PRIVATE_KEY_ID=tu_valor
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=tu_email@proyecto.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=tu_client_id
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/...
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASSWORD=re_xxxxxx
EOF

# 2. Aplicar al proyecto
supabase link --project-ref gfazxronwllqcswdaimh
supabase secrets set --env-file secrets-production.env

# 3. Borrar el archivo por seguridad
rm secrets-production.env
```

---

## 📝 Listar Secrets de un Proyecto

### Comando para Ver Nombres:

```bash
# Conectar al proyecto origen
supabase link --project-ref zkgiwamycbjcogcgqhff

# Listar secrets (solo nombres)
supabase secrets list

# Guardar la lista en un archivo
supabase secrets list > secrets-list.txt
```

### Salida Esperada:

```
NAME                        DIGEST      UPDATED AT
SUPABASE_URL                6638a2a7... 2025-11-09 02:56:21
SUPABASE_ANON_KEY           fd309c69... 2025-11-09 02:56:21
FIREBASE_PRIVATE_KEY_ID     afb90c25... 2025-08-11 15:47:25
FIREBASE_CLIENT_EMAIL       7f4d8939... 2025-08-11 15:47:25
SMTP_HOST                   7e445684... 2025-07-11 03:47:19
```

---

## 🔧 Script para Comparar Secrets Entre Proyectos

```bash
#!/bin/bash

echo "==================================="
echo "Comparando secrets entre proyectos"
echo "==================================="
echo ""

# Proyecto ORIGEN (desarrollo)
echo "Obteniendo secrets de DESARROLLO..."
supabase link --project-ref zkgiwamycbjcogcgqhff
supabase secrets list > secrets-dev.txt

# Proyecto DESTINO (producción)
echo "Obteniendo secrets de PRODUCCION..."
supabase link --project-ref gfazxronwllqcswdaimh
supabase secrets list > secrets-prod.txt

# Comparar
echo ""
echo "==================================="
echo "DIFERENCIAS:"
echo "==================================="
echo ""
echo "Secrets en DEV pero no en PROD:"
diff secrets-dev.txt secrets-prod.txt | grep "^<" | sed 's/^< //'
echo ""
echo "Secrets en PROD pero no en DEV:"
diff secrets-dev.txt secrets-prod.txt | grep "^>" | sed 's/^> //'

# Limpiar
rm secrets-dev.txt secrets-prod.txt
```

---

## 📦 Secrets Faltantes que Probablemente Necesites

Basándome en tu código, estos secrets están en uso pero NO aparecen en la captura:

### 1. Firebase (Completos):
```bash
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/...
```

### 2. MercadoPago:
```bash
MERCADOPAGO_ACCESS_TOKEN=APP-xxxxxxxx
MERCADOPAGO_PUBLIC_KEY=APP_USR-xxxxxxxx
```

### 3. OpenAI (IA Médica):
```bash
OPENAI_API_KEY=sk-xxxxxxxx
```

### 4. Google Cloud (OCR):
```bash
GOOGLE_CLOUD_PROJECT_ID=tu-proyecto
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_CLOUD_CLIENT_EMAIL=tu@proyecto.iam.gserviceaccount.com
```

### 5. Resend (Email) - Alternativa a SMTP:
```bash
RESEND_API_KEY=re_xxxxxxxx
```

---

## 🎯 Proceso Recomendado

### Paso 1: Identificar Secrets Necesarios

Revisa tu código en `supabase/functions/` y busca todos los usos de `Deno.env.get()`:

```bash
# Buscar en todas las funciones
grep -r "Deno.env.get" supabase/functions/
```

### Paso 2: Crear Archivo de Secrets

Crea `secrets.env` con TODOS los secrets necesarios:

```env
# === SUPABASE (Auto-configurados) ===
# No necesitas configurar estos, se crean automáticamente:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - SUPABASE_DB_URL

# === FIREBASE ===
FIREBASE_PRIVATE_KEY_ID=6c256092339bc53b9ba2f05b395386e5803f8ee6
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDDw3Vo0K+u1d5g\n1pjxitfY8MSS+l7SqG8V5Rj5HDsCc+RsSmuudL2NEclu843PxSHAIQFu34jcPdij\nrZxONizRW6xxXkwZ/sNcuHrV5gbkE1K+Ze58hIjurD9qy+SLKKLrP/eBdNkddd/v1\nFitq3OxrZ8DCcOtiB3fkdVIIYsPRdO+nQa5nnd9yaAJavzq+EXty5zYogdFFuR0q\nJbGYXm25mc/lVln6uXIOx6GJa9BQMIxzj9TXmsjOJ9djHA8cpvisOCfAyL2Gafex\njfhZf3EuORhDAot9Yu7nd+A+eLi4JWoH2vf6s1iCDcTR+goUnqxWLxeyR1yiJl13\nhfBTd7XfAgMBAAECggEAAema8Apo02GC+u6u2ffsN6dtLuFZLFdKhPA9pOJ1MA+c\n/YyEDAACGyIuazZGdbwdbvaOQH7HpAv+GZCZcUKzkR+DWz2EEVm/Sg/PEDU9O3ZC\nu55CyJqBzhmGkNER7XXY+RYQOxeLjM1U8J2ZO0HFSDDxbsGsMW4Mct+8Jjt9lTEx\nj3a6Y+ynnhYkyX25XxOQFFWsQOKWenAiQehPp16a3EOnaYfHCgEOBov/uuWkFJJH\nLzziuDGLNI4hubBNkLpsM3Aof50aonG6rT4oVMSMdUgjsoTlfF5SIOUEwip8ad6N\nxHsPFuN0xZL06VEWu0klMDaA6eZPo3kHSEcLcRqfwQKBgQDm5L49/K6J/sK8XGQq\n7kxtOUXoPd224cR0GVskiZHQ6eCAOfR2Vk9mAU6t756+THAqqHh1auIco5ubCPPm\nueQJ2Pyb41TcfkFBRtoJKxKDm7fNpBkfgvUmjndH4dfTYxcuK0QTubHA5I8opKXU\nMw6s9cRkdqcWPBG5IlK2vlFstwKBgQDZDNIGVZDWHW4scZHk17Z3Sf0w2ibBsnOV\nKf5HPcUA9JHG7sWRC0RlxkrVVcLRKCBVPtrhtkrFqaPY1rvO1lhCUAzfA9Xs8OBm\npd1QbI3q0IiTqQRJ4vFQ0WZl74lCsqgFjO6ZsVPvD157jEamblpj6VYZG/MJ3tSG\nzzSCjzSoGQKBgFPMBsNmdk382N4VxgDStYgadiWgdlwOOgdMwIhVKUeh6el/nxpn\nnq9NoCl+QqWcBkVlGTq8DM4KDspIiIRfSMTOLHfDHKRdaf9v4Gfdav26wQ1wFfIa\nzDAvGllLPNIqL1qBN1bVWQ7BpLdCcjC+SwA4vgscCO4H5QLE0zIhhlmnAoGAF/b2\naYShDUMKmxWfCilXGCyvK+mqRdCyOlH8pVkIm2ZlghVy8uTPlH0kXhGuBPHtP/xE\npo8+Cj0EvjhXXCsGa6vy/9yojhS6chr2KJ8TvE1yBvuuYYoRIt878x1Thm27Z4F8\nBrQxlD+aKwH9+vpMOKPWwcb4OqrDxG60WYX+RmECgYACMHORMEBsvJsAhDusXb8X\ndFNCZ+AaFz7ludnTa02kanDZYX+/RXG1Nd75dMMv7WlTIzN03Rbp3VO5AKVBIcnK\nteHydUUQ9alX6Tb1Q2Z7tQPJ65eeDtrWibFpyHaR9FhMvCmNEnOE9K6JaxuqiUsx\nrIv5baxF9GkGr0yRaKxVYA==\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc340@app-mascota-7db30.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=109374673320703954244
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc340%40app-mascota-7db30.iam.gserviceaccount.com

# === EMAIL (SMTP) ===
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASSWORD=<OBTENER_DE_RESEND>

# === RESEND (Alternativa) ===
RESEND_API_KEY=re_xxxxxxxx

# === MERCADOPAGO ===
MERCADOPAGO_ACCESS_TOKEN=<OBTENER_DE_MERCADOPAGO>
MERCADOPAGO_PUBLIC_KEY=<OBTENER_DE_MERCADOPAGO>

# === OPENAI ===
OPENAI_API_KEY=<OBTENER_DE_OPENAI>

# === GOOGLE CLOUD ===
GOOGLE_CLOUD_PROJECT_ID=<TU_PROYECTO>
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_CLOUD_CLIENT_EMAIL=<TU_EMAIL>@<TU_PROYECTO>.iam.gserviceaccount.com
```

### Paso 3: Aplicar Secrets

```bash
# Conectar al proyecto de producción
supabase link --project-ref gfazxronwllqcswdaimh

# Aplicar todos los secrets
supabase secrets set --env-file secrets.env

# Verificar
supabase secrets list
```

---

## ✅ Verificación Final

Después de configurar los secrets, verifica que las funciones funcionan:

```bash
# Probar función que use Firebase
supabase functions invoke send-notification-fcm-v1 --method POST

# Probar función que use Email
supabase functions invoke send-email --method POST

# Ver logs para errores
supabase functions logs send-notification-fcm-v1
```

---

## 🔒 Seguridad

**IMPORTANTE:**

1. ✅ Nunca subas `secrets.env` a Git
2. ✅ Borra `secrets.env` después de usar
3. ✅ Usa un gestor de contraseñas para guardar los valores
4. ✅ Rota los secrets periódicamente
5. ✅ No expongas los secrets en logs o mensajes de error

---

## 🆘 Si Perdiste los Secrets

Si no tienes los valores originales:

1. **Firebase:** Genera un nuevo Service Account desde Firebase Console
2. **Resend:** Genera una nueva API key desde Dashboard
3. **MercadoPago:** Obtén nuevas credenciales desde tu cuenta
4. **OpenAI:** Genera nueva API key (la anterior quedará inválida)
5. **Google Cloud:** Genera nuevo Service Account

---

**Resumen:** No hay forma de exportar los valores de los secrets, pero puedes ver los nombres con `supabase secrets list` y luego configurarlos manualmente en el nuevo proyecto.
