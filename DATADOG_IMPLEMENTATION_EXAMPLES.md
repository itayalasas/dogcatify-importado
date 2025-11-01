# Ejemplos de Implementación - Datadog Tracking

Este documento muestra cómo agregar tracking de Datadog a pantallas existentes de la aplicación.

## Ejemplo 1: Agregar Tracking a la Pantalla de Tienda

### Antes (sin tracking)

```typescript
// app/(tabs)/shop.tsx - ANTES
import { supabaseClient } from '@/lib/supabase';

function ShopScreen() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const { data } = await supabaseClient
      .from('partner_products')
      .select('*')
      .eq('is_active', true);

    setProducts(data || []);
  };

  return (
    <FlatList
      data={products}
      renderItem={({ item }) => (
        <ProductCard
          product={item}
          onPress={() => router.push(`/products/${item.id}`)}
        />
      )}
    />
  );
}
```

### Después (con tracking completo)

```typescript
// app/(tabs)/shop.tsx - DESPUÉS
import { useDatadogTracking } from '@/hooks/useDatadogTracking';
import Analytics from '@/utils/analytics';
import { supabaseTracked } from '@/utils/supabaseWithTracking';

function ShopScreen() {
  const { trackAction, trackError, trackTiming, trackInteraction } =
    useDatadogTracking('ShopScreen');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const start = Date.now();

    try {
      // Usa supabaseTracked para logging automático
      const { data, error } = await supabaseTracked
        .from('partner_products')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      setProducts(data || []);

      // Track timing de la carga
      const duration = Date.now() - start;
      trackTiming('products_load', duration, {
        count: data?.length || 0,
        cached: false,
      });

    } catch (error) {
      trackError(error, {
        operation: 'load_products',
        retry_count: 0,
      });

      Alert.alert('Error', 'No se pudieron cargar los productos');
    } finally {
      setLoading(false);
    }
  };

  const handleProductPress = (product) => {
    // Track view del producto
    Analytics.trackProductView(product.id, product.name, product.price);

    // Track navegación
    trackAction('navigate_to_product', {
      product_id: product.id,
      product_name: product.name,
    });

    router.push(`/products/${item.id}`);
  };

  const handleScroll = () => {
    // Track scroll (puede ayudar a entender engagement)
    trackInteraction('product_list', 'scroll');
  };

  return (
    <FlatList
      data={products}
      renderItem={({ item }) => (
        <ProductCard
          product={item}
          onPress={() => handleProductPress(item)}
        />
      )}
      onScroll={handleScroll}
      scrollEventThrottle={1000} // Solo trackear cada segundo
    />
  );
}
```

## Ejemplo 2: Pantalla de Detalle de Producto con Add to Cart

### Implementación Completa

