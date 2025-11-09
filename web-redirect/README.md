# DogCatiFy - Universal Links Landing Page

Esta carpeta contiene el sitio web que permite que los links compartidos de DogCatiFy abran directamente la app.

## 🚀 Despliegue Rápido en Netlify

### Opción 1: Drag & Drop (Más Rápido)

1. Ve a https://app.netlify.com
2. Haz clic en "Add new site" > "Deploy manually"
3. **Arrastra esta carpeta completa** (`web-redirect`) a Netlify
4. Listo! Tu sitio estará en `https://app-dogcatify.netlify.app`

### Opción 2: Desde Git

1. Sube tu proyecto a GitHub
2. En Netlify: "Add new site" > "Import from Git"
3. Selecciona tu repositorio
4. Configuración de build:
   - **Base directory**: `web-redirect`
   - **Build command**: (dejar vacío)
   - **Publish directory**: `.` (punto)
5. Deploy!

## 📁 Archivos Importantes

```
web-redirect/
├── index.html                              # Página de redirección
├── netlify.toml                            # Configuración de Netlify
├── _headers                                # Headers HTTP personalizados
└── .well-known/
    ├── apple-app-site-association          # Para iOS Universal Links
    └── assetlinks.json                     # Para Android App Links
```

## ⚙️ Configuración Necesaria

### 1. iOS - Team ID

Edita `.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "details": [{
      "appID": "TU_TEAM_ID.com.dogcatify.app",  // <- Cambia TU_TEAM_ID
      ...
    }]
  }
}
```

Encuentra tu Team ID en: https://developer.apple.com/account/

### 2. Android - SHA256 Fingerprint

Edita `.well-known/assetlinks.json`:

```bash
# Obtener SHA256 de tu keystore
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA256
```

Luego actualiza el archivo con el SHA256 obtenido.

## ✅ Verificar el Despliegue

Después de desplegar, verifica que estos URLs funcionen:

```bash
# Página principal
curl -I https://app-dogcatify.netlify.app/

# iOS (debe retornar 200 y Content-Type: application/json)
curl -I https://app-dogcatify.netlify.app/.well-known/apple-app-site-association

# Android (debe retornar 200 y Content-Type: application/json)
curl -I https://app-dogcatify.netlify.app/.well-known/assetlinks.json
```

## 🔧 Solución de Problemas

### "Los archivos .well-known no son accesibles"

1. Verifica que `netlify.toml` esté en la raíz de esta carpeta
2. Vuelve a desplegar
3. En Netlify: Settings > Build & deploy > Clear cache

### "Content-Type incorrecto"

Los headers están configurados en `netlify.toml`. Si no funcionan:
1. Verifica que el archivo esté bien formateado
2. Limpia el cache de Netlify
3. Vuelve a desplegar

### "Netlify no encuentra los archivos"

Asegúrate de que al desplegar:
- Estás arrastrando la carpeta `web-redirect` completa
- O configurando `web-redirect` como Base directory

## 📝 Siguientes Pasos

1. ✅ Desplegar en Netlify
2. ⚙️ Configurar Team ID y SHA256
3. 🔍 Verificar URLs .well-known
4. 🏗️ Crear nuevo build de la app con EAS
5. 📱 Probar en dispositivos reales

## 🎉 ¿Funcionó?

Una vez configurado:
- Los links como `https://app-dogcatify.netlify.app/album/123` abrirán directamente la app
- Son clickeables en WhatsApp, Telegram, etc.
- Si no tienen la app, verán la página para descargarla

---

Para más detalles, consulta `NETLIFY_SETUP.md` en la raíz del proyecto.
