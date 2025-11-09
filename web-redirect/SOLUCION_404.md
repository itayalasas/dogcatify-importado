# Solución al Error 404 en Netlify

## Problema
Al acceder a `https://app-dogcatify.netlify.app/album/[id]` aparece "Page not found"

## Causa
Netlify no está encontrando el archivo `_redirects` o no está configurado correctamente.

## ✅ Solución

### Archivos Necesarios

Ya están creados en esta carpeta:
1. **`_redirects`** - Redirige todas las rutas a index.html
2. **`netlify.toml`** - Configuración alternativa de Netlify

### Pasos para Solucionar:

#### Opción 1: Redesplegar con _redirects (Recomendado)

1. **Verifica que el archivo `_redirects` esté en la raíz de `web-redirect/`**
   ```bash
   ls web-redirect/_redirects
   # Debe existir
   ```

2. **Contenido del archivo `_redirects`:**
   ```
   /album/*  /index.html  200
   /post/*   /index.html  200
   /share/*  /index.html  200
   /*        /index.html  200
   ```

3. **Redesplegar en Netlify:**
   - Ve a https://app.netlify.com
   - Encuentra tu sitio `app-dogcatify`
   - Ve a "Deploys"
   - Haz clic en "Deploy manually"
   - **Arrastra la carpeta `web-redirect` COMPLETA** (asegúrate de incluir el archivo `_redirects`)

4. **Espera a que se complete el despliegue** (1-2 minutos)

5. **Prueba el link nuevamente:**
   ```
   https://app-dogcatify.netlify.app/album/7e002271-00e4-4ae6-aff7-fe6dfff9996f
   ```

#### Opción 2: Verificar desde Netlify Dashboard

1. Ve a tu sitio en Netlify
2. Click en "Site configuration" > "Redirects"
3. Verifica que estén estas reglas:
   - `/album/*` → `/index.html` (200)
   - `/post/*` → `/index.html` (200)
   - `/*` → `/index.html` (200)

Si NO aparecen, el archivo `_redirects` no se subió correctamente.

#### Opción 3: Forzar desde netlify.toml

Si el `_redirects` no funciona, `netlify.toml` debería hacerlo:

1. Verifica que `netlify.toml` esté en `web-redirect/`
2. Contenido debe incluir:
   ```toml
   [[redirects]]
     from = "/album/:id"
     to = "/index.html?type=album&id=:id"
     status = 200

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

3. Redesplegar

### Verificación Rápida

Después de redesplegar, prueba en tu navegador:

```bash
# Debe mostrar la página HTML, no 404
https://app-dogcatify.netlify.app/album/test-123

# También debe funcionar
https://app-dogcatify.netlify.app/post/test-456
```

### 🔍 Debug

Si sigue sin funcionar:

1. **Verifica los logs de despliegue en Netlify:**
   - Ve a "Deploys"
   - Click en el último deploy
   - Revisa el log - debe decir que encontró `_redirects`

2. **Verifica archivos desplegados:**
   - En Netlify, ve a "Deploys" > "Deploy log"
   - Busca: "Processed redirects file"
   - Si NO aparece, el archivo no se subió

3. **Limpia cache de Netlify:**
   - Settings > Build & deploy > Clear cache and retry deploy

### 📋 Checklist

- [ ] Archivo `_redirects` existe en `web-redirect/`
- [ ] Archivo `netlify.toml` existe en `web-redirect/`
- [ ] Redesplegado en Netlify arrastrando carpeta completa
- [ ] Esperado 1-2 minutos para propagación
- [ ] Probado URL: `https://app-dogcatify.netlify.app/album/test`
- [ ] Ya no aparece error 404

---

## 🎯 Resultado Esperado

Después de solucionar:
- ✅ `https://app-dogcatify.netlify.app/album/[id]` → Muestra página de redirección
- ✅ La página detecta el ID del álbum
- ✅ Intenta abrir la app DogCatiFy
- ✅ Si no tiene la app, muestra botones de descarga

## 💡 Nota Importante

**SIEMPRE** despliega la carpeta `web-redirect` **COMPLETA**, no solo archivos individuales. La estructura debe ser:

```
web-redirect/ (← Arrastra ESTA carpeta completa)
├── index.html
├── _redirects          ← IMPORTANTE
├── _headers
├── netlify.toml        ← IMPORTANTE
├── README.md
└── .well-known/
    ├── apple-app-site-association
    └── assetlinks.json
```
