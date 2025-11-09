# Resumen de Cambios - Universal Links con Netlify

## 🎯 Objetivo
Configurar Universal Links para que los álbumes compartidos se abran directamente en la app DogCatiFy usando el dominio `app-dogcatify.netlify.app`.

---

## ✅ Archivos Modificados

### 1. `app.json`
**Cambios realizados:**
- iOS `associatedDomains`: Actualizado a `applinks:app-dogcatify.netlify.app`
- Android `intentFilters`: Actualizado con URLs de `app-dogcatify.netlify.app`

**Antes:**
```json
"associatedDomains": [
  "applinks:dogcatify.app",
  "applinks:www.dogcatify.app"
]
```

**Después:**
```json
"associatedDomains": [
  "applinks:app-dogcatify.netlify.app"
]
```

### 2. `components/PostCard.tsx`
**Cambios realizados:**
- URLs de compartir actualizadas a `app-dogcatify.netlify.app`

**Antes:**
```typescript
const webLink = `https://dogcatify.com/album/${id}`;
```

**Después:**
```typescript
const webLink = `https://app-dogcatify.netlify.app/album/${id}`;
```

---

## 📁 Archivos Nuevos Creados

### En `web-redirect/`

1. **index.html** - Página de redirección principal
2. **netlify.toml** - Configuración de Netlify
3. **_headers** - Headers HTTP personalizados
4. **README.md** - Instrucciones de despliegue
5. **.well-known/apple-app-site-association** - Configuración iOS
6. **.well-known/assetlinks.json** - Configuración Android

### En la raíz del proyecto

1. **NETLIFY_SETUP.md** - Guía completa de configuración
2. **CAMBIOS_DOMINIO.md** - Este archivo

---

## 🚀 Próximos Pasos (DEBES HACER)

### 1. Desplegar en Netlify (5 minutos)

```bash
# Opción A: Manual
# 1. Ve a https://app.netlify.com
# 2. Arrastra la carpeta web-redirect/
# 3. Listo!

# Opción B: CLI
cd web-redirect
netlify deploy --prod
```

Tu sitio estará en: `https://app-dogcatify.netlify.app`

### 2. Configurar Credenciales (10 minutos)

**iOS - Team ID:**
```bash
# 1. Ve a https://developer.apple.com/account/
# 2. Copia tu Team ID (10 caracteres)
# 3. Edita: web-redirect/.well-known/apple-app-site-association
# 4. Reemplaza: TEAMID.com.dogcatify.app
#    Por: TU_TEAM_ID.com.dogcatify.app
```

**Android - SHA256:**
```bash
# 1. Obtén el fingerprint
keytool -list -v -keystore android/app/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android | grep SHA256

# 2. Copia el resultado (ej: AA:BB:CC:DD:...)
# 3. Edita: web-redirect/.well-known/assetlinks.json
# 4. Reemplaza: YOUR_SHA256_FINGERPRINT_HERE
#    Por: Tu fingerprint copiado
```

### 3. Verificar Configuración (2 minutos)

```bash
# Verifica que estos URLs retornen 200 OK
curl -I https://app-dogcatify.netlify.app/.well-known/apple-app-site-association
curl -I https://app-dogcatify.netlify.app/.well-known/assetlinks.json
```

**Ambos deben retornar:**
- Status: `200 OK`
- Content-Type: `application/json`

### 4. Rebuild de la App (30 minutos)

```bash
# Android
eas build --profile production --platform android

# iOS
eas build --profile production --platform ios
```

**¿Por qué rebuild?**
Los cambios en `app.json` solo toman efecto en nuevos builds.

### 5. Testing (5 minutos)

1. Instala el nuevo build en tu dispositivo
2. Comparte un álbum desde la app
3. Envíate el link por WhatsApp
4. Toca el link - debe abrir la app directamente

---

## 🎯 Resultados Esperados

### Antes de estos cambios:
❌ Link: `dogcatify://album/123` (no clickeable en WhatsApp)
❌ Solo mostraba Play Store, no App Store
❌ Usuario tenía que copiar ID manualmente

