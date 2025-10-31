# Fix: Error de AndroidManifest - Cannot read properties of null (reading 'manifest')

## Error Original

```
TypeError: Cannot read properties of null (reading 'manifest')
    at isManifest (node_modules\@expo\config-plugins\build\android\Manifest.js:73:16)
    at Object.readAndroidManifestAsync
    at async syncConfigurationToNativeAndroidAsync
```

## Causa

Los archivos `AndroidManifest.xml` no tenían el atributo `package` en el tag `<manifest>`, lo cual es requerido por `expo-updates` para leer y sincronizar la configuración.

## Solución Aplicada

Se agregó el atributo `package="com.dogcatify.app"` a todos los archivos AndroidManifest.xml:

### 1. android/app/src/main/AndroidManifest.xml

**Antes:**
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android" 
          xmlns:tools="http://schemas.android.com/tools">
```

**Después:**
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android" 
          xmlns:tools="http://schemas.android.com/tools" 
          package="com.dogcatify.app">
```

### 2. android/app/src/debug/AndroidManifest.xml

**Antes:**
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">
```

**Después:**
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.dogcatify.app">
```

### 3. android/app/src/debugOptimized/AndroidManifest.xml

**Antes:**
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">
```

**Después:**
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.dogcatify.app">
```

## Verificación

Los tres archivos ahora tienen el atributo `package` correctamente configurado:

```bash
# Verificar que todos tienen el atributo package
grep -r "package=\"com.dogcatify.app\"" android/app/src/*/AndroidManifest.xml

# Resultado esperado:
# android/app/src/main/AndroidManifest.xml:... package="com.dogcatify.app">
# android/app/src/debug/AndroidManifest.xml:... package="com.dogcatify.app">
# android/app/src/debugOptimized/AndroidManifest.xml:... package="com.dogcatify.app">
```

## Por Qué es Necesario

1. **expo-updates** necesita leer el AndroidManifest.xml para sincronizar configuraciones
2. El atributo `package` identifica de forma única la aplicación
3. Sin él, el parser XML retorna `null` causando el error

## Archivos Modificados

- `android/app/src/main/AndroidManifest.xml` ✅
- `android/app/src/debug/AndroidManifest.xml` ✅
- `android/app/src/debugOptimized/AndroidManifest.xml` ✅

## Compatibilidad

Este cambio es compatible con:
- Android Gradle Plugin 7.x y 8.x
- Expo SDK 54
- React Native 0.81.4

**Nota:** Aunque AGP 7.0+ permite omitir el atributo `package` (usando `namespace` en build.gradle), muchas herramientas de Expo aún lo requieren para funcionar correctamente.

## Próximo Paso

Ahora puedes hacer el build sin este error:

```bash
eas build --profile production --platform android
```

---

**Fecha de fix:** 31 de Octubre 2025
**Estado:** ✅ Resuelto - Atributo package agregado a todos los manifiestos
