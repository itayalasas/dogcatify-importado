# Configuración de OpenAI para Recomendaciones de Comportamiento

Este documento explica cómo configurar la API key de OpenAI para generar recomendaciones personalizadas de comportamiento con inteligencia artificial.

## Requisitos Previos

1. Una cuenta de OpenAI ([https://platform.openai.com](https://platform.openai.com))
2. Una API key de OpenAI
3. Acceso al proyecto de Supabase

## Paso 1: Obtener tu API Key de OpenAI

1. Ve a [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Inicia sesión con tu cuenta de OpenAI
3. Haz clic en **"Create new secret key"**
4. Dale un nombre descriptivo (ej: "DogCatify Production")
5. Copia la key (solo se muestra una vez)
6. **IMPORTANTE**: Guarda esta key en un lugar seguro

## Paso 2: Configurar la API Key en Supabase

### Opción A: Desde el Dashboard de Supabase (Recomendado)

1. Ve a tu proyecto en [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. En el menú lateral, ve a **Settings** → **Edge Functions**
3. En la sección **Secrets**, busca o crea una nueva variable
4. Configura:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Tu API key de OpenAI (ej: `sk-proj-...`)
5. Haz clic en **Save**

### Opción B: Usando Supabase CLI (Para desarrollo local)

```bash
# Primero, asegúrate de tener Supabase CLI instalado
npm install -g supabase

# Inicia sesión en Supabase
supabase login

# Vincula tu proyecto
supabase link --project-ref TU_PROJECT_REF

# Configura el secreto
supabase secrets set OPENAI_API_KEY=sk-proj-tu-api-key-aqui
```

## Paso 3: Verificar la Configuración

La Edge Function `generate-behavior-recommendations` ya está desplegada y lista para usar.

### Probar desde la App

1. Abre la app y ve a la sección de mascotas
2. Selecciona una mascota
3. Ve a la pestaña **"Conducta"**
4. Realiza una evaluación de comportamiento
5. Presiona el botón **"Generar con IA"**
6. Espera unos segundos mientras la IA genera recomendaciones personalizadas

### Probar desde el Terminal (Opcional)

```bash
# Ejecutar el script de prueba
node scripts/test-behavior-ai.js
```

## Costos y Límites

### Modelo Usado: GPT-4o-mini

- **Costo aproximado**: $0.15 por 1M de tokens de entrada, $0.60 por 1M de tokens de salida
- **Costo por recomendación**: Aproximadamente $0.001 - $0.002 USD por evaluación
- **Límite de tokens**: Máximo 1000 tokens por respuesta

### Estimación de Costos Mensuales

Para una app con **1000 usuarios activos** que generan recomendaciones **2 veces al mes**:
- Total de llamadas: 2,000 llamadas/mes
- Costo estimado: **$2 - $4 USD/mes**

## Características de las Recomendaciones con IA

### ✅ Lo que la IA Considera

1. **Datos de la Mascota**:
   - Nombre, especie (perro/gato), raza
   - Edad y peso (si están disponibles)

2. **Evaluación de Comportamiento**:
   - Los 7 traits principales evaluados (1-5)
   - Traits específicos por especie (ladrido/maullido/arañado)

3. **Información de la Raza**:
   - Características típicas de la raza según la API
   - Tendencias genéticas y comportamentales

4. **Contexto Individual**:
   - La IA compara la evaluación individual vs. las características de la raza
   - Identifica discrepancias y genera recomendaciones específicas

### 🎯 Beneficios sobre Recomendaciones Hardcodeadas

1. **Personalización Real**: Cada recomendación es única para la mascota
2. **Contextualización**: Considera múltiples factores simultáneamente
3. **Lenguaje Natural**: Respuestas en español fluido y comprensible
4. **Priorización Inteligente**: Enfoca en los aspectos más importantes
5. **Actualizaciones Dinámicas**: Se adapta a cambios en el comportamiento

## Ejemplo de Salida

### Recomendaciones Hardcodeadas (Sistema Anterior)
```
• Necesita ejercicio diario intenso y actividades estimulantes
• Excelente para familias y socialización con otros animales
• Ideal para entrenamientos avanzados y trucos complejos
```

### Recomendaciones con IA (Sistema Nuevo)
```
🎯 Para Niko (2 años, mestizo, 2kg): Sesiones de juego de 20-25 minutos, 2 veces al día con juguetes que simulen presas (plumas, ratones de juguete)

🧩 Su nivel de independencia moderado sugiere que puede quedarse solo 4-6 horas, pero beneficiaría de un rascador cerca de la ventana para entretenimiento

⚠️ El arañado elevado (4/5) requiere: 2-3 rascadores verticales en zonas estratégicas, uno horizontal, y recorte de uñas cada 2-3 semanas

🗣️ Los maullidos frecuentes pueden indicar comunicación: establece horarios fijos de comida/juego para reducir vocalizaciones por demanda

✂️ Como mestizo con pelaje moderado: cepillado 2-3 veces por semana es suficiente, aumenta a diario durante cambios de estación
```

## Seguridad

- ✅ La API key nunca se expone al cliente
- ✅ Todas las llamadas están autenticadas con JWT
- ✅ Solo usuarios autenticados pueden generar recomendaciones
- ✅ La función valida todos los inputs antes de llamar a OpenAI

## Fallback y Manejo de Errores

Si la IA falla (API key inválida, límite de tasa, error de red):
- La app automáticamente vuelve a usar las **recomendaciones hardcodeadas**
- El usuario ve un mensaje informativo pero no pierde funcionalidad
- El sistema sigue funcionando normalmente

## Solución de Problemas

### Error: "OpenAI API key not configured"

**Solución**: Verifica que la variable `OPENAI_API_KEY` esté configurada en los secretos de Supabase.

### Error: "Rate limit exceeded"

**Solución**: Has excedido el límite de llamadas de OpenAI. Espera unos minutos o aumenta tu límite en OpenAI.

### Error: "Insufficient quota"

**Solución**: Tu cuenta de OpenAI no tiene créditos suficientes. Añade créditos en [https://platform.openai.com/account/billing](https://platform.openai.com/account/billing).

### Las recomendaciones están en inglés

**Solución**: Esto no debería pasar ya que el prompt especifica español. Si ocurre, reporta el issue.

## Monitoreo

### Ver Logs de la Edge Function

```bash
# Ver logs en tiempo real
supabase functions logs generate-behavior-recommendations

# Ver logs de las últimas 24 horas
supabase functions logs generate-behavior-recommendations --tail
```

### Métricas Importantes a Monitorear

1. **Tiempo de respuesta**: Debe ser < 5 segundos
2. **Tasa de error**: Debe ser < 5%
3. **Costos mensuales**: Revisar en OpenAI Dashboard
4. **Uso de tokens**: Promedio por llamada

## Actualizaciones y Mantenimiento

La Edge Function se actualiza automáticamente cuando haces deploy. No requiere configuración adicional.

Para actualizar el modelo de IA usado:
1. Edita `supabase/functions/generate-behavior-recommendations/index.ts`
2. Cambia el campo `model` de `gpt-4o-mini` a otro (ej: `gpt-4o`, `gpt-4-turbo`)
3. Redeploy la función

## Soporte

Si tienes problemas con la configuración:
1. Verifica los logs de la Edge Function
2. Asegúrate de que la API key sea válida
3. Verifica que tengas créditos en tu cuenta de OpenAI
4. Contacta al equipo de desarrollo si el problema persiste
