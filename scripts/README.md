# 🛠️ Scripts de Configuración

## Scripts Disponibles

### 1. `get-android-sha256.sh`
Extrae el SHA256 Fingerprint del keystore de Android

**Uso:**
```bash
chmod +x scripts/get-android-sha256.sh
./scripts/get-android-sha256.sh
```

**Qué hace:**
- Lee el archivo `android/app/debug.keystore`
- Extrae el SHA256 usando `keytool`
- Muestra el resultado en pantalla
- Opcionalmente actualiza `assetlinks.json` automáticamente

---

### 2. `update-well-known-files.sh`
Actualiza automáticamente los archivos `.well-known` con tus credenciales

**Uso:**
```bash
chmod +x scripts/update-well-known-files.sh
./scripts/update-well-known-files.sh
```

**Qué hace:**
- Te solicita tu Apple Team ID
- Te solicita tu Android SHA256
- Crea backups de los archivos actuales
- Actualiza `apple-app-site-association` con tu Team ID
- Actualiza `assetlinks.json` con tu SHA256
- Muestra el contenido actualizado
- Te indica los próximos pasos

---

## Uso Recomendado

### Configuración Completa (Primera vez)

```bash
# 1. Hacer scripts ejecutables
chmod +x scripts/*.sh

# 2. Ejecutar configurador
./scripts/update-well-known-files.sh

# 3. Seguir las instrucciones en pantalla
```

### Solo Android (Actualización)

```bash
./scripts/get-android-sha256.sh
```

---

## Requisitos

- `keytool` (viene con Java JDK)
- Bash (Linux, macOS, Git Bash en Windows)
- Archivos del proyecto en su ubicación correcta

---

## Troubleshooting

### "Permission denied"
```bash
chmod +x scripts/get-android-sha256.sh
chmod +x scripts/update-well-known-files.sh
```

### "keytool: command not found"
Instala Java JDK:
- macOS: `brew install openjdk`
- Ubuntu: `sudo apt install openjdk-11-jdk`
- Windows: Descarga desde https://adoptium.net/

### "No such file or directory"
Asegúrate de ejecutar los scripts desde la raíz del proyecto:
```bash
cd /ruta/a/dogcatify
./scripts/get-android-sha256.sh
```

---

## Alternativa Manual

Si los scripts no funcionan, puedes configurar manualmente:

### Obtener SHA256:
```bash
keytool -list -v -keystore android/app/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android | grep SHA256
```

### Obtener Team ID:
https://developer.apple.com/account/

### Editar archivos:
- `web-redirect/.well-known/apple-app-site-association`
- `web-redirect/.well-known/assetlinks.json`

Consulta: `../CONFIGURAR_UNIVERSAL_LINKS.md` para instrucciones detalladas