```typescript
// app/products/[id].tsx
import { useDatadogTracking } from '@/hooks/useDatadogTracking';
import Analytics from '@/utils/analytics';
import { supabaseTracked } from '@/utils/supabaseWithTracking';
import { useCart } from '@/contexts/CartContext';

function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const { trackAction, trackError, trackTiming } =
    useDatadogTracking('ProductDetailScreen');

  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    const start = Date.now();

    try {
      const { data, error } = await supabaseTracked
        .from('partner_products')
        .select('*, partner:partners(name, rating)')
        .eq('id', id)
        .single();

      if (error) throw error;

      setProduct(data);

      // Track view del producto (ya cargado)
      Analytics.trackProductView(data.id, data.name, data.price);

      trackTiming('product_load', Date.now() - start);

    } catch (error) {
      trackError(error, { product_id: id });
    }
  };

  const handleAddToCart = () => {
    // Track antes de agregar
    trackAction('add_to_cart_clicked', {
      product_id: product.id,
      quantity,
    });

    try {
      addToCart(product, quantity);

      // Track en Analytics para funnel de e-commerce
      Analytics.trackAddToCart(
        product.id,
        product.name,
        product.price,
        quantity
      );

      // Feedback visual
      Alert.alert('Éxito', 'Producto agregado al carrito');

    } catch (error) {
      trackError(error, {
        operation: 'add_to_cart',
        product_id: product.id,
      });

      Alert.alert('Error', 'No se pudo agregar al carrito');
    }
  };

  const handleShareProduct = async () => {
    trackAction('share_product_clicked', {
      product_id: product.id,
    });

    try {
      await Share.share({
        message: `Mira este producto: ${product.name}`,
        url: `https://dogcatify.app/products/${product.id}`,
      });

      // Track el share
      Analytics.trackShare('product', product.id, 'native_share');

    } catch (error) {
      trackError(error, { operation: 'share_product' });
    }
  };

  if (!product) {
    return <LoadingScreen />;
  }

  return (
    <ScrollView>
      <Image source={{ uri: product.image_url }} style={styles.image} />

      <Text style={styles.title}>{product.name}</Text>
      <Text style={styles.price}>${product.price}</Text>

      <View style={styles.quantitySelector}>
        <Button
          title="-"
          onPress={() => {
            setQuantity(Math.max(1, quantity - 1));
            trackInteraction('quantity_button', 'tap');
          }}
        />
        <Text>{quantity}</Text>
        <Button
          title="+"
          onPress={() => {
            setQuantity(quantity + 1);
            trackInteraction('quantity_button', 'tap');
          }}
        />
      </View>

      <Button
        title="Agregar al Carrito"
        onPress={handleAddToCart}
      />

      <Button
        title="Compartir"
        onPress={handleShareProduct}
      />
    </ScrollView>
  );
}
```

## Ejemplo 3: Checkout con Tracking de Funnel

```typescript
// app/cart/checkout.tsx
import { useDatadogTracking } from '@/hooks/useDatadogTracking';
import { useFormTracking } from '@/hooks/useDatadogTracking';
import Analytics from '@/utils/analytics';
import { supabaseTracked } from '@/utils/supabaseWithTracking';

function CheckoutScreen() {
  const { trackAction, trackError } = useDatadogTracking('CheckoutScreen');
  const { trackFieldInteraction, trackFieldError, trackSubmit } =
    useFormTracking('CheckoutForm');

  const { cartItems, cartTotal, clearCart } = useCart();
  const { user } = useAuth();

  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mercadopago');

  useEffect(() => {
    // Track inicio del checkout
    Analytics.trackCheckoutStarted(cartTotal, cartItems.length);

    trackAction('checkout_viewed', {
      cart_total: cartTotal,
      item_count: cartItems.length,
      user_id: user?.id,
    });
  }, []);

  const validateFields = () => {
    let isValid = true;

    if (!address || address.length < 10) {
      trackFieldError('address', 'Address too short');
      isValid = false;
    }

    if (!phone || phone.length < 8) {
      trackFieldError('phone', 'Invalid phone');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateFields()) {
      trackAction('checkout_validation_failed');
      return;
    }

    trackAction('checkout_submit_clicked', {
      payment_method: paymentMethod,
      cart_total: cartTotal,
    });

    const start = Date.now();

    try {
      // Crear orden
      const { data: order, error } = await supabaseTracked
        .from('orders')
        .insert({
          user_id: user.id,
          total_amount: cartTotal,
          delivery_address: address,
          phone,
          payment_method: paymentMethod,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Crear items de orden
      const orderItems = cartItems.map(item => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        price: item.price,
      }));

      await supabaseTracked
        .from('order_items')
        .insert(orderItems);

      // Track purchase exitoso
      const duration = Date.now() - start;

      Analytics.trackPurchase(
        order.id,
        cartTotal,
        cartItems.length,
        paymentMethod
      );

      trackSubmit(true);
      trackAction('checkout_completed', {
        order_id: order.id,
        duration,
      });

      // Limpiar carrito y navegar
      clearCart();
      router.push(`/orders/${order.id}`);

    } catch (error) {
      trackSubmit(false, error);
      trackError(error, {
        step: 'order_creation',
        cart_total: cartTotal,
        payment_method: paymentMethod,
      });

      Alert.alert('Error', 'No se pudo completar la orden');
    }
  };

  return (
    <ScrollView>
      <Text style={styles.title}>Finalizar Compra</Text>

      <TextInput
        placeholder="Dirección de entrega"
        value={address}
        onFocus={() => trackFieldInteraction('address')}
        onChangeText={setAddress}
        style={styles.input}
      />

      <TextInput
        placeholder="Teléfono"
        value={phone}
        onFocus={() => trackFieldInteraction('phone')}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={styles.input}
      />

      <View style={styles.paymentMethods}>
        <Text>Método de Pago:</Text>
        {['mercadopago', 'cash', 'card'].map(method => (
          <Button
            key={method}
            title={method}
            onPress={() => {
              setPaymentMethod(method);
              trackAction('payment_method_selected', {
                method,
              });
            }}
          />
        ))}
      </View>

      <View style={styles.summary}>
        <Text>Total: ${cartTotal}</Text>
        <Text>{cartItems.length} items</Text>
      </View>

      <Button
        title="Confirmar Orden"
        onPress={handleSubmit}
        style={styles.submitButton}
      />
    </ScrollView>
  );
}
```

## Ejemplo 4: Service Booking con Tracking

```typescript
// app/services/booking/[serviceId].tsx
import { useDatadogTracking } from '@/hooks/useDatadogTracking';
import { useFormTracking } from '@/hooks/useDatadogTracking';
import Analytics from '@/utils/analytics';
import { supabaseTracked } from '@/utils/supabaseWithTracking';

