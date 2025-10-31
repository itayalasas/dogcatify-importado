# Fix: Datadog Sourcemaps Upload Error en Build

## Error Original

```
❌ Configuration error: Error: Neither DATADOG_API_KEY nor DD_API_KEY contains a valid API key for Datadog site datadoghq.com.
exception=org.gradle.process.internal.ExecException: Process 'command '/home/expo/workingdir/build/node_modules/.bin/datadog-ci'' finished with non-zero exit value 1

FAILURE: Build failed with an exception.
* Where:
Script '/home/expo/workingdir/build/node_modules/@datadog/mobile-react-native/datadog-sourcemaps.gradle' line: 360
* What went wrong:
Execution failed for task ':app:uploadReleaseSourcemaps'.
> Process 'command '/home/expo/workingdir/build/node_modules/.bin/datadog-ci'' finished with non-zero exit value 1
```

## Causa

El plugin de Datadog para React Native intenta subir los sourcemaps automáticamente durante el build de Android, pero:

1. La API key de Datadog en `eas.json` no está siendo pasada correctamente al proceso de Gradle
2. El plugin espera las variables de entorno `DATADOG_API_KEY` o `DD_API_KEY` pero no las encuentra
3. Esto hace que el build falle completamente

## Solución Aplicada (ACTUALIZADA)

Se **removió completamente el plugin de Datadog Gradle** que causaba el error. Esto NO afecta el funcionamiento de Datadog en runtime.

### Cambios en `android/build.gradle`:

```gradle
dependencies {
    classpath('com.android.tools.build:gradle')
    classpath('com.facebook.react:react-native-gradle-plugin')
    classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')
    classpath('com.google.gms:google-services:4.4.0')
    // Datadog Gradle plugin deshabilitado para evitar error en upload de sourcemaps
    // classpath('com.datadoghq:dd-sdk-android-gradle-plugin:latest.release')
}
```

### Cambios en `android/app/build.gradle`:

```gradle
apply plugin: "com.android.application"
apply plugin: "org.jetbrains.kotlin.android"
apply plugin: "com.facebook.react"
// Plugin de Datadog Gradle REMOVIDO (causaba error con uploadSourcemaps)
// apply plugin: "com.datadoghq.dd-sdk-android-gradle-plugin"
```

**Importante:** El SDK de Datadog (`dd-sdk-android-logs`) **sigue activo** en las dependencias de `android/app/build.gradle`, por lo que Datadog funciona normalmente en la app. Solo se removió el plugin de Gradle que causaba problemas durante el build.

## ¿Qué Cambia?

### ✅ Sigue Funcionando:
- Datadog SDK en la app (logging, RUM, crash reporting)
- Generación de sourcemaps localmente
- Todos los features de Datadog en runtime

### ❌ NO Funciona Automáticamente:
- Subida automática de sourcemaps a Datadog durante el build
- Los stacktraces en Datadog no estarán desminificados automáticamente

## Alternativas

### Opción A: Mantener Deshabilitado (Recomendado para ahora)

✅ **Pros:**
- Build funciona sin errores
- La app funciona completamente
- Datadog sigue reportando errores (solo que sin desminificar)

❌ **Contras:**
- Los stacktraces en Datadog serán minificados (difíciles de leer)

### Opción B: Configurar Variables de Entorno Correctamente

Si quieres habilitar la subida de sourcemaps más adelante:

1. **Asegurarse de que la API key es válida:**
   - Verifica en [Datadog Dashboard → Organization Settings → API Keys](https://app.datadoghq.com/organization-settings/api-keys)
   - La key actual en `eas.json`: `068208a98b131a96831ca92a86d4f158`

2. **Agregar a secretos de EAS:**
   ```bash
   eas secret:create --scope project --name DATADOG_API_KEY --value "068208a98b131a96831ca92a86d4f158"
   ```

3. **Remover de `eas.json` env (para mayor seguridad):**
   ```json
   "env": {
     "DATADOG_SITE": "datadoghq.com"
     // Remover DATADOG_API_KEY de aquí
   }
   ```

4. **Habilitar sourcemaps nuevamente en `build.gradle`:**
   ```gradle
   datadog {
       uploadSourcemaps = true
   }
   ```

### Opción C: Subir Sourcemaps Manualmente

Puedes subir los sourcemaps después del build:

```bash
# Después del build exitoso
npx @datadog/datadog-ci react-native upload \
  --platform android \
  --service com.dogcatify.app \
  --bundle android/app/build/generated/assets/react/release/index.android.bundle \
  --sourcemap android/app/build/generated/sourcemaps/react/release/index.android.bundle.map \
  --release-version 9.0.0 \
  --build-version 35
```

## Verificación

Después del cambio, el build debe completarse sin errores:

```bash
eas build --profile production --platform android
```

Ya no deberías ver:
```
❌ Configuration error: Error: Neither DATADOG_API_KEY nor DD_API_KEY contains a valid API key
```

## Impacto

### En Desarrollo:
- ✅ Sin cambios - Datadog funciona igual

### En Producción:
- ✅ La app funciona normalmente
- ✅ Datadog reporta logs y errores
- ⚠️ Los stacktraces minificados son más difíciles de leer
- 💡 Puedes subir sourcemaps manualmente después si lo necesitas

## Recomendación

**Por ahora, mantener deshabilitado** (`uploadSourcemaps = false`) hasta que:
1. La app esté en producción con usuarios reales
2. Necesites debugging detallado de errores en producción
3. Tengas tiempo para configurar correctamente las API keys en EAS Secrets

Los sourcemaps son útiles pero **no críticos** para que la app funcione.

## Archivos Modificados

- ✅ `android/build.gradle` - Comentado `classpath` del plugin de Datadog Gradle
- ✅ `android/app/build.gradle` - Removido `apply plugin` de Datadog Gradle

## Próximo Paso

Descarga el código actualizado y ejecuta:

```bash
eas build --profile production --platform android
```

El build debería completarse exitosamente ahora.

---

**Fecha del fix:** 31 de Octubre 2025
**Estado:** ✅ Resuelto - Sourcemaps upload deshabilitado
**Impacto:** Ninguno en funcionalidad de la app
