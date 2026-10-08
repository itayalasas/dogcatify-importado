# Optimización de Caches de IA

## 📋 Resumen

Este sistema optimiza el consumo de tokens de OpenAI mediante caches inteligentes para:
- **Enfermedades** por raza
- **Alergias** por raza
- **Desparasitantes** por raza

## 🎯 Problema Original

Antes, cada consulta de enfermedades:
- ✅ Buscaba en cache por: especie + raza + edad exacta + peso
- ❌ Casi nunca encontraba coincidencias exactas
- ❌ Llamaba a OpenAI constantemente (2500 tokens/consulta)
- ❌ Costoso e ineficiente

**Ejemplo:**
- Usuario 1: Labrador, 24 meses → Llama a IA
- Usuario 2: Labrador, 25 meses → Llama a IA de nuevo
- Usuario 3: Labrador, 30 meses → Llama a IA de nuevo

## ✅ Solución Implementada

### 1. Cache Simplificado
Ahora busca SOLO por: `especie + raza`

**Beneficio:**
- Usuario 1: Labrador → Llama a IA (primera vez)
- Usuario 2: Labrador → Usa cache (0 tokens)
- Usuario 3: Labrador → Usa cache (0 tokens)
- **Ahorro: 99% de tokens**

### 2. Pre-población de TODOS los Caches
Script que genera datos de IA para las 33 razas más comunes:
- 21 razas de perros × 3 tipos = 63 operaciones
- 12 razas de gatos × 3 tipos = 36 operaciones
- **Total: 99 operaciones de cache**

Tipos de datos generados:
- ✅ Enfermedades comunes
- ✅ Alergias frecuentes
- ✅ Desparasitantes recomendados

## 🚀 Uso

### Ejecutar el Script de Pre-población

```bash
npm run populate-illness-cache
```

Este script:
1. ✅ Verifica qué razas ya tienen datos en cache
2. ✅ Genera enfermedades para razas faltantes
3. ✅ Muestra progreso en tiempo real
4. ✅ Proporciona estadísticas al finalizar

### Salida Esperada

```
🚀 Iniciando población de TODOS los caches de IA...

📊 Estadísticas:
   - Razas de perros: 21
   - Razas de gatos: 12
   - Total: 33 razas
   - Tipos de cache: 3 (enfermedades, alergias, desparasitantes)
   - Operaciones totales: 99

🐕 Procesando razas de perros...
🔄 Generando enfermedades para dog: Labrador Retriever...
✅ Generadas 15 enfermedades para Labrador Retriever
🔄 Generando alergias para dog: Labrador Retriever...
✅ Generadas 12 alergias para Labrador Retriever
🔄 Generando desparasitantes para dog: Labrador Retriever...
✅ Generadas 10 desparasitantes para Labrador Retriever

...

📊 RESUMEN FINAL

ILLNESSES:
  ✅ Generadas: 30
  ⏭️  Saltadas: 3
  ❌ Errores: 0
  📈 Total: 33

ALLERGIES:
  ✅ Generadas: 31
  ⏭️  Saltadas: 2
  ❌ Errores: 0
  📈 Total: 33

DEWORMERS:
  ✅ Generadas: 32
  ⏭️  Saltadas: 1
  ❌ Errores: 0
  📈 Total: 33

TOTALES GLOBALES:
✅ Generadas exitosamente: 93
⏭️  Saltadas (ya existían): 6
❌ Errores: 0
📈 Total procesadas: 99

🎉 ¡Todos los caches poblados exitosamente!
```

## 📊 Impacto

### Antes (sin cache optimizado)
- **Costo por consulta IA:** ~$0.003 USD
- **Consultas típicas por usuario:** 3 (enfermedad + alergia + desparasitante)
- **Costo por usuario:** ~$0.009 USD
- **1000 usuarios/día:** ~$9 USD/día = **$270 USD/mes**
- **Tiempo de respuesta:** 2-5 segundos por consulta

