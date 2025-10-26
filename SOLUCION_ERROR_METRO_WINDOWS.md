# Solución: Error Metro Bundler en Windows

## Error
```
Error: ENOENT: no such file or directory, open 'C:\Proyectos\Pruebas\dogcatify\InternalBytecode.js'
```

## Causa
Este error ocurre cuando Metro bundler en Windows tiene problemas con el caché o los paths simbólicos.

## Soluciones (en orden de prioridad)

### 1. Limpiar caché de Metro y node_modules
```bash
# Detener el servidor Metro si está corriendo (Ctrl+C)

# Limpiar caché de Expo
npx expo start -c

# O limpiar todo (más agresivo)
rm -rf node_modules
rm -rf .expo
npm install
npx expo start -c
```

### 2. Limpiar caché de Watchman (si está instalado)
```bash
watchman watch-del-all
```

### 3. Limpiar caché completa de Metro
```bash
# Windows PowerShell
Remove-Item -Recurse -Force $env:LOCALAPPDATA\Temp\metro-*
Remove-Item -Recurse -Force $env:LOCALAPPDATA\Temp\haste-map-*

# O en bash/git bash
rm -rf $LOCALAPPDATA/Temp/metro-*
rm -rf $LOCALAPPDATA/Temp/haste-map-*
```

### 4. Si el problema persiste
```bash
# Eliminar package-lock.json y reinstalar
rm package-lock.json
rm -rf node_modules
npm install

# Iniciar con caché limpia
npx expo start -c --tunnel
```

## Prevención
En Windows, es recomendable:
1. Usar rutas cortas para proyectos (evitar espacios y caracteres especiales)
2. Ejecutar la terminal como administrador si hay problemas de permisos
3. Mantener actualizado npm: `npm install -g npm@latest`

## Comandos rápidos para copiar

### Solución rápida (Windows PowerShell):
```powershell
# Detener Metro (Ctrl+C si está corriendo)
Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm install
npx expo start -c --tunnel
```

### Solución rápida (Git Bash en Windows):
```bash
rm -rf .expo node_modules
npm install
npx expo start -c --tunnel
```