function BookingScreen() {
  const { serviceId } = useLocalSearchParams();
  const { trackAction, trackError, trackTiming } =
    useDatadogTracking('BookingScreen');
  const { trackFieldInteraction, trackSubmit } =
    useFormTracking('BookingForm');

  const { user } = useAuth();
  const [service, setService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedPet, setSelectedPet] = useState(null);

  useEffect(() => {
    loadService();
  }, [serviceId]);

  const loadService = async () => {
    const start = Date.now();

    try {
      const { data, error } = await supabaseTracked
        .from('partner_services')
        .select('*, partner:partners(*)')
        .eq('id', serviceId)
        .single();

      if (error) throw error;

      setService(data);

      // Track view del servicio
      Analytics.trackServiceView(data.id, data.name, data.price);

      trackTiming('service_load', Date.now() - start);

    } catch (error) {
      trackError(error, { service_id: serviceId });
    }
  };

  useEffect(() => {
    if (service) {
      // Track inicio del booking
      Analytics.trackBookingStarted(service.id, service.name);
      trackAction('booking_started', {
        service_id: service.id,
        service_name: service.name,
      });
    }
  }, [service]);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    trackFieldInteraction('date');
    trackAction('date_selected', {
      date: date.toISOString(),
    });
  };

  const handlePetSelect = (pet) => {
    setSelectedPet(pet);
    trackFieldInteraction('pet');
    trackAction('pet_selected', {
      pet_id: pet.id,
      species: pet.species,
    });
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedPet) {
      trackAction('booking_validation_failed', {
        has_date: !!selectedDate,
        has_pet: !!selectedPet,
      });
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }

    const start = Date.now();

    try {
      const { data: booking, error } = await supabaseTracked
        .from('bookings')
        .insert({
          user_id: user.id,
          service_id: service.id,
          pet_id: selectedPet.id,
          booking_date: selectedDate.toISOString(),
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      const duration = Date.now() - start;

      // Track booking exitoso
      Analytics.trackBookingCompleted(
        booking.id,
        service.id,
        service.name,
        selectedDate.toISOString()
      );

      trackSubmit(true);
      trackAction('booking_completed', {
        booking_id: booking.id,
        duration,
      });

      router.push(`/partner/bookings/${booking.id}`);

    } catch (error) {
      trackSubmit(false, error);
      trackError(error, {
        service_id: service.id,
        selected_date: selectedDate?.toISOString(),
      });

      Alert.alert('Error', 'No se pudo crear la reserva');
    }
  };

  return (
    <ScrollView>
      <Text style={styles.title}>{service?.name}</Text>
      <Text style={styles.price}>${service?.price}</Text>

      <DatePicker
        value={selectedDate}
        onChange={handleDateSelect}
      />

      <PetSelector
        value={selectedPet}
        onSelect={handlePetSelect}
      />

      <Button
        title="Confirmar Reserva"
        onPress={handleSubmit}
      />
    </ScrollView>
  );
}
```

## Ejemplo 5: Login Screen con Tracking de Autenticación

```typescript
// app/auth/login.tsx
import { useDatadogTracking } from '@/hooks/useDatadogTracking';
import { useFormTracking } from '@/hooks/useDatadogTracking';
import Analytics from '@/utils/analytics';
import { logger } from '@/utils/datadogLogger';

