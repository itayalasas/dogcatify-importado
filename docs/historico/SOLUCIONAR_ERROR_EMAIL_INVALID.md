# 🔧 Solución: Error "Email address is invalid"

## 🔴 El Error

```
ERROR  Auth signup error: [AuthApiError: Email address "test.comprador@dogcatify.com" is invalid]
```

Este error ocurre cuando Supabase **rechaza el formato del email** durante el registro. Aunque otros emails con `@dogcatify.com` funcionan, este en particular está siendo bloqueado.

---

## 🎯 Causas Posibles

### 1. **Allowlist/Blocklist de Dominios**
Supabase puede tener configurada una lista de dominios permitidos o bloqueados.

### 2. **Rate Limiting**
Demasiados registros en poco tiempo desde la misma IP/dominio.

### 3. **Formato del Email**
El punto (`.`) antes del `@` puede estar causando problemas con alguna validación.

### 4. **Configuración de Auth Providers**
El Email Provider puede tener restricciones adicionales.

---

## ✅ Solución: Verificar Auth Settings en Dashboard

### Paso 1: Acceder a Auth Configuration

Ve a: **https://supabase.com/dashboard/project/gfazxronwllqcswdaimh/auth/providers**

### Paso 2: Verificar Email Provider Settings

En la sección **Email**:

1. ✅ **Enable email provider** debe estar **ON**
2. ✅ **Enable email signup** debe estar **ON**
3. ❌ **Confirm email** debe estar **OFF** (usas tu API custom)
4. ⚠️ **Allow list** debe estar **VACÍO** (o incluir `dogcatify.com`)
5. ⚠️ **Block list** debe estar **VACÍO**

### Paso 3: Verificar Email Settings Avanzados

Navega a: **Settings > Authentication**

Verifica:

- **Email validation**: No debe tener reglas restrictivas custom
- **Rate limits**: No debe estar muy bajo
  - Default: 60 requests por hora
  - Para development: Aumentar a 100+

### Paso 4: Verificar Logs de Auth

Ve a: **https://supabase.com/dashboard/project/gfazxronwllqcswdaimh/logs/explorer**

Busca logs recientes de:
```sql
SELECT * FROM auth.audit_log_entries
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;
```

Esto te mostrará el error exacto que Supabase está viendo.

---

## 🧪 Prueba Alternativa

### Opción 1: Usar Gmail para Probar

En lugar de `test.comprador@dogcatify.com`, prueba con:
```
tu-email@gmail.com
```

Si funciona, confirma que es un problema de dominio/formato.

### Opción 2: Usar Email sin Punto

En lugar de `test.comprador@dogcatify.com`, prueba:
```
testcomprador@dogcatify.com
```

Si funciona, el punto está causando el problema.

### Opción 3: Verificar desde SQL

Intenta crear el usuario directamente:

```sql
-- Ver si podemos crear el usuario manualmente
SELECT * FROM auth.users WHERE email = 'test.comprador@dogcatify.com';
```

---

## 🔍 Verificar Rate Limits

Si has hecho muchas pruebas, Supabase puede haber aplicado rate limiting:

### En el Dashboard:

1. Ve a **Logs > Auth Logs**
2. Busca mensajes como: `rate_limit_exceeded` o `too_many_requests`

### Esperar y Reintentar:

- Rate limits se resetean cada **1 hora**
- Espera 10-15 minutos e intenta de nuevo

---

## 📋 Checklist de Configuración

Ve al Dashboard de Supabase y verifica:

### Authentication > Providers > Email:
- [ ] Enable email provider: **ON**
- [ ] Enable email signup: **ON**
- [ ] Confirm email: **OFF**
- [ ] Allow list: **VACÍO** (o con `*@dogcatify.com`)
- [ ] Block list: **VACÍO**

### Authentication > Settings:
- [ ] Email validation: Sin reglas custom restrictivas
- [ ] Rate limits: >= 60 requests/hour
- [ ] Password requirements: Configurados (min 6 caracteres)

### Authentication > URL Configuration:
- [ ] Site URL: `http://localhost:8081` (o tu dominio)
- [ ] Redirect URLs: Incluye `dogcatify://` y `exp://`

---

## 🚀 Solución Rápida

Si todo lo anterior está bien configurado, intenta:

### 1. Limpiar Cache de Supabase (Server Side)

En algunos casos, Supabase cachea validaciones. Espera 5-10 minutos.

### 2. Usar un Email Completamente Diferente

Prueba con:
```
nuevo-test-2025@dogcatify.com
```

### 3. Verificar en Producción vs Development

Recuerda que estás en **DEVELOP** (gfazxronwllqcswdaimh).

Si la rama **MAIN** funciona pero **DEVELOP** no, compara las configuraciones de Auth entre ambas ramas.

---

## 📞 Si Nada Funciona

1. **Contacta Soporte de Supabase**:
   - Support > New Ticket
   - Incluye: Project ID, email que falla, y el error completo

2. **Verifica Status de Supabase**:
   - https://status.supabase.com
   - Puede haber un problema temporal del servicio

---

## ✅ Después de Corregir

Una vez que identifiques y corrijas el problema:

1. Reinicia el servidor de desarrollo:
   ```bash
   npx expo start --clear
   ```

2. Intenta registrarte de nuevo

3. Verifica en la base de datos:
   ```sql
   SELECT email, created_at
   FROM auth.users
   WHERE email = 'test.comprador@dogcatify.com';
   ```

---

**Fecha:** 2025-01-11
**Rama:** develop (gfazxronwllqcswdaimh)
