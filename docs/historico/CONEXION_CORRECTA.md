# 🔌 Cómo Conectar a la Base de Datos de Producción

## ❌ Error Común

```bash
# INCORRECTO (lo que intentaste):
psql -h https://gfazxronwllqcswdaimh.supabase.co -U postgres -d postgres -f production_schema.sql
```

El problema: `psql` no acepta URLs con `https://`, solo el host.

---

## ✅ Forma Correcta

### Opción 1: Usar Connection Pooler (RECOMENDADO)

```bash
psql "postgresql://postgres.gfazxronwllqcswdaimh:TU_PASSWORD@aws-0-sa-east-1.pooler.supabase.com:6543/postgres" -f production_schema.sql
```

### Opción 2: Conexión Directa

```bash
psql "postgresql://postgres.gfazxronwllqcswdaimh:TU_PASSWORD@db.gfazxronwllqcswdaimh.supabase.co:5432/postgres" -f production_schema.sql
```

### Opción 3: Parámetros Separados

```bash
psql -h aws-0-sa-east-1.pooler.supabase.com -p 6543 -U postgres.gfazxronwllqcswdaimh -d postgres -f production_schema.sql
```

---

## 📋 Cómo Obtener la Connection String Correcta

### Desde Supabase Dashboard:

1. Ve a: https://supabase.com/dashboard/project/gfazxronwllqcswdaimh/settings/database

2. Baja a la sección **"Connection string"**

3. Selecciona el tab **"URI"**

4. Elige **"Transaction Mode"** (pooler)

5. Copia la URI completa, se verá así:
   ```
   postgresql://postgres.gfazxronwllqcswdaimh:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   ```

6. Reemplaza `[YOUR-PASSWORD]` con tu contraseña real

---

## 🚀 PERO... ¡HAY UNA FORMA MÁS FÁCIL!

### Mejor Usar Supabase CLI (NO necesitas psql):

```bash
# 1. Conectar al proyecto
supabase link --project-ref gfazxronwllqcswdaimh

# 2. Aplicar TODAS las migraciones automáticamente
supabase db push
```

Esto es **MÁS FÁCIL** porque:
- ✅ No necesitas recordar la connection string
- ✅ No necesitas instalar psql
- ✅ Aplica las migraciones en el orden correcto
- ✅ Hace validaciones automáticas
- ✅ No te puedes equivocar con los parámetros

---

## 🔑 Obtener Tu Contraseña

1. Dashboard → https://supabase.com/dashboard/project/gfazxronwllqcswdaimh/settings/database

2. Sección **"Database Password"**

3. Si no la recuerdas, puedes resetearla:
   - Click en **"Reset database password"**
   - Copia la nueva contraseña
   - Guárdala en un lugar seguro

---

## 📝 Ejemplo Completo con psql

Si realmente quieres usar psql directamente:

```bash
# Paso 1: Crear variable con la connection string
set PGPASSWORD=tu_password_aqui

# Paso 2: Conectar (Windows CMD)
psql "postgresql://postgres.gfazxronwllqcswdaimh:%PGPASSWORD%@aws-0-sa-east-1.pooler.supabase.com:6543/postgres" -f production_schema.sql

# Para PowerShell:
$env:PGPASSWORD="tu_password_aqui"
psql "postgresql://postgres.gfazxronwllqcswdaimh:$env:PGPASSWORD@aws-0-sa-east-1.pooler.supabase.com:6543/postgres" -f production_schema.sql
```

---

## ⚡ MI RECOMENDACIÓN FINAL

**NO uses psql directamente.** En su lugar, usa el método automatizado:

### Desde Windows:

```cmd
# Doble clic en:
MIGRATE_WINDOWS.bat
```

O manualmente:

```cmd
supabase link --project-ref gfazxronwllqcswdaimh
supabase db push
```

### ¿Por qué este método es mejor?

1. **Más seguro**: No expones tu contraseña en la línea de comandos
2. **Más fácil**: Solo 2 comandos en lugar de recordar connection strings
3. **Más confiable**: Aplica migraciones en orden correcto
4. **Con validación**: Te dice si algo salió mal

---

## 🆘 Si Necesitas psql Pero No Lo Tienes Instalado

### Windows:

```bash
# Instalar PostgreSQL (incluye psql)
winget install PostgreSQL.PostgreSQL
```

O descarga desde: https://www.postgresql.org/download/windows/

### Mac:

```bash
brew install postgresql
```

### Linux:

```bash
sudo apt-get install postgresql-client
```

---

## 🎯 Resumen de Opciones

| Método | Dificultad | Recomendado |
|--------|-----------|-------------|
| `MIGRATE_WINDOWS.bat` | ⭐ Fácil | ✅ SÍ |
| `supabase db push` | ⭐⭐ Medio | ✅ SÍ |
| `psql` con connection string | ⭐⭐⭐ Difícil | ❌ NO |
| Manual SQL en Dashboard | ⭐⭐⭐⭐ Muy difícil | ❌ NO |

---

**Recomendación:** Usa `MIGRATE_WINDOWS.bat` o `supabase db push` 🚀
