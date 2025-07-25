import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft, Plus, Minus, Trash2, ShoppingCart, CreditCard } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { supabaseClient } from '../../lib/supabase';
import { createMultiPartnerOrder } from '../../utils/mercadoPago';

export default function Cart() {
  const { currentUser } = useAuth();
  const { cart, updateQuantity, removeFromCart, clearCart, getCartTotal } = useCart();
  const [loading, setLoading] = useState(false);
  const [shippingAddress, setShippingAddress] = useState('');
  const [partnerShippingInfo, setPartnerShippingInfo] = useState<{[key: string]: {hasShipping: boolean, cost: number, name: string}}>({});
  const [loadingShipping, setLoadingShipping] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      router.replace('/auth/login');
      return;
    }
    
    // Load user's default address
    if (currentUser.location) {
      setShippingAddress(currentUser.location);
    }
    
    // Load shipping info for all partners in cart
    if (cart.length > 0) {
      loadPartnerShippingInfo();
    }
  }, [currentUser]);

  useEffect(() => {
    if (cart.length > 0) {
      loadPartnerShippingInfo();
    } else {
      setPartnerShippingInfo({});
      setLoadingShipping(false);
    }
  }, [cart]);

  const loadPartnerShippingInfo = async () => {
    setLoadingShipping(true);
    try {
      const uniquePartnerIds = [...new Set(cart.map(item => item.partnerId))];
      const shippingInfo: {[key: string]: {hasShipping: boolean, cost: number, name: string}} = {};
      
      for (const partnerId of uniquePartnerIds) {
        try {
          const { data, error } = await supabaseClient
            .from('partners')
            .select('business_name, has_shipping, shipping_cost')
            .eq('id', partnerId)
            .single();
          
          if (error) {
            console.error('Error fetching partner shipping info:', error);
            // Default values if error
            shippingInfo[partnerId] = {
              hasShipping: false,
              cost: 0,
              name: cart.find(item => item.partnerId === partnerId)?.partnerName || 'Tienda'
            };
          } else {
            shippingInfo[partnerId] = {
              hasShipping: data.has_shipping || false,
              cost: data.shipping_cost || 0,
              name: data.business_name || 'Tienda'
            };
          }
        } catch (error) {
          console.error('Error loading shipping for partner:', partnerId, error);
          shippingInfo[partnerId] = {
            hasShipping: false,
            cost: 0,
            name: cart.find(item => item.partnerId === partnerId)?.partnerName || 'Tienda'
          };
        }
      }
      
      setPartnerShippingInfo(shippingInfo);
    } catch (error) {
      console.error('Error loading partner shipping info:', error);
    } finally {
      setLoadingShipping(false);
    }
  };
  const validateCartItems = async () => {
    console.log('Validating cart items...');
    const validatedItems = [];
    const partnersWithoutMP = [];
    
    for (const item of cart) {
      try {
        // Verify product exists and get correct partner_id
        const { data: productData, error } = await supabaseClient
          .from('partner_products')
          .select('*, partners!inner(business_name, mercadopago_connected, mercadopago_config)')
          .eq('id', item.id)
          .single();
        
        if (error) {
          console.error(`Product ${item.id} not found:`, error);
          Alert.alert('Producto no encontrado', `El producto "${item.name}" ya no está disponible y será removido del carrito.`);
          removeFromCart(item.id);
          continue;
        }
        
        // Check if partner has MP configured
        if (!productData.partners.mercadopago_connected || !productData.partners.mercadopago_config) {
          partnersWithoutMP.push({
            partnerName: productData.partners.business_name,
            productName: item.name,
            itemId: item.id
          });
          continue;
        }
        
        // Update item with correct partner info
        const correctedItem = {
          ...item,
          partnerId: productData.partner_id,
          partnerName: productData.partners.business_name
        };
        
        validatedItems.push(correctedItem);
        
      } catch (error) {
        console.error(`Error validating item ${item.id}:`, error);
        removeFromCart(item.id);
      }
    }
    
    // Show alert for partners without MP and remove their products
    if (partnersWithoutMP.length > 0) {
      const partnerNames = [...new Set(partnersWithoutMP.map(p => p.partnerName))];
      Alert.alert(
        'Negocios sin pagos configurados',
        `Los siguientes negocios no tienen configurado Mercado Pago y sus productos serán removidos del carrito:\n\n${partnerNames.join('\n')}\n\nPor favor contacta con los negocios para que configuren sus pagos.`,
        [
          {
            text: 'Entendido',
            onPress: () => {
              // Remove all products from partners without MP
              partnersWithoutMP.forEach(p => removeFromCart(p.itemId));
            }
          }
        ]
      );
      return [];
    }
    
    return validatedItems;
  };

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
    } else {
      updateQuantity(itemId, newQuantity);
    }
  };

  const handleRemoveItem = (itemId: string) => {
    Alert.alert(
      'Eliminar producto',
      '¿Estás seguro de que quieres eliminar este producto del carrito?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => removeFromCart(itemId) }
      ]
    );
  };

  const handleMercadoPagoCheckout = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'Debes iniciar sesión para realizar la compra');
      return;
    }

    if (cart.length === 0) {
      Alert.alert('Carrito vacío', 'Agrega productos al carrito antes de proceder al pago');
      return;
    }

    if (!shippingAddress.trim()) {
      Alert.alert('Dirección requerida', 'Por favor ingresa una dirección de envío');
      return;
    }

    setLoading(true);
    try {
      console.log('Starting Mercado Pago checkout process...');
      console.log('Shipping address:', shippingAddress);
      console.log('Cart items:', cart.map(item => ({
        id: item.id,
        name: item.name,
        partnerId: item.partnerId,
        partnerName: item.partnerName
      })));

      // Validate cart items first
      const validatedItems = await validateCartItems();
      
      if (validatedItems.length === 0) {
        Alert.alert('Carrito vacío', 'No hay productos válidos en el carrito para procesar');
        return;
      }

      if (validatedItems.length !== cart.length) {
        Alert.alert(
          'Productos removidos',
          'Algunos productos fueron removidos del carrito porque no están disponibles o el negocio no puede procesar pagos. Por favor revisa tu carrito e intenta nuevamente.'
        );
        return;
      }

      // Create orders and payment preferences
      const { orders, paymentPreferences } = await createMultiPartnerOrder(
        validatedItems,
        currentUser,
        shippingAddress.trim(),
        calculateShipping() // Now uses dynamic shipping calculation
      );

      console.log('Orders created:', orders.length);
      console.log('Payment preferences created:', paymentPreferences.length);

      // Get unique partner names for display
      const uniquePartners = [...new Set(validatedItems.map(item => item.partnerName))];
      
      // Always create a single unified order and payment
      const preference = paymentPreferences[0];
      const checkoutUrl = preference.init_point || preference.sandbox_init_point;
      
      console.log('Unified preference data:', {
        id: preference?.id,
        init_point: preference?.init_point,
        sandbox_init_point: preference?.sandbox_init_point
      });
      
      if (checkoutUrl) {
        // Show confirmation for multiple stores
        if (uniquePartners.length > 1) {
          Alert.alert(
            'Compra de múltiples tiendas',
            `Tu carrito contiene productos de ${uniquePartners.length} tiendas diferentes:\n\n${uniquePartners.join('\n')}\n\nSe procesará como una sola compra unificada.`,
            [
              { text: 'Cancelar', style: 'cancel' },
              { 
                text: 'Proceder al Pago', 
                onPress: async () => {
                  console.log('User confirmed unified payment, processing...');
                  console.log('Checkout URL:', checkoutUrl);
                  
                  clearCart();
                  try {
                    await WebBrowser.openBrowserAsync(checkoutUrl);
                    console.log('Browser opened successfully');
                  } catch (browserError) {
                    console.error('Error opening browser:', browserError);
                    Alert.alert('Error', 'No se pudo abrir la página de pago');
                  }
                }
              }
            ]
          );
        } else {
          // Single store - direct checkout
          console.log('Single store checkout, opening browser directly...');
          clearCart();
          try {
            await WebBrowser.openBrowserAsync(checkoutUrl);
            console.log('Browser opened successfully');
          } catch (browserError) {
            console.error('Error opening browser:', browserError);
            Alert.alert('Error', 'No se pudo abrir la página de pago');
          }
        }
      } else {
        console.error('No checkout URL available');
        Alert.alert('Error', 'No se pudo generar la preferencia de pago');
      }
    } catch (error) {
      console.error('Error in Mercado Pago checkout:', error);
      Alert.alert(
        'Error en el checkout',
        error.message || 'No se pudo procesar el pago. Por favor intenta nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  const calculateShipping = () => {
    if (cart.length === 0) return 0;
    
    const uniquePartnerIds = [...new Set(cart.map(item => item.partnerId))];
    let totalShipping = 0;
    
    uniquePartnerIds.forEach(partnerId => {
      const shippingInfo = partnerShippingInfo[partnerId];
      if (shippingInfo?.hasShipping) {
        totalShipping += shippingInfo.cost;
      }
    });
    
    return totalShipping;
  };

  const calculateTotal = () => {
    return getCartTotal() + calculateShipping();
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loginPrompt}>
          <Text style={styles.loginPromptText}>Inicia sesión para ver tu carrito</Text>
          <Button title="Iniciar Sesión" onPress={() => router.push('/auth/login')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Mi Carrito</Text>
        <View style={styles.placeholder} />
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyContainer}>
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
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Cart Items */}
          <View style={styles.itemsContainer}>
            {cart.map((item) => (
              <Card key={item.id} style={styles.itemCard}>
                <View style={styles.itemContent}>
                  <Image 
                    source={{ 
                      uri: item.image || 'https://images.pexels.com/photos/1459244/pexels-photo-1459244.jpeg?auto=compress&cs=tinysrgb&w=200'
                    }} 
                    style={styles.itemImage} 
                  />
                  
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.itemPartner}>{item.partnerName}</Text>
                    <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
                  </View>
                  
                  <View style={styles.itemActions}>
                    <TouchableOpacity 
                      style={styles.removeButton}
                      onPress={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                    
                    <View style={styles.quantityContainer}>
                      <TouchableOpacity 
                        style={styles.quantityButton}
                        onPress={() => handleQuantityChange(item.id, item.quantity - 1)}
                      >
                        <Minus size={16} color="#6B7280" />
                      </TouchableOpacity>
                      
                      <Text style={styles.quantityText}>{item.quantity}</Text>
                      
                      <TouchableOpacity 
                        style={styles.quantityButton}
                        onPress={() => handleQuantityChange(item.id, item.quantity + 1)}
                      >
                        <Plus size={16} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </View>

          {/* Shipping Address */}
          <Card style={styles.shippingCard}>
            <Text style={styles.sectionTitle}>Dirección de Envío</Text>
            <Input
              placeholder="Ingresa tu dirección completa"
              value={shippingAddress}
              onChangeText={setShippingAddress}
              multiline
              numberOfLines={2}
            />
          </Card>

          {/* Order Summary */}
          <Card style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Resumen del Pedido</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal ({cart.length} productos)</Text>
              <Text style={styles.summaryValue}>{formatCurrency(getCartTotal())}</Text>
            </View>
            
            {/* Shipping breakdown by store */}
            {Object.keys(partnerShippingInfo).length > 0 && (
              <View style={styles.shippingBreakdown}>
                <Text style={styles.shippingBreakdownTitle}>Envío por tienda:</Text>
                {Object.entries(partnerShippingInfo).map(([partnerId, info]) => (
                  <View key={partnerId} style={styles.shippingRow}>
                    <Text style={styles.shippingStoreLabel}>{info.name}</Text>
                    <Text style={styles.shippingStoreValue}>
                      {info.hasShipping ? formatCurrency(info.cost) : 'Sin envío'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Envío</Text>
              <Text style={styles.summaryValue}>
                {loadingShipping ? 'Calculando...' : formatCurrency(calculateShipping())}
              </Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(calculateTotal())}</Text>
            </View>
          </Card>

          {/* Checkout Button */}
          <View style={styles.checkoutContainer}>
            <Button
              title="Pagar con Mercado Pago"
              onPress={handleMercadoPagoCheckout}
              loading={loading}
              size="large"
              disabled={cart.length === 0 || !shippingAddress.trim() || loadingShipping}
            />
          </View>
        </ScrollView>
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
  placeholder: {
    width: 32,
  },
  loginPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginPromptText: {
    fontSize: 18,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 24,
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
  content: {
    flex: 1,
    padding: 16,
  },
  itemsContainer: {
    marginBottom: 16,
  },
  itemCard: {
    marginBottom: 12,
    padding: 12,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  itemPartner: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  itemActions: {
    alignItems: 'center',
  },
  removeButton: {
    padding: 8,
    marginBottom: 8,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: 'center',
  },
  shippingCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  summaryCard: {
    marginBottom: 16,
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
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  totalValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  shippingBreakdown: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  shippingBreakdownTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  shippingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  shippingStoreLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    flex: 1,
  },
  shippingStoreValue: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#111827',
  },
  checkoutContainer: {
    marginBottom: 24,
  },
});