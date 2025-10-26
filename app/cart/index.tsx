import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { ArrowLeft, ShoppingCart, Trash2, Plus, Minus, MapPin, ChevronDown, ChevronUp } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { createMultiPartnerOrder, openMercadoPagoPayment } from '../../utils/mercadoPago';
import { supabaseClient } from '../../lib/supabase';
import { PaymentModal } from '../../components/PaymentModal';

export default function Cart() {
  const { currentUser } = useAuth();
  const { cart, updateQuantity, removeFromCart, clearCart, getCartTotal } = useCart();
  const [loading, setLoading] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [isAddressExpanded, setIsAddressExpanded] = useState(false);
  const [productStocks, setProductStocks] = useState<Record<string, number>>({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
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

  // Cargar stocks de los productos en el carrito
  useEffect(() => {
    if (cart && cart.length > 0) {
      loadProductStocks();
    }
  }, [cart]);

  // Recargar stocks cada vez que la pantalla se enfoca (al volver desde Mercado Pago)
  useFocusEffect(
    React.useCallback(() => {
      if (cart && cart.length > 0) {
        loadProductStocks();
      }
    }, [cart])
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

  const handleCheckout = async () => {
    if (!currentUser) {
      Alert.alert('Iniciar sesión', 'Debes iniciar sesión para realizar una compra');
      return;
    }

    if (!cart || cart.length === 0) {
      Alert.alert('Error', 'Tu carrito está vacío');
      return;
    }

    const addressToUse = useNewAddress ? newAddress : savedAddress;

    if (!addressToUse.street.trim() || !addressToUse.number.trim() || !addressToUse.locality.trim() || !addressToUse.department.trim()) {
      Alert.alert('Error', 'Por favor completa los campos obligatorios de dirección (calle, número, localidad, departamento)');
      return;
    }

    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async (paymentResult: any) => {
    console.log('Payment successful:', paymentResult);
    setLoading(true);
    try {
      if (!currentUser || !cart || cart.length === 0) {
        throw new Error('Información incompleta para crear la orden');
      }

      const addressToUse = useNewAddress ? newAddress : savedAddress;

      let fullAddress = `${addressToUse.street} ${addressToUse.number}`;
      if (addressToUse.locality) fullAddress += `, ${addressToUse.locality}`;
      fullAddress += `, ${addressToUse.department}`;
      if (addressToUse.codigo_postal) fullAddress += ` - CP: ${addressToUse.codigo_postal}`;
      if (addressToUse.phone) fullAddress += ` - Tel: ${addressToUse.phone}`;

      const totalShippingCost = 500;

      for (const item of cart) {
        const orderData = {
          partner_id: item.partnerId,
          customer_id: currentUser.id,
          customer_name: currentUser.displayName || 'Usuario',
          customer_email: currentUser.email,
          customer_phone: currentUser.phone || null,
          items: [{
            product_id: item.id,
            product_name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            total_price: item.price * item.quantity
          }],
          subtotal: item.price * item.quantity,
          shipping_cost: totalShippingCost,
          total_amount: (item.price * item.quantity) + totalShippingCost,
          shipping_address: fullAddress,
          status: 'confirmed',
          payment_status: 'paid',
          payment_method: 'credit_card',
          payment_transaction_id: paymentResult.transactionId,
          payment_confirmed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };

        const { error } = await supabaseClient
          .from('orders')
          .insert([orderData]);

        if (error) {
          console.error('Error creating order:', error);
          throw new Error(`Error al crear la orden: ${error.message}`);
        }
      }

      clearCart();

      Alert.alert(
        'Compra Exitosa',
        `¡Perfecto! Tu compra ha sido procesada correctamente.\n\n💰 Total: ${formatCurrency(getCartTotal() + 500)}\n\nRecibirás un correo con los detalles de tu pedido.`,
        [{ text: 'OK', onPress: () => router.push('/(tabs)') }]
      );
    } catch (error: any) {
      console.error('Error creating order:', error);
      Alert.alert(
        'Error al crear orden',
        `${error?.message || 'Error desconocido'}\n\nPor favor intenta nuevamente o contacta con soporte.`,
        [
          { text: 'Reintentar', onPress: () => setShowPaymentModal(true) },
          { text: 'Cancelar', style: 'cancel' }
        ]
      );
    } finally {
      setLoading(false);
      setShowPaymentModal(false);
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
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Envío</Text>
                <Text style={styles.summaryValue}>{formatCurrency(500)}</Text>
              </View>
              
              <View style={styles.divider} />
              
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatCurrency(getCartTotal() + 500)}</Text>
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
                    <Text style={styles.addressHeaderTitle}>Dirección de Envío</Text>
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
                </View>
              )}
            </Card>

            <View style={styles.actionsContainer}>
              <Button
                title={loading ? 'Procesando...' : 'Continuar con el Pago'}
                onPress={handleCheckout}
                loading={loading}
                size="large"
                disabled={!currentUser}
              />
              <Text style={styles.checkoutNote}>
                Completa el pago de forma segura con tarjeta de crédito
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <PaymentModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
        paymentData={{
          serviceName: cart && cart.length > 0
            ? `${cart.length} producto${cart.length > 1 ? 's' : ''}`
            : 'Productos',
          providerName: cart && cart.length > 0
            ? cart.map(item => item.partnerName).join(', ')
            : 'Varios proveedores',
          price: getCartTotal(),
          hasShipping: true,
          shippingCost: 500
        }}
      />
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
  checkoutNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },
});