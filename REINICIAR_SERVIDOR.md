# 🔄 Cómo Reiniciar el Servidor Correctamente

## Problema
Cuando cambias las variables de entorno en `.env`, Expo y Metro Bundler **mantienen los valores antiguos en cache**. Esto causa el error: `Invalid API key`

## ✅ Solución: Limpiar Cache

### Opción 1: Reinicio Completo (RECOMENDADO)

```bash
# 1. Detener el servidor actual
Ctrl + C

# 2. Limpiar TODOS los caches
npx expo start --clear

# 3. En la terminal de Expo:
# - Presiona 'r' para recargar
# - O presiona 'a' para abrir en Android nuevamente
```

### Opción 2: Limpieza Profunda (si la Opción 1 no funciona)

```bash
# 1. Detener el servidor
Ctrl + C

# 2. Limpiar node_modules y cache
rm -rf node_modules/.cache
rm -rf .expo

# 3. Iniciar con cache limpio
npx expo start --clear
```

### Opción 3: Reset Total (último recurso)

```bash
# 1. Detener el servidor
Ctrl + C

# 2. Limpiar TODO
npx expo start --clear --reset-cache

# 3. Si sigue sin funcionar, limpiar watchman (si está instalado)
watchman watch-del-all
```

---

## 🔍 Verificar que las Credenciales se Cargaron

Después de reiniciar, busca en los logs:

```
LOG  Supabase URL: https://gfazxronwllqcswdaimh.supabase.co
```

Si ves `zkgiwamycbjcogcgqhff` en lugar de `gfazxronwllqcswdaimh`, el cache NO se limpió correctamente.

---

## 🚨 Importante

- **SIEMPRE** usa `--clear` cuando cambias variables de entorno
- **NO** uses solo `npm start` después de cambiar `.env`
- **ESPERA** a que termine de limpiar el cache (puede tomar 1-2 minutos)

---

## 📱 En Android (Expo Go)

Después de reiniciar el servidor:

1. Cierra completamente la app Expo Go (desliza y cierra)
2. Vuelve a abrir Expo Go
3. Escanea el QR nuevamente

**O simplemente:**
- Presiona `a` en la terminal para reabrir automáticamente

---

## ✅ Checklist

Antes de probar el registro:

- [ ] Detuve el servidor (Ctrl+C)
- [ ] Ejecuté `npx expo start --clear`
- [ ] Esperé a que termine de cargar (100%)
- [ ] Vi el mensaje de bundle completo
- [ ] Recargué la app en el dispositivo
- [ ] Los logs muestran la URL correcta: `gfazxronwllqcswdaimh`

---

**Ahora sí, tu app debería usar las credenciales de la rama `develop` correctamente.**
