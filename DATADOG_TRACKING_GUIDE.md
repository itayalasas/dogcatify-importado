# Guía de Tracking con Datadog

Esta guía explica cómo usar el sistema de tracking automático para monitorear tu aplicación en Datadog y ver métricas como las que aparecen en Product Analytics.

## 📋 Tabla de Contenidos

- [¿Qué está configurado?](#qué-está-configurado)
- [Tracking Automático](#tracking-automático)
- [Tracking Manual](#tracking-manual)
- [Ver Métricas en Datadog](#ver-métricas-en-datadog)
- [Mejores Prácticas](#mejores-prácticas)
- [Ejemplos de Uso](#ejemplos-de-uso)

---

## ¿Qué está configurado?

### 1. Tracking Automático

✅ **Ya funcionando sin configuración adicional:**

- **Errores globales**: Todos los errores no capturados se envían a Datadog
- **Navegación**: Cada cambio de pantalla se registra automáticamente
- **Autenticación**: Login, logout, signup se trackean automáticamente
- **Lifecycle**: App start, background, foreground

### 2. Herramientas Disponibles

- ✅ `useDatadogTracking`: Hook para tracking en componentes
- ✅ `Analytics`: Servicio para eventos de negocio
- ✅ `supabaseTracked`: Cliente Supabase con logging automático
- ✅ `logger`: Logger directo para casos personalizados

---

## Tracking Automático

### Queries de Supabase

**Opción 1: Usar el cliente con tracking automático**

```typescript
import { supabaseTracked } from '@/utils/supabaseWithTracking';

// Todas las queries se loguean automáticamente
const { data, error } = await supabaseTracked
  .from('pets')
  .select('*')
  .eq('owner_id', userId);

// Esto registra automáticamente en Datadog:
// - Tabla: pets
// - Operación: select
// - Duración: XX ms
// - Éxito/Error
// - Cantidad de resultados
```

**Opción 2: Cliente normal (sin tracking)**

```typescript
import { supabaseClient } from '@/lib/supabase';

// No se loguea automáticamente
const { data, error } = await supabaseClient
  .from('pets')
  .select('*');
```

### Errores

Los errores se capturan automáticamente:

```typescript
try {
  const result = await someFunction();
} catch (error) {
  // Ya se envió a Datadog automáticamente por el global error handler
  // Pero puedes agregar contexto adicional:
  logger.trackError(error, 'MyComponent', {
    userId: user.id,
    action: 'fetching_data',
  });
}
```

---

## Tracking Manual

### 1. En Componentes React

```typescript
import { useDatadogTracking } from '@/hooks/useDatadogTracking';

function MyScreen() {
  const { trackAction, trackError, trackTiming, trackInteraction } =
    useDatadogTracking('MyScreen');

  // Track acción del usuario
  const handleButtonPress = () => {
    trackAction('button_pressed', {
      button_name: 'submit_form',
      user_id: user.id,
    });
  };

  // Track timing de operaciones
  const loadData = async () => {
    const start = Date.now();
    try {
      await fetchData();
      const duration = Date.now() - start;
      trackTiming('data_load', duration, { records: data.length });
    } catch (error) {
      trackError(error, { operation: 'data_load' });
    }
  };

  // Track interacciones
  const handleScroll = () => {
    trackInteraction('feed_list', 'scroll');
  };

  return (
    <View>
      <Button onPress={handleButtonPress} title="Submit" />
    </View>
  );
}
```

### 2. Analytics de Negocio

```typescript
import Analytics from '@/utils/analytics';

// E-commerce
Analytics.trackProductView(product.id, product.name, product.price);
Analytics.trackAddToCart(product.id, product.name, product.price, 1);
Analytics.trackPurchase(order.id, order.total, items.length, 'mercadopago');

// Servicios
Analytics.trackServiceView(service.id, service.name, service.price);
Analytics.trackBookingCompleted(booking.id, service.id, service.name, date);

// Mascotas
Analytics.trackPetAdded(pet.id, pet.species, pet.breed);
Analytics.trackMedicalRecordAdded(pet.id, 'vaccine');

// Búsquedas
Analytics.trackSearch(query, results.length, 'products');

// Compartir
Analytics.trackShare('pet_profile', pet.id, 'whatsapp');

// Custom events
Analytics.trackCustomEvent('special_action', {
  detail1: 'value1',
  detail2: 'value2',
});
```

### 3. Tracking de Formularios

```typescript
import { useFormTracking } from '@/hooks/useDatadogTracking';

function RegisterForm() {
  const { trackFieldInteraction, trackFieldError, trackSubmit } =
    useFormTracking('RegisterForm');

  return (
    <View>
      <TextInput
        onFocus={() => trackFieldInteraction('email')}
        onChangeText={(text) => {
          if (!isValidEmail(text)) {
            trackFieldError('email', 'Invalid email format');
          }
        }}
      />

      <Button
        onPress={async () => {
          try {
            await submitForm();
            trackSubmit(true);
          } catch (error) {
            trackSubmit(false, error);
          }
        }}
      />
    </View>
  );
}
```

### 4. Performance Tracking

```typescript
import { usePerformanceTracking } from '@/hooks/useDatadogTracking';

function HeavyComponent() {
  const { renderCount } = usePerformanceTracking('HeavyComponent');

  // Automáticamente trackea:
  // - Tiempo de montaje
  // - Número de re-renders
  // - Tiempo de vida del componente

  return <View>...</View>;
}
```

---

## Ver Métricas en Datadog

### 1. Dashboard de Product Analytics

**URL:** https://us5.datadoghq.com/

**Navega a:** APM → RUM → Product Analytics

Verás métricas como:
- **Active Users**: Usuarios activos en tiempo real
- **Sessions**: Sesiones por día/hora
- **Views**: Páginas más visitadas
- **Actions**: Acciones más comunes
- **Errors**: Tasa de errores
- **Performance**: Tiempos de carga

### 2. Queries Útiles

#### Ver todas las acciones de usuarios

```
service:com.dogcatify.app @category:engagement
```

#### Ver compras completadas

```
service:com.dogcatify.app @event:purchase
```

#### Ver errores de usuario

```
service:com.dogcatify.app @category:error @user_facing:true
```

#### Ver queries lentas de Supabase

```
service:com.dogcatify.app @table:* @duration:>500
```

#### Ver pantallas más visitadas

```
service:com.dogcatify.app "Screen View"
```

### 3. Crear Dashboard Personalizado

1. Ve a **Dashboards** → **New Dashboard**
2. Agrega widgets:

**Widget: Active Users**
```json
{
  "metric": "trace.com.dogcatify.app",
  "filter": "action:Screen View",
  "aggregation": "count_unique",
  "group_by": "user_id"
}
```

**Widget: Top Screens**
```json
{
  "metric": "trace.com.dogcatify.app",
  "filter": "action:Screen View",
  "aggregation": "count",
  "group_by": "screen"
}
```

**Widget: E-commerce Funnel**
```json
{
  "steps": [
    {"filter": "@event:product_view"},
    {"filter": "@event:add_to_cart"},
    {"filter": "@event:checkout_start"},
    {"filter": "@event:purchase"}
  ]
}
```

---

## Mejores Prácticas

### 1. Nombrar Eventos

✅ **Bueno:**
```typescript
trackAction('add_to_cart', { product_id: '123' });
trackAction('booking_completed', { service_id: '456' });
```

❌ **Malo:**
```typescript
trackAction('click', { type: 'button' }); // Muy genérico
trackAction('user_did_something'); // Poco descriptivo
```

### 2. Propiedades de Eventos

✅ **Bueno:**
```typescript
Analytics.trackPurchase(orderId, total, itemCount, paymentMethod);
// Propiedades estructuradas y útiles
```

❌ **Malo:**
```typescript
Analytics.trackCustomEvent('purchase', {
  data: JSON.stringify(order) // No hacer stringify
});
```

### 3. Errores

✅ **Bueno:**
```typescript
trackError(error, {
  context: 'checkout',
  step: 'payment',
  userId: user.id,
});
```

❌ **Malo:**
```typescript
trackError(error); // Sin contexto
```

### 4. Timing

✅ **Bueno:**
```typescript
const start = Date.now();
await loadData();
trackTiming('data_load', Date.now() - start, {
  records: data.length,
  cached: false,
});
```

❌ **Malo:**
```typescript
trackTiming('operation', 123); // Sin contexto
```

### 5. User Properties

```typescript
// Al login, set user properties
logger.setUser(user.id, {
  email: user.email,
  plan: user.subscription_plan,
  role: user.role,
  created_at: user.created_at,
});

// Al logout, clear
logger.clearUser();
```

---

## Ejemplos de Uso

### Ejemplo 1: Pantalla de Productos

```typescript
import { useDatadogTracking } from '@/hooks/useDatadogTracking';
import Analytics from '@/utils/analytics';
import { supabaseTracked } from '@/utils/supabaseWithTracking';

function ProductsScreen() {
  const { trackAction, trackError, trackTiming } =
    useDatadogTracking('ProductsScreen');

  const [products, setProducts] = useState([]);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const start = Date.now();

    try {
      // Esto se loguea automáticamente
      const { data, error } = await supabaseTracked
        .from('partner_products')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      setProducts(data);

      const duration = Date.now() - start;
      trackTiming('products_load', duration, {
        count: data.length,
      });

    } catch (error) {
      trackError(error, { operation: 'load_products' });
    }
  };

  const handleProductPress = (product) => {
    Analytics.trackProductView(product.id, product.name, product.price);
    router.push(`/products/${product.id}`);
  };

  const handleAddToCart = (product) => {
    trackAction('add_to_cart', { product_id: product.id });
    Analytics.trackAddToCart(product.id, product.name, product.price, 1);
    // ... add to cart logic
  };

  return (
    <FlatList
      data={products}
      renderItem={({ item }) => (
        <ProductCard
          product={item}
          onPress={() => handleProductPress(item)}
          onAddToCart={() => handleAddToCart(item)}
        />
      )}
    />
  );
}
```

### Ejemplo 2: Checkout Flow

```typescript
import Analytics from '@/utils/analytics';
import { useDatadogTracking } from '@/hooks/useDatadogTracking';

function CheckoutScreen() {
  const { trackAction, trackError } = useDatadogTracking('CheckoutScreen');
  const { cartItems, cartTotal } = useCart();

  useEffect(() => {
    // Track inicio de checkout
    Analytics.trackCheckoutStarted(cartTotal, cartItems.length);
  }, []);

  const handlePayment = async (paymentMethod) => {
    trackAction('payment_initiated', { method: paymentMethod });

    try {
      const order = await createOrder(cartItems, paymentMethod);

      // Track purchase exitoso
      Analytics.trackPurchase(
        order.id,
        order.total,
        cartItems.length,
        paymentMethod
      );

      router.push(`/payment/success?order=${order.id}`);

    } catch (error) {
      trackError(error, {
        step: 'payment',
        method: paymentMethod,
        cart_total: cartTotal,
      });

      Alert.alert('Error', 'No se pudo procesar el pago');
    }
  };

  return (
    <View>
      {/* UI del checkout */}
    </View>
  );
}
```

### Ejemplo 3: Form con Validación

```typescript
import { useFormTracking } from '@/hooks/useDatadogTracking';
import Analytics from '@/utils/analytics';

function RegistrationForm() {
  const { trackFieldInteraction, trackFieldError, trackSubmit } =
    useFormTracking('RegistrationForm');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const validateEmail = (value) => {
    if (!value.includes('@')) {
      trackFieldError('email', 'Invalid email format');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      trackSubmit(true);
      Analytics.trackSignup('email', true);

      router.push('/auth/confirm');

    } catch (error) {
      trackSubmit(false, error);
      Analytics.trackSignup('email', false);
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Email"
        value={email}
        onFocus={() => trackFieldInteraction('email')}
        onChangeText={(text) => {
          setEmail(text);
          validateEmail(text);
        }}
      />

      <TextInput
        placeholder="Password"
        value={password}
        secureTextEntry
        onFocus={() => trackFieldInteraction('password')}
        onChangeText={setPassword}
      />

      <Button title="Registrarse" onPress={handleSubmit} />
    </View>
  );
}
```

### Ejemplo 4: Feature Discovery

```typescript
import Analytics from '@/utils/analytics';

function NewFeatureBanner() {
  const [hasSeenFeature, setHasSeenFeature] = useState(false);

  useEffect(() => {
    if (!hasSeenFeature) {
      // Track que el usuario descubrió la feature
      Analytics.trackFeatureDiscovered('medical_records_sharing');
      setHasSeenFeature(true);
    }
  }, []);

  const handleTryFeature = () => {
    Analytics.trackFeatureUsed('medical_records_sharing', {
      source: 'banner',
    });

    router.push('/pets/share-medical-history');
  };

  return (
    <Banner
      title="Nueva función"
      message="Ahora puedes compartir registros médicos"
      onPress={handleTryFeature}
    />
  );
}
```

---

## Métricas Clave a Monitorear

### 1. Engagement
- Usuarios activos diarios (DAU)
- Usuarios activos mensuales (MAU)
- Sesiones por usuario
- Tiempo en app
- Pantallas por sesión

### 2. E-commerce
- Tasa de conversión (views → purchase)
- Valor promedio de orden
- Productos más vistos
- Abandono de carrito
- Métodos de pago populares

### 3. Features
- Adopción de features
- Tiempo para primera acción
- Features más usadas
- Features descubiertas vs usadas

### 4. Performance
- Tiempo de carga de pantallas
- Tiempo de respuesta de queries
- Errores por sesión
- Crash rate

### 5. Retención
- Retención día 1, 7, 30
- Churn rate
- Usuarios que regresan

---

## Alertas Recomendadas

### Alerta 1: Error Rate Alto

```
Condición: error_rate > 5% for 5 minutes
Notificar: Slack, Email
Severidad: High
```

### Alerta 2: Compras Fallando

```
Condición: purchase_error_rate > 10% for 10 minutes
Notificar: PagerDuty, Slack
Severidad: Critical
```

### Alerta 3: Queries Lentas

```
Condición: avg(query_duration) > 1000ms for 5 minutes
Notificar: Slack
Severidad: Medium
```

### Alerta 4: Usuarios Activos Bajos

```
Condición: active_users < 100 during peak_hours
Notificar: Email
Severidad: Low
```

---

## Troubleshooting

### No veo métricas en Datadog

1. Verifica que la app esté inicializada:
```typescript
// En app/_layout.tsx ya está configurado
logger.initialize();
```

2. Verifica el site correcto:
```typescript
// En utils/datadogLogger.ts
const DATADOG_SITE = 'us5.datadoghq.com'; // Debe ser US5
```

3. Verifica que estés en un build nativo (no Expo Go)

### Métricas duplicadas

- Usa `useCallback` para las funciones de tracking
- No trackees en cada render, solo en eventos específicos

### Queries no se loguean

- Usa `supabaseTracked` en lugar de `supabaseClient`
- O agrega tracking manual con `logger.info()`

---

## Recursos

- [Dashboard Datadog](https://us5.datadoghq.com/)
- [Documentación Datadog RUM](https://docs.datadoghq.com/real_user_monitoring/)
- [Código del logger](./utils/datadogLogger.ts)
- [Hooks de tracking](./hooks/useDatadogTracking.ts)
- [Servicio Analytics](./utils/analytics.ts)

---

¡Listo! Ahora puedes monitorear toda tu app desde Datadog y ver métricas detalladas como en el dashboard de Product Analytics.
