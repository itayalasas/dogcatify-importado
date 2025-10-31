# Checklist: Build Android Exitoso

## Pre-Build: Verificaciones Críticas

### ✅ 1. Gradle Wrapper
```bash
# Verificar que existan estos archivos:
ls android/gradlew
ls android/gradlew.bat
ls android/gradle/wrapper/gradle-wrapper.jar
ls android/gradle/wrapper/gradle-wrapper.properties
```

Si faltan:
```bash
npx expo prebuild --clean --platform android
git add android/gradlew android/gradlew.bat android/gradle/
git commit -m "Add Gradle wrapper files"
git push
```

### ✅ 2. Datadog - Sin Dependencias Nativas
Verificar que `android/app/build.gradle` NO incluya:
```gradle
// ❌ ESTO NO DEBE ESTAR:
implementation "com.datadoghq:dd-sdk-android-logs:latest.release"

// ❌ ESTO NO DEBE ESTAR:
apply plugin: "com.datadoghq.dd-sdk-android-gradle-plugin"
```

Verificar que `android/build.gradle` NO incluya:
```gradle
// ❌ ESTO NO DEBE ESTAR:
classpath('com.datadoghq:dd-sdk-android-gradle-plugin:latest.release')
```

Verificar que `MainApplication.kt` NO tenga inicialización nativa:
```kotlin
// ❌ Esto debe estar comentado:
// Datadog.initialize(...)
```

### ✅ 3. Safe Area (Tabs Visibles)
Verificar en estos archivos:
- `app/(tabs)/_layout.tsx`
- `app/(admin-tabs)/_layout.tsx`
- `app/(partner-tabs)/_layout.tsx`

Deben tener:
```typescript
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs screenOptions={{
      tabBarStyle: {
        paddingBottom: Math.max(insets.bottom, 8),
        height: Platform.OS === 'ios' ? 85 : 60 + Math.max(insets.bottom, 0),
      }
    }}>
```

## Ejecutar Build

### Opción 1: Build de Producción
```bash
eas build --profile production --platform android
```

### Opción 2: Build de Preview
```bash
eas build --profile preview --platform android
```

### Opción 3: Build de Development
```bash
eas build --profile development --platform android
```

## Durante el Build: Señales de Éxito

### ✅ Logs Correctos:
```
✔ Gradle wrapper found
✔ Dependencies resolved
✔ No duplicate classes detected
✔ Build completed successfully
```

### ❌ Si ves estos errores:

**Error: gradlew not found**
- Solución: Ver sección "Gradle Wrapper" arriba

**Error: Duplicate class com.datadog**
- Solución: Ver sección "Datadog" arriba

**Error: uploadSourcemaps property not found**
- Solución: Ver sección "Datadog" arriba

## Post-Build: Verificación

### 1. Descargar APK/AAB
```bash
eas build:download --platform android
```

### 2. Instalar en Dispositivo de Prueba
```bash
adb install app.apk
```

### 3. Verificar Tabs Visibles
- Abrir la app
- Navegar entre tabs
- Verificar que NO estén ocultos por la barra del sistema

### 4. Verificar Datadog (Opcional)
- Navegar por la app
- Generar un error de prueba
- Verificar en [Datadog Dashboard](https://app.datadoghq.com) que lleguen logs

## Archivos Clave (Estado Actual)

### ✅ CORRECTO:
```
android/
├── gradlew                              ✅ Existe
├── gradlew.bat                          ✅ Existe
├── build.gradle                         ✅ Sin plugin Datadog
├── app/build.gradle                     ✅ Sin dependencias Datadog
└── app/src/main/java/.../MainApplication.kt  ✅ Sin init Datadog

app/
├── (tabs)/_layout.tsx                   ✅ Con useSafeAreaInsets
├── (admin-tabs)/_layout.tsx             ✅ Con useSafeAreaInsets
└── (partner-tabs)/_layout.tsx           ✅ Con useSafeAreaInsets

utils/
└── datadogLogger.ts                     ✅ Inicialización desde JS

package.json                             ✅ Con @datadog/mobile-react-native
```

## Comandos Útiles

### Ver errores de build anterior:
```bash
eas build:list --platform android --status errored
eas build:view [BUILD_ID]
```

### Limpiar caché local (si pruebas localmente):
```bash
cd android
./gradlew clean
./gradlew cleanBuildCache
```

### Verificar dependencias (localmente):
```bash
cd android
./gradlew :app:dependencies > deps.txt
grep "datadog" deps.txt
```

## Problemas Conocidos Resueltos

| Problema | Estado | Fix |
|----------|--------|-----|
| gradlew missing | ✅ Resuelto | Agregado a Git |
| Datadog sourcemaps | ✅ Resuelto | Plugin removido |
| Duplicate classes | ✅ Resuelto | Deps nativas removidas |
| Tabs ocultos | ✅ Resuelto | useSafeAreaInsets |

## Próximos Pasos

Después de build exitoso:

1. **Instalar en dispositivo de prueba**
2. **Probar funcionalidad completa**
3. **Verificar tabs visibles en todos los dispositivos**
4. **Confirmar que Datadog recibe eventos**
5. **Distribuir a testers vía EAS Submit o Firebase App Distribution**

---

**Última Actualización:** 31 de Octubre 2025  
**Estado del Proyecto:** ✅ Listo para build
