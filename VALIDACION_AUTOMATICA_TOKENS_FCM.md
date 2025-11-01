# 🔄 Sistema de Validación Automática de Tokens FCM

## 🎯 Objetivo

Validar y actualizar automáticamente los tokens de notificación (Expo Push + FCM) cuando el usuario inicia sesión, sin necesidad de intervención manual.

## ⚠️ Requisitos Previos

**IMPORTANTE**: Este sistema requiere una **build nativa** de la app.

### NO Funciona En:
- ❌ **Expo Go** - Los tokens FCM no están disponibles
- ❌ **Web** - No hay soporte para push notifications nativas
- ❌ **Simuladores/Emuladores** - Los tokens no están disponibles

### Funciona En:
- ✅ **Builds nativas en dispositivos físicos Android**
- ✅ **Builds nativas en dispositivos físicos iOS**
- ✅ **Builds de desarrollo** (`npm run android`)
- ✅ **Builds EAS** (`eas build --platform android`)

**Logs en Expo Go:**
```
⚠️ Running in Expo Go - Notifications require native build
💡 Run: eas build --platform android --profile preview
```

## ✨ Funcionalidad Implementada

### Cuándo se Ejecuta

La validación se ejecuta **automáticamente** en estos momentos:

1. **Al iniciar sesión** - Cuando `currentUser` cambia en el `AuthContext`
2. **Al abrir la app** - Si el usuario ya está logueado
3. **Después de reinstalar la app** - Los tokens se actualizan automáticamente

**Solo si:**
- ✅ La app es un build nativo (no Expo Go)
- ✅ El usuario ha iniciado sesión
- ✅ El dispositivo es físico (no simulador)

### Qué Hace

```
Usuario inicia sesión
        ↓
¿Tiene permisos de notificación?
        ↓ Sí
Obtiene tokens actuales del dispositivo
        ↓
Compara con tokens almacenados en DB
        ↓
¿Son diferentes o faltan?
        ↓ Sí
Actualiza tokens en base de datos
        ↓
✅ Listo para recibir notificaciones
```

## 🔍 Validaciones Realizadas

### 1. Verificación de Permisos

Si el usuario revocó permisos, limpia los tokens almacenados para mantener coherencia.

### 2. Comparación de Tokens

#### Expo Push Token
Compara el token actual del dispositivo con el almacenado en DB.

#### FCM Token (Android)
Solo en Android, compara el FCM token nativo.

### 3. Casos de Actualización

| Situación | Acción |
|-----------|--------|
| **Usuario nuevo** | Guarda tokens por primera vez |
| **Token cambió** | Actualiza con nuevo token |
| **Token falta** | Obtiene y guarda token |
| **Permisos revocados** | Limpia tokens de DB |
| **Token válido** | No hace nada (eficiente) |

## 📊 Flujo Completo

### Escenario 1: Usuario Nuevo

```
1. Usuario instala app
2. Usuario crea cuenta / inicia sesión
3. Sistema detecta: no hay tokens
4. ¿Tiene permisos? → Pide permisos
5. Usuario acepta permisos
6. Obtiene ambos tokens (Expo + FCM)
7. Guarda en base de datos
8. ✅ Listo para notificaciones
```

### Escenario 2: Usuario Existente (Token Válido)

```
1. Usuario inicia sesión
2. Sistema obtiene tokens actuales
3. Compara con almacenados
4. Tokens coinciden ✅
5. No actualiza (optimización)
6. ✅ Listo para notificaciones
```

### Escenario 3: Usuario Existente (Token Cambió)

```
1. Usuario reinstala app / cambia dispositivo
2. Usuario inicia sesión
3. Sistema obtiene nuevos tokens
4. Compara: tokens diferentes 🔄
5. Actualiza en base de datos
6. ✅ Listo con nuevos tokens
```

### Escenario 4: Usuario Revocó Permisos

```
1. Usuario inicia sesión
2. Sistema verifica permisos
3. Permisos = denegados ❌
4. Limpia tokens de DB
5. Usuario NO recibirá notificaciones
6. (Puede reactivar desde configuración)
```

## 📝 Logs y Debugging

### Logs Normales (Token Válido)

```
=== VALIDANDO TOKENS AL INICIAR SESIÓN ===
Tokens almacenados:
- Expo Token: ExponentPushToken[XXX]...
- FCM Token: cXXXXXXXXXXXXXXXXXXXXX...
✅ Expo token actual: ExponentPushToken[XXX]...
✅ FCM token actual: cXXXXXXXXXXXXXXXXXXXX...
✅ Tokens válidos, no se requiere actualización
=== VALIDACIÓN DE TOKENS COMPLETADA ===
```

