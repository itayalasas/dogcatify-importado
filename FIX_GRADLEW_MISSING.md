# Fix: ENOENT - gradlew File Missing

## Error

```
ENOENT: no such file or directory, open '/home/expo/workingdir/build/android/gradlew'
```

## Causa

Los archivos `gradlew` y `gradlew.bat` no están en tu repositorio Git, por lo que cuando descargas el código o EAS Build intenta compilar, estos archivos críticos no existen.

## Solución Completa

### Paso 1: Regenerar el Gradle Wrapper

En tu máquina Windows, ejecuta:

```bash
cd C:\Proyectos\Pruebas\dogcatify\android

# Regenerar el gradle wrapper
gradle wrapper --gradle-version=8.10.2 --distribution-type=all
```

Si no tienes Gradle instalado globalmente, usa el wrapper de otro proyecto o instálalo:

```bash
# Con Chocolatey (Windows)
choco install gradle

# O descarga desde https://gradle.org/install/
```

### Paso 2: Verificar que se Crearon los Archivos

```bash
# Verificar que existen
ls gradlew
ls gradlew.bat
ls gradle/wrapper/gradle-wrapper.jar
ls gradle/wrapper/gradle-wrapper.properties
```

### Paso 3: Dar Permisos de Ejecución (Git Bash o WSL)

```bash
chmod +x gradlew
```

### Paso 4: Agregar al Repositorio Git

```bash
cd C:\Proyectos\Pruebas\dogcatify

# Agregar los archivos
git add android/gradlew
git add android/gradlew.bat
git add android/gradle/wrapper/gradle-wrapper.jar
git add android/gradle/wrapper/gradle-wrapper.properties

# Commit
git commit -m "Add Gradle wrapper files"

# Push
git push
```

### Paso 5: Verificar en Git

```bash
git ls-files | grep gradlew
```

Deberías ver:
```
android/gradlew
android/gradlew.bat
android/gradle/wrapper/gradle-wrapper.jar
android/gradle/wrapper/gradle-wrapper.properties
```

## Alternativa: Usar npx expo prebuild

Si no tienes Gradle instalado, Expo puede regenerar estos archivos:

```bash
cd C:\Proyectos\Pruebas\dogcatify

# Limpiar y regenerar android/
npx expo prebuild --clean --platform android

# Luego agregar a git
git add android/gradlew android/gradlew.bat android/gradle/
git commit -m "Add Gradle wrapper files via expo prebuild"
git push
```

## Verificación Post-Fix

### 1. Verificar que gradlew es ejecutable:

```bash
# En Git Bash o WSL
cd android
./gradlew --version
```

Deberías ver la versión de Gradle.

### 2. Probar build localmente (opcional):

```bash
cd android
./gradlew assembleRelease
```

### 3. Intentar EAS Build nuevamente:

```bash
eas build --profile production --platform android
```

## ¿Por Qué Pasó Esto?

Los archivos Gradle wrapper (`gradlew`, `gradlew.bat`, `gradle-wrapper.jar`) son archivos binarios/ejecutables que a menudo se excluyen accidentalmente de Git o nunca se agregaron inicialmente.

Estos archivos son **esenciales** para:
- Builds locales de Android
- EAS Build en la nube
- CI/CD pipelines

## Archivos Críticos que DEBEN estar en Git

```
android/
├── gradlew              ← Ejecutable (Unix/Mac/Linux)
├── gradlew.bat          ← Ejecutable (Windows)
└── gradle/
    └── wrapper/
        ├── gradle-wrapper.jar        ← Binario JAR
        └── gradle-wrapper.properties ← Configuración
```

## Configuración Recomendada de .gitignore

Asegúrate de que tu `.gitignore` NO incluya:

```gitignore
# ❌ NO IGNORAR:
# gradlew
# gradlew.bat
# gradle-wrapper.jar

# ✅ SÍ IGNORAR:
.gradle/
build/
local.properties
```

## Próximos Pasos

1. **Opción A (Recomendada):** Ejecutar `npx expo prebuild --clean --platform android`
2. **Opción B:** Ejecutar `gradle wrapper` manualmente
3. Agregar archivos a Git
4. Hacer commit y push
5. Ejecutar `eas build --profile production --platform android`

---

**Estado:** Esperando que agregues los archivos Gradle wrapper a tu repositorio Git
**Tiempo estimado:** 5 minutos
