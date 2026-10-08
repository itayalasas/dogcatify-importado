# 🔗 Configurar Universal Links - Solución Completa

## 🎯 Objetivo
Hacer que los links de Netlify (`https://app-dogcatify.netlify.app/album/[id]`) abran automáticamente la app DogCatiFy en lugar de quedarse en el navegador.

---

## ⚠️ PROBLEMA ACTUAL

Los archivos `.well-known` tienen valores de ejemplo (`TEAMID` y `YOUR_SHA256_FINGERPRINT_HERE`) que deben ser reemplazados con tus credenciales reales.

---

## ✅ SOLUCIÓN PASO A PASO

### Paso 1: Obtener SHA256 de Android (2 minutos)

#### Opción A: Usando el keystore del proyecto

Abre una terminal en la raíz del proyecto y ejecuta:

```bash
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**Busca esta sección en la salida:**
```
Certificate fingerprints:
         SHA1: XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
         SHA256: AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99
```

**Copia TODA la cadena SHA256** (con los dos puntos `:`)

#### Opción B: Desde Google Play Console (si ya publicaste)

1. Ve a: https://play.google.com/console
2. Selecciona tu app
3. Ve a "Configuración" > "Integridad de la app"
4. En "Certificado de firma de app", copia el SHA-256

---

### Paso 2: Obtener Team ID de Apple (2 minutos)

#### Opción A: Desde Apple Developer Portal

1. Ve a: https://developer.apple.com/account/
2. Inicia sesión con tu Apple ID: `pedro.ayala@ayalait.com.uy`
3. **Tu Team ID aparece en la esquina superior derecha**
   - Es un código de 10 caracteres (ejemplo: `A1B2C3D4E5`)
4. Cópialo

#### Opción B: Desde EAS CLI

Si tienes EAS instalado:

```bash
eas build:list --platform ios --limit 1
```

Busca la línea: `Apple Team ID: XXXXXXXXXX`

#### Opción C: Desde App Store Connect

1. Ve a: https://appstoreconnect.apple.com
2. Click en tu nombre (arriba a la derecha)
3. Ve a "API Keys" o "Users and Access"
4. El Team ID aparece en la URL: `https://appstoreconnect.apple.com/teams/XXXXXXXXXX`

---

### Paso 3: Actualizar Archivos .well-known

Una vez que tengas:
- ✅ SHA256 de Android
- ✅ Team ID de Apple

#### Para iOS: `web-redirect/.well-known/apple-app-site-association`

**Reemplaza `TEAMID` con tu Team ID real:**

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TU_TEAM_ID_AQUI.com.dogcatify.app",
        "paths": [
          "/album/*",
          "/post/*",
          "/share/*"
        ]
      }
    ]
  },
  "webcredentials": {
    "apps": [
      "TU_TEAM_ID_AQUI.com.dogcatify.app"
    ]
  }
}
```

Ejemplo con Team ID `A1B2C3D4E5`:
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "A1B2C3D4E5.com.dogcatify.app",
        "paths": ["/album/*", "/post/*", "/share/*"]
      }
    ]
  },
  "webcredentials": {
    "apps": ["A1B2C3D4E5.com.dogcatify.app"]
  }
}
```

#### Para Android: `web-redirect/.well-known/assetlinks.json`

**Reemplaza `YOUR_SHA256_FINGERPRINT_HERE` con tu SHA256 real:**

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.dogcatify.app",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
      ]
    }
  }
]
```

---

### Paso 4: Redesplegar en Netlify (1 minuto)

1. Ve a https://app.netlify.com
2. Encuentra el sitio `app-dogcatify`
3. Click en "Deploys" > "Deploy manually"
4. **Arrastra la carpeta `web-redirect` COMPLETA**
5. Espera a que termine el deploy (1-2 minutos)

---

### Paso 5: Crear Nuevo Build de la App (10-15 minutos)

**CRÍTICO:** Los cambios en `app.json` solo funcionan si creas un nuevo build.

#### Para Android:

```bash
eas build --platform android --profile production
```

O si quieres probar rápido (APK):

```bash
eas build --platform android --profile preview
```

#### Para iOS:

```bash
eas build --platform ios --profile production
```

**Luego instala el nuevo build en tu dispositivo.**

---

### Paso 6: Verificar en iOS

Apple necesita validar el archivo `apple-app-site-association`. Verifica que esté accesible:

1. Abre en Safari (iOS):
   ```
   https://app-dogcatify.netlify.app/.well-known/apple-app-site-association
   ```

2. Debe mostrar el JSON con tu Team ID

3. Valida con Apple AASA Validator:
   ```
   https://search.developer.apple.com/appsearch-validation-tool/
   ```
   - Ingresa: `https://app-dogcatify.netlify.app`
   - Debe decir "Valid"

