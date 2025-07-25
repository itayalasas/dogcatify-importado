import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag, CreditCard } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { createMultiPartnerOrder } from '../../utils/mercadoPago';
import { Platform } from 'react-native';

export default function Cart() {
  const { currentUser } = useAuth();
  const { cart, updateQuantity, removeFromCart, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'mercadopago' | 'cash'>('mercadopago');

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    const item = cart.find(item => item.id === itemId);
    if (!item) return;
    
    const newQuantity = item.quantity + delta;
    if (newQuantity >= 1) {
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

  const handleClearCart = () => {
    if (cart.length === 0) return;
    
    Alert.alert(
      'Vaciar carrito',
      '¿Estás seguro de que quieres vaciar el carrito?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Vaciar', style: 'destructive', onPress: () => clearCart() }
      ]
    );
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Carrito vacío', 'Agrega productos al carrito para continuar');
      return;
    }
    
    if (!currentUser) {
      Alert.alert('Iniciar sesión', 'Debes iniciar sesión para realizar la compra');
      return;
    }
    
    if (selectedPaymentMethod === 'mercadopago') {
      handleMercadoPagoCheckout();
    } else {
      handleCashCheckout();
    }
  };
  
  const handleMercadoPagoCheckout = async () => {
    setLoading(true);
    try {
      console.log('Starting Mercado Pago checkout process...');
      
      // Create orders and payment preferences for each partner
      const { orders, paymentPreferences } = await createMultiPartnerOrder(
        cart,
        currentUser,
        'Dirección de envío' // You might want to collect this from user
      );
      
      console.log('Orders created:', orders.length);
      console.log('Payment preferences created:', paymentPreferences.length);
      
      // For multiple partners, we'll redirect to the first payment
      // In a real app, you might want to handle multiple payments differently
      if (paymentPreferences.length > 0) {
        const firstPreference = paymentPreferences[0];
        const paymentUrl = firstPreference.sandbox_init_point || firstPreference.init_point;
        
        if (paymentUrl) {
          // Clear cart before redirecting
          clearCart();
          
          // Redirect to Mercado Pago
          if (Platform.OS === 'web') {
            window.open(paymentUrl, '_self');
          } else {
            // For mobile, you might want to use WebBrowser
            Alert.alert(
              'Redirigiendo a Mercado Pago',
              'Serás redirigido para completar el pago',
              [
                {
                  text: 'Continuar',
                  onPress: () => {
                    // Here you would open the payment URL in a WebView or browser
                    console.log('Payment URL:', paymentUrl);
                  }
                }
              ]
            );
          }
        } else {
          throw new Error('No se pudo generar la URL de pago');
        }
      } else {
        throw new Error('No se pudieron crear las preferencias de pago');
      }
    } catch (error) {
      console.error('Error in Mercado Pago checkout:', error);
      Alert.alert(
        'Error en el pago',
        'No se pudo procesar el pago con Mercado Pago. Por favor intenta nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };
  
  const handleCashCheckout = () => {
    setLoading(true);
    
    // Simulate cash payment process
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Pedido realizado',
        'Tu pedido ha sido registrado para pago en efectivo. El vendedor se pondrá en contacto contigo.',
        [
          { 
            text: 'OK', 
            onPress: () => {
              clearCart();
              router.push('/(tabs)');
            }
          }
        ]
      );
    }, 1500);
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const calculateShipping = () => {
    return cart.length > 0 ? 500 : 0;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateShipping();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(price);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Mi Carrito</Text>
        {cart.length > 0 && (
          <TouchableOpacity onPress={handleClearCart} style={styles.clearButton}>
            <Trash2 size={20} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ShoppingBag size={64} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
          <Text style={styles.emptySubtitle}>
            Agrega productos a tu carrito para continuar con la compra
          </Text>
          <Button
            title="Explorar Productos"
            onPress={() => router.push('/(tabs)/shop')}
            size="large"
          />
        </View>
      ) : (
        <>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Cart Items */}
            <View style={styles.cartItems}>
              {cart.map((item) => (
                <Card key={item.id} style={styles.cartItem}>
                  <View style={styles.itemContent}>
                    <Image 
                      source={{ 
                        uri: item.image || 'https://images.pexels.com/photos/1459244/pexels-photo-1459244.jpeg?auto=compress&cs=tinysrgb&w=400'
                      }} 
                      style={styles.itemImage} 
                    />
                    
                    <View style={styles.itemDetails}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemStore}>{item.partnerName}</Text>
                      <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
                      
                      <View style={styles.quantityContainer}>
                        <TouchableOpacity 
                          style={styles.quantityButton}
                          onPress={() => handleUpdateQuantity(item.id, -1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus size={16} color={item.quantity <= 1 ? '#D1D5DB' : '#111827'} />
                        </TouchableOpacity>
                        
                        <Text style={styles.quantityText}>{item.quantity}</Text>
                        
                        <TouchableOpacity 
                          style={styles.quantityButton}
                          onPress={() => handleUpdateQuantity(item.id, 1)}
                        >
                          <Plus size={16} color="#111827" />
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={styles.removeButton}
                          onPress={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
            
            {/* Order Summary */}
            <Card style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Resumen del Pedido</Text>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{formatPrice(calculateSubtotal())}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Envío</Text>
                <Text style={styles.summaryValue}>{formatPrice(calculateShipping())}</Text>
              </View>
              
              <View style={styles.divider} />
              
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatPrice(calculateTotal())}</Text>
              </View>
            </Card>
            
            {/* Payment Methods */}
            <Card style={styles.paymentCard}>
              <Text style={styles.paymentTitle}>Métodos de Pago</Text>
              
              <TouchableOpacity 
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === 'mercadopago' && styles.selectedPaymentMethod
                ]}
                onPress={() => setSelectedPaymentMethod('mercadopago')}
              >
                <View style={[
                  styles.paymentRadio,
                  selectedPaymentMethod === 'mercadopago' && styles.selectedPaymentRadio
                ]}>
                  {selectedPaymentMethod === 'mercadopago' && (
                    <View style={styles.paymentRadioInner} />
                  )}
                </View>
                <View style={styles.paymentMethodContent}>
                  <CreditCard size={20} color="#00A650" />
                  <View style={styles.paymentMethodText}>
                    <Text style={styles.paymentText}>Mercado Pago</Text>
                    <Text style={styles.paymentSubtext}>Tarjetas, transferencias y más</Text>
                  </View>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === 'cash' && styles.selectedPaymentMethod
                ]}
                onPress={() => setSelectedPaymentMethod('cash')}
              >
                <View style={[
                  styles.paymentRadio,
                  selectedPaymentMethod === 'cash' && styles.selectedPaymentRadio
                ]}>
                  {selectedPaymentMethod === 'cash' && (
                    <View style={styles.paymentRadioInner} />
                  )}
                </View>
                <View style={styles.paymentMethodContent}>
                  <Text style={styles.cashIcon}>💵</Text>
                  <View style={styles.paymentMethodText}>
                    <Text style={styles.paymentText}>Efectivo</Text>
                    <Text style={styles.paymentSubtext}>Pago al recibir el producto</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Card>
            
            {/* Checkout Button */}
            <View style={styles.checkoutContainer}>
              <Button
                title="Finalizar Compra"
                onPress={handleCheckout}
                loading={loading}
                size="large"
              />
            </View>
          </ScrollView>
        </>
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
  clearButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  },
  content: {
    flex: 1,
    padding: 16,
  },
  cartItems: {
    marginBottom: 16,
  },
  cartItem: {
    marginBottom: 12,
  },
  itemContent: {
    flexDirection: 'row',
  },
  itemImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  itemStore: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
    marginBottom: 8,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: 'center',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  summaryCard: {
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  paymentCard: {
    marginBottom: 16,
  },
  paymentTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  selectedPaymentMethod: {
    borderColor: '#3B82F6',
    backgroundColor: '#F0F9FF',
  },
  paymentRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selectedPaymentRadio: {
    borderColor: '#3B82F6',
  },
  paymentRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodText: {
    marginLeft: 12,
    flex: 1,
  },
  paymentText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#111827',
  },
  paymentSubtext: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  cashIcon: {
    fontSize: 20,
  },
  checkoutContainer: {
    marginBottom: 32,
  },
});