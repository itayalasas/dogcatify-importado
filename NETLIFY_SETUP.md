# Configuración de Universal Links con Netlify

## Dominio Configurado: `app-dogcatify.netlify.app`

### ✅ Cambios Realizados

1. **app.json actualizado**
   - iOS: `applinks:app-dogcatify.netlify.app`
   - Android: `https://app-dogcatify.netlify.app`

2. **Código de compartir actualizado**
   - Ahora genera links: `https://app-dogcatify.netlify.app/album/[id]`
   - Los links son clickeables en WhatsApp y otras apps

---

## 🚀 Despliegue en Netlify

### Paso 1: Preparar el sitio para Netlify

La carpeta `web-redirect` contiene todos los archivos necesarios:

```
web-redirect/
├── index.html
└── .well-known/
    ├── apple-app-site-association
    └── assetlinks.json
```

### Paso 2: Desplegar en Netlify

**Opción A: Despliegue Manual (más rápido)**

1. Ve a https://app.netlify.com
2. Haz clic en "Add new site" > "Deploy manually"
3. Arrastra la carpeta `web-redirect` completa
4. Netlify la desplegará automáticamente en tu dominio `app-dogcatify.netlify.app`

**Opción B: Desde Git (recomendado para producción)**

1. Sube tu proyecto a GitHub/GitLab
2. Conecta el repositorio en Netlify
3. Configura el build:
   - Base directory: `web-redirect`
   - Publish directory: `/` (raíz)
   - Build command: (dejar vacío, no necesita build)

### Paso 3: Configurar Headers en Netlify

Netlify necesita headers especiales para los archivos `.well-known`. Crea un archivo `_headers` en `web-redirect/`:

```
/.well-known/apple-app-site-association
  Content-Type: application/json
  Access-Control-Allow-Origin: *

/.well-known/assetlinks.json
  Content-Type: application/json
  Access-Control-Allow-Origin: *
```

### Paso 4: Verificar el despliegue

Verifica que estos URLs estén accesibles:

```bash
# Página principal
curl -I https://app-dogcatify.netlify.app/

# iOS Universal Links
curl -I https://app-dogcatify.netlify.app/.well-known/apple-app-site-association

# Android App Links
curl -I https://app-dogcatify.netlify.app/.well-known/assetlinks.json
```

Todos deben retornar `200 OK` y el Content-Type correcto.

---

## 🔧 Configuración de Certificados

### Para iOS (Apple Team ID)

1. Ve a https://developer.apple.com/account/
2. Copia tu Team ID (10 caracteres)
3. Edita `web-redirect/.well-known/apple-app-site-association`
4. Reemplaza `TEAMID` con tu Team ID real:

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
  }
}
```

### Para Android (SHA256 Fingerprint)

1. Obtén el fingerprint de tu keystore:

```bash
# Para debug
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA256

# Para producción
keytool -list -v -keystore tu-release.keystore -alias tu-alias
```

2. Edita `web-redirect/.well-known/assetlinks.json`
3. Reemplaza `YOUR_SHA256_FINGERPRINT_HERE` con tu fingerprint:

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

## 🔨 Rebuild de la App

Después de configurar todo, necesitas crear nuevos builds:

```bash
# Android
eas build --profile production --platform android

# iOS
eas build --profile production --platform ios
```

---

## ✅ Testing

### Probar en iOS

1. Instala el build más reciente
2. Envía este link por WhatsApp: `https://app-dogcatify.netlify.app/album/[ID_REAL]`
3. Toca el link - debe abrir la app directamente
4. Si no funciona, reinicia el dispositivo (iOS cachea mucho)

### Probar en Android

1. Instala el build más reciente
2. Envía este link por WhatsApp: `https://app-dogcatify.netlify.app/album/[ID_REAL]`
3. Toca el link - puede preguntar con qué app abrir
4. Selecciona "DogCatiFy" y marca "Siempre"

---

## 🔍 Validadores Online

**iOS Universal Links:**
- https://branch.io/resources/aasa-validator/
- Ingresa: `app-dogcatify.netlify.app`

**Android App Links:**
- https://developers.google.com/digital-asset-links/tools/generator
- Domain: `app-dogcatify.netlify.app`
- Package: `com.dogcatify.app`

---

## 🐛 Troubleshooting

### "El link abre el navegador en vez de la app"

1. **Verifica que los archivos .well-known sean accesibles**
   ```bash
   curl https://app-dogcatify.netlify.app/.well-known/apple-app-site-association
   ```

2. **Verifica el Team ID / SHA256**
   - Deben ser exactamente los correctos

3. **Reinstala la app**
   - iOS y Android verifican los Universal Links en la primera instalación

### "No puedo acceder a los archivos .well-known"

1. Verifica que el archivo `_headers` esté en la raíz de `web-redirect/`
2. Vuelve a desplegar en Netlify
3. Limpia el cache de Netlify: Settings > Build & deploy > Clear cache

### "iOS no reconoce los Universal Links"

1. Espera 24 horas (Apple cachea)
2. Reinicia el dispositivo
3. Borra y reinstala la app
4. Verifica el Team ID en el archivo AASA

---

## 📝 Checklist Final

- [ ] Archivos subidos a Netlify
- [ ] `_headers` configurado
- [ ] Team ID de Apple actualizado en AASA
- [ ] SHA256 actualizado en assetlinks.json
- [ ] URLs `.well-known` accesibles y retornan 200
- [ ] Content-Type es `application/json`
- [ ] Nuevo build creado con EAS
- [ ] Probado en iOS
- [ ] Probado en Android

---

## 🎉 ¿Todo funcionando?

Cuando esté todo listo:
- Los links serán clickeables en WhatsApp
- Si la app está instalada, abrirá directamente el contenido
- Si no está instalada, mostrará la página para descargarla
- Experiencia profesional y sin fricciones

---

## 📚 Recursos

- [Netlify Headers](https://docs.netlify.com/routing/headers/)
- [Apple Universal Links](https://developer.apple.com/ios/universal-links/)
- [Android App Links](https://developer.android.com/training/app-links)
