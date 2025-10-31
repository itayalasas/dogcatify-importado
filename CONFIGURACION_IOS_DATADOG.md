# 🍎 Configuración Nativa de DataDog para iOS

## Estado Actual

Como este es un proyecto **Expo Managed**, no tenemos carpeta `ios/` nativa. La carpeta iOS se genera automáticamente durante el build con EAS o al ejecutar `npx expo prebuild`.

## 📋 Pasos para Implementar DataDog Nativo en iOS

### Opción 1: Usando Expo Config Plugin (Recomendado)

La forma más fácil es usar el config plugin de DataDog en `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "@datadog/mobile-react-native",
        {
          "ios": {
            "datadogClientToken": "068208a98b131a96831ca92a86d4f158",
            "datadogApplicationId": "dogcatify-app",
            "datadogSite": "US1",
            "datadogEnvironment": "production"
          }
        }
      ]
    ]
  }
}
```

Luego ejecutar:
```bash
npx expo prebuild --clean
```

### Opción 2: Configuración Manual (Después de Prebuild)

Si prefieres configurar manualmente, después de ejecutar `npx expo prebuild`, tendrás una carpeta `ios/` donde puedes agregar:

#### 1. Podfile

Agregar al final del archivo `ios/Podfile`:

```ruby
# DataDog SDK
pod 'DatadogCore', '~> 2.0'
pod 'DatadogLogs', '~> 2.0'
pod 'DatadogCrashReporting', '~> 2.0'
```

Luego ejecutar:
```bash
cd ios && pod install && cd ..
```

#### 2. AppDelegate.mm o AppDelegate.swift

Buscar el archivo `ios/DogCatiFy/AppDelegate.mm` (o `.swift` si es Swift) y agregar:

**Para Objective-C (AppDelegate.mm):**

```objc
#import <DatadogCore/DatadogCore-Swift.h>
#import <DatadogLogs/DatadogLogs-Swift.h>

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Initialize DataDog
  DDConfiguration *configuration = [[DDConfiguration alloc] initWithClientToken:@"068208a98b131a96831ca92a86d4f158"
                                                                             env:@"production"];
  configuration.site = DDSiteUS1;
  
  [DDDatadog initializeWithConfiguration:configuration
                         trackingConsent:DDTrackingConsentGranted];
  
  // Enable Logs
  [DDLogs enableWith:[[DDLogsConfiguration alloc] init]];
  
  // ... resto del código existente
  return YES;
}
```

**Para Swift (AppDelegate.swift):**

```swift
import DatadogCore
import DatadogLogs

func application(_ application: UIApplication, 
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    
    // Initialize DataDog
    Datadog.initialize(
        with: Datadog.Configuration(
            clientToken: "068208a98b131a96831ca92a86d4f158",
            env: "production",
            site: .us1
        ),
        trackingConsent: .granted
    )
    
    // Enable Logs
    Logs.enable(with: Logs.Configuration())
    
    // ... resto del código existente
    return true
}
```

## 🔧 Configuración con EAS Build

Si usas EAS Build, puedes crear un hook personalizado:

### 1. Crear archivo `eas-hooks/eas-build-on-success.sh`

```bash
#!/bin/bash

# Este script se ejecuta después del build exitoso
echo "✅ Build completado - DataDog configurado"
```

### 2. Actualizar `eas.json`

```json
{
  "build": {
    "development": {
      "ios": {
        "simulator": false,
        "buildConfiguration": "Debug",
        "resourceClass": "m-medium"
      }
    },
    "preview": {
      "ios": {
        "simulator": false,
        "buildConfiguration": "Release",
        "resourceClass": "m-medium"
      }
    },
    "production": {
      "ios": {
        "simulator": false,
        "buildConfiguration": "Release",
        "resourceClass": "m-medium"
      }
    }
  }
}
```

## 📱 Info.plist (Opcional)

Si quieres usar variables de entorno en Info.plist:

```xml
<!-- ios/DogCatiFy/Info.plist -->
<dict>
  <!-- ... otras configuraciones ... -->
  
  <key>DatadogClientToken</key>
  <string>068208a98b131a96831ca92a86d4f158</string>
  
  <key>DatadogApplicationId</key>
  <string>dogcatify-app</string>
  
  <key>DatadogEnvironment</key>
  <string>production</string>
</dict>
```

Y en el código leer:

```swift
if let clientToken = Bundle.main.object(forInfoDictionaryKey: "DatadogClientToken") as? String {
    // Usar clientToken
}
```

## 🚀 Probar la Configuración

### Generar proyecto iOS nativo:
```bash
npx expo prebuild --platform ios --clean
```

### Build local:
```bash
npx expo run:ios
```

### Build con EAS:
```bash
eas build --profile development --platform ios
```

## ✅ Verificar que Funciona

En Xcode o en los logs del build, deberías ver:

```
✅ DataDog SDK initialized successfully
🔧 DataDog Logs feature enabled
```

En el dashboard de DataDog:
1. Ve a https://app.datadoghq.com/logs
2. Filtra por: `source:ios`
3. Deberías ver logs nativos de iOS

## 🎯 Logs que se Capturarán

Con la configuración nativa de iOS:

- ✅ Crashes nativos de iOS
- ✅ Errores del runtime Objective-C/Swift
- ✅ Errores del puente React Native
- ✅ Logs desde JavaScript (via React Native SDK)
- ✅ Network requests (si habilitas tracing)
- ✅ App lifecycle events

## 📊 Comparación de Configuraciones

| Característica | Solo JS | JS + Nativo iOS |
|---------------|---------|----------------|
| Logs desde React Native | ✅ | ✅ |
| Crashes nativos | ❌ | ✅ |
| Performance monitoring | Limitado | Completo |
| Source mapping | Básico | Avanzado |
| Inicialización | Tardía | Temprana |
| Overhead | Medio | Bajo |

## 🔐 Seguridad en Producción

**Recomendaciones:**

1. **Usar variables de entorno en build time:**
```json
{
  "expo": {
    "extra": {
      "datadogClientToken": "$DATADOG_CLIENT_TOKEN",
      "datadogApplicationId": "$DATADOG_APP_ID"
    }
  }
}
```

2. **No commitear credenciales en código:**
   - Usar secrets de EAS Build
   - Usar variables de entorno locales

3. **Diferentes tokens por ambiente:**
   - Token para development
   - Token para production

## 📚 Referencias Oficiales

- [DataDog iOS SDK](https://docs.datadoghq.com/logs/log_collection/ios/)
- [DataDog React Native](https://github.com/DataDog/dd-sdk-reactnative)
- [Expo Config Plugins](https://docs.expo.dev/config-plugins/introduction/)
- [EAS Build Hooks](https://docs.expo.dev/build/building-on-ci/)

## 🎯 Próximos Pasos

1. **Inmediato**: DataDog funciona con configuración JS actual
2. **Cuando hagas prebuild**: Agregar configuración nativa
3. **En producción**: Configuración dual (JS + Nativo)

La configuración nativa es **opcional pero muy recomendada** para mejor captura de errores y performance.

---

## ⚠️ Nota Importante

**Expo Managed vs Bare:**
- Este proyecto usa **Expo Managed**, así que la carpeta `ios/` no existe por defecto
- La configuración nativa se aplica automáticamente durante el build con EAS
- Si haces `eject` o `prebuild`, entonces tendrás acceso directo a los archivos nativos

**Recomendación**: Mantener el proyecto como Managed y usar el config plugin de DataDog en `app.json`.