### Logs con Actualización

```
=== VALIDANDO TOKENS AL INICIAR SESIÓN ===
Tokens almacenados:
- Expo Token: ExponentPushToken[OLD]...
- FCM Token: null
✅ Expo token actual: ExponentPushToken[NEW]...
✅ FCM token actual: cNEWTOKEN...
🔄 Expo token cambió, necesita actualización
🔄 FCM token cambió, necesita actualización
💾 Actualizando tokens en base de datos...
✅ Tokens actualizados exitosamente
✅ FCM v1 API listo para Android
=== VALIDACIÓN DE TOKENS COMPLETADA ===
```

### Logs sin Permisos

```
=== VALIDANDO TOKENS AL INICIAR SESIÓN ===
⚠️ Permisos de notificación no otorgados
Limpiando tokens almacenados (permisos revocados)
=== VALIDACIÓN DE TOKENS COMPLETADA ===
```

## 🎯 Ventajas del Sistema

### 1. **Totalmente Automático**
- No requiere intervención del usuario
- Se ejecuta en background al iniciar sesión

### 2. **Mantiene Coherencia**
- DB siempre sincronizada con estado real
- Tokens siempre actualizados y válidos

### 3. **Maneja Casos Edge**
- Usuario cambia de dispositivo ✅
- Usuario reinstala app ✅
- Usuario revoca permisos ✅
- Usuario cambia de cuenta ✅

### 4. **Eficiente**
- Solo actualiza si es necesario
- No realiza operaciones innecesarias
- Logs detallados para debugging

### 5. **Compatible con Ambos Sistemas**
- Actualiza Expo Push Token (legacy)
- Actualiza FCM Token (v1 API)
- Funciona en iOS y Android

## 🔄 Flujo de Migración

### Usuario con App Antigua (Solo Expo Token)

```
1. Usuario actualiza app
2. Usuario inicia sesión
3. Sistema detecta: tiene Expo token, falta FCM
4. Obtiene FCM token del dispositivo
5. Actualiza perfil con ambos tokens
6. ✅ Usuario migrado automáticamente
```

### Usuario Nuevo (Después de Actualización)

```
1. Usuario instala app actualizada
2. Usuario crea cuenta
3. Sistema obtiene ambos tokens automáticamente
4. Guarda en DB
5. ✅ Usuario listo con ambos tokens desde el inicio
```

## 🧪 Testing

### Verificar en Base de Datos

```sql
SELECT
  id,
  display_name,
  LEFT(push_token, 30) as expo_token,
  LEFT(fcm_token, 30) as fcm_token,
  updated_at
FROM profiles
WHERE id = 'TU_USER_ID';
```

### Probar Escenarios

#### Test 1: Token Válido
- Usuario cierra sesión
- Inicia sesión de nuevo
- **Esperado**: No actualiza (logs muestran "tokens válidos")

#### Test 2: Token Cambió
- Desinstala app
- Reinstala app
- Inicia sesión
- **Esperado**: Actualiza tokens (logs muestran "actualizando")

#### Test 3: Sin Permisos
- Revoca permisos en Configuración Android
- Cierra app
- Abre app e inicia sesión
- **Esperado**: Limpia tokens (logs muestran "permisos no otorgados")

## 📊 Monitoreo

### Query: Usuarios con Tokens Actualizados Hoy

```sql
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN fcm_token IS NOT NULL THEN 1 END) as con_fcm,
  COUNT(CASE WHEN push_token IS NOT NULL THEN 1 END) as con_expo
FROM profiles
WHERE updated_at::date = CURRENT_DATE
  AND (push_token IS NOT NULL OR fcm_token IS NOT NULL);
```

### Query: Usuarios sin Tokens

```sql
SELECT
  id,
  display_name,
  created_at,
  updated_at
FROM profiles
WHERE push_token IS NULL
  AND fcm_token IS NULL
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

## ✅ Resultado Final

**Experiencia de Usuario:**

1. Usuario instala/actualiza app
2. Usuario inicia sesión
3. **Automáticamente** tiene notificaciones configuradas
4. Sin necesidad de ir a "Configuración"
5. Sin necesidad de "Activar notificaciones"
6. Todo funciona transparentemente

**Experiencia de Desarrollador:**

1. Sistema mantiene tokens actualizados
2. No hay tokens obsoletos en DB
3. Notificaciones siempre funcionan
4. Logs claros para debugging
5. Sin mantenimiento manual

---

**¡Sistema de validación automática implementado!** 🚀

Los usuarios obtienen sus tokens automáticamente al iniciar sesión, sin necesidad de activar nada manualmente.
