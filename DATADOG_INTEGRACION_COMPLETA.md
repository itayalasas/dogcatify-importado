# Integración Completa de DataDog con Expo

## Problema Identificado

Estamos usando `@datadog/mobile-react-native` pero intentando usarlo como plugin de Expo. Este paquete NO es un plugin válido de Expo.

## Solución: Usar expo-datadog

Para que DataDog funcione correctamente con Expo y EAS Build, necesitamos usar el paquete oficial `expo-datadog`.

## Instalación

### 1. Instalar expo-datadog

```bash
npm install expo-datadog@54.x.x
```

**Importante:** La versión de `expo-datadog` debe coincidir con tu versión de Expo SDK. En tu caso, Expo SDK 54, entonces usa `expo-datadog@54.x.x`.

### 2. Verificar que tienes @datadog/mobile-react-native

Ya lo tienes instalado:
```json
"@datadog/mobile-react-native": "^2.13.0"
```

### 3. Instalar @datadog/datadog-ci (desarrollo)

Para subir source maps:
```bash
npm install --save-dev @datadog/datadog-ci
```

## Configuración en app.json

### Opción 1: Configuración Básica (Recomendada)

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      ["expo-notifications", { ... }],
      "expo-updates",
      "expo-datadog"
    ]
  }
}
```

### Opción 2: Configuración Avanzada

Si quieres deshabilitar algunos uploads:

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      ["expo-notifications", { ... }],
      "expo-updates",
      [
        "expo-datadog",
        {
          "errorTracking": {
            "iosDsyms": true,
            "iosSourcemaps": true,
            "androidProguardMappingFiles": true,
            "androidSourcemaps": true
          }
        }
      ]
    ]
  }
}
```

## Variables de Entorno

Mantener en `app.json > extra`:

```json
"extra": {
  "DATADOG_CLIENT_TOKEN": "068208a98b131a96831ca92a86d4f158",
  "DATADOG_APPLICATION_ID": "dogcatify-app",
  "DATADOG_ENV": "production"
}
```

## ¿Qué hace expo-datadog?

El plugin `expo-datadog` se encarga de:

1. **Subir dSYMs** (iOS debug symbols) automáticamente en cada build
2. **Subir Source Maps** (iOS y Android) para stack traces legibles
3. **Subir ProGuard mapping files** (Android) para ofuscación
4. **Configuración nativa automática** durante el prebuild

Sin este plugin:
- ❌ Los crashes no tendrán stack traces legibles
- ❌ Los errores mostrarán código ofuscado
- ❌ No podrás ver las líneas de código exactas de los errores
- ❌ Tendrías que subir manualmente todos los archivos de debug

Con el plugin:
- ✅ Todo se sube automáticamente en cada build de EAS
- ✅ Stack traces completamente legibles
- ✅ Mapeo de código minificado a código fuente
- ✅ Mejor experiencia de debugging

## Diferencias entre los Paquetes

### @datadog/mobile-react-native
- **Qué es:** SDK principal de DataDog para React Native
- **Para qué:** Enviar logs, métricas, traces desde la app
- **Dónde:** Runtime de la aplicación
- **Necesario:** ✅ SÍ

### @datadog/mobile-react-native-navigation (opcional)
- **Qué es:** Integración con React Navigation
- **Para qué:** Tracking automático de navegación
- **Necesario:** ⚠️ Opcional (ya lo tienes instalado)

### expo-datadog
- **Qué es:** Config plugin de Expo
- **Para qué:** Configuración nativa automática + subida de debug symbols
- **Dónde:** Build time (EAS Build)
- **Necesario:** ✅ SÍ (para builds de producción con error tracking completo)

### @datadog/datadog-ci
- **Qué es:** CLI de DataDog
- **Para qué:** Subir source maps y debug symbols
- **Necesario:** ✅ SÍ (como dev dependency)

## Inicialización en el Código

Tu código actual en `utils/datadogLogger.ts` está correcto y seguirá funcionando sin cambios:

```typescript
const config = new DdSdkReactNativeConfiguration(
  DATADOG_CLIENT_TOKEN,
  DATADOG_ENV,
  DATADOG_APPLICATION_ID,
  true, // trackInteractions
  true, // trackResources  
  true  // trackErrors
);

await DdSdkReactNative.initialize(config);
```

## Pasos para Implementar

### 1. Instalar el paquete

```bash
npm install expo-datadog@54.x.x @datadog/datadog-ci --save-dev
```

### 2. Agregar plugin a app.json

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      ["expo-notifications", { ... }],
      "expo-updates",
      "expo-datadog"
    ]
  }
}
```

### 3. Agregar configuración de DataDog en eas.json

Agregar el API key de DataDog para que pueda subir los archivos:

```json
{
  "build": {
    "production": {
      "env": {
        "DATADOG_API_KEY": "tu_api_key_aqui",
        "DATADOG_SITE": "datadoghq.com"
      }
    }
  }
}
```

**Importante:** Necesitas obtener tu API key de DataDog desde:
https://app.datadoghq.com/organization-settings/api-keys

### 4. Build

```bash
eas build --profile production --platform android
```

## Verificación

Después del build, deberías ver en los logs:

```
✅ expo-datadog: Uploading source maps...
✅ expo-datadog: Uploading ProGuard mapping files...
✅ expo-datadog: Upload complete
```

## Alternativa: Sin Plugin (No Recomendado)

Si decides NO usar el plugin:
- ⚠️ Los logs funcionarán
- ⚠️ Las métricas funcionarán
- ❌ Los stack traces de crashes NO serán legibles
- ❌ Tendrás que subir manualmente los source maps después de cada build
- ❌ Perderás contexto en errores de producción

## Resumen

**ANTES (Problemático):**
```json
"plugins": [
  ["@datadog/mobile-react-native", { ... }] // ❌ No es un plugin válido
]
```

**AHORA (Correcto):**
```json
"plugins": [
  "expo-datadog" // ✅ Plugin oficial de Expo
]
```

**Paquetes necesarios:**
```json
{
  "dependencies": {
    "@datadog/mobile-react-native": "^2.13.0"  // SDK principal
  },
  "devDependencies": {
    "expo-datadog": "54.x.x",                   // Plugin de Expo
    "@datadog/datadog-ci": "latest"             // CLI para uploads
  }
}
```

## Beneficios de la Configuración Correcta

1. **Crash reporting completo** con stack traces legibles
2. **Subida automática** de símbolos de debug en cada build
3. **Mapeo de código** minificado/ofuscado a código fuente
4. **Mejor debugging** en producción
5. **Sin configuración manual** de uploads
6. **Integración nativa** configurada automáticamente

---

**Recomendación:** Implementar la solución completa con `expo-datadog` para tener todas las capacidades de DataDog funcionando correctamente.