### Después de estos cambios:
✅ Link: `https://app-dogcatify.netlify.app/album/123` (clickeable)
✅ Detecta iOS/Android automáticamente
✅ Si tiene la app instalada → abre directamente
✅ Si no tiene la app → muestra página para descargarla
✅ Experiencia fluida y profesional

---

## 📊 Comparación Visual

### Mensaje Compartido - ANTES
```
🐾 ¡Mira este álbum de Robert!
📸 1 foto(s)

dogcatify://album/9cec2453-566b-4751-a012-86390879e865

¿No tienes la app? Descárgala aquí:
https://play.google.com/store/apps/details?id=com.dogcatify.app
```
**Problemas:**
- Deep link no es clickeable
- Solo muestra Play Store
- Usuario debe instalar y buscar manualmente

### Mensaje Compartido - DESPUÉS
```
🐾 ¡Mira este álbum de Robert compartido por Maria!
📸 1 foto(s)

https://app-dogcatify.netlify.app/album/9cec2453-566b-4751-a012-86390879e865

✨ Abre el link para ver el contenido directo en la app DogCatiFy
```
**Ventajas:**
- Link HTTPS es clickeable en todas las apps
- Abre automáticamente en la app si está instalada
- Muestra la tienda correcta (iOS/Android) si no está instalada

---

## 🔍 Verificación de Funcionamiento

### Test 1: Universal Links (iOS)
```bash
# Validador online
https://branch.io/resources/aasa-validator/
# Ingresa: app-dogcatify.netlify.app
```

### Test 2: App Links (Android)
```bash
# Validador online
https://developers.google.com/digital-asset-links/tools/generator
# Domain: app-dogcatify.netlify.app
# Package: com.dogcatify.app
```

### Test 3: Manual
1. Envía link por WhatsApp: `https://app-dogcatify.netlify.app/album/[ID]`
2. Toca el link
3. **iOS**: Debe abrir la app directamente (sin pregunta)
4. **Android**: Puede preguntar - selecciona "DogCatiFy" y marca "Siempre"

---

## 🐛 Troubleshooting Común

### "El link abre el navegador"
- ✅ Verifica que los archivos .well-known sean accesibles
- ✅ Verifica Team ID (iOS) o SHA256 (Android)
- ✅ Reinstala la app (borra caché)

### "No puedo acceder a .well-known"
- ✅ Verifica que `netlify.toml` esté en web-redirect/
- ✅ Vuelve a desplegar en Netlify
- ✅ Limpia cache: Settings > Clear cache and deploy

### "iOS no reconoce Universal Links"
- ✅ Espera hasta 24 horas (Apple cachea)
- ✅ Reinicia el dispositivo
- ✅ Verifica el Team ID exacto

---

## 📚 Documentación de Referencia

- `NETLIFY_SETUP.md` - Guía completa paso a paso
- `web-redirect/README.md` - Instrucciones de despliegue rápido
- [Netlify Docs](https://docs.netlify.com)
- [Apple Universal Links](https://developer.apple.com/ios/universal-links/)
- [Android App Links](https://developer.android.com/training/app-links)

---

## ✅ Checklist Final

- [ ] Archivos desplegados en Netlify
- [ ] URLs .well-known accesibles (retornan 200)
- [ ] Team ID configurado (iOS)
- [ ] SHA256 configurado (Android)
- [ ] Nuevo build creado con EAS
- [ ] Probado en iOS
- [ ] Probado en Android
- [ ] Link es clickeable en WhatsApp
- [ ] App se abre correctamente

---

## 🎉 ¡Listo!

Una vez completados todos los pasos, tus usuarios podrán:
- Tocar links directamente en WhatsApp
- Ver contenido compartido sin fricciones
- Descargar la app fácilmente si no la tienen

**El cambio de `dogcatify.com` a `app-dogcatify.netlify.app` está COMPLETO.**