---

### Paso 7: Probar en Dispositivo Real

1. **Instala el NUEVO build** en tu dispositivo
2. **Desinstala la app anterior** si está instalada
3. Reinstala desde el nuevo build
4. Abre el link desde un mensaje, email o navegador:
   ```
   https://app-dogcatify.netlify.app/album/7e002271-00e4-4ae6-aff7-fe6dfff9996f
   ```

**Resultado esperado:**
- ✅ iOS: Aparece banner "Abrir en DogCatiFy" o se abre automáticamente
- ✅ Android: Aparece diálogo "Abrir con DogCatiFy" o se abre automáticamente

---

## 🔍 Troubleshooting

### iOS no muestra el banner

1. **Verifica Associated Domains en Xcode:**
   - Debe estar: `applinks:app-dogcatify.netlify.app`
   - (Ya está en `app.json` línea 43-44)

2. **Limpia cache de iOS:**
   ```bash
   # Desinstala la app
   # Reinicia el iPhone
   # Vuelve a instalar
   ```

3. **Verifica que el archivo esté servido con el Content-Type correcto:**
   - Debe ser `application/json`
   - Ya está configurado en `netlify.toml`

### Android no abre la app

1. **Verifica Intent Filters:**
   - Ya están configurados en `app.json` líneas 75-87
   - `autoVerify: true` está activado

2. **Resetea verificación de Android:**
   ```bash
   adb shell pm set-app-links --package com.dogcatify.app 0 all
   adb shell pm verify-app-links --re-verify com.dogcatify.app
   ```

3. **Verifica que assetlinks.json esté accesible:**
   ```
   https://app-dogcatify.netlify.app/.well-known/assetlinks.json
   ```

---

## 🚀 Alternativa Temporal: Deep Links Directos

Mientras configuras Universal Links, puedes usar deep links directos:

**En lugar de compartir:**
```
https://app-dogcatify.netlify.app/album/[id]
```

**Comparte:**
```
dogcatify://album/[id]
```

**Ventajas:**
- ✅ Funciona inmediatamente
- ✅ No requiere configuración de certificados
- ✅ No requiere nuevo build

**Desventajas:**
- ❌ No funciona desde navegadores web
- ❌ Requiere que la app esté instalada
- ❌ Menos profesional para usuarios

---

## 📋 Checklist Final

- [ ] Obtuve SHA256 de Android
- [ ] Obtuve Team ID de Apple
- [ ] Actualicé `apple-app-site-association` con Team ID real
- [ ] Actualicé `assetlinks.json` con SHA256 real
- [ ] Redesplegué en Netlify
- [ ] Creé nuevo build con EAS (Android y/o iOS)
- [ ] Instalé el nuevo build en mi dispositivo
- [ ] Probé el link desde un navegador/mensaje
- [ ] El link abre la app automáticamente ✅

---

## 💡 Resumen Rápido

**¿Por qué no funciona ahora?**
- Los archivos `.well-known` tienen valores de ejemplo
- La app necesita un nuevo build con las credenciales reales

**¿Qué necesito hacer?**
1. Obtener SHA256 (Android) y Team ID (iOS)
2. Actualizar archivos `.well-known`
3. Redesplegar en Netlify
4. Crear nuevo build con EAS
5. Instalar y probar

**¿Cuánto tiempo toma?**
- Obtener credenciales: 5 minutos
- Actualizar archivos: 2 minutos
- Redesplegar Netlify: 2 minutos
- Crear build EAS: 10-15 minutos
- **Total: ~25 minutos**

---

## 📞 Comando Rápido para Obtener Credenciales

**Android (ejecuta en terminal):**
```bash
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA256
```

**iOS:**
Ve a https://developer.apple.com/account/ y copia el Team ID

---

¿Necesitas ayuda con algún paso específico?
