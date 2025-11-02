# Solución Final: DataDog Build Errors

## Problema Persistente

Después de intentar deshabilitar DataDog en `app.json`, el error continuaba:

```
Execution failed for task ':app:uploadReleaseSourcemaps'.
> Process 'command 'datadog-ci'' finished with non-zero exit value 1
```

**Causa:** El script `datadog-sourcemaps.gradle` del paquete `@datadog/mobile-react-native` se aplica automáticamente y ejecuta tareas de upload de sourcemaps que fallan.

## Solución Implementada

### 1. Android - Deshabilitar Tareas en build.gradle

**Archivo:** `android/app/build.gradle`

```gradle
// Deshabilitar la subida de sourcemaps de Datadog para evitar errores de build
// El SDK de DataDog sigue funcionando en runtime para logs, errores y métricas
tasks.configureEach { task ->
    if (task.name.contains('uploadReleaseSourcemaps') || task.name.contains('uploadDebugSourcemaps')) {
        task.enabled = false
        println "⏭️  Saltando tarea de DataDog sourcemaps: ${task.name} (deshabilitada)"
    }
}
```

**Qué hace:**
- Detecta las tareas de upload de sourcemaps
- Las deshabilita completamente (`task.enabled = false`)
- El SDK de DataDog sigue funcionando en runtime

### 2. Android - Modo Dry Run

**Archivo:** `android/gradle.properties`

```properties
# Deshabilitar subida de sourcemaps de DataDog para evitar errores de build
# El SDK sigue funcionando en runtime para logs, errores y métricas
# Dry run mode evita que se suban pero ejecuta el script sin errores
datadogSourcemapsDryRun=true
```

**Qué hace:**
- Activa el modo "dry run" de DataDog
- El script se ejecuta pero NO sube los sourcemaps
- Evita errores si las tareas no pueden deshabilitarse

### 3. App.json - Plugin Configuration

**Archivo:** `app.json`

```json
"plugins": [
  [
    "expo-datadog",
    {
      "iosDsyms": false,
      "androidSourcemaps": false
    }
  ]
]
```

**Qué hace:**
- Configuración a nivel de Expo
- Deshabilita generación de dSYMs (iOS) y sourcemaps (Android)

## Solución en Capas (Defense in Depth)

Implementamos **3 capas de protección** para asegurar que no falle:

```
Capa 1: app.json config → Intenta prevenir desde Expo
   ↓
Capa 2: gradle.properties → Dry run mode
   ↓
Capa 3: build.gradle → Deshabilita tareas directamente
```

Si una capa falla, las otras atrapan el problema.

## Verificar que Funciona

### En el log del build deberías ver:

```
⏭️  Saltando tarea de DataDog sourcemaps: uploadReleaseSourcemaps (deshabilitada)
```

O si el dry run está activo:

```
Dry run mode enabled, not uploading sourcemaps to Datadog.
```

### Build exitoso:

```
BUILD SUCCESSFUL in 2m 45s
```

## DataDog Sigue Funcionando

✅ **Lo que SÍ funciona:**
- Logs en runtime
- Error tracking
- Crash reporting
- Custom metrics
- RUM (Real User Monitoring)
- Todo el SDK de DataDog está activo

❌ **Lo que NO funciona:**
- Stack traces simbolizados en errores
- Verás nombres ofuscados como `a.b.c` en lugar de `MyFunction`

## ¿Necesitas Stack Traces Simbolizados?

Si realmente necesitas stack traces legibles en producción:

### Opción 1: Upload Manual Después del Build

```bash
# Después de que EAS build termine exitosamente

# Para Android
npx @datadog/datadog-ci react-native upload \
  --platform android \
  --service com.dogcatify.app \
  --release-version 14 \
  --build-version 14

# Para iOS
npx @datadog/datadog-ci react-native upload \
  --platform ios \
  --service com.dogcatify.app \
  --release-version 14 \
  --build-version 14
```

### Opción 2: Re-habilitar (Solo cuando esté configurado correctamente)

Para re-habilitar en el futuro:

1. **Remover** la línea `task.enabled = false` en `build.gradle`
2. **Remover** `datadogSourcemapsDryRun=true` en `gradle.properties`
3. **Configurar** credenciales correctas en EAS:
   ```bash
   eas secret:create --scope project --name DATADOG_API_KEY --value "tu-api-key"
   ```

## Resumen de Archivos Modificados

```
✅ android/app/build.gradle       - Deshabilitar tareas
✅ android/gradle.properties      - Dry run mode
✅ app.json                       - Plugin config
✅ metro.config.js               - Remover Sentry (ya hecho)
```

## Próximos Pasos

1. **Commit de todos los cambios:**
   ```bash
   git add android/app/build.gradle
   git add android/gradle.properties
   git add app.json
   git commit -m "fix: disable DataDog sourcemap uploads to fix build errors"
   git push
   ```

2. **Reintentar el build:**
   ```bash
   eas build --platform android --profile production
   eas build --platform ios --profile production
   ```

3. **Verificar:**
   - El build debería completar SIN errores
   - La app funciona normalmente
   - DataDog logs aparecen en el dashboard

## Para iOS

Si iOS también falla con DataDog sourcemaps, aplicar solución similar:

1. Buscar el script de build en Xcode que sube dSYMs
2. Agregar condición para saltar si `DATADOG_SOURCEMAPS_DRY_RUN=true`
3. O comentar el script completamente en el proyecto de Xcode

## Troubleshooting

### Si el build sigue fallando:

1. **Verificar que los cambios se aplicaron:**
   ```bash
   grep "task.enabled = false" android/app/build.gradle
   grep "datadogSourcemapsDryRun" android/gradle.properties
   ```

2. **Ver logs detallados del build:**
   - En expo.dev, buscar la sección "Run gradlew"
   - Buscar mensajes de DataDog
   - Verificar que dice "dry run mode" o "saltando tarea"

3. **Último recurso - Remover plugin completamente:**
   ```json
   "plugins": [
     "expo-router",
     "expo-updates"
     // Remover expo-datadog temporalmente
   ]
   ```

   Luego deshabilitar DataDog en el código:
   ```typescript
   // utils/datadogLogger.ts
   async initialize() {
     if (Platform.OS === 'web') return;
     // return; // Comentar todo para deshabilitar
   }
   ```

## Conclusión

Con estas 3 capas de protección, el build debería funcionar. DataDog seguirá reportando errores y logs en runtime, solo sin symbolication avanzada (que es opcional para la mayoría de casos).

Si necesitas symbolication más adelante, puedes subirlo manualmente después del build.
