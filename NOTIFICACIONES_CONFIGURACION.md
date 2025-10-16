# Configuración de Notificaciones Push - DogCatiFy

## Cambios Realizados

### 1. Deshabilitar Notificaciones en Expo Go

**Problema:** Al ejecutar la app en Expo Go, se mostraban errores porque Expo Go no soporta notificaciones push nativas desde SDK 53.

**Solución:**
- Se modificó `NotificationContext.tsx` para cargar los módulos de notificaciones **solo cuando NO estamos en Expo Go**
- Se usa carga condicional con `require()` en lugar de `import` estático
- Esto previene errores en desarrollo con Expo Go

```typescript
const isExpoGo = Constants.appOwnership === 'expo';

let Notifications: any = null;
let Device: any = null;

if (!isExpoGo && Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
}
```

### 2. Icono Personalizado de Notificaciones

**Problema:** Las notificaciones mostraban el icono de Expo Go en lugar del icono de la app.

**Solución Implementada:**
- El icono personalizado ya está configurado correctamente en:
  - `app.json`: Define el icono en `notification.icon`
  - `AndroidManifest.xml`: Configurado con `notification_icon` drawable
  - Archivos de recursos: Iconos en todas las densidades (hdpi, mdpi, xhdpi, xxhdpi, xxxhdpi)
  - Color del icono: `#2D6A6F` (color principal de la app)

**Archivos del icono:**
```
android/app/src/main/res/
  ├── drawable-hdpi/notification_icon.png
  ├── drawable-mdpi/notification_icon.png
  ├── drawable-xhdpi/notification_icon.png
  ├── drawable-xxhdpi/notification_icon.png
  └── drawable-xxxhdpi/notification_icon.png
```

### 3. Control de Permisos y Estado

**Problema:** La app intentaba enviar notificaciones aunque el usuario no hubiera activado los permisos, y el switch no reflejaba correctamente el estado.

**Solución:**
- Nuevo campo `notificationsEnabled` en el contexto que refleja el estado real
- La función `sendNotificationToUser()` ahora verifica antes de enviar:
  - Si el usuario tiene un `push_token` guardado
  - Si el usuario tiene `notification_preferences.push = true`
  - Solo envía notificaciones si ambas condiciones se cumplen

```typescript
// Verificación antes de enviar
const { data: profile } = await supabaseClient
  .from('profiles')
  .select('push_token, notification_preferences')
  .eq('id', userId)
  .single();

if (!profile?.push_token) {
  console.log('❌ User does not have push notifications enabled');
  return;
}

const preferences = profile.notification_preferences || {};
if (preferences.push === false) {
  console.log('❌ User has disabled push notifications');
  return;
}
```

### 4. Flujo de Habilitación/Deshabilitación

**Antes:** El usuario no podía desactivar notificaciones fácilmente.

**Ahora:**
- El switch en el perfil permite habilitar/deshabilitar notificaciones
- Al habilitar:
  1. Solicita permisos del sistema
  2. Obtiene token de Expo
  3. Guarda el token en la base de datos
  4. Actualiza `notification_preferences.push = true`

- Al deshabilitar:
  1. Elimina el token de la base de datos
  2. Actualiza `notification_preferences.push = false`
  3. Ya no se enviarán notificaciones a ese usuario

### 5. Manejo de Errores Mejorado

**Antes:** Errores genéricos difíciles de entender.

**Ahora:**
- Mensajes de error claros y específicos:
  - "Las notificaciones no están disponibles en Expo Go..."
  - "Las notificaciones solo funcionan en dispositivos físicos..."
  - "Permisos denegados por el usuario"
  - Etc.

## Uso en Desarrollo

### Con Expo Go (Desarrollo rápido)
- Las notificaciones NO funcionarán
- No se mostrarán errores
- Puedes desarrollar otras funcionalidades sin problemas

### Con Development Build (Testing completo)
1. Crear el build:
   ```bash
   eas build --profile development --platform android
   ```
2. Instalar el APK en tu dispositivo
3. Las notificaciones funcionarán completamente

### En Producción
- Las notificaciones funcionarán automáticamente
- El icono será el de DogCatiFy
- El color será `#2D6A6F` (verde-azulado)

## Configuración de Notificaciones en la Base de Datos

### Tabla `profiles`
```sql
push_token: text (nullable)
notification_preferences: jsonb {
  push: boolean,
  email: boolean
}
```

### Lógica de Envío
```typescript
// Solo envía si:
// 1. push_token existe
// 2. notification_preferences.push === true

if (!profile?.push_token || preferences.push === false) {
  // No enviar notificación
  return;
}
```

## Canales de Notificación Android

La app configura 3 canales de notificación:

1. **default** - Notificaciones generales
   - Importancia: MAX
   - Color: #2D6A6F
   - Vibración: [0, 250, 250, 250]

2. **chat** - Mensajes de chat y adopción
   - Importancia: HIGH
   - Color: #2D6A6F
   - Vibración: [0, 250, 250, 250]

3. **bookings** - Reservas y citas
   - Importancia: HIGH
   - Color: #2D6A6F
   - Vibración: [0, 500, 250, 500]

## Testing

Para probar notificaciones:
1. Instalar development build o production build
2. Ir a Perfil
3. Activar "Notificaciones Push v2"
4. Presionar "Probar notificación"
5. Deberías ver una notificación con el icono de DogCatiFy

## Troubleshooting

### "No se pudieron habilitar notificaciones"
- Verificar que NO estés en Expo Go
- Verificar que sea un dispositivo físico (no simulador)
- Revisar permisos en Configuración > Apps > DogCatiFy > Notificaciones

### "El icono sigue siendo el de Expo"
- Esto solo pasa en Expo Go (es normal)
- En un build real, el icono será el correcto

### "No recibo notificaciones"
- Verificar que el switch esté activado en el perfil
- Verificar que la app tenga permisos de notificación
- Revisar logs de la app con `npx react-native log-android`