function LoginScreen() {
  const { trackAction, trackError } = useDatadogTracking('LoginScreen');
  const { trackFieldInteraction, trackFieldError, trackSubmit } =
    useFormTracking('LoginForm');

  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    trackAction('login_button_clicked');

    const start = Date.now();

    try {
      const { data, error } = await signIn(email, password);

      if (error) throw error;

      const duration = Date.now() - start;

      // Set user en Datadog
      logger.setUser(data.user.id, {
        email: data.user.email,
        created_at: data.user.created_at,
      });

      // Track login exitoso
      Analytics.trackLogin('email', true);
      trackSubmit(true);
      trackAction('login_completed', {
        duration,
        user_id: data.user.id,
      });

      router.replace('/(tabs)');

    } catch (error) {
      const duration = Date.now() - start;

      // Track login fallido
      Analytics.trackLogin('email', false);
      trackSubmit(false, error);
      trackError(error, {
        duration,
        email_provided: !!email,
        password_length: password.length,
      });

      Alert.alert('Error', 'Credenciales inválidas');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Email"
        value={email}
        onFocus={() => trackFieldInteraction('email')}
        onChangeText={(text) => {
          setEmail(text);
          if (!text.includes('@')) {
            trackFieldError('email', 'Invalid email format');
          }
        }}
      />

      <TextInput
        placeholder="Password"
        value={password}
        secureTextEntry
        onFocus={() => trackFieldInteraction('password')}
        onChangeText={setPassword}
      />

      <Button
        title="Iniciar Sesión"
        onPress={handleLogin}
      />

      <Button
        title="¿Olvidaste tu contraseña?"
        onPress={() => {
          trackAction('forgot_password_clicked');
          router.push('/auth/forgot-password');
        }}
      />
    </View>
  );
}
```

## Resumen de Cambios

Para agregar tracking a cualquier pantalla:

1. **Importar hooks y servicios:**
```typescript
import { useDatadogTracking } from '@/hooks/useDatadogTracking';
import Analytics from '@/utils/analytics';
import { supabaseTracked } from '@/utils/supabaseWithTracking';
```

2. **Inicializar tracking en el componente:**
```typescript
const { trackAction, trackError, trackTiming } =
  useDatadogTracking('ScreenName');
```

3. **Reemplazar cliente de Supabase:**
```typescript
// Antes: supabaseClient
// Después: supabaseTracked
```

4. **Agregar tracking de eventos:**
```typescript
// Navegación
trackAction('navigate_to_x', { params });

// Interacciones
trackInteraction('button', 'tap');

// Analytics de negocio
Analytics.trackProductView(id, name, price);

// Errores
trackError(error, { context });

// Timing
trackTiming('operation', duration, { details });
```

5. **Track formularios (si aplica):**
```typescript
const { trackFieldInteraction, trackSubmit } =
  useFormTracking('FormName');
```

¡Y eso es todo! Ahora verás todas estas métricas en tu dashboard de Datadog.
