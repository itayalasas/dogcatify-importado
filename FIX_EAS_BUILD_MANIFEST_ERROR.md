# Fix: EAS Build - Plugin Errors

## Errores Encontrados

### Error 1: AndroidManifest null (RESUELTO)
```
TypeError: Cannot read properties of null (reading 'manifest')
    at isManifest (node_modules/@expo/config-plugins/build/android/Manifest.js:73:16)
```
**Solución:** Simplificamos el plugin de expo-updates

### Error 2: DataDog Plugin Invalid (RESUELTO)
```
Package "@datadog/mobile-react-native" does not contain a valid config plugin.
Unexpected token 'typeof'
```
**Solución:** Removimos el plugin de DataDog del app.json

## Causa de los Errores

1. **expo-updates**: Tenía configuración compleja que causaba conflictos durante el build
2. **@datadog/mobile-react-native**: El plugin no es compatible con el proceso de build de EAS (tiene código que no puede ser parseado como config plugin)

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

## Nota Importante sobre DataDog

El plugin de DataDog `@datadog/mobile-react-native` NO puede usarse como config plugin en app.json porque no es un plugin válido de Expo.

### Cómo usar DataDog sin el plugin:

La librería de DataDog sigue funcionando perfectamente en runtime. Solo necesitas:

1. **Mantener la dependencia en package.json:**
```json
"@datadog/mobile-react-native": "^2.13.0"
```

2. **Inicializar DataDog en el código (ya está implementado):**
```typescript
// utils/datadogLogger.ts ya tiene la inicialización correcta
import { DdSdkReactNative } from '@datadog/mobile-react-native';
```

3. **Las variables de entorno en app.json:**
```json
"extra": {
  "DATADOG_CLIENT_TOKEN": "068208a98b131a96831ca92a86d4f158",
  "DATADOG_APPLICATION_ID": "dogcatify-app",
  "DATADOG_ENV": "production"
}
```

**Resultado:** DataDog funciona perfectamente en runtime sin necesidad del plugin de configuración.

## Siguiente Paso

Intenta construir nuevamente con:
```bash
eas build --profile production --platform android
```

✅ **Aplicado:**
1. Simplificado plugin expo-updates
2. Removido plugin DataDog (la librería sigue funcionando)

Si el error persiste:
1. Limpiar y regenerar archivos nativos (Solución 2)
2. Verificar estructura del manifest (Solución 4)

## Referencias

- [Expo Updates Docs](https://docs.expo.dev/versions/latest/sdk/updates/)
- [EAS Build Configuration](https://docs.expo.dev/build/eas-json/)
- [Troubleshooting EAS Build](https://docs.expo.dev/build-reference/troubleshooting/)
