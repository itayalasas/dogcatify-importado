import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Modal, ActivityIndicator, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { ArrowLeft, ShoppingCart, Trash2, Plus, Minus, MapPin, ChevronDown, ChevronUp, CreditCard, X } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { createMultiPartnerOrder, openMercadoPagoPayment } from '../../utils/mercadoPago';
import { supabaseClient } from '../../lib/supabase';

export default function Cart() {
  const { currentUser } = useAuth();
  const { cart, updateQuantity, removeFromCart, clearCart, getCartTotal } = useCart();
  const [loading, setLoading] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [isAddressExpanded, setIsAddressExpanded] = useState(false);
  const [productStocks, setProductStocks] = useState<Record<string, number>>({});
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('Preparando tu pago con Mercado Pago');
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [partnerInfo, setPartnerInfo] = useState<{
    has_shipping: boolean;
    shipping_cost: number;
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
      // CRÍTICO: Esperar 500ms antes de ocultar el loader para evitar que se oculte durante la apertura de MP
      // Esto permite que Mercado Pago se abra completamente antes de ocultar el loader
      const timer = setTimeout(() => {
        if (paymentLoading) {
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
          .select('has_shipping, shipping_cost, calle, barrio, city')
          .eq('id', productData.partner_id)
          .maybeSingle();

        if (partnerData) {
          setPartnerInfo({
            has_shipping: partnerData.has_shipping || false,
            shipping_cost: partnerData.shipping_cost || 0,
            calle: partnerData.calle || '',
            barrio: partnerData.barrio || '',
            city: partnerData.city || '',
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
        `Solo hay ${availableStock} unidades disponibles de este producto.`
      );
      return;
    }

    updateQuantity(itemId, newQuantity, availableStock);
  };

  const handleShowPaymentMethods = () => {
    if (!currentUser) {
      Alert.alert('Iniciar sesión', 'Debes iniciar sesión para realizar una compra');
      return;
    }

    if (!cart || cart.length === 0) {
      Alert.alert('Error', 'Tu carrito está vacío');
      return;
    }

    const addressToUse = useNewAddress ? newAddress : savedAddress;

    // Solo validar dirección si tiene envío
    if (partnerInfo?.has_shipping) {
      if (!addressToUse.street.trim() || !addressToUse.number.trim() || !addressToUse.locality.trim() || !addressToUse.department.trim()) {
        Alert.alert('Error', 'Por favor completa los campos obligatorios de dirección (calle, número, localidad, departamento)');
        return;
      }
    }

    // Mostrar modal de métodos de pago
    setShowPaymentMethodModal(true);
  };

  const handlePayWithMercadoPago = async () => {
    console.log('💳 ========== INICIO handlePayWithMercadoPago ==========');
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
    console.log(`⏱️  Tiempo mínimo de loading: ${MIN_LOADING_TIME}ms`);

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

      const totalShippingCost = partnerInfo?.has_shipping ? (partnerInfo.shipping_cost || 0) : 0;

      // Esperar 800ms para que el loader sea visible
      await new Promise(resolve => setTimeout(resolve, 800));

      setPaymentMessage('Creando orden de compra...');
      const { orders, paymentPreferences, isTestMode } = await createMultiPartnerOrder(
        cart,
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
          paymentUrl = preference.sandbox_init_point || preference.init_point;
          if (!preference.sandbox_init_point) {
            console.warn('⚠️ sandbox_init_point not available, falling back to init_point');
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
        const openResult = await openMercadoPagoPayment(paymentUrl, isTestModeByUrl);
        console.log('📱 openMercadoPagoPayment completado:', openResult);

        if (!openResult.success) {
          console.error('❌ Error abriendo Mercado Pago');
          Alert.alert(
            'Error',
            openResult.error || 'No se pudo abrir Mercado Pago. Por favor intenta nuevamente.'
          );
          // CRÍTICO: Ocultar loader si falló al abrir
          setPaymentLoading(false);
          setPaymentMessage('Preparando tu pago con Mercado Pago');
        } else {
          console.log('✅ Mercado Pago abierto exitosamente');
          console.log('⏳ Loader DEBE permanecer visible hasta que el usuario regrese');
          // IMPORTANTE: NO ocultar el loader aquí, se ocultará automáticamente cuando el usuario vuelva a la app
          // El useFocusEffect se encarga de ocultar el loader cuando regresa
          // El loader DEBE quedar visible para mostrar que la transacción está en proceso
        }
      } else {
        throw new Error('No se pudo crear la preferencia de pago');
      }
    } catch (error: any) {
      console.error('❌ Error with cart checkout:', error);

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
          errorMessage + '\n\nPor favor verifica que haya productos disponibles e intenta nuevamente.',
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
    }).format(amount);
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Mi Carrito</Text>
        <View style={styles.headerActions}>
          {cart && cart.length > 0 && (
            <TouchableOpacity 
              style={styles.cartButton}
              onPress={() => {
                Alert.alert(
                  'Vaciar Carrito',
                  '¿Estás seguro de que quieres vaciar tu carrito?',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Vaciar', style: 'destructive', onPress: clearCart }
                  ]
                );
              }}
            >
              <Trash2 size={22} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!cart || cart.length === 0 ? (
          <Card style={styles.emptyCard}>
            <ShoppingCart size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
            <Text style={styles.emptySubtitle}>
              Agrega productos de la tienda para comenzar tu compra
            </Text>
            <Button
              title="Ir a la Tienda"
              onPress={() => router.push('/(tabs)/shop')}
              size="large"
            />
          </Card>
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
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemPartner}>{item.partnerName}</Text>
                        {availableStock !== undefined && (
                          <Text style={styles.stockInfo}>
                            Stock: {availableStock} disponibles
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
                        >
                          <Minus size={16} color="#6B7280" />
                        </TouchableOpacity>
                        <Text style={styles.quantityText}>{item.quantity}</Text>
                        <TouchableOpacity
                          style={[styles.quantityButton, !canIncreaseQuantity && styles.quantityButtonDisabled]}
                          onPress={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          disabled={!canIncreaseQuantity}
                        >
                          <Plus size={16} color={canIncreaseQuantity ? "#6B7280" : "#D1D5DB"} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  
                  <View style={styles.itemFooter}>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeFromCart(item.id)}
                    >
                      <Trash2 size={16} color="#EF4444" />
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
              <Text style={styles.summaryTitle}>Resumen del Pedido</Text>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(getCartTotal())}
                </Text>
              </View>
              
              {partnerInfo?.has_shipping ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Envío</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(partnerInfo.shipping_cost)}</Text>
                </View>
              ) : (
                <View style={styles.pickupNotice}>
                  <Text style={styles.pickupNoticeText}>🏪 Retiro en tienda</Text>
                </View>
              )}

              <View style={styles.divider} />

              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(getCartTotal() + (partnerInfo?.has_shipping ? (partnerInfo.shipping_cost || 0) : 0))}
                </Text>
              </View>

              <View style={styles.divider} />

              {/* Dirección de Envío Colapsable */}
              <TouchableOpacity
                style={styles.addressHeader}
                onPress={() => setIsAddressExpanded(!isAddressExpanded)}
              >
                <View style={styles.addressHeaderLeft}>
                  <MapPin size={20} color="#3B82F6" />
                  <View style={styles.addressHeaderText}>
                    <Text style={styles.addressHeaderTitle}>
                      {partnerInfo?.has_shipping ? 'Dirección de Envío' : 'Dirección de la Tienda'}
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
                            ⚠️ {hasPartialAddress() ? 'Completar departamento' : 'Completar dirección'}
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                </View>
                {isAddressExpanded ? (
                  <ChevronUp size={20} color="#6B7280" />
                ) : (
                  <ChevronDown size={20} color="#6B7280" />
                )}
              </TouchableOpacity>

              {isAddressExpanded && (
                <View style={styles.addressExpandedContent}>
                  {!partnerInfo?.has_shipping && partnerInfo ? (
                    // Mostrar dirección de la tienda
                    <View style={styles.storeAddressContainer}>
                      <Text style={styles.storeAddressTitle}>Dirección de retiro:</Text>
                      <Text style={styles.storeAddressText}>
                        {partnerInfo.calle}
                        {partnerInfo.barrio ? `, ${partnerInfo.barrio}` : ''}
                        {partnerInfo.city ? `, ${partnerInfo.city}` : ''}
                      </Text>
                      <Text style={styles.storeAddressNote}>
                        📦 Podrás retirar tu pedido una vez confirmado el pago
                      </Text>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.checkboxContainer}
                        onPress={() => setUseNewAddress(!useNewAddress)}
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
                            No tienes una dirección guardada. Marca "Usar dirección diferente" para ingresar una.
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

            <View style={styles.actionsContainer}>
              <Button
                title={loading ? 'Procesando...' : 'Pagar'}
                onPress={handleShowPaymentMethods}
                loading={loading}
                size="large"
                disabled={!currentUser}
              />
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal de Métodos de Pago */}
      <Modal
        visible={showPaymentMethodModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentMethodModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Método de Pago</Text>
              <TouchableOpacity onPress={() => setShowPaymentMethodModal(false)} style={styles.closeButton}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.methodsContent}>
              <View style={styles.methodsHeader}>
                <CreditCard size={40} color="#2D6A6F" />
                <Text style={styles.methodsTitle}>Selecciona tu método de pago</Text>
                <Text style={styles.methodsSubtitle}>
                  Total: {formatCurrency(getCartTotal() + (partnerInfo?.has_shipping ? (partnerInfo.shipping_cost || 0) : 0))}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.paymentMethodCard}
                onPress={handlePayWithMercadoPago}
              >
                <View style={styles.paymentMethodIcon}>
                  <Image
                    source={require('@/assets/images/mercadopago.png')}
                    style={styles.mercadoPagoIcon}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Mercado Pago</Text>
                  <Text style={styles.paymentMethodDescription}>
                    Pago seguro con tarjetas, transferencias y más
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paymentMethodCard, styles.disabledMethod]}
                disabled
              >
                <View style={[styles.paymentMethodIcon, { backgroundColor: '#F3F4F6' }]}>
                  <CreditCard size={32} color="#9CA3AF" />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={[styles.paymentMethodTitle, { color: '#9CA3AF' }]}>Tarjeta de Crédito/Débito</Text>
                  <Text style={[styles.paymentMethodDescription, { color: '#9CA3AF' }]}>
                    Visa, Mastercard, American Express
                  </Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.paymentNote}>
                Serás redirigido para completar el pago de forma segura
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Loading Overlay con Barra de Progreso */}
      {paymentLoading && (
        <Modal
          visible={paymentLoading}
          transparent
          animationType="fade"
          statusBarTranslucent
        >
          <View style={styles.paymentLoadingOverlay}>
            <View style={styles.paymentLoadingContent}>
              {/* Logo de Mercado Pago */}
              <View style={styles.mpLogoContainer}>
                <Image
                  source={require('@/assets/images/mercadopago.png')}
                  style={styles.mpLoadingLogo}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.paymentLoadingTitle}>Procesando pago...</Text>
              <Text style={styles.paymentLoadingSubtitle}>
                {paymentMessage}
              </Text>

              {/* Barra de progreso animada */}
              <View style={styles.progressBarContainer}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>

              <Text style={styles.loadingHint}>Serás redirigido a Mercado Pago</Text>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
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
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 60,
    margin: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  itemsContainer: {
    padding: 16,
  },
  itemCard: {
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  itemPartner: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  stockInfo: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#059669',
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: 8,
  },
  originalPrice: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  quantityButton: {
    padding: 8,
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginHorizontal: 12,
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
    paddingVertical: 4,
  },
  removeButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#EF4444',
    marginLeft: 4,
  },
  itemTotal: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  addressHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  addressHeaderText: {
    flex: 1,
  },
  addressHeaderTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  addressHeaderSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  addressHeaderWarning: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#F59E0B',
  },
  addressExpandedContent: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  checkboxMark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  checkboxLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  addressForm: {
    gap: 12,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 12,
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
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  noAddressText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
    textAlign: 'center',
  },
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  totalValue: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  actionsContainer: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    minHeight: 450,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  methodsContent: {
    padding: 20,
  },
  methodsHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  mercadoPagoIcon: {
    width: 48,
    height: 48,
  },
  methodsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginTop: 12,
    textAlign: 'center',
  },
  methodsSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#10B981',
    marginTop: 4,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  disabledMethod: {
    opacity: 0.5,
  },
  paymentMethodIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  paymentMethodDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  paymentNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
  paymentLoadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentLoadingContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    width: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  mpLogoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#009EE3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  mpLoadingLogo: {
    width: 50,
    height: 50,
  },
  paymentLoadingTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  paymentLoadingSubtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#00A650',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00A650',
    borderRadius: 3,
  },
  loadingHint: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  pickupNotice: {
    backgroundColor: '#DBEAFE',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  pickupNoticeText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
    textAlign: 'center',
  },
  storeAddressContainer: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  storeAddressTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#166534',
    marginBottom: 8,
  },
  storeAddressText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#15803D',
    marginBottom: 12,
    lineHeight: 22,
  },
  storeAddressNote: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#16A34A',
    fontStyle: 'italic',
  },
});