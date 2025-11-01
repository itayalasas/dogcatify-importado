# Sistema de Caché para Recomendaciones de Alergias con IA

## Descripción General

El sistema de alergias utiliza OpenAI GPT-4o-mini para generar recomendaciones personalizadas de alergias según la especie, raza, edad y peso de la mascota. Para optimizar costos y mejorar el rendimiento, implementamos un sistema de caché en Supabase.

## Arquitectura del Sistema

### 1. Base de Datos

#### Tabla: `allergies_ai_cache`

```sql
CREATE TABLE allergies_ai_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species text NOT NULL CHECK (species IN ('dog', 'cat')),
  breed text NOT NULL,
  age_in_months integer NOT NULL CHECK (age_in_months >= 0),
  weight numeric CHECK (weight > 0),
  allergies jsonb NOT NULL DEFAULT '[]'::jsonb,
  cache_key text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '90 days')
);
```

**Campos importantes:**
- `cache_key`: Formato `{species}_{breed}_{age}_{weight}` (ej: `dog_Golden Retriever_36_25`)
- `allergies`: Array JSON con estructura completa de cada alergia
- `expires_at`: Caché válido por 90 días

### 2. Estructura de Datos de Alergias

Cada alergia en el caché contiene:

```json
{
  "name": "Ácaros del polvo",
  "description": "Alergia a ácaros microscópicos en el hogar",
  "allergy_type": "Ambiental",
  "symptoms": ["Picazón constante", "Estornudos", "Ojos irritados", "Tos"],
  "severity": "moderate",
  "frequency": "Muy común",
  "triggers": ["Camas", "Alfombras", "Cortinas", "Humedad"],
  "prevention_tips": [
    "Aspirar frecuentemente",
    "Lavar la ropa de cama semanalmente",
    "Usar fundas antiácaros"
  ]
}
```

## Flujo de Funcionamiento

### Escenario 1: Con datos completos de mascota (raza + edad)

```
Usuario selecciona agregar alergia
    ↓
Sistema verifica cache_key = "{species}_{breed}_{age}_{weight}"
    ↓
¿Cache válido existe?
    ├─ SÍ → Carga alergias desde cache (instantáneo)
    └─ NO → Genera con IA → Guarda en cache → Muestra alergias
```

### Escenario 2: Sin datos de raza/edad

```
Usuario selecciona agregar alergia
    ↓
Sistema usa valores genéricos:
  - breed: "Común/ Doméstico/ Mestizo"
  - age: 24 meses
  - cache_key = "{species}_Común/ Doméstico/ Mestizo_24_any"
    ↓
¿Cache genérico existe?
    ├─ SÍ → Carga alergias genéricas (instantáneo)
    └─ NO → Genera con IA → Guarda en cache → Muestra alergias
```

## Beneficios del Sistema de Caché

### 1. Optimización de Costos
- **Primera vez**: Consulta a OpenAI (costo: ~$0.001)
- **Siguientes 90 días**: Carga desde cache (sin costo de IA)
- **Ahorro estimado**: 99% de las consultas usan cache

### 2. Mejora de Rendimiento
- **Sin cache**: 2-5 segundos (espera respuesta de OpenAI)
- **Con cache**: <500ms (consulta a base de datos)
- **Mejora**: 4-10x más rápido

### 3. Consistencia
- Misma raza/edad siempre recibe las mismas recomendaciones
- Evita variaciones en respuestas de IA

### 4. Disponibilidad
- Funciona incluso si OpenAI tiene problemas
- No depende de latencia de API externa

## Mantenimiento del Caché

### Limpieza Automática

El sistema incluye una función para limpiar cache expirado:

```sql
SELECT cleanup_expired_illness_cache();
```

Esta función elimina entradas de:
- `illnesses_ai_cache`
- `treatments_ai_cache`
- `allergies_ai_cache`

**Recomendación**: Ejecutar diariamente mediante cron job o edge function programada.

### Estadísticas de Cache

Ejecutar script de prueba:

```bash
node scripts/test-allergy-cache.js
```

Este script muestra:
- Número de entradas en cache
- Entradas válidas vs expiradas
- Muestras de datos
- Validación de estructura

## Casos de Uso

### 1. Perro Golden Retriever de 3 años

```javascript
// Primera vez
cache_key: "dog_Golden Retriever_36_25"
Resultado: Genera con IA → 10-15 alergias específicas → Guarda cache
Tiempo: 3-4 segundos

// Segunda vez (mismo perro u otro Golden de 3 años)
Resultado: Carga desde cache
Tiempo: <500ms
```

### 2. Gato sin raza específica

