# Configurar Firebase Cloud Messaging (FCM) en Expo

## Problema Actual

```
Error: "Unable to retrieve the FCM server key for the recipient's app.
Make sure you have provided a server key as directed by the Expo FCM documentation."
```

Este error ocurre porque Expo necesita las credenciales de FCM para enviar notificaciones a dispositivos Android.

## Información del Proyecto

- **Project ID**: `app-mascota-7db30`
- **Project Number**: `867298215472`
- **App ID**: `1:867298215472:android:44f476301c4481617acff5`
- **Package Name**: `com.dogcatify.app`

## Pasos para Configurar FCM en Expo

### Opción A: Usando FCM v1 API (Recomendado)

#### 1. Obtener el archivo de credenciales de servicio

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **app-mascota-7db30**
3. Click en el ícono de engranaje ⚙️ > **Project Settings**
4. Ve a la pestaña **Service Accounts**
5. Click en **Generate New Private Key**
6. Descarga el archivo JSON (se llamará algo como `app-mascota-7db30-firebase-adminsdk-xxxxx.json`)

#### 2. Subir credenciales a Expo

```bash
# Instala la CLI de Expo (si no la tienes)
npm install -g eas-cli

# Login a tu cuenta de Expo
eas login

# Sube las credenciales FCM
eas credentials
```

En el menú interactivo:
1. Selecciona **Android**
2. Selecciona tu build profile (development, preview, o production)
3. Selecciona **Push Notifications: FCM server key**
4. Selecciona **Upload a service account key for FCM V1**
5. Proporciona la ruta al archivo JSON descargado

### Opción B: Usando FCM Legacy Server Key (Más rápido pero obsoleto)

#### 1. Obtener el Server Key

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **app-mascota-7db30**
3. Click en el ícono de engranaje ⚙️ > **Project Settings**
4. Ve a la pestaña **Cloud Messaging**
5. Si ves un mensaje sobre habilitar Cloud Messaging API:
   - Click en el botón de menú (⋮) junto a "Cloud Messaging API (Legacy)"
   - Click en "Manage API in Google Cloud Console"
   - Click en **ENABLE**
   - Espera unos minutos y recarga la página
6. Copia el **Server Key** (empieza con `AAAA...`)

#### 2. Configurar en Expo usando CLI

```bash
# Login a Expo
eas login

# Configurar FCM Server Key
eas credentials
```

En el menú:
1. Selecciona **Android**
2. Selecciona tu build profile
3. Selecciona **Push Notifications: FCM server key**
4. Selecciona **Add a FCM server key**
5. Pega el Server Key cuando te lo pida

### Opción C: Configurar manualmente en eas.json (Legacy)

**Nota**: No es recomendado por seguridad, pero útil para testing

```json
{
  "build": {
    "preview": {
      "android": {
        "config": "app.json"
      },
      "env": {
        "EXPO_PUBLIC_FCM_SERVER_KEY": "tu-server-key-aqui"
      }
    }
  }
}
```

## Verificar la Configuración

### 1. Listar credenciales actuales

```bash
eas credentials
```

Selecciona Android y verás todas las credenciales configuradas.

### 2. Probar después de configurar

Después de subir las credenciales:

1. **NO necesitas rebuild** - las credenciales se usan en el servidor de Expo
2. Prueba inmediatamente:

```bash
node scripts/test-android-notifications.js "ExponentPushToken[tu-token]"
```

## Habilitar Cloud Messaging API

Si el error persiste, asegúrate de que Cloud Messaging API esté habilitada:

### Método 1: Desde Firebase Console

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona **app-mascota-7db30**
3. Ve a **Project Settings** > **Cloud Messaging**
4. Si ves "Cloud Messaging API (Legacy) disabled", habilítalo

### Método 2: Desde Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona el proyecto **app-mascota-7db30** (Project Number: 867298215472)
3. Ve a **APIs & Services** > **Library**
4. Busca "Firebase Cloud Messaging API"
5. Click en **ENABLE**

## Solución de Problemas

### Error: "InvalidCredentials"

**Causa**: Las credenciales FCM no están configuradas o son incorrectas.

**Solución**:
1. Verifica que hayas subido las credenciales correctas
2. Asegúrate de usar el archivo JSON del proyecto correcto
3. Confirma que Cloud Messaging API esté habilitada

### Error: "MismatchSenderId"

**Causa**: El sender ID en google-services.json no coincide con el proyecto.

**Solución**:
1. Descarga un nuevo `google-services.json` desde Firebase
2. Cópialo a la raíz del proyecto y a `android/app/`
3. Rebuild la app

### Las credenciales no se aplican

**Causa**: Las credenciales están configuradas para un profile diferente.

**Solución**:
```bash
# Configura para cada profile que uses
eas credentials --profile preview
eas credentials --profile production
```

### Verificar que el token sea válido

```bash
# El token debe empezar con ExponentPushToken[
echo "ExponentPushToken[GmaZ8POLgyDoSH9O2tbukD]" | grep "^ExponentPushToken\["
```

## Después de Configurar

Una vez que hayas configurado las credenciales FCM:

1. ✅ **NO necesitas rebuild** de la app
2. ✅ Las notificaciones funcionarán inmediatamente
3. ✅ Prueba con el script:
   ```bash
   node scripts/test-android-notifications.js "ExponentPushToken[tu-token]"
   ```
4. ✅ Deberías recibir la notificación en tu dispositivo Android

## Recursos Adicionales

- [Expo Push Notifications - FCM Setup](https://docs.expo.dev/push-notifications/fcm-credentials/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Google Cloud Console](https://console.cloud.google.com/)
- [EAS Credentials](https://docs.expo.dev/app-signing/managed-credentials/)

## Checklist

- [ ] Cloud Messaging API habilitada en Firebase
- [ ] Service Account Key descargado (FCM v1) o Server Key copiado (Legacy)
- [ ] Credenciales subidas a Expo con `eas credentials`
- [ ] Credenciales configuradas para el profile correcto (preview/production)
- [ ] Prueba realizada con el script de test
- [ ] Notificación recibida en el dispositivo Android

## Próximos Pasos

1. Configura las credenciales FCM siguiendo uno de los métodos anteriores
2. Verifica con `eas credentials` que estén configuradas
3. Prueba inmediatamente (sin necesidad de rebuild)
4. Si funciona, ¡listo! Si no, revisa la sección de solución de problemas

**Importante**: La configuración de credenciales se hace **una sola vez** por proyecto. No necesitas repetirla para cada build.
