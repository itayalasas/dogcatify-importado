# Cómo Sincronizar los Cambios de AndroidManifest

## Cambios Realizados (en el servidor)

Se agregó el atributo `package="com.dogcatify.app"` a tres archivos:

1. `android/app/src/main/AndroidManifest.xml`
2. `android/app/src/debug/AndroidManifest.xml`
3. `android/app/src/debugOptimized/AndroidManifest.xml`

## Opción 1: Editar Manualmente (Más Rápido)

### En tu máquina Windows:

#### 1. Archivo: `android/app/src/main/AndroidManifest.xml`

Busca la primera línea:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
```

Reemplázala por:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools" package="com.dogcatify.app">
```

#### 2. Archivo: `android/app/src/debug/AndroidManifest.xml`

Busca:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">
```

Reemplázala por:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.dogcatify.app">
```

#### 3. Archivo: `android/app/src/debugOptimized/AndroidManifest.xml`

Mismo cambio que en debug:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.dogcatify.app">
```

### Verificar en Windows:

```bash
# En tu terminal de Windows (PowerShell o CMD)
cd C:\Proyectos\Pruebas\dogcatify

# Verificar que los archivos tienen el atributo package
findstr /S /C:"package=\"com.dogcatify.app\"" android\app\src\*\AndroidManifest.xml
```

Deberías ver 3 líneas indicando que los 3 archivos tienen el atributo.

## Opción 2: Reemplazar los Archivos Completos

Si prefieres, puedo mostrarte el contenido completo de cada archivo para que lo copies directamente.

## Después de Sincronizar

Una vez que hayas editado los archivos en tu máquina, intenta el build nuevamente:

```bash
eas build --profile production --platform android
```

## ¿Los Cambios se Perderán?

**NO.** Estos archivos están en el directorio `android/`, que está versionado en tu repositorio. Los cambios persistirán.

---

**Acción requerida:** Editar 3 archivos AndroidManifest.xml en tu máquina Windows
**Tiempo estimado:** 2 minutos
