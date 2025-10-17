# Desplegar API Actualizada

## ✅ Cambios Realizados

La API `orders-api` ahora soporta **dos modos de acceso**:

1. **Modo Partner** - Usa Partner ID como API Key (ve solo sus órdenes)
2. **Modo Admin** - Usa token administrativo (ve TODAS las órdenes)

## 🚀 Cómo Desplegar

La función ya está actualizada en el archivo pero necesita ser desplegada. Hay dos opciones:

### Opción 1: Desde Supabase Dashboard (Recomendado)

1. Ve a tu proyecto en Supabase
2. Abre el Dashboard
3. Ve a **Edge Functions**
4. Encuentra la función `orders-api`
5. Haz clic en "Deploy"
6. Sube el archivo `/supabase/functions/orders-api/index.ts`

### Opción 2: Desde CLI (Si tienes Supabase CLI instalado)

```bash
# Navega al directorio del proyecto
cd /ruta/a/proyecto

# Despliega la función
supabase functions deploy orders-api
```

## 🔐 Token Administrativo

### Token por Defecto

```
dogcatify_admin_2025_secure
```

### Cambiar el Token (Opcional pero Recomendado)

1. Ve a Supabase Dashboard
2. Settings > Edge Functions > Secrets
3. Agrega variable:
   - Nombre: `ADMIN_API_TOKEN`
   - Valor: `tu-token-super-seguro-generado-con-openssl`

```bash
# Generar token seguro
openssl rand -hex 32
```

## 🧪 Probar Inmediatamente

```bash
# Probar con token administrativo (ve TODAS las órdenes)
curl -X GET \
  "https://zkgiwamycbjcogcgqhff.supabase.co/functions/v1/orders-api?limit=5" \
  -H "X-API-Key: dogcatify_admin_2025_secure"

# Deberías ver órdenes de TODOS los partners
```

## 📝 Verificar que Funciona

Después de desplegar, deberías ver en los logs:

- `🔐 Admin access granted - Full access to all orders` (cuando usas el token admin)
- `👤 Partner access granted: [nombre]` (cuando usas Partner ID)

## 🆕 Nuevas Características

### Para CRM (Token Admin)

```bash
# Ver TODAS las órdenes
GET /orders-api

# Filtrar por partner específico
GET /orders-api?partner_id=PARTNER-UUID

# Ver orden específica (cualquier partner)
GET /orders-api/ORDER-UUID
```

### Para Partners (Partner ID)

```bash
# Ver solo SUS órdenes
GET /orders-api
-H "X-API-Key: SU-PARTNER-ID"

# Ver solo UNA de sus órdenes
GET /orders-api/ORDER-UUID
-H "X-API-Key: SU-PARTNER-ID"
```

## 📚 Documentación

- **Para CRM**: Lee `CONFIGURACION_API_CRM.md`
- **Para Partners**: Lee `DOCUMENTACION_API_ORDENES.md`
- **Ejemplos**: Lee `EJEMPLOS_RAPIDOS_API.md`

## ⚠️ Notas Importantes

1. El token admin por defecto es público en este documento
2. **Cámbialo inmediatamente** en producción
3. Los partners siguen usando su Partner ID (sin cambios)
4. El token admin no interfiere con el acceso de partners

## ✅ Checklist Post-Despliegue

- [ ] La función `orders-api` está desplegada
- [ ] Probé con el token admin y veo TODAS las órdenes
- [ ] Probé con un Partner ID y veo solo sus órdenes
- [ ] Configuré `ADMIN_API_TOKEN` en Supabase (opcional)
- [ ] Actualicé la documentación de mi CRM

---

**Última actualización**: 2025-10-17
