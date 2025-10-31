# Fix: EAS Build - AndroidManifest Error

## Error Actual
```
TypeError: Cannot read properties of null (reading 'manifest')
    at isManifest (node_modules/@expo/config-plugins/build/android/Manifest.js:73:16)
    at Object.readAndroidManifestAsync
    at syncConfigurationToNativeAndroidAsync
```

## Causa del Error

El error ocurre cuando `expo-updates` intenta sincronizar su configuración con el AndroidManifest.xml durante el proceso de build en EAS. Esto puede pasar por varias razones:

1. El AndroidManifest.xml tiene un formato que no es reconocido correctamente
2. Hay conflicto entre la configuración en app.json y la configuración nativa
3. El plugin de expo-updates tiene una configuración incorrecta

## Soluciones

### Solución 1: Simplificar Plugin de expo-updates (APLICADA)

Cambiamos de:
```json
[
  "expo-updates",
  {
    "username": "pedro86cu"
  }
]
```

A:
```json
"expo-updates"
```

La configuración de username se puede manejar a través del `owner` en app.json.

### Solución 2: Limpiar y Regenerar Archivos Nativos

Si la solución 1 no funciona, ejecutar localmente:

```bash
# Limpiar archivos nativos
rm -rf android/

# Regenerar con expo prebuild
npx expo prebuild --clean

# Verificar que el manifest se genera correctamente
cat android/app/src/main/AndroidManifest.xml
```

### Solución 3: Usar EAS Build sin expo-updates

Si el problema persiste, podemos temporalmente remover expo-updates:

1. Remover el plugin de app.json:
```json
"plugins": [
  "expo-router",
  ["expo-notifications", { ... }],
  // Comentar temporalmente:
  // "expo-updates",
  ["@datadog/mobile-react-native", { ... }]
]
```

2. Remover la configuración de updates:
```json
// Comentar estas líneas en app.json:
// "updates": {
//   "url": "https://u.expo.dev/..."
// }
```

3. Construir sin OTA updates:
```bash
eas build --profile production --platform android
```

### Solución 4: Verificar AndroidManifest.xml

El AndroidManifest debe tener esta estructura mínima:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <!-- permissions -->
  <application>
    <!-- activities y meta-data -->
  </application>
</manifest>
```

Verificar que:
- No hay caracteres especiales o BOM al inicio
- Todas las etiquetas están bien cerradas
- Los namespaces están correctos

### Solución 5: Variables de Entorno

Agregamos esta variable en eas.json para skip validaciones:

```json
"env": {
  ...
  "EXPO_SKIP_MANIFEST_VALIDATION_TOKEN": "true"
}
```

## Comandos para Diagnosticar

```bash
# Ver estructura del manifest
cat android/app/src/main/AndroidManifest.xml

# Validar XML
xmllint android/app/src/main/AndroidManifest.xml

# Ver logs detallados de EAS
eas build --profile production --platform android --local

# Limpiar caché de npm
rm -rf node_modules package-lock.json
npm install
```

## Siguiente Paso

Intenta construir nuevamente con:
```bash
eas build --profile production --platform android
```

Si el error persiste, prueba las soluciones en orden:
1. ✅ Ya aplicamos simplificar plugin expo-updates
2. Limpiar y regenerar archivos nativos (Solución 2)
3. Remover temporalmente expo-updates (Solución 3)
4. Verificar estructura del manifest (Solución 4)

## Referencias

- [Expo Updates Docs](https://docs.expo.dev/versions/latest/sdk/updates/)
- [EAS Build Configuration](https://docs.expo.dev/build/eas-json/)
- [Troubleshooting EAS Build](https://docs.expo.dev/build-reference/troubleshooting/)
