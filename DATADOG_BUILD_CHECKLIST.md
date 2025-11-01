# ✅ Checklist de Configuración Datadog para EAS Build

## Pre-Build Verification

### 1. Archivos Requeridos
- [x] `.datadogrc` existe en la raíz del proyecto
- [x] `android/gradle.properties` contiene variables DD_API_KEY
- [x] `android/app/build.gradle` tiene task interceptor configurado
- [x] `eas-hooks/pre-install.sh` configura Datadog
- [x] `eas.json` tiene variables en env de production y development
- [x] `.gitignore` incluye `.datadogrc`

### 2. Variables Configuradas

#### En `.datadogrc`:
```json
{
  "apiKey": "068208a98b131a96831ca92a86d4f158",
  "datadogSite": "datadoghq.com"
}
```

#### En `gradle.properties`:
```properties
DD_API_KEY=068208a98b131a96831ca92a86d4f158
DATADOG_API_KEY=068208a98b131a96831ca92a86d4f158
DD_SITE=datadoghq.com
DATADOG_SITE=datadoghq.com
```

#### En `eas.json` (production):
```json
"env": {
  "DD_API_KEY": "068208a98b131a96831ca92a86d4f158",
  "DATADOG_API_KEY": "068208a98b131a96831ca92a86d4f158",
  "DD_SITE": "datadoghq.com",
  "DATADOG_SITE": "datadoghq.com"
}
```

### 3. Comandos de Verificación

```bash
# Verificar .datadogrc
cat .datadogrc

# Verificar gradle.properties
grep "DD_API_KEY" android/gradle.properties

# Verificar build.gradle
grep -A 5 "Configuración de Datadog" android/app/build.gradle

# Verificar pre-install hook
grep -A 5 "Configuring Datadog" eas-hooks/pre-install.sh

# Verificar eas.json
grep "DD_API_KEY" eas.json
```

## Durante el Build

### Logs a Buscar

#### 1. Pre-Install Hook:
```
🤖 Running Android setup...
📊 Configuring Datadog...
   DD_API_KEY: 068208a98b...
   DD_SITE: datadoghq.com
   Creating .datadogrc configuration file...
✅ Datadog configured successfully
```

#### 2. Gradle Task:
```
> Task :app:uploadReleaseSourcemaps
🔧 Configurando variables de entorno para Datadog sourcemaps...
   ✅ DD_API_KEY: 068208a98b...
   ✅ DD_SITE: datadoghq.com
```

#### 3. Datadog CLI:
```
Starting upload...
Upload of /home/expo/workingdir/build/android/.../index.android.bundle.map
Uploading sourcemap... for JS file index.android.bundle
✅ Sourcemap uploaded successfully
```

## Si el Build Falla

### Troubleshooting

1. **Error: "Neither DATADOG_API_KEY nor DD_API_KEY contains a valid API key"**
   - Verificar que `.datadogrc` existe
   - Verificar que `gradle.properties` tiene las variables
   - Verificar que el task interceptor está en `build.gradle`

2. **Verificar valores durante el build:**
   - Buscar los logs del pre-install hook
   - Buscar los logs del task interceptor
   - Verificar que las claves mostradas coinciden

3. **Última opción - Deshabilitar sourcemaps:**
   ```gradle
   // En android/app/build.gradle, comentar:
   // apply from: new File(["node", "--print", "require.resolve('@datadog/mobile-react-native/package.json')"].execute(null, rootDir).text.trim()).getParent() + "/datadog-sourcemaps.gradle"
   ```

## Estructura de Capas

```
Layer 1: eas.json env vars
         ↓
Layer 2: pre-install.sh hook → crea .datadogrc
         ↓
Layer 3: gradle.properties (fallback)
         ↓
Layer 4: build.gradle task interceptor → inyecta environment
         ↓
Layer 5: datadog-ci ejecuta con variables
```

## Notas Importantes

- ✅ El archivo `.datadogrc` NO debe commitearse (está en .gitignore)
- ✅ Se regenera automáticamente en cada build
- ✅ Las variables tienen múltiples fallbacks
- ✅ Los logs mostrarán si las variables están configuradas
- ✅ La API key se trunca en logs por seguridad (solo primeros 10 caracteres)

## Comando de Build

```bash
eas build --platform android --profile production
```

## Verificación Post-Build

1. Build completa exitosamente ✅
2. APK generado
3. Logs muestran "Sourcemap uploaded successfully"
4. En Datadog dashboard: Error Tracking → Sourcemaps → Verificar que existe la versión
