# Guía de Pruebas de Carga - DogCatiFy

Esta guía explica cómo usar los scripts de prueba de carga para validar el rendimiento de la aplicación y monitorear métricas en Datadog.

## 📋 Tabla de Contenidos

- [Scripts Disponibles](#scripts-disponibles)
- [Requisitos Previos](#requisitos-previos)
- [Script 1: Prueba Básica (Sin Autenticación)](#script-1-prueba-básica-sin-autenticación)
- [Script 2: Prueba Autenticada](#script-2-prueba-autenticada)
- [Interpretación de Resultados](#interpretación-de-resultados)
- [Monitoreo en Datadog](#monitoreo-en-datadog)
- [Mejores Prácticas](#mejores-prácticas)

---

## Scripts Disponibles

### 1. `load-test-app.js`
Prueba de carga básica que simula usuarios anónimos navegando por la app.

**Características:**
- No requiere autenticación
- Simula navegación básica (productos, servicios, lugares)
- Seguro para usar en producción
- Métricas en tiempo real

### 2. `load-test-authenticated.js`
Prueba avanzada con usuarios autenticados que crean/modifican datos.

**Características:**
- Crea usuarios de prueba
- Simula acciones completas (crear mascotas, órdenes, etc.)
- **SOLO PARA DESARROLLO/STAGING**
- Limpieza automática de datos

---

## Requisitos Previos

### 1. Variables de Entorno

Asegúrate de tener un archivo `.env` con:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

### 2. Dependencias

```bash
npm install
```

### 3. Permisos de Ejecución

```bash
chmod +x scripts/load-test-app.js
chmod +x scripts/load-test-authenticated.js
```

---

## Script 1: Prueba Básica (Sin Autenticación)

### Uso Básico

```bash
node scripts/load-test-app.js
```

**Configuración por defecto:**
- 20 usuarios simultáneos
- 30 segundos de duración
- Intervalo de 2 segundos entre acciones

### Opciones Avanzadas

```bash
# Personalizar parámetros
node scripts/load-test-app.js --users 50 --duration 60 --interval 1000

# Opciones disponibles:
# --users      Número de usuarios simultáneos (default: 20)
# --duration   Duración en segundos (default: 30)
# --interval   Intervalo entre acciones en ms (default: 2000)
# --rampup     Tiempo de rampa en segundos (default: 10)
```

### Ejemplos de Uso

#### Prueba Ligera (Desarrollo)
```bash
node scripts/load-test-app.js --users 5 --duration 20
```

#### Prueba Media (Pre-producción)
```bash
node scripts/load-test-app.js --users 30 --duration 60
```

#### Prueba Intensa (Capacidad máxima)
```bash
node scripts/load-test-app.js --users 100 --duration 120 --interval 1000
```

### Acciones Simuladas

El script simula usuarios que:
1. Consultan mascotas disponibles
2. Navegan productos de la tienda
3. Revisan servicios ofrecidos
4. Buscan lugares pet-friendly
5. Ven promociones activas
6. Consultan historial de órdenes

---

## Script 2: Prueba Autenticada

⚠️ **ADVERTENCIA:** Este script crea usuarios de prueba en tu base de datos. Úsalo **SOLO** en ambientes de desarrollo o staging.

### Uso Básico

```bash
node scripts/load-test-authenticated.js
```

**Configuración por defecto:**
- 5 usuarios simultáneos
- 30 segundos de duración
- Intervalo de 3 segundos entre acciones

### Opciones Avanzadas

```bash
# Personalizar parámetros
node scripts/load-test-authenticated.js --users 10 --duration 60 --interval 2000

# Opciones disponibles:
# --users      Número de usuarios (default: 5)
# --duration   Duración en segundos (default: 30)
# --interval   Intervalo entre acciones en ms (default: 3000)
```

### Ejemplos de Uso

#### Prueba de Autenticación
```bash
node scripts/load-test-authenticated.js --users 3 --duration 20
```

#### Prueba de Escritura (Base de Datos)
```bash
node scripts/load-test-authenticated.js --users 10 --duration 60
```

### Acciones Simuladas

El script simula usuarios que:
1. **Se registran** en la aplicación
2. **Crean mascotas** en su perfil
3. **Consultan sus mascotas**
4. **Navegan productos** disponibles
5. **Crean órdenes** de compra
6. **Consultan su historial** de órdenes
7. **Actualizan su perfil**
8. **Buscan servicios** disponibles

### Limpieza de Datos

El script **automáticamente limpia** los datos de prueba al finalizar:
- Elimina mascotas creadas
- Elimina órdenes generadas
- **Nota:** Los usuarios no se pueden eliminar desde el cliente (requiere admin)

---

## Interpretación de Resultados

### Métricas Mostradas

#### Durante la Prueba (Tiempo Real)

```
📊 RESUMEN GENERAL:
   Total de requests:       150
   Requests exitosos:       148 (98.67%)
   Requests fallidos:       2
   Usuarios activos:        20

⏱️  TIEMPOS DE RESPUESTA:
   Promedio:                234 ms
   Mínimo:                  45 ms
   Máximo:                  892 ms

📈 MÉTRICAS POR ENDPOINT:
   GET /pets: 45 | OK: 45 | Error: 0 | Avg: 156ms
   GET /products: 38 | OK: 37 | Error: 1 | Avg: 289ms
```

#### Reporte Final

Incluye:
- **Resumen general** con totals y tasas
- **Tiempos de respuesta** (min, max, avg)
- **Rendimiento por endpoint**
- **Evaluación automática**
- **Recomendaciones**

### Evaluación de Rendimiento

#### Tasa de Éxito
- **99%+** = Excelente ✅
- **95-99%** = Bueno ✅
- **90-95%** = Aceptable ⚠️
- **<90%** = Crítico ❌

#### Tiempo de Respuesta
- **<200ms** = Excelente ✅
- **200-500ms** = Bueno ✅
- **500-1000ms** = Lento ⚠️
- **>1000ms** = Muy Lento ❌

---

## Monitoreo en Datadog

### Acceder al Dashboard

1. Abre tu dashboard de Datadog:
   ```
   https://us5.datadoghq.com/
   ```

2. Navega a **APM → Services**

3. Busca el servicio: `com.dogcatify.app`

### Métricas Clave a Monitorear

#### 1. APM (Application Performance Monitoring)

**Dónde:** APM → Services → com.dogcatify.app

**Métricas:**
- **Latency (p50, p75, p95, p99)**: Tiempo de respuesta
- **Requests per second**: Throughput
- **Error rate**: Tasa de errores
- **Apdex score**: Satisfacción del usuario

**Qué buscar:**
- Picos de latencia durante la prueba
- Incremento en error rate
- Degradación del Apdex score

#### 2. Logs

**Dónde:** Logs → Search

**Queries útiles:**
```
service:com.dogcatify.app status:error
service:com.dogcatify.app @action:"FETCH_PRODUCTS"
service:com.dogcatify.app @responseTime:>1000
```

**Qué buscar:**
- Errores específicos durante la prueba
- Queries lentas
- Timeouts

#### 3. Infrastructure

**Dónde:** Infrastructure → Metrics

**Métricas de Supabase:**
- CPU usage
- Database connections
- Query performance
- Connection pool saturation

**Qué buscar:**
- CPU spikes
- Connection pool exhaustion
- Slow queries

#### 4. Real User Monitoring (RUM)

**Dónde:** RUM → Sessions

**Métricas:**
- Session duration
- View loads
- Resource timing
- JavaScript errors

### Crear Alertas

#### Alerta de Latencia Alta

```
Metric: trace.http.request.duration
Condition: avg > 1000ms for 5 minutes
Service: com.dogcatify.app
```

#### Alerta de Error Rate

```
Metric: trace.http.request.errors
Condition: rate > 5% for 5 minutes
Service: com.dogcatify.app
```

#### Alerta de Throughput Bajo

```
Metric: trace.http.request.hits
Condition: avg < 10 req/s for 10 minutes
Service: com.dogcatify.app
```

---

## Mejores Prácticas

### 1. Planificación de Pruebas

#### Antes de Ejecutar

- [ ] Verificar ambiente (dev/staging/prod)
- [ ] Revisar estado actual de Datadog
- [ ] Hacer backup de datos (si es staging)
- [ ] Notificar al equipo
- [ ] Definir objetivos de la prueba

#### Durante la Prueba

- [ ] Monitorear Datadog en tiempo real
- [ ] Observar logs de errores
- [ ] Tomar capturas de pantalla
- [ ] Anotar comportamientos anómalos

#### Después de la Prueba

- [ ] Analizar métricas en Datadog
- [ ] Identificar cuellos de botella
- [ ] Documentar hallazgos
- [ ] Crear tickets de optimización
- [ ] Limpiar datos de prueba

### 2. Interpretación de Resultados

#### Identificar Cuellos de Botella

**Queries lentas:**
```sql
-- Buscar en Datadog logs
service:com.dogcatify.app @query_duration:>500
```

**Endpoints lentos:**
- Revisar APM → Traces
- Ordenar por duración
- Analizar flamegraph

**Problemas de red:**
- Revisar Resource timing en RUM
- Buscar timeouts
- Verificar DNS resolution time

#### Optimizaciones Comunes

**Si los productos son lentos:**
- Agregar índice en `partner_products(is_active)`
- Implementar caching
- Optimizar query con `select` específico

**Si las órdenes son lentas:**
- Agregar índice compuesto `orders(user_id, created_at)`
- Paginar resultados
- Usar materialized views

**Si la autenticación es lenta:**
- Verificar RLS policies
- Optimizar policies con índices
- Revisar JWT token size

### 3. Escalamiento Gradual

No empieces con 100 usuarios. Escala gradualmente:

1. **Baseline (5 usuarios)** → Establecer métricas base
2. **Pequeña carga (20 usuarios)** → Identificar primeros problemas
3. **Carga media (50 usuarios)** → Validar optimizaciones
4. **Carga alta (100+ usuarios)** → Probar límites

### 4. Horarios Recomendados

- **Desarrollo:** Cualquier momento
- **Staging:** Fuera de horario de trabajo del equipo
- **Producción:** Horario de menor tráfico (madrugada)

### 5. Documentar Resultados

Crea un documento con:

```markdown
## Prueba de Carga - [Fecha]

### Configuración
- Usuarios: 50
- Duración: 60s
- Ambiente: Staging

### Resultados
- Tasa de éxito: 98.5%
- Latencia promedio: 234ms
- Requests/segundo: 15

### Problemas Encontrados
1. Endpoint `/products` lento (500ms avg)
2. Error rate 2% en `/orders/create`

### Acciones
- [ ] Optimizar query de productos
- [ ] Revisar RLS policy de orders
```

---

## Troubleshooting

### Error: "Variables de entorno no configuradas"

**Solución:**
```bash
# Verifica que el archivo .env existe
cat .env

# Si no existe, créalo:
cp .env.example .env
# Edita y agrega tus credenciales
```

### Error: "Connection refused"

**Solución:**
- Verifica que Supabase esté accesible
- Revisa la URL en `.env`
- Verifica tu conexión a internet

### Muchos Errores Durante la Prueba

**Posibles causas:**
1. **Rate limiting:** Supabase tiene límites
2. **Connection pool saturado:** Muchas conexiones simultáneas
3. **RLS policies:** Queries bloqueadas por seguridad

**Solución:**
- Reduce el número de usuarios
- Aumenta el intervalo entre acciones
- Revisa logs en Datadog para errores específicos

### Script se Cuelga

**Solución:**
```bash
# Interrumpir con Ctrl+C
# Limpiar procesos colgados
pkill -f "node scripts/load-test"
```

---

## Comandos Rápidos

```bash
# Prueba rápida básica
node scripts/load-test-app.js --users 5 --duration 15

# Prueba media
node scripts/load-test-app.js --users 30 --duration 60

# Prueba intensa
node scripts/load-test-app.js --users 100 --duration 120

# Prueba autenticada (solo dev/staging)
node scripts/load-test-authenticated.js --users 5 --duration 30

# Ver ayuda
node scripts/load-test-app.js --help
```

---

## Recursos Adicionales

- [Documentación Datadog APM](https://docs.datadoghq.com/tracing/)
- [Supabase Performance Tips](https://supabase.com/docs/guides/platform/performance)
- [Dashboard Datadog](https://us5.datadoghq.com/)

---

## Soporte

Si encuentras problemas:

1. Revisa esta guía
2. Consulta los logs en Datadog
3. Revisa el código del script
4. Contacta al equipo de desarrollo
