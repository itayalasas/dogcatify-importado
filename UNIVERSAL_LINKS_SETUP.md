# Configuración de Universal Links para DogCatiFy

Esta guía te explica paso a paso cómo configurar Universal Links (iOS) y App Links (Android) para que los enlaces compartidos abran directamente la app.

## Resumen de Cambios Realizados

✅ Página web de redirección creada
✅ Archivos de configuración para iOS y Android generados
✅ app.json actualizado con los dominios correctos
✅ Código de compartir actualizado para usar URLs web
✅ Sistema de manejo de deep links ya configurado en la app

---

## 📁 Archivos Creados

### 1. Página Web de Redirección
- **Ubicación**: `web-redirect/index.html`
- **Función**: Detecta la plataforma y intenta abrir la app, si no está instalada muestra links a las tiendas

### 2. Configuración iOS
- **Ubicación**: `web-redirect/.well-known/apple-app-site-association`
- **Función**: Asocia tu dominio con la app iOS

### 3. Configuración Android
- **Ubicación**: `web-redirect/.well-known/assetlinks.json`
- **Función**: Asocia tu dominio con la app Android

---

## 🚀 Pasos para Implementar

### Paso 1: Subir los archivos al servidor web

Necesitas subir toda la carpeta `web-redirect` a tu dominio `dogcatify.com`:

```
dogcatify.com/
├── index.html
└── .well-known/
    ├── apple-app-site-association (sin extensión)
    └── assetlinks.json
```

**IMPORTANTE:**
- El archivo `apple-app-site-association` NO debe tener extensión
- Ambos archivos deben ser accesibles por HTTPS sin redirecciones
- Los archivos deben retornar Content-Type: `application/json`

### Paso 2: Configurar tu servidor web

#### Para Nginx:
```nginx
server {
    listen 443 ssl;
    server_name dogcatify.com www.dogcatify.com;

    # ... configuración SSL ...

    # Servir archivos estáticos
    location / {
        root /var/www/dogcatify.com;
        try_files $uri $uri/ /index.html;
    }

    # Configuración especial para .well-known
    location /.well-known/apple-app-site-association {
        default_type application/json;
        add_header Content-Type application/json;
    }

    location /.well-known/assetlinks.json {
        default_type application/json;
        add_header Content-Type application/json;
    }
}
```

#### Para Apache (.htaccess):
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>

# Forzar Content-Type correcto para archivos .well-known
<FilesMatch "apple-app-site-association">
    ForceType application/json
</FilesMatch>

<FilesMatch "assetlinks.json">
    ForceType application/json
</FilesMatch>
```

### Paso 3: Obtener certificados de firma

#### Para iOS:
1. El archivo `apple-app-site-association` ya está configurado pero necesitas reemplazar `TEAMID` con tu Team ID de Apple Developer
2. Tu Team ID lo encuentras en: https://developer.apple.com/account/
3. Edita el archivo y reemplaza: `TEAMID.com.dogcatify.app` con `TU_TEAM_ID.com.dogcatify.app`

#### Para Android:
1. Necesitas obtener el SHA256 fingerprint de tu app
2. Ejecuta este comando en tu terminal:

```bash
# Para keystore de debug
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Para keystore de producción (cuando la tengas)
keytool -list -v -keystore android/app/release.keystore -alias your-key-alias
```

3. Copia el SHA256 y reemplázalo en `assetlinks.json`:
```json
"sha256_cert_fingerprints": [
  "TU_SHA256_AQUI"
]
```

### Paso 4: Verificar la configuración

#### Verificar iOS:
1. Visita: https://branch.io/resources/aasa-validator/
2. Ingresa tu dominio: `dogcatify.com`
3. Debe mostrar que el archivo es válido

Alternativamente, verifica manualmente:
```bash
curl -I https://dogcatify.com/.well-known/apple-app-site-association
```
Debe retornar status `200 OK` y `Content-Type: application/json`

#### Verificar Android:
1. Visita: https://developers.google.com/digital-asset-links/tools/generator
2. Ingresa tu dominio: `dogcatify.com`
3. Package name: `com.dogcatify.app`
4. El sistema verificará que todo esté correcto

### Paso 5: Rebuild la app con EAS

Después de todos los cambios en app.json, necesitas crear un nuevo build:

```bash
# Para desarrollo
eas build --profile development --platform android
eas build --profile development --platform ios

# Para producción
eas build --profile production --platform android
eas build --profile production --platform ios
```

### Paso 6: Probar Universal Links

#### En iOS:
1. Instala la app desde el nuevo build
2. Envía un mensaje de prueba con el link: `https://dogcatify.com/album/ID_DE_ALBUM`
3. Presiona el link - debe abrir la app directamente
4. Si no funciona inmediatamente, reinicia el dispositivo

#### En Android:
1. Instala la app desde el nuevo build
2. Envía un mensaje de prueba con el link: `https://dogcatify.com/album/ID_DE_ALBUM`
3. Presiona el link - puede mostrar un diálogo preguntando cómo abrir
4. Selecciona "DogCatiFy" y marca "Siempre"

---

## 🔧 Solución de Problemas

### iOS: "El link no abre la app"
1. **Verifica que AASA esté accesible**: `curl https://dogcatify.com/.well-known/apple-app-site-association`
2. **Reinicia el dispositivo**: iOS cachea agresivamente la configuración
3. **Verifica el Team ID**: Debe coincidir exactamente con tu cuenta de Apple Developer
4. **Borra y reinstala la app**: A veces iOS necesita esto para re-verificar

### Android: "Muestra un selector de app"
1. **Ve a Configuración > Apps > DogCatiFy > Abrir por defecto**
2. **Activa "Abrir links compatibles"**
3. **Verifica que dogcatify.com esté en la lista**

### El link abre el navegador en vez de la app
1. **Verifica que el archivo assetlinks.json o AASA sea accesible**
2. **Asegúrate de usar HTTPS (no HTTP)**
3. **Verifica que no haya redirecciones** (301/302)

### Errores de certificado SHA256
```bash
# Re-obtén el certificado correcto
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA256

# Cópialo exactamente (con los dos puntos)
AA:BB:CC:DD:EE:FF:...
```

---

## 📝 Notas Importantes

1. **Tiempo de propagación**: Los cambios en AASA pueden tardar hasta 24 horas en propagarse
2. **Cache de iOS**: iOS cachea la configuración de Universal Links muy agresivamente
3. **HTTPS obligatorio**: Todo debe servirse por HTTPS
4. **Sin redirecciones**: Los archivos .well-known no deben redirigir
5. **Content-Type correcto**: Debe ser `application/json`

---

## 🎉 ¿Funcionó?

Una vez que todo esté configurado correctamente:

1. Los usuarios que tengan la app instalada verán los enlaces directamente en la app
2. Los usuarios sin la app verán la página web que los guiará a instalarla
3. Los enlaces ahora son CLICKEABLES en WhatsApp y otras apps de mensajería
4. La experiencia es mucho más fluida y profesional

---

## 📚 Referencias

- [Apple Universal Links](https://developer.apple.com/ios/universal-links/)
- [Android App Links](https://developer.android.com/training/app-links)
- [Expo Linking](https://docs.expo.dev/guides/linking/)
