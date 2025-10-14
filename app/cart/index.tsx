import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Linking } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ShoppingCart, Trash2, Plus, Minus, MapPin } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { createMultiPartnerOrder } from '../../utils/mercadoPago';

export default function Cart() {
  const { currentUser } = useAuth();
  const { cart, updateQuantity, removeFromCart, clearCart, getCartTotal } = useCart();
  const [loading, setLoading] = useState(false);
  const [shippingAddress, setShippingAddress] = useState('');

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
    } else {
      updateQuantity(itemId, newQuantity);
    }
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

    if (!shippingAddress.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu dirección de envío');
      return;
    }

    setLoading(true);
    try {
      console.log('Starting checkout process...');
      console.log('Cart items:', cart);
      console.log('Customer info:', currentUser);
      
      // Calculate shipping cost
      const totalShippingCost = 500;
      
      // Create orders and payment preferences using Mercado Pago
      const { orders, paymentPreferences } = await createMultiPartnerOrder(
        cart,
        currentUser,
        shippingAddress.trim(),
        totalShippingCost
      );
      
      console.log('Orders created:', orders.length);
      console.log('Payment preferences created:', paymentPreferences.length);
      
      if (paymentPreferences.length > 0) {
        const preference = paymentPreferences[0];
        
        // Clear cart before redirecting to payment
        clearCart();
        
        // Get the appropriate init point
        const initPoint = preference.sandbox_init_point || preference.init_point;
        
        if (initPoint) {
          console.log('Redirecting to Mercado Pago:', initPoint);
          
          // Use Linking to open URL in React Native
          try {
            await Linking.openURL(initPoint);
          } catch (linkingError) {
            console.error('Error opening URL:', linkingError);
            Alert.alert(
              'Error',
              'No se pudo abrir Mercado Pago. Por favor intenta nuevamente.',
              [
                {
                  text: 'Copiar enlace',
                  onPress: () => {
                    console.log('Payment URL:', initPoint);
                  }
                },
                { text: 'OK' }
              ]
            );
          }
        } else {
          throw new Error('No se pudo obtener el enlace de pago');
        }
      } else {
        throw new Error('No se pudo crear la preferencia de pago');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      Alert.alert('Error', error.message || 'No se pudo procesar tu pedido');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
    }).format(amount);
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
              {cart.map((item) => (
                <Card key={item.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Image 
                      source={{ uri: item.image || 'https://images.pexels.com/photos/1459244/pexels-photo-1459244.jpeg?auto=compress&cs=tinysrgb&w=400' }} 
                      style={styles.itemImage} 
                    />
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemPartner}>{item.partnerName}</Text>
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
                        style={styles.quantityButton}
                        onPress={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus size={16} color="#6B7280" />
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
              ))}
            </View>

            <Card style={styles.shippingCard}>
              <Text style={styles.shippingTitle}>Dirección de Envío</Text>
              <Input
                placeholder="Ingresa tu dirección completa"
                value={shippingAddress}
                onChangeText={setShippingAddress}
                leftIcon={<MapPin size={20} color="#6B7280" />}
                multiline
                numberOfLines={2}
              />
            </Card>

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
            </Card>

            <View style={styles.actionsContainer}>
              <Button
                title={loading ? 'Procesando...' : 'Pagar con Mercado Pago'}
                onPress={handleCheckout}
                loading={loading}
                size="large"
                disabled={!currentUser}
              />
              <Text style={styles.checkoutNote}>
                Serás redirigido a Mercado Pago para completar el pago de forma segura
              </Text>
            </View>
          </>
        )}
      </ScrollView>
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
  shippingCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  shippingTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
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