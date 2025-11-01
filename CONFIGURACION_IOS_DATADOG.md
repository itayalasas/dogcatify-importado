# Configuración Completa de Datadog para iOS

Esta guía cubre la configuración completa de Datadog para builds de iOS en Expo con EAS Build.

## ✅ Estado de Configuración

### Completado

- ✅ Plugin `@datadog/mobile-react-native` instalado
- ✅ Variables de entorno en `eas.json`
- ✅ Pre-install hook configurado
- ✅ `.datadogrc` con site correcto (us5.datadoghq.com)
- ✅ Perfiles iOS agregados en `eas.json`

### Automático (manejado por el plugin)

- ✅ Configuración de Xcode
- ✅ Script de upload de sourcemaps
- ✅ Integración con el build system de iOS

## 📱 Diferencias: Android vs iOS

### Android

```
gradle.properties → Variables DD_API_KEY, DD_SITE
app/build.gradle  → Task interceptor personalizado
Build Process     → Gradle tasks
Sourcemap Upload  → datadog-ci vía task interceptor
```

### iOS

```
eas.json          → Variables DD_API_KEY, DD_SITE
Plugin Expo       → Configuración automática de Xcode
Build Process     → Xcode build phases
Sourcemap Upload  → datadog-ci vía build phase script
```

## 🔧 Configuración en eas.json

Todos los perfiles ya incluyen configuración iOS:

### Development Profile

```json
"development": {
  "distribution": "internal",
  "ios": {
    "buildConfiguration": "Debug",
    "simulator": false
  },
  "env": {
    "DD_API_KEY": "068208a98b131a96831ca92a86d4f158",
    "DATADOG_API_KEY": "068208a98b131a96831ca92a86d4f158",
    "DD_SITE": "us5.datadoghq.com",
    "DATADOG_SITE": "us5.datadoghq.com"
  }
}
```

### Production Profile

```json
"production": {
  "autoIncrement": true,
  "distribution": "internal",
  "ios": {
    "buildConfiguration": "Release",
    "simulator": false
  },
  "env": {
    "DD_API_KEY": "068208a98b131a96831ca92a86d4f158",
    "DATADOG_API_KEY": "068208a98b131a96831ca92a86d4f158",
    "DD_SITE": "us5.datadoghq.com",
    "DATADOG_SITE": "us5.datadoghq.com"
  }
}
```

## 🚀 Cómo Hacer un Build de iOS

### 1. Build de Desarrollo

```bash
eas build --platform ios --profile development
```

### 2. Build de Producción

```bash
eas build --platform ios --profile production
```

### 3. Build para Ambas Plataformas

```bash
eas build --platform all --profile production
```

## 📊 Verificación del Upload de Sourcemaps

Durante el build de iOS, deberías ver estos logs:

```
📊 Uploading sourcemaps to Datadog...
   Service: com.dogcatify.app
   Version: [version]
   Site: us5.datadoghq.com

Starting upload with Datadog CI
Uploading sourcemap for bundle: main.jsbundle
✅ Sourcemap uploaded successfully
```

## 🔍 Qué Hace el Plugin Automáticamente

El plugin `@datadog/mobile-react-native` se encarga de:

1. **Durante la configuración del proyecto:**
   - Modifica el `Podfile` para incluir Datadog SDK
   - Agrega las dependencias necesarias
   - Configura el framework de Datadog

2. **Durante el build:**
   - Lee las variables `DD_API_KEY` y `DD_SITE`
   - Agrega un build phase script a Xcode
   - Ejecuta `datadog-ci` para subir sourcemaps
   - Vincula los sourcemaps con la versión del build

3. **En runtime:**
   - Inicializa el SDK de Datadog
   - Captura crashes y errores
   - Envía logs y métricas

## 🎯 Variables de Entorno Requeridas

### Para el Build (en eas.json)

```bash
DD_API_KEY=068208a98b131a96831ca92a86d4f158
DATADOG_API_KEY=068208a98b131a96831ca92a86d4f158
DD_SITE=us5.datadoghq.com
DATADOG_SITE=us5.datadoghq.com
```

### Para el Pre-Install Hook

El archivo `eas-hooks/pre-install.sh` ya exporta estas variables:

```bash
export DD_API_KEY="${DD_API_KEY:-068208a98b131a96831ca92a86d4f158}"
export DATADOG_API_KEY="${DATADOG_API_KEY:-068208a98b131a96831ca92a86d4f158}"
export DD_SITE="${DD_SITE:-us5.datadoghq.com}"
export DATADOG_SITE="${DATADOG_SITE:-us5.datadoghq.com}"
```

## 📝 Archivos Clave

```
eas.json                    → Configuración de builds iOS
eas-hooks/pre-install.sh    → Exporta variables antes del build
.datadogrc                  → Configuración del CLI de Datadog
package.json                → Plugin @datadog/mobile-react-native
app.json                    → Config app (el plugin lo modifica)
```

