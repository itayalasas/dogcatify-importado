import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Modal, ActivityIndicator, Animated, AppState, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, ShoppingCart, Trash2, Plus, Minus, MapPin, ChevronDown, ChevronUp, CreditCard, X } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PaymentMethodModal } from '../../components/PaymentMethodModal';
import { MercadoPagoRedirectModal } from '../../components/MercadoPagoRedirectModal';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { createMultiPartnerOrder, openMercadoPagoPayment } from '../../utils/mercadoPago';
import { validateGamePromotion } from '../../utils/promotions';
import { GamePromoInput } from '../../components/GamePromoInput';
import { ScreenHeader, IconButton, EmptyState } from '../../components/ui';
import { colors, radius, spacing, typography, shadows, touchTarget } from '../../constants/theme';
import { formatPrice } from '../../components/shop/format';
import { supabaseClient } from '../../lib/supabase';

export default function Cart() {
  const { currentUser } = useAuth();
  const { cart, updateQuantity, removeFromCart, clearCart, getCartTotal, getCartSubtotalWithoutTax, getCartTaxAmount, getCartOriginalTotal, getCartDiscountAmount, appliedPromo, setAppliedPromo } = useCart();
  const [loading, setLoading] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [isAddressExpanded, setIsAddressExpanded] = useState(false);
  const [productStocks, setProductStocks] = useState<Record<string, number>>({});
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('Preparando tu pago con Mercado Pago');
  const progressAnim = useRef(new Animated.Value(0)).current;
  const isProcessingPayment = useRef(false); // Flag para saber si estamos procesando pago
  const [partnerInfo, setPartnerInfo] = useState<{
    has_shipping: boolean;
    shipping_cost: number;
    free_shipping_threshold: number;
    calle: string;
    barrio: string;
    city: string;
  } | null>(null);
  const [savedAddress, setSavedAddress] = useState({
    street: '',
    number: '',
    locality: '',
    department: '',
    codigo_postal: '',
    phone: ''
  });

  const cartStores = cart.reduce((stores, item) => {
    const partnerId = String(item.partnerId || '').trim();
    if (!partnerId) return stores;

    const existingStore = stores.find((store) => store.partnerId === partnerId);
    if (existingStore) {
      return stores;
    }

    stores.push({
      partnerId,
      partnerName: item.partnerName || 'Tienda',
    });
    return stores;
  }, [] as { partnerId: string; partnerName: string }[]);

  const hasMixedStores = cartStores.length > 1;
  const cartStoreLabel = cartStores.map((store) => store.partnerName).join(', ');
  const mixedStoreMessage = hasMixedStores
    ? `Tu carrito contiene productos de ${cartStoreLabel}. Solo podés comprar productos de una tienda por vez.`
    : '';
  const [newAddress, setNewAddress] = useState({
    street: '',
    number: '',
    locality: '',
    department: '',
    codigo_postal: '',
    phone: ''
  });

  useEffect(() => {
    if (currentUser) {
      loadUserAddress();
    }
  }, [currentUser]);

  // Cargar información del negocio (shipping)
  useEffect(() => {
    if (cart && cart.length > 0) {
      loadPartnerShippingInfo();
    }
  }, [cart]);

  // Cargar stocks de los productos en el carrito
  useEffect(() => {
    if (cart && cart.length > 0) {
      loadProductStocks();
    }
  }, [cart]);

  // Animar barra de progreso cuando se activa el loading
  useEffect(() => {
    if (paymentLoading) {
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 100,
        duration: 4500,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(0);
    }
  }, [paymentLoading]);

  // Recargar stocks y ocultar loader cada vez que la pantalla se enfoca (al volver desde Mercado Pago)
  useFocusEffect(
    React.useCallback(() => {
      console.log('📱 useFocusEffect triggered - isProcessingPayment:', isProcessingPayment.current);

      // CRÍTICO: NO ocultar el loader si estamos procesando pago
      if (isProcessingPayment.current) {
        console.log('⚠️ Estamos procesando pago, NO ocultar loader');
        return;
      }

      // CRÍTICO: Esperar 500ms antes de ocultar el loader para evitar que se oculte durante la apertura de MP
      // Esto permite que Mercado Pago se abra completamente antes de ocultar el loader
      const timer = setTimeout(() => {
        if (paymentLoading && !isProcessingPayment.current) {
          console.log('🔄 Usuario regresó a la pantalla del carrito, ocultando loader');
          setPaymentLoading(false);
          setPaymentMessage('Preparando tu pago con Mercado Pago');
        }
      }, 500);

      if (cart && cart.length > 0) {
        loadProductStocks();
      }

      return () => clearTimeout(timer);
    }, [cart, paymentLoading])
  );

  // NUEVO: Listener de AppState para detectar cuando la app vuelve al primer plano (iOS fix)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      console.log('📱 AppState changed to:', nextAppState);

      // Si la app vuelve al primer plano ('active') y el loader está visible
      if (nextAppState === 'active' && paymentLoading && !isProcessingPayment.current) {
        console.log('✅ iOS: App returned to foreground, hiding payment loader');

        // En iOS, agregar un pequeño delay para asegurar que la transición se complete
        const delay = Platform.OS === 'ios' ? 800 : 500;

        setTimeout(() => {
          setPaymentLoading(false);
          setPaymentMessage('Preparando tu pago con Mercado Pago');
        }, delay);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [paymentLoading]);

  const loadProductStocks = async () => {
    if (!cart || cart.length === 0) return;

    try {
      const productIds = cart.map(item => item.id);
      const { data, error } = await supabaseClient
        .from('partner_products')
        .select('id, stock')
        .in('id', productIds);

      if (data && !error) {
        const stocks: Record<string, number> = {};
        data.forEach(product => {
          stocks[product.id] = product.stock;
        });
        setProductStocks(stocks);
      }
    } catch (error) {
      console.error('Error loading product stocks:', error);
    }
  };

  const loadPartnerShippingInfo = async () => {
    if (!cart || cart.length === 0) return;

    if (hasMixedStores) {
      setPartnerInfo(null);
      return;
    }

    try {
      // Obtener el partner_id del primer producto (asumiendo mismo partner)
      const firstItem = cart[0];
      const { data: productData } = await supabaseClient
        .from('partner_products')
        .select('partner_id')
        .eq('id', firstItem.id)
        .maybeSingle();

      if (productData?.partner_id) {
        const { data: partnerData } = await supabaseClient
          .from('partners')
          .select('has_shipping, shipping_cost, calle, barrio, numero, codigo_postal, address')
          .eq('id', productData.partner_id)
          .maybeSingle();

        if (partnerData) {
          // Compose city/locality from available address fields
          const cityPart = partnerData.barrio || partnerData.codigo_postal || '';
          setPartnerInfo({
            has_shipping: partnerData.has_shipping || false,
            shipping_cost: partnerData.shipping_cost || 0,
            free_shipping_threshold: 0,
            calle: partnerData.calle || partnerData.address || '',
            barrio: partnerData.barrio || '',
            city: cityPart,
          });
        }
      }
    } catch (error) {
      console.error('Error loading partner shipping info:', error);
    }
  };

  const loadUserAddress = async () => {
    if (!currentUser) return;

    setLoadingAddress(true);
    try {
      // Primero intentamos cargar con JOIN a departments
      const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select(`
          calle,
          numero,
          address_locality,
          barrio,
          codigo_postal,
          address_phone,
          phone,
          department_id,
          departments (name)
        `)
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading address with departments:', error);
        // Si falla el JOIN, intentamos sin departments (fallback)
        const { data: profileSimple } = await supabaseClient
          .from('profiles')
          .select('calle, numero, address_locality, address_department, barrio, codigo_postal, address_phone, phone')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profileSimple) {
          const loadedAddress = {
            street: profileSimple.calle || '',
            number: profileSimple.numero || '',
            locality: profileSimple.barrio || profileSimple.address_locality || '',
            department: profileSimple.address_department || '',
            codigo_postal: profileSimple.codigo_postal || '',
            phone: profileSimple.address_phone || profileSimple.phone || ''
          };
          setSavedAddress(loadedAddress);
        }
        setLoadingAddress(false);
        return;
      }

      if (profile) {
        let departmentName = '';
        if (profile.departments) {
          if (Array.isArray(profile.departments) && profile.departments.length > 0) {
            departmentName = profile.departments[0]?.name || '';
          } else if (typeof profile.departments === 'object' && 'name' in profile.departments) {
            departmentName = (profile.departments as any).name || '';
          }
        }

        const loadedAddress = {
          street: profile.calle || '',
          number: profile.numero || '',
          locality: profile.barrio || profile.address_locality || '',
          department: departmentName,
          codigo_postal: profile.codigo_postal || '',
          phone: profile.address_phone || profile.phone || ''
        };
        setSavedAddress(loadedAddress);
      }
    } catch (error) {
      console.error('Error loading user address:', error);
    } finally {
      setLoadingAddress(false);
    }
  };

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim() || !currentUser) return;
    setIsApplyingPromo(true);
    setPromoError('');
    try {
      const promo = await validateGamePromotion(promoCodeInput.trim(), currentUser.id, 'products');
      if (promo) {
        setAppliedPromo(promo);
        setPromoCodeInput('');
      } else {
        setPromoError('Código inválido o ya utilizado');
      }
    } catch (e: any) {
      setPromoError(e.message || 'Error al validar el código');
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    // Validar contra el stock disponible
    const availableStock = productStocks[itemId];
    if (availableStock !== undefined && newQuantity > availableStock) {
      Alert.alert(
        'Stock insuficiente',
        'No hay más unidades disponibles de este producto.'
      );
      return;
    }

    updateQuantity(itemId, newQuantity, availableStock);
  };

  const handleShowPaymentMethods = () => {
    if (!currentUser) {
      Alert.alert('Iniciar sesión', 'Tenés que iniciar sesión para hacer una compra');
      return;
    }

    if (!cart || cart.length === 0) {
      Alert.alert('Error', 'Tu carrito está vacío');
      return;
    }

    if (hasMixedStores) {
      Alert.alert(
        'Solo una tienda por compra',
        'Tu carrito tiene productos de distintas tiendas. Vacialo y empezá una nueva compra con una sola tienda.',
        [
          { text: 'Vaciar carrito', style: 'destructive', onPress: clearCart },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
      return;
    }

    const addressToUse = useNewAddress ? newAddress : savedAddress;

    // Solo validar dirección si tiene envío
    if (partnerInfo?.has_shipping) {
      if (!addressToUse.street.trim() || !addressToUse.number.trim() || !addressToUse.locality.trim() || !addressToUse.department.trim()) {
        Alert.alert('Falta la dirección', 'Completá los campos obligatorios de la dirección: calle, número, localidad y departamento.');
        return;
      }
    }

    // Mostrar modal de métodos de pago
    setShowPaymentMethodModal(true);
  };

  const handlePayWithMercadoPago = async () => {
    console.log('💳 ========== INICIO handlePayWithMercadoPago ==========');

    // CRÍTICO: Activar flag de procesamiento para evitar que useFocusEffect oculte el loader
    isProcessingPayment.current = true;
    console.log('🚩 isProcessingPayment = true');

    // Cerrar el modal de pago para mostrar el loader en pantalla completa
    setShowPaymentMethodModal(false);
    console.log('✅ Modal de métodos de pago cerrado');

    setPaymentLoading(true);
    console.log('✅ paymentLoading = true, loader DEBE estar visible');

    setPaymentMessage('Preparando tu pago...');
    console.log('✅ Mensaje inicial establecido');

    // Guardar el tiempo de inicio para garantizar 5 segundos mínimos
    const startTime = Date.now();
    const MIN_LOADING_TIME = 5000; // 5 segundos
    console.log(`⏱️ Tiempo mínimo de loading: ${MIN_LOADING_TIME}ms`);

    try {
      console.log('=== Iniciando proceso de checkout ===');
      console.log('Cart items:', cart);
      console.log('Customer info:', currentUser);

      const addressToUse = useNewAddress ? newAddress : savedAddress;

      let fullAddress = '';

      if (partnerInfo?.has_shipping) {
        // Dirección del usuario para envío
        fullAddress = `${addressToUse.street} ${addressToUse.number}`;
        if (addressToUse.locality) fullAddress += `, ${addressToUse.locality}`;
        fullAddress += `, ${addressToUse.department}`;
        if (addressToUse.codigo_postal) fullAddress += ` - CP: ${addressToUse.codigo_postal}`;
        if (addressToUse.phone) fullAddress += ` - Tel: ${addressToUse.phone}`;
      } else {
        // Dirección de la tienda para retiro
        fullAddress = 'Retiro en tienda: ';
        if (partnerInfo?.calle) fullAddress += partnerInfo.calle;
        if (partnerInfo?.barrio) fullAddress += `, ${partnerInfo.barrio}`;
        if (partnerInfo?.city) fullAddress += `, ${partnerInfo.city}`;
      }

      console.log('Shipping address:', fullAddress);

      const totalShippingCost = getEffectiveShippingCost();

      // Esperar 800ms para que el loader sea visible
      await new Promise(resolve => setTimeout(resolve, 800));

      setPaymentMessage('Creando orden de compra...');

      const itemsWithPromoApplied = cart.map(item => {
        let newPrice = item.price;
        if (appliedPromo) {
          if (appliedPromo.discountPercent) {
            newPrice = item.price * (1 - appliedPromo.discountPercent / 100);
          } else if (appliedPromo.discountAmount) {
            const total = cart.reduce((t, i) => t + (i.price * i.quantity), 0);
            if (total > 0) {
              const ratio = (item.price * item.quantity) / total;
              const itemDiscount = appliedPromo.discountAmount * ratio;
              newPrice = Math.max(0, item.price - (itemDiscount / item.quantity));
            }
          }
        }
        return {
          ...item,
          price: newPrice,
          original_price: item.original_price || item.price,
          discount_percentage: appliedPromo?.discountPercent ? item.discount_percentage + appliedPromo.discountPercent : item.discount_percentage,
          game_promotion_id: appliedPromo?.id
        };
      });

      const { orders, paymentPreferences, isTestMode } = await createMultiPartnerOrder(
        itemsWithPromoApplied,
        currentUser,
        fullAddress,
        totalShippingCost
      );

      console.log('Orders created:', orders.length);
      console.log('Payment preferences created:', paymentPreferences.length);
      console.log('Environment detected:', isTestMode ? 'TEST' : 'PRODUCTION');

      if (paymentPreferences.length > 0) {
        const preference = paymentPreferences[0];

        let paymentUrl: string | undefined;

        if (isTestMode) {
          paymentUrl = preference.sandbox_init_point;
          if (!paymentUrl) {
            throw new Error('Mercado Pago no devolvió sandbox_init_point en modo prueba');
          }
        } else {
          paymentUrl = preference.init_point;
        }

        if (!paymentUrl) {
          throw new Error('No se pudo obtener la URL de pago');
        }

        console.log('✅ Orden creada exitosamente');
        console.log('URL de pago:', paymentUrl);

        // Detect environment from payment URL (same as services)
        const isTestModeByUrl = paymentUrl.includes('sandbox');

        setPaymentMessage('Abriendo Mercado Pago...');

        // Calcular tiempo restante para completar 5 segundos
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);

        if (remainingTime > 0) {
          console.log(`⏳ Esperando ${remainingTime}ms para completar tiempo mínimo de loading`);
          await new Promise(resolve => setTimeout(resolve, remainingTime));
        }

        // Open Mercado Pago directly (same as services)
        console.log('🚀 Abriendo Mercado Pago...');

        let openResult;
        try {
          openResult = await openMercadoPagoPayment(paymentUrl, isTestModeByUrl);
          console.log('📱 openMercadoPagoPayment completado:', openResult);
        } catch (openMPError: any) {
          console.error('❌ Exception al abrir Mercado Pago:', openMPError);
          openResult = {
            success: false,
            openedInApp: false,
            error: openMPError.message || 'No se pudo abrir Mercado Pago'
          };
        }

        if (!openResult.success) {
          console.error('❌ Error abriendo Mercado Pago');

          // CRÍTICO: Desactivar flag de procesamiento si falla
          isProcessingPayment.current = false;
          console.log('🚩 isProcessingPayment = false (error al abrir MP)');

          // CRÍTICO: Ocultar loader si falló al abrir
          setPaymentLoading(false);
          setPaymentMessage('Preparando tu pago con Mercado Pago');

          // Mostrar mensaje de error después de un momento
          setTimeout(() => {
            Alert.alert(
              'Error al abrir Mercado Pago',
              openResult.error || 'No se pudo abrir la pasarela de pago. Intentá nuevamente.',
              [
                { text: 'OK', style: 'default' }
              ]
            );
          }, 300);
        } else {
          console.log('✅ Mercado Pago abierto exitosamente');
          console.log('⏳ Loader DEBE permanecer visible hasta que el usuario regrese');

          // CRÍTICO: Desactivar flag de procesamiento DESPUÉS de abrir MP exitosamente
          // Esto permite que useFocusEffect oculte el loader cuando el usuario regrese
          isProcessingPayment.current = false;
          console.log('🚩 isProcessingPayment = false (MP abierto, esperando retorno del usuario)');

          // IMPORTANTE: NO ocultar el loader aquí, se ocultará automáticamente cuando el usuario vuelva a la app
          // El useFocusEffect se encarga de ocultar el loader cuando regresa
          // El loader DEBE quedar visible para mostrar que la transacción está en proceso
        }
      } else {
        throw new Error('No se pudo crear la preferencia de pago');
      }
    } catch (error: any) {
      console.error('❌ Error with cart checkout:', error);

      // CRÍTICO: Desactivar flag de procesamiento si hay error
      isProcessingPayment.current = false;
      console.log('🚩 isProcessingPayment = false (error en checkout)');

      // CRÍTICO: Ocultar loader inmediatamente
      setPaymentLoading(false);
      setPaymentMessage('Preparando tu pago con Mercado Pago');

      let errorMessage = 'No se pudo procesar tu pedido';
      if (error.message) {
        errorMessage = error.message;
      }

      // Esperar para asegurar que el loader se oculte completamente
      setTimeout(() => {
        Alert.alert(
          'Error al procesar el pago',
          errorMessage + '\n\nVerificá que haya productos disponibles e intentá nuevamente.',
          [
            { text: 'Reintentar', onPress: () => {
              setShowPaymentMethodModal(true);
            }},
            { text: 'Cancelar', style: 'cancel' }
          ]
        );
      }, 300);
    } finally {
      // Solo ocultar loader si todavía está visible
      if (paymentLoading) {
        setPaymentLoading(false);
        setPaymentMessage('Preparando tu pago con Mercado Pago');
      }
    }
  };

  const formatCurrency = (amount: number) => formatPrice(amount);

  const getEffectiveShippingCost = () => {
    if (!partnerInfo?.has_shipping) return 0;

    const shippingCost = Number(partnerInfo.shipping_cost || 0);
    const threshold = Number(partnerInfo.free_shipping_threshold || 0);
    const cartTotal = Number(getCartTotal() || 0);

    if (threshold > 0 && cartTotal >= threshold) {
      return 0;
    }

    return shippingCost;
  };

  const hasFreeShippingApplied = () => {
    if (!partnerInfo?.has_shipping) return false;

    const threshold = Number(partnerInfo.free_shipping_threshold || 0);
    return threshold > 0 && Number(getCartTotal() || 0) >= threshold;
  };

  const getCompactAddress = () => {
    const addr = useNewAddress ? newAddress : savedAddress;
    if (!addr.street && !addr.number) return null;

    let compact = `${addr.street} ${addr.number}`;
    if (addr.locality) compact += `, ${addr.locality}`;
    return compact;
  };

  const hasPartialAddress = () => {
    const addr = useNewAddress ? newAddress : savedAddress;
    return !!(addr.street || addr.number || addr.locality);
  };

  const hasCompleteAddress = () => {
    const addr = useNewAddress ? newAddress : savedAddress;
    return !!(addr.street && addr.number && addr.locality && addr.department);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Mi carrito"
        right={cart && cart.length > 0 ? (
          <IconButton
            icon={<Trash2 size={22} color={colors.textSecondary} />}
            accessibilityLabel="Vaciar carrito"
            onPress={() => {
              Alert.alert(
                'Vaciar carrito',
                '¿Querés vaciar tu carrito?',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Vaciar', style: 'destructive', onPress: clearCart }
                ]
              );
            }}
          />
        ) : undefined}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={cart && cart.length > 0 ? styles.contentWithBar : styles.contentEmpty}
        showsVerticalScrollIndicator={false}
      >
        {!cart || cart.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart size={32} color={colors.primary} />}
            title="Tu carrito está vacío"
            description="Agregá productos de la tienda para empezar tu compra."
            actionLabel="Ir a la tienda"
            onAction={() => router.push('/(tabs)/shop')}
          />
        ) : (
          <>
            <View style={styles.itemsContainer}>
              {cart.map((item) => {
                const availableStock = productStocks[item.id];
                const canIncreaseQuantity = availableStock === undefined || item.quantity < availableStock;

                return (
                  <Card key={item.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <Image
                        source={{ uri: item.image || 'https://images.pexels.com/photos/1459244/pexels-photo-1459244.jpeg?auto=compress&cs=tinysrgb&w=400' }}
                        style={styles.itemImage}
                      />
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                        <Text style={styles.itemPartner} numberOfLines={1}>{item.partnerName}</Text>
                        {availableStock !== undefined && availableStock <= 5 && (
                          <Text style={[styles.stockInfo, availableStock <= 0 && styles.stockInfoEmpty]}>
                            {availableStock <= 0 ? 'Sin stock' : 'Últimas unidades'}
                          </Text>
                        )}
                        {item.discount_percentage > 0 ? (
                          <View style={styles.priceContainer}>
                            <Text style={styles.originalPrice}>
                              {formatCurrency(item.original_price || item.price)}
                            </Text>
                            <View style={styles.discountBadge}>
                              <Text style={styles.discountText}>{item.discount_percentage}% OFF</Text>
                            </View>
                          </View>
                        ) : null}
                        <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
                      </View>
                      <View style={styles.quantityControls}>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          accessibilityRole="button"
                          accessibilityLabel={item.quantity <= 1 ? `Quitar ${item.name} del carrito` : `Restar una unidad de ${item.name}`}
                        >
                          <Minus size={16} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.quantityText} accessibilityLabel={`Cantidad: ${item.quantity}`}>{item.quantity}</Text>
                        <TouchableOpacity
                          style={[styles.quantityButton, !canIncreaseQuantity && styles.quantityButtonDisabled]}
                          onPress={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          disabled={!canIncreaseQuantity}
                          accessibilityRole="button"
                          accessibilityLabel={`Sumar una unidad de ${item.name}`}
                          accessibilityState={{ disabled: !canIncreaseQuantity }}
                        >
                          <Plus size={16} color={canIncreaseQuantity ? colors.text : colors.textDisabled} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  
                  <View style={styles.itemFooter}>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeFromCart(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Eliminar ${item.name} del carrito`}
                    >
                      <Trash2 size={16} color={colors.danger} />
                      <Text style={styles.removeButtonText}>Eliminar</Text>
                    </TouchableOpacity>
                    <Text style={styles.itemTotal}>
                      {formatCurrency(item.price * item.quantity)}
                    </Text>
                  </View>
                </Card>
                );
              })}
            </View>

            <Card style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Resumen del pedido</Text>
              {/* Sección promociones globales del juego */}
              <GamePromoInput
                promoCode={promoCodeInput}
                onChangeCode={text => { setPromoCodeInput(text); setPromoError(''); }}
                isApplying={isApplyingPromo}
                errorMessage={promoError}
                appliedPromo={appliedPromo}
                onApply={handleApplyPromo}
                onRemove={() => setAppliedPromo(null)}
                formatCurrency={formatCurrency}
              />
              <View style={styles.divider} />
              
              {/* Mostrar descuento si existe alguno en el carrito */}
              {getCartDiscountAmount() > 0 && (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal sin descuento</Text>
                    <Text style={styles.summaryValue}>
                      {formatCurrency(getCartOriginalTotal())}
                    </Text>
                  </View>
                  
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.success }]}>Descuento</Text>
                    <Text style={[styles.summaryValue, { color: colors.success }]}>
                      -{formatCurrency(getCartDiscountAmount())}
                    </Text>
                  </View>
                  
                  <View style={styles.divider} />
                </>
              )}
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal (sin IVA)</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(getCartSubtotalWithoutTax())}
                </Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>IVA (22%)</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(getCartTaxAmount())}
                </Text>
              </View>
              
              {hasMixedStores ? (
                <View style={styles.mixedStoreWarning}>
                  <Text style={styles.mixedStoreWarningTitle}>Solo una tienda por compra</Text>
                  <Text style={styles.mixedStoreWarningText}>
                    {mixedStoreMessage || 'Vaciá el carrito para continuar con productos de una sola tienda.'}
                  </Text>
                  <View style={styles.mixedStoreWarningActions}>
                    <View style={styles.mixedStoreWarningAction}>
                      <Button
                        title="Vaciar carrito"
                        onPress={clearCart}
                        variant="outline"
                        size="medium"
                      />
                    </View>
                    <View style={styles.mixedStoreWarningAction}>
                      <Button
                        title="Seguir comprando"
                        onPress={() => router.push('/(tabs)/shop')}
                        size="medium"
                      />
                    </View>
                  </View>
                </View>
              ) : partnerInfo?.has_shipping ? (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Envío</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(getEffectiveShippingCost())}</Text>
                  </View>
                  {hasFreeShippingApplied() && (
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: colors.success }]}>Beneficio</Text>
                      <Text style={[styles.summaryValue, { color: colors.success }]}>Envío gratis aplicado</Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.pickupNotice}>
                  <Text style={styles.pickupNoticeText}>Retiro en tienda</Text>
                </View>
              )}

              <View style={styles.divider} />

              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(getCartTotal() + getEffectiveShippingCost())}
                </Text>
              </View>

              <View style={styles.divider} />

              {/* Dirección de envío colapsable */}
              <TouchableOpacity
                style={styles.addressHeader}
                onPress={() => setIsAddressExpanded(!isAddressExpanded)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isAddressExpanded }}
                accessibilityHint={isAddressExpanded ? 'Oculta la dirección' : 'Muestra y edita la dirección'}
              >
                <View style={styles.addressHeaderLeft}>
                  <MapPin size={20} color={colors.primary} />
                  <View style={styles.addressHeaderText}>
                    <Text style={styles.addressHeaderTitle}>
                      {partnerInfo?.has_shipping ? 'Dirección de envío' : 'Dirección de retiro'}
                    </Text>
                    {!loadingAddress && !isAddressExpanded && (
                      <>
                        {hasPartialAddress() && getCompactAddress() && (
                          <Text style={styles.addressHeaderSubtitle} numberOfLines={1}>
                            {getCompactAddress()}
                          </Text>
                        )}
                        {!hasCompleteAddress() && (
                          <Text style={styles.addressHeaderWarning}>
                            {hasPartialAddress() ? 'Falta completar el departamento' : 'Falta completar la dirección'}
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                </View>
                {isAddressExpanded ? (
                  <ChevronUp size={20} color={colors.textSecondary} />
                ) : (
                  <ChevronDown size={20} color={colors.textSecondary} />
                )}
              </TouchableOpacity>

              {isAddressExpanded && (
                <View style={styles.addressExpandedContent}>
                  {!partnerInfo?.has_shipping && partnerInfo ? (
                    // Mostrar dirección de la tienda
                    <View style={styles.storeAddressContainer}>
                      <Text style={styles.storeAddressTitle}>Dirección de retiro</Text>
                      <Text style={styles.storeAddressText}>
                        {partnerInfo.calle}
                        {partnerInfo.barrio ? `, ${partnerInfo.barrio}` : ''}
                        {partnerInfo.city ? `, ${partnerInfo.city}` : ''}
                      </Text>
                      <Text style={styles.storeAddressNote}>
                        Podés retirar tu pedido una vez confirmado el pago.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.checkboxContainer}
                        onPress={() => setUseNewAddress(!useNewAddress)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: useNewAddress }}
                      >
                        <View style={[styles.checkbox, useNewAddress && styles.checkboxChecked]}>
                          {useNewAddress && <Text style={styles.checkboxMark}>✓</Text>}
                        </View>
                        <Text style={styles.checkboxLabel}>Usar dirección diferente</Text>
                      </TouchableOpacity>

                      {loadingAddress ? (
                        <Text style={styles.loadingText}>Cargando dirección...</Text>
                      ) : (
                        <View style={styles.addressForm}>
                      <View style={styles.addressRow}>
                        <View style={styles.addressFieldLarge}>
                          <Input
                            placeholder="Calle *"
                            value={useNewAddress ? newAddress.street : savedAddress.street}
                            onChangeText={(text) => {
                              if (useNewAddress) {
                                setNewAddress({ ...newAddress, street: text });
                              }
                            }}
                            editable={useNewAddress}
                          />
                        </View>
                        <View style={styles.addressFieldSmall}>
                          <Input
                            placeholder="Número *"
                            value={useNewAddress ? newAddress.number : savedAddress.number}
                            onChangeText={(text) => {
                              if (useNewAddress) {
                                setNewAddress({ ...newAddress, number: text });
                              }
                            }}
                            editable={useNewAddress}
                          />
                        </View>
                      </View>

                      <Input
                        placeholder="Barrio/Localidad *"
                        value={useNewAddress ? newAddress.locality : savedAddress.locality}
                        onChangeText={(text) => {
                          if (useNewAddress) {
                            setNewAddress({ ...newAddress, locality: text });
                          }
                        }}
                        editable={useNewAddress}
                        style={styles.addressInput}
                      />

                      <Input
                        placeholder="Departamento *"
                        value={useNewAddress ? newAddress.department : savedAddress.department}
                        onChangeText={(text) => {
                          if (useNewAddress) {
                            setNewAddress({ ...newAddress, department: text });
                          }
                        }}
                        editable={useNewAddress}
                        style={styles.addressInput}
                      />

                      <Input
                        placeholder="Código Postal (opcional)"
                        value={useNewAddress ? newAddress.codigo_postal : savedAddress.codigo_postal}
                        onChangeText={(text) => {
                          if (useNewAddress) {
                            setNewAddress({ ...newAddress, codigo_postal: text });
                          }
                        }}
                        editable={useNewAddress}
                        keyboardType="numeric"
                        style={styles.addressInput}
                      />

                      <Input
                        placeholder="Teléfono de contacto"
                        value={useNewAddress ? newAddress.phone : savedAddress.phone}
                        onChangeText={(text) => {
                          if (useNewAddress) {
                            setNewAddress({ ...newAddress, phone: text });
                          }
                        }}
                        editable={useNewAddress}
                        keyboardType="phone-pad"
                        style={styles.addressInput}
                      />

                      {!useNewAddress && !savedAddress.street && !savedAddress.number && (
                        <View style={styles.noAddressContainer}>
                          <Text style={styles.noAddressText}>
                            No tenés una dirección guardada. Marcá &quot;Usar dirección diferente&quot; para ingresar una.
                          </Text>
                        </View>
                      )}
                        </View>
                      )}
                    </>
                  )}
                </View>
              )}
            </Card>
          </>
        )}
      </ScrollView>

      {cart && cart.length > 0 ? (
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarTotal}>
            <Text style={styles.bottomBarLabel}>Total</Text>
            <Text style={styles.bottomBarValue} numberOfLines={1}>
              {formatCurrency(getCartTotal() + getEffectiveShippingCost())}
            </Text>
          </View>
          <View style={styles.bottomBarAction}>
            <Button
              title={loading ? 'Procesando...' : 'Pagar'}
              onPress={handleShowPaymentMethods}
              loading={loading}
              size="large"
              disabled={!currentUser}
            />
          </View>
        </View>
      ) : null}

      <PaymentMethodModal
        visible={showPaymentMethodModal}
        totalLabel={formatCurrency(getCartTotal() + getEffectiveShippingCost())}
        onClose={() => setShowPaymentMethodModal(false)}
        onMercadoPago={handlePayWithMercadoPago}
        loadingMercadoPago={paymentLoading}
        secureNote="Serás redirigido para completar el pago de forma segura"
      />

      <MercadoPagoRedirectModal
        visible={paymentLoading}
        message={paymentMessage}
        progress={progressAnim}
        hint="Serás redirigido a Mercado Pago"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartButton: {
    position: 'relative',
    padding: 6,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentWithBar: {
    paddingBottom: spacing.xxl,
  },
  contentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...shadows.lg,
  },
  bottomBarTotal: {
    flexShrink: 1,
  },
  bottomBarLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  bottomBarValue: {
    ...typography.heading,
    color: colors.text,
  },
  bottomBarAction: {
    flex: 1,
  },
  stockInfoEmpty: {
    color: colors.danger,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 60,
    margin: spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    lineHeight: 24,
  },
  itemsContainer: {
    padding: spacing.lg,
  },
  itemCard: {
    marginBottom: spacing.md,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  itemImage: {
    width: 72,
    height: 72,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    marginRight: spacing.md,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  itemPartner: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  stockInfo: {
    ...typography.captionStrong,
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxs,
    gap: spacing.sm,
  },
  originalPrice: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 6,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
  },
  discountText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: colors.white,
  },
  itemPrice: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
  },
  quantityButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityText: {
    ...typography.bodyStrong,
    color: colors.text,
    marginHorizontal: spacing.xs,
    minWidth: 20,
    textAlign: 'center',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTarget,
  },
  removeButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.danger,
    marginLeft: spacing.xs,
  },
  itemTotal: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: colors.text,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTarget,
    paddingVertical: spacing.md,
  },
  addressHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  addressHeaderText: {
    flex: 1,
  },
  addressHeaderTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  addressHeaderSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  addressHeaderWarning: {
    ...typography.captionStrong,
    color: colors.warning,
  },
  addressExpandedContent: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTarget,
    marginTop: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxMark: {
    color: colors.white,
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  checkboxLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  addressForm: {
    gap: spacing.md,
  },
  addressRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  addressFieldLarge: {
    flex: 3,
  },
  addressFieldSmall: {
    flex: 1,
  },
  addressInput: {
    marginBottom: 0,
  },
  noAddressContainer: {
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  noAddressText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.warning,
    textAlign: 'center',
  },
  mixedStoreWarning: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xs,
  },
  mixedStoreWarningTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.warning,
    marginBottom: spacing.sm,
  },
  mixedStoreWarningText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.warning,
    lineHeight: 20,
  },
  mixedStoreWarningActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  mixedStoreWarningAction: {
    flex: 1,
  },
  summaryCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  totalValue: {
    ...typography.heading,
    color: colors.text,
  },
  actionsContainer: {
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    minHeight: 450,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  closeButton: {
    padding: spacing.xs,
  },
  methodsContent: {
    padding: spacing.xl,
  },
  methodsHeader: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  mercadoPagoIcon: {
    width: 48,
    height: 48,
  },
  methodsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  methodsSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: colors.success,
    marginTop: spacing.xs,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  disabledMethod: {
    opacity: 0.5,
  },
  paymentMethodIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  paymentMethodDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  paymentNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 16,
  },
  pickupNotice: {
    backgroundColor: colors.primaryMuted,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    marginVertical: spacing.xs,
  },
  pickupNoticeText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.primaryStrong,
    textAlign: 'center',
  },
  storeAddressContainer: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storeAddressTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  storeAddressText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: colors.text,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  storeAddressNote: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});