```javascript
// Primera vez
cache_key: "cat_Común/ Doméstico/ Mestizo_24_any"
Resultado: Genera alergias comunes en gatos → Guarda cache
Tiempo: 3-4 segundos

// Segunda vez (cualquier gato sin datos específicos)
Resultado: Carga desde cache genérico
Tiempo: <500ms
```

### 3. Perro Labrador cachorro (6 meses)

```javascript
cache_key: "dog_Labrador_6_15"
Resultado: IA considera predisposiciones de cachorro
  - Alergias alimentarias en transición
  - Sensibilidad a vacunas
  - Dermatitis juvenil
```

## Actualización del Caché

### Cuándo se actualiza

El cache se renueva automáticamente:
- Cada 90 días (expiración)
- Al cambiar datos significativos de la mascota:
  - Edad cruza umbral importante (cachorro → adulto)
  - Cambio de peso significativo
  - Actualización de raza

### Forzar Regeneración

Si necesitas regenerar el cache (ej: mejoras en prompt de IA):

```sql
-- Eliminar cache específico
DELETE FROM allergies_ai_cache
WHERE cache_key = 'dog_Golden Retriever_36_25';

-- Eliminar todo el cache de una especie
DELETE FROM allergies_ai_cache
WHERE species = 'dog';

-- Eliminar todo el cache expirado
SELECT cleanup_expired_illness_cache();
```

## Monitoreo

### Métricas Importantes

1. **Tasa de aciertos de cache**: Porcentaje de consultas que usan cache
2. **Tiempo promedio de carga**: Con y sin cache
3. **Entradas expiradas**: Cuántas necesitan limpieza
4. **Uso de OpenAI**: Tokens consumidos vs ahorrados

### Dashboard Recomendado

```sql
-- Tasa de acierto de cache
SELECT
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE expires_at > now()) as valid_entries,
  ROUND(100.0 * COUNT(*) FILTER (WHERE expires_at > now()) / COUNT(*), 2) as valid_percentage
FROM allergies_ai_cache;

-- Distribución por especie
SELECT
  species,
  COUNT(*) as entries,
  COUNT(DISTINCT breed) as unique_breeds
FROM allergies_ai_cache
WHERE expires_at > now()
GROUP BY species;

-- Cache más antiguo
SELECT
  cache_key,
  created_at,
  expires_at,
  EXTRACT(DAY FROM (expires_at - now())) as days_until_expiry
FROM allergies_ai_cache
WHERE expires_at > now()
ORDER BY created_at ASC
LIMIT 10;
```

## Mejores Prácticas

1. **Pre-popular cache común**: Generar cache para razas populares
2. **Monitorear expiración**: Limpiar entradas expiradas regularmente
3. **Validar estructura**: Asegurar que JSON tenga campos requeridos
4. **Backup del cache**: Incluir en backups de base de datos
5. **Logs de IA**: Registrar cuándo se generan nuevas entradas

## Troubleshooting

### Problema: Cache no se está usando

**Síntomas**: Siempre genera con IA, nunca carga desde cache

**Solución**:
```sql
-- Verificar si hay cache
SELECT * FROM allergies_ai_cache WHERE cache_key LIKE 'dog%' LIMIT 5;

-- Verificar que no esté expirado
SELECT * FROM allergies_ai_cache
WHERE cache_key = 'tu_cache_key'
AND expires_at > now();
```

### Problema: Datos incompletos en cache

**Síntomas**: Alergias sin campos requeridos

**Solución**:
```sql
-- Eliminar entrada problemática
DELETE FROM allergies_ai_cache WHERE cache_key = 'problematic_key';

-- Se regenerará en próxima consulta
```

### Problema: Cache muy grande

**Síntomas**: Tabla muy grande, consultas lentas

**Solución**:
```sql
-- Ver tamaño de tabla
SELECT pg_size_pretty(pg_total_relation_size('allergies_ai_cache'));

-- Limpiar entradas antiguas
DELETE FROM allergies_ai_cache
WHERE created_at < now() - interval '180 days';
```

## Futuras Mejoras

1. **Cache adaptativo**: Ajustar duración según popularidad
2. **Pre-caching**: Generar cache en background para razas comunes
3. **Versionado**: Mantener versiones de cache al actualizar prompts
4. **Sincronización**: Compartir cache entre instancias
5. **Analytics**: Dashboard de uso y efectividad de cache

## Conclusión

El sistema de caché de alergias reduce significativamente:
- Costos de API de OpenAI (99% de ahorro)
- Tiempo de respuesta (4-10x más rápido)
- Dependencia de servicios externos

Mientras mantiene:
- Alta calidad de recomendaciones
- Personalización por raza/edad
- Consistencia en resultados
