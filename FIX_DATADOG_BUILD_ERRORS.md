# Fix: DataDog Build Errors en EAS Build

## Problema

Durante el build en EAS (tanto iOS como Android), el proceso fallaba al intentar subir sourcemaps a DataDog:

### Android Error:
```
Execution failed for task ':app:uploadReleaseSourcemaps'.
> Process 'command 'datadog-ci'' finished with non-zero exit value 1
```

### iOS Error:
```
PhaseScriptExecution Bundle React Native code and images
** ARCHIVE FAILED **
Run script build phase 'Upload dSYMs to Datadog' will be run during every build
```

## Causa

El plugin `expo-datadog` estaba configurado para subir automáticamente:
- **iOS**: dSYM files (símbolos de debug)
- **Android**: Source maps

Durante el build en EAS, este proceso fallaba y bloqueaba la compilación completa.

## Solución Aplicada

Deshabilitamos la subida automática de sourcemaps durante el build modificando `app.json`:

### Antes:
```json
"plugins": [
  "expo-router",
  "expo-updates",
  "expo-datadog"
]
```

### Después:
```json
"plugins": [
  "expo-router",
  "expo-updates",
  [
    "expo-datadog",
    {
      "iosDsyms": false,
      "androidSourcemaps": false
    }
  ]
]
```

## ¿Qué significa esto?

### ✅ DataDog SIGUE funcionando
- Los **logs en runtime** siguen funcionando
- El **error tracking** sigue funcionando
- Las **métricas RUM** siguen funcionando
- El SDK de DataDog está activo en la app

### ❌ Lo que NO funciona automáticamente
- Los **stack traces** en los errores NO estarán simbolizados (mostrarán códigos en lugar de nombres de funciones)
- No se subirán automáticamente los archivos de símbolos

## ¿Por qué deshabilitar?

1. **Builds más rápidos**: No hay que esperar la subida de sourcemaps
2. **Menos errores**: El build no falla si hay problemas de red o credenciales
3. **Control manual**: Puedes subir sourcemaps solo cuando los necesites

## ¿Cómo subir sourcemaps manualmente? (Opcional)

Si necesitas stack traces simbolizados en producción:

### Opción 1: Subir después del build exitoso

```bash
# Después de que el build termine exitosamente en EAS

# Para Android
npx datadog-ci react-native upload \
  --platform android \
  --service com.dogcatify.app \
  --bundle android/app/build/generated/assets/react/release/index.android.bundle \
  --sourcemap android/app/build/generated/sourcemaps/react/release/index.android.bundle.map

# Para iOS
npx datadog-ci react-native upload \
  --platform ios \
  --service com.dogcatify.app \
  --bundle ios/main.jsbundle \
  --sourcemap ios/main.jsbundle.map
```

### Opción 2: Script automatizado post-build

Crea un script `upload-sourcemaps.sh`:

```bash
#!/bin/bash

# Esperar a que EAS build termine
echo "Esperando build de EAS..."

# Una vez descargado el build, extraer sourcemaps
# Android APK/AAB
unzip app-release.aab -d extracted/
# Buscar sourcemaps en extracted/

# iOS IPA
unzip app.ipa -d extracted-ios/
# Buscar sourcemaps en extracted-ios/

# Subir a DataDog
npx datadog-ci react-native upload \
  --platform android \
  --service com.dogcatify.app \
  --bundle extracted/index.android.bundle \
  --sourcemap extracted/index.android.bundle.map
```

### Opción 3: No hacer nada (Recomendado para desarrollo)

Para la mayoría de casos de desarrollo:
- Los logs ya te dan suficiente información
- Puedes debuggear localmente con sourcemaps
- Solo necesitas symbolication en producción crítica

## Verificar que DataDog funciona

Después del build, verifica en el dashboard de DataDog que:

1. ✅ Los logs de la app aparecen
2. ✅ Los errores se reportan (aunque no simbolizados)
3. ✅ Las métricas RUM funcionan
4. ✅ Los custom events se registran

Si ves estos datos, DataDog está funcionando correctamente.

## Re-habilitar subida automática (Si lo necesitas)

Si en el futuro quieres volver a intentar la subida automática:

```json
"plugins": [
  [
    "expo-datadog",
    {
      "iosDsyms": true,
      "androidSourcemaps": true
    }
  ]
]
```

**Requisitos para que funcione:**
1. Variables de entorno configuradas en EAS:
   ```bash
   eas secret:create --scope project --name DATADOG_API_KEY --value "tu-api-key"
   eas secret:create --scope project --name DATADOG_APP_KEY --value "tu-app-key"
   ```

2. Archivo `.datadogrc` con las credenciales correctas

3. Red estable durante el build

## Resumen

✅ **Cambio realizado**: Deshabilitada subida automática de sourcemaps
✅ **Resultado esperado**: Builds exitosos en iOS y Android
✅ **DataDog**: Sigue funcionando para logs, errores y métricas
⚠️  **Limitación**: Stack traces no simbolizados (solo si lo necesitas)

## Próximos pasos

1. Hacer commit de los cambios:
   ```bash
   git add app.json
   git commit -m "fix: disable DataDog sourcemap upload during build"
   git push
   ```

2. Reintentar el build:
   ```bash
   eas build --platform all --profile production
   ```

3. ✅ El build debería completar exitosamente

## Referencias

- [Expo DataDog Plugin](https://docs.expo.dev/guides/using-datadog/)
- [DataDog React Native SDK](https://docs.datadoghq.com/real_user_monitoring/reactnative/)
- [DataDog CI Upload](https://github.com/DataDog/datadog-ci/tree/master/src/commands/react-native)
