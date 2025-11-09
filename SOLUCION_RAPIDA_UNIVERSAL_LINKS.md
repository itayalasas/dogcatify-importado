# ⚡ Solución Rápida - Universal Links

## 🎯 Problema
El link `https://app-dogcatify.netlify.app/album/[id]` NO abre la app, se queda en el navegador.

## ✅ Solución (3 Pasos)

---

### 1️⃣ OBTENER CREDENCIALES (5 min)

#### Android SHA256:
```bash
keytool -list -v -keystore android/app/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android \
  | grep SHA256
```

**Copia la cadena completa** (ej: `AA:BB:CC:DD:...`)

#### iOS Team ID:
1. Ve a: https://developer.apple.com/account/
2. Login con: `pedro.ayala@ayalait.com.uy`
3. **Copia el Team ID** (esquina superior derecha, 10 caracteres)

---

### 2️⃣ ACTUALIZAR ARCHIVOS (2 min)

#### Archivo 1: `web-redirect/.well-known/apple-app-site-association`

Reemplaza `TEAMID` con tu Team ID real:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TU_TEAM_ID.com.dogcatify.app",
        "paths": ["/album/*", "/post/*", "/share/*"]
      }
    ]
  },
  "webcredentials": {
    "apps": ["TU_TEAM_ID.com.dogcatify.app"]
  }
}
```

#### Archivo 2: `web-redirect/.well-known/assetlinks.json`

Reemplaza `YOUR_SHA256_FINGERPRINT_HERE` con tu SHA256:

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

### 3️⃣ REDESPLEGAR Y REBUILD (15 min)

#### A) Redesplegar Netlify:
1. Ve a https://app.netlify.com
2. Busca tu sitio
3. Drag & drop la carpeta `web-redirect` completa
4. Espera 2 minutos

#### B) Crear nuevo build:
```bash
# Android
eas build --platform android --profile preview

# iOS
eas build --platform ios --profile production
```

#### C) Instalar nuevo build en tu dispositivo

#### D) Probar:
Abre desde navegador/mensaje:
```
https://app-dogcatify.netlify.app/album/7e002271-00e4-4ae6-aff7-fe6dfff9996f
```

**Debe abrir la app automáticamente** ✅

---

## 🔍 Verificación Rápida

**iOS:**
```bash
# Valida que el archivo esté accesible
curl https://app-dogcatify.netlify.app/.well-known/apple-app-site-association
```

**Android:**
```bash
# Valida que el archivo esté accesible
curl https://app-dogcatify.netlify.app/.well-known/assetlinks.json
```

---

## ⏱️ Tiempo Total: ~25 minutos

- Obtener credenciales: 5 min
- Actualizar archivos: 2 min
- Redesplegar Netlify: 2 min
- Build EAS: 15 min
- Instalar y probar: 1 min

---

## 🚨 Si No Funciona

### iOS:
1. Desinstala la app completamente
2. Reinicia el iPhone
3. Reinstala desde el nuevo build
4. Prueba nuevamente

### Android:
```bash
# Resetea verificación de App Links
adb shell pm set-app-links --package com.dogcatify.app 0 all
adb shell pm verify-app-links --re-verify com.dogcatify.app
```

---

## 💡 Alternativa Temporal

Mientras haces el setup, usa deep links directos:

**Comparte este link:**
```
dogcatify://album/7e002271-00e4-4ae6-aff7-fe6dfff9996f
```

- ✅ Abre la app inmediatamente
- ❌ Solo funciona si tienen la app instalada

---

## 📝 Checklist

- [ ] Obtuve SHA256 de Android
- [ ] Obtuve Team ID de Apple
- [ ] Actualicé `apple-app-site-association`
- [ ] Actualicé `assetlinks.json`
- [ ] Redesplegué en Netlify
- [ ] Creé nuevo build con EAS
- [ ] Instalé el nuevo build
- [ ] El link abre la app ✅

---

**¿Dudas?** Consulta la guía completa: `CONFIGURAR_UNIVERSAL_LINKS.md`
