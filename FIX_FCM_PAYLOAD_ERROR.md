# 🔧 Fix: Error de Payload FCM v1

## ❌ Error Encontrado

```
Invalid JSON payload received. Unknown name "priority" at 'message.android.notification': Cannot find field.
```

## 🎯 Causa

El campo `priority` estaba duplicado en el objeto `android.notification`, pero según la [documentación de FCM v1](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages#androidnotification), este campo **NO existe** en `android.notification`.

La prioridad debe estar solo en el nivel `android`, no dentro de `android.notification`.

## ✅ Solución Aplicada

### Estructura Incorrecta (Antes):

```typescript
android: {
  priority: 'high',          // ✅ Correcto aquí
  notification: {
    sound: 'default',
    channelId: 'default',
    priority: 'high',        // ❌ INCORRECTO - No existe este campo
    defaultSound: true,
    defaultVibrateTimings: true,
  },
}
```

### Estructura Correcta (Después):

```typescript
android: {
  priority: 'high',          // ✅ Correcto
  notification: {
    sound: 'default',
    channelId: 'default',
    // ✅ priority REMOVIDO de aquí
    defaultSound: true,
    defaultVibrateTimings: true,
  },
}
```

## 📝 Archivo Corregido

**`supabase/functions/send-notification-fcm-v1/index.ts`**

Se eliminó el campo `priority` duplicado de `android.notification`.

## 🧪 Cómo Verificar el Fix

### 1. Despliega la función actualizada

Si usas Supabase CLI local:
```bash
supabase functions deploy send-notification-fcm-v1
```

Si usas el sistema MCP (ya está desplegado automáticamente).

### 2. Ejecuta el test

```bash
node scripts/test-fcm-v1.js
```

### 3. Resultado Esperado

Ahora deberías ver:

```
✅ Service Account configurado correctamente
✅ Edge function está lista (token de prueba inválido es esperado)
```

O si hay usuarios con FCM token:

```
✅ NOTIFICACIÓN ENVIADA EXITOSAMENTE!
📱 Revisa tu dispositivo Android para ver la notificación
```

## 📚 Referencia: Estructura Correcta de FCM v1

### Android Notification Fields (Permitidos)

Según [AndroidNotification](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages#androidnotification):

```typescript
{
  title?: string;
  body?: string;
  icon?: string;
  color?: string;
  sound?: string;              // ✅
  tag?: string;
  clickAction?: string;
  bodyLocKey?: string;
  bodyLocArgs?: string[];
  titleLocKey?: string;
  titleLocArgs?: string[];
  channelId?: string;          // ✅
  ticker?: string;
  sticky?: boolean;
  eventTime?: string;
  localOnly?: boolean;
  notificationPriority?: string;  // ⚠️ Esto existe pero es diferente a 'priority'
  defaultSound?: boolean;      // ✅
  defaultVibrateTimings?: boolean;  // ✅
  defaultLightSettings?: boolean;
  vibrateTimings?: string[];
  visibility?: string;
  notificationCount?: number;
  lightSettings?: object;
  image?: string;
}
```

### Android Config Fields (Nivel superior)

```typescript
{
  collapseKey?: string;
  priority?: string;           // ✅ 'high' o 'normal' - AQUÍ va priority
  ttl?: string;
  restrictedPackageName?: string;
  data?: Record<string, string>;
  notification?: AndroidNotification;  // Ver arriba
  fcmOptions?: object;
  directBootOk?: boolean;
}
```

## 🎯 Resumen

- ✅ **El error fue corregido** - Campo `priority` eliminado de `android.notification`
- ✅ **Estructura validada** - Ahora cumple con la especificación de FCM v1
- ✅ **Script actualizado** - Detecta este tipo de errores automáticamente
- ✅ **Ready para testing** - Ejecuta `node scripts/test-fcm-v1.js`

## 🚀 Próximo Paso

Ejecuta el test nuevamente:

```bash
node scripts/test-fcm-v1.js
```

Deberías ver todos los checks en verde ✅
