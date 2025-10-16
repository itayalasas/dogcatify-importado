import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Package, Clock, Truck, CircleCheck as CheckCircle, Circle as XCircle, MapPin, Phone, Star, MessageSquare } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { OrderTracking } from '../../components/OrderTracking';

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      router.replace('/auth/login');
      return;
    }
    
    if (!id) {
      Alert.alert('Error', 'ID de pedido no válido');
      router.back();
      return;
    }
    
    fetchOrderDetails();
  }, [currentUser, id]);

  const fetchOrderDetails = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('id', id)
        .eq('customer_id', currentUser!.id)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setOrder({
          id: data.id,
          partnerId: data.partner_id,
          customerId: data.customer_id,
          items: data.items || [],
          status: data.status || 'pending',
          orderType: data.order_type || 'product_purchase',
          totalAmount: data.total_amount || 0,
          shippingAddress: data.shipping_address || '',
          createdAt: new Date(data.created_at),
          updatedAt: data.updated_at ? new Date(data.updated_at) : null
        });
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
      Alert.alert('Error', 'No se pudo cargar el detalle del pedido');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FEF3C7';
      case 'confirmed': return '#DBEAFE';
      case 'processing': return '#DBEAFE';
      case 'shipped': return '#D1FAE5';
      case 'delivered': return '#D1FAE5';
      case 'cancelled': return '#FEE2E2';
      default: return '#F3F4F6';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'pending': return '#92400E';
      case 'confirmed': return '#1E40AF';
      case 'processing': return '#1E40AF';
      case 'shipped': return '#065F46';
      case 'delivered': return '#065F46';
      case 'cancelled': return '#991B1B';
      default: return '#374151';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'confirmed': return 'Confirmado';
      case 'processing': return 'En proceso';
      case 'shipped': return 'Enviado';
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      default: return 'Desconocido';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contactar Soporte',
      `Pedido #${order.id.slice(-6)}\n\nPuedes contactarnos por:\n\n📧 Email: soporte@dogcatify.com\n📱 WhatsApp: +54 11 1234-5678`,
      [{ text: 'Entendido' }]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando detalle del pedido...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No se encontró el pedido</Text>
          <Button title="Volver" onPress={() => router.back()} />
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
        <Text style={styles.title}>Detalle del Pedido</Text>
        <TouchableOpacity onPress={handleContactSupport} style={styles.supportButton}>
          <MessageSquare size={20} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Status */}
        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.orderNumber}>Pedido #{order.id.slice(-6)}</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(order.status) }
            ]}>
              <Text style={[
                styles.statusText,
                { color: getStatusTextColor(order.status) }
              ]}>
                {getStatusText(order.status)}
              </Text>
            </View>
          </View>

          <Text style={styles.orderDate}>
            Realizado el {order.createdAt.toLocaleDateString()} a las {order.createdAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </Text>

          {order.updatedAt && (
            <Text style={styles.lastUpdate}>
              Última actualización: {order.updatedAt.toLocaleDateString()}
            </Text>
          )}
        </Card>

        {/* Order Tracking Timeline */}
        <Card style={styles.trackingCard}>
          <Text style={styles.sectionTitle}>Seguimiento del Pedido</Text>
          <OrderTracking
            orderStatus={order.status}
            orderType={order.orderType}
            orderDate={order.createdAt}
            cancelledDate={order.status === 'cancelled' ? order.updatedAt : undefined}
          />
        </Card>

        {/* Order Items */}
        <Card style={styles.itemsCard}>
          <Text style={styles.sectionTitle}>Productos ({order.items.length})</Text>
          
          {order.items.map((item: any, index: number) => (
            <View key={index} style={styles.orderItem}>
              {item.image && (
                <Image source={{ uri: item.image }} style={styles.itemImage} />
              )}
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.name || 'Producto'}</Text>
                <Text style={styles.itemPartner}>{item.partnerName || 'Tienda'}</Text>
                <View style={styles.itemPricing}>
                  <Text style={styles.itemQuantity}>Cantidad: {item.quantity || 1}</Text>
                  <Text style={styles.itemPrice}>
                    {formatCurrency((item.price || 0) * (item.quantity || 1))}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </Card>

        {/* Shipping Information */}
        {order.shippingAddress && (
          <Card style={styles.shippingCard}>
            <Text style={styles.sectionTitle}>Información de Envío</Text>
            <View style={styles.shippingInfo}>
              <MapPin size={20} color="#6B7280" />
              <Text style={styles.shippingAddress}>{order.shippingAddress}</Text>
            </View>
          </Card>
        )}

        {/* Order Summary */}
        <Card style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Resumen del Pedido</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(order.totalAmount - 500)} {/* Assuming 500 shipping */}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Envío</Text>
            <Text style={styles.summaryValue}>{formatCurrency(500)}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(order.totalAmount)}</Text>
          </View>
        </Card>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {order.status === 'delivered' && (
            <Button
              title="Reordenar Productos"
              onPress={() => {
                Alert.alert('Reordenar', 'Los productos se han agregado al carrito');
                router.push('/cart');
              }}
              size="large"
            />
          )}
          
          <Button
            title="Contactar Soporte"
            onPress={handleContactSupport}
            variant="outline"
            size="large"
          />
        </View>
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
  supportButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  statusCard: {
    marginBottom: 16,
  },
  trackingCard: {
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  orderDate: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  lastUpdate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  itemsCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  orderItem: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
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
    marginBottom: 8,
  },
  itemPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemQuantity: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  itemPrice: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  shippingCard: {
    marginBottom: 16,
  },
  shippingInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  shippingAddress: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
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
    gap: 12,
  },
});