## ⚠️ Notas Importantes

### 1. Simulator vs Device

```json
"simulator": false  // Build para dispositivos reales
"simulator": true   // Build para simulador (más rápido para testing)
```

### 2. Build Configuration

```json
"buildConfiguration": "Debug"    // Para development
"buildConfiguration": "Release"  // Para production/preview
```

### 3. Distribution

```json
"distribution": "internal"  // Para testing interno
"distribution": "store"     // Para App Store
```

## 🔄 Flujo Completo del Build iOS

```
1. EAS Build inicia
   ↓
2. Pre-install hook ejecuta
   → Exporta DD_API_KEY, DD_SITE
   ↓
3. npm install ejecuta
   → Instala @datadog/mobile-react-native
   → El plugin configura el proyecto
   ↓
4. Prebuild ejecuta (si managed workflow)
   → Genera carpeta ios/
   → Modifica Podfile
   → Agrega build phase script
   ↓
5. Pod install ejecuta
   → Instala Datadog SDK
   ↓
6. Xcode build ejecuta
   → Compila la app
   → Build phase script se ejecuta
   → datadog-ci sube sourcemaps a us5.datadoghq.com
   ↓
7. Build completo
   → IPA generado
   → Sourcemaps vinculados en Datadog
```

## ✅ Checklist Pre-Build

Antes de hacer el build de iOS, verifica:

- [ ] `eas.json` tiene configuración iOS
- [ ] Variables DD_API_KEY y DD_SITE están en env
- [ ] Site es `us5.datadoghq.com` (no datadoghq.com)
- [ ] `.datadogrc` existe con configuración correcta
- [ ] Pre-install hook exporta las variables
- [ ] Plugin instalado en package.json
- [ ] Tienes credenciales iOS configuradas en EAS

## 🆘 Troubleshooting

### Sourcemaps no se suben

```bash
# Verificar que las variables están disponibles
eas build --platform ios --profile production --non-interactive

# Revisar logs del build phase
# Buscar: "Uploading sourcemaps to Datadog"
```

### Error de API Key

```bash
# Verificar el site correcto
cat .datadogrc
# Debe mostrar: "datadogSite": "us5.datadoghq.com"

# Verificar variables en eas.json
grep -A 2 "DD_API_KEY" eas.json
```

### Build falla en Pod Install

```bash
# El plugin debería manejar esto automáticamente
# Si falla, verifica que @datadog/mobile-react-native esté instalado
npm list @datadog/mobile-react-native
```

## 📚 Referencias

- [Datadog React Native SDK](https://docs.datadoghq.com/real_user_monitoring/reactnative/)
- [EAS Build - iOS](https://docs.expo.dev/build/setup/)
- [Datadog US5 Site](https://us5.datadoghq.com/)

## 🎉 ¡Listo!

La configuración está completa. Ahora puedes hacer builds de iOS con Datadog totalmente integrado.

Para verificar que todo funciona:

```bash
# Build de prueba
eas build --platform ios --profile development

# Build de producción
eas build --platform ios --profile production

# Build para ambas plataformas
eas build --platform all --profile production
```

Los sourcemaps se subirán automáticamente a tu instancia de Datadog en US5.


## ⚠️ IMPORTANTE: Configuración del SITE

### Error Común

Si ves este error durante el build de iOS:

```
Error: Neither DATADOG_API_KEY nor DD_API_KEY contains a valid 
API key for Datadog site datadoghq.com.
```

**Causa**: El formato del DATADOG_SITE es incorrecto.

### Formato CORRECTO del Site

❌ **INCORRECTO:**
- `"US5"`
- `"us5"`
- `"datadoghq.com"`
- `"US5.datadoghq.com"`

✅ **CORRECTO:**
- `"us5.datadoghq.com"`

### Archivos que Deben Usar el Formato Correcto

1. **app.json** (línea 38):
```json
"extra": {
  "DATADOG_SITE": "us5.datadoghq.com"
}
```

2. **utils/datadogLogger.ts** (línea 11):
```typescript
const DATADOG_SITE = Constants.expoConfig?.extra?.DATADOG_SITE ||
  process.env.EXPO_PUBLIC_DATADOG_SITE || 'us5.datadoghq.com';
```

3. **eas.json** (variables de entorno):
```json
"env": {
  "DD_SITE": "us5.datadoghq.com",
  "DATADOG_SITE": "us5.datadoghq.com"
}
```

4. **.datadogrc**:
```json
{
  "datadogSite": "us5.datadoghq.com"
}
```

### Verificación Rápida

```bash
# Verificar que todos los archivos tengan el formato correcto
grep -r "us5.datadoghq.com" . --include="*.json" --include="*.ts"

# Buscar formatos incorrectos
grep -r '"US5"' . --include="*.json"
```

Si encuentras `"US5"` en algún archivo, cámbialo a `"us5.datadoghq.com"`.