### Después (con cache optimizado)
- **Costo inicial:** ~$0.30 USD (99 operaciones de cache)
- **Costo por usuario:** $0 USD (usa cache)
- **1000 usuarios/día:** ~$0.30 USD/mes (solo costo inicial)
- **Tiempo de respuesta:** <500ms por consulta
- **Ahorro mensual:** ~$270 USD
- **ROI:** El costo inicial se recupera con solo 4 consultas

## 🔧 Configuración

### Requisitos

1. **Variables de Entorno** (en `.env`):
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
   ```

2. **OpenAI API Key** (en Supabase):
   - Ve a: Settings → Edge Functions → Secrets
   - Agrega: `OPENAI_API_KEY` con tu API key

## 🗂️ Estructura del Cache

### Tabla: `illnesses_ai_cache`

```sql
{
  id: uuid,
  species: 'dog' | 'cat',
  breed: string,              -- Ej: "Labrador Retriever"
  age_in_months: integer,      -- Edad usada para generar (no se usa en búsqueda)
  weight: numeric,             -- Peso usado para generar (no se usa en búsqueda)
  illnesses: jsonb,            -- Array de enfermedades
  cache_key: string,           -- "dog_Labrador_general"
  created_at: timestamp,
  expires_at: timestamp        -- 90 días por defecto
}
```

### Búsqueda Optimizada

```typescript
// Busca SOLO por species + breed
const { data } = await supabase
  .from('illnesses_ai_cache')
  .select('*')
  .eq('species', 'dog')
  .eq('breed', 'Labrador Retriever')
  .gt('expires_at', new Date().toISOString())
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
```

## 🎨 Razas Incluidas

### Perros (21)
- Labrador Retriever
- Golden Retriever
- Pastor Alemán
- Bulldog Francés
- Beagle
- Yorkshire Terrier
- Poodle
- Chihuahua
- Rottweiler
- Boxer
- Dachshund
- Shih Tzu
- Siberian Husky
- Pomerania
- Boston Terrier
- Bulldog Inglés
- Cocker Spaniel
- Border Collie
- Doberman
- Schnauzer
- Mestizo

### Gatos (12)
- Siamés
- Persa
- Maine Coon
- Bengalí
- Ragdoll
- British Shorthair
- Sphynx
- Abisinio
- Scottish Fold
- American Shorthair
- Europeo Común
- Mestizo

## 🔄 Mantenimiento

### Agregar Más Razas

1. Edita `scripts/populate-illness-cache.js`
2. Agrega razas al objeto `COMMON_BREEDS`
3. Ejecuta: `npm run populate-illness-cache`

### Actualizar Cache Existente

El cache expira después de 90 días. Para forzar actualización:

```sql
-- Eliminar cache específico
DELETE FROM illnesses_ai_cache
WHERE species = 'dog' AND breed = 'Labrador Retriever';

-- Regenerar con el script
npm run populate-illness-cache
```

## 📈 Monitoreo

### Ver Estadísticas del Cache

```sql
-- Razas en cache
SELECT species, breed, created_at, expires_at
FROM illnesses_ai_cache
ORDER BY created_at DESC;

-- Contar por especie
SELECT species, COUNT(*) as total
FROM illnesses_ai_cache
GROUP BY species;

-- Ver razas sin cache
SELECT DISTINCT breed
FROM pets
WHERE breed NOT IN (
  SELECT breed FROM illnesses_ai_cache WHERE species = pets.species
);
```

## ⚠️ Notas Importantes

1. **Primera Ejecución:** Toma ~1.5-2 horas (99 operaciones × 1 segundo de pausa)
2. **Costo Inicial:** ~$0.30 USD en tokens de OpenAI
3. **Cache Inteligente:** Saltará operaciones que ya existen en cache
4. **Renovación:** Ejecutar cada 3 meses para mantener datos actualizados
5. **Interrupción:** Si se interrumpe, al volver a ejecutar continuará donde quedó

## 🎯 Próximos Pasos

1. ✅ Ejecutar el script de población
2. ✅ Verificar que las razas comunes tienen datos
3. ✅ Monitorear uso de tokens (debería ser ~99% menor)
4. ⏳ Agregar más razas según analítica de usuarios
