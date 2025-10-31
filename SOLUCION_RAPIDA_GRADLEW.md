# Solución Rápida: gradlew Missing

## El Problema

EAS Build falla con:
```
ENOENT: no such file or directory, open '/home/expo/workingdir/build/android/gradlew'
```

**Causa:** Los archivos del Gradle Wrapper no están en tu repositorio Git.

---

## Solución en 3 Pasos

### Opción A: Usar Script Automático (Recomendado)

#### En Windows (PowerShell):
```powershell
cd C:\Proyectos\Pruebas\dogcatify
.\restore-gradlew.ps1
```

#### En Git Bash / WSL / Mac / Linux:
```bash
cd ~/Proyectos/Pruebas/dogcatify
./restore-gradlew.sh
```

Luego:
```bash
git commit -m "Add Gradle wrapper files"
git push
eas build --profile production --platform android
```

---

### Opción B: Manual (Si el script falla)

#### Paso 1: Regenerar archivos Gradle

```bash
cd C:\Proyectos\Pruebas\dogcatify

# Regenerar con Expo (método más simple)
npx expo prebuild --clean --platform android
```

#### Paso 2: Dar permisos de ejecución (Git Bash/WSL)

```bash
chmod +x android/gradlew
```

#### Paso 3: Agregar a Git

```bash
git add android/gradlew
git add android/gradlew.bat
git add android/gradle/wrapper/gradle-wrapper.jar
git add android/gradle/wrapper/gradle-wrapper.properties

git commit -m "Add Gradle wrapper files"
git push
```

#### Paso 4: Build

```bash
eas build --profile production --platform android
```

---

## Verificación

Antes del build, verifica que los archivos existan:

```bash
ls android/gradlew
ls android/gradlew.bat
ls android/gradle/wrapper/gradle-wrapper.jar
ls android/gradle/wrapper/gradle-wrapper.properties
```

Todos deben existir.

---

## ¿Por Qué Pasó Esto?

Los archivos Gradle wrapper son ejecutables que permiten compilar el proyecto Android sin tener Gradle instalado globalmente. Son **críticos** para EAS Build.

Estos archivos:
- ✅ **DEBEN** estar en Git
- ✅ **DEBEN** tener permisos de ejecución (Unix/Mac/Linux)
- ✅ **DEBEN** estar en el directorio `android/`

---

## Resumen

1. **Ejecuta:** `npx expo prebuild --clean --platform android`
2. **Agrega a Git:** `git add android/gradlew*` y `git add android/gradle/`
3. **Commit y Push:** `git commit -m "Add Gradle wrapper" && git push`
4. **Build:** `eas build --profile production --platform android`

---

**Tiempo estimado:** 3-5 minutos
**Una vez hecho, no volverá a ocurrir**
