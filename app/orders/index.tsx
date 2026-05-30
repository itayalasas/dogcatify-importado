import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert, Linking, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Package, Clock, Truck, CircleCheck as CheckCircle, Circle as XCircle, MapPin, Phone, Star, AlertCircle, RefreshCw } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { regeneratePaymentLink } from '../../utils/mercadoPago';
import { getOrderFulfillmentMode, getOrderStatusLabel } from '../../utils/orderFulfillment';

export default function MyOrders() {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [counts, setCounts] = useState({ active: 0, completed: 0 });

  const PAGE_SIZE = 20;
  const ACTIVE_STATUSES = ['pending', 'reserved', 'payment_failed', 'confirmed', 'processing', 'preparing', 'ready_for_delivery', 'shipped'];
  const COMPLETED_STATUSES = ['completed', 'delivered', 'cancelled', 'refunded'];

  useEffect(() => {
    if (!currentUser) {
      router.replace('/auth/login');
      return;
    }

    fetchOrders(true);
    fetchOrderCounts();

    // Suscripción en tiempo real para actualizar pedidos cuando cambie el estado
    const ordersSubscription = supabaseClient
      .channel('customer_orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `customer_id=eq.${currentUser.id}`
        },
        (payload) => {
          console.log('📦 Order changed in real-time:', payload.eventType, payload.new || payload.old);
          fetchOrders(true);
          fetchOrderCounts();
        }
      )
      .subscribe();

    // Cleanup: desuscribirse cuando el componente se desmonte
    return () => {
      ordersSubscription.unsubscribe();
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    fetchOrders(true);
    fetchOrderCounts();
  }, [activeTab]);

  useFocusEffect(
    React.useCallback(() => {
      if (!currentUser) return;
      fetchOrders(true);
      fetchOrderCounts();
    }, [currentUser?.id, activeTab])
  );

  const fetchOrderCounts = async () => {
    if (!currentUser) return;

    try {
      const [{ count: activeCount, error: activeError }, { count: completedCount, error: completedError }] = await Promise.all([
        supabaseClient
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', currentUser.id)
          .in('status', ACTIVE_STATUSES),
        supabaseClient
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', currentUser.id)
          .in('status', COMPLETED_STATUSES),
      ]);

      if (activeError || completedError) {
        console.error('Error fetching order counts:', activeError || completedError);
        return;
      }

      setCounts({
        active: activeCount || 0,
        completed: completedCount || 0,
      });
    } catch (error) {
      console.error('Error fetching order counts:', error);
    }
  };

  const fetchOrders = async (reset = false) => {
    if (!currentUser) return;

    const currentLength = reset ? 0 : orders.length;
    const from = currentLength;
    const to = currentLength + PAGE_SIZE - 1;

    if (reset) {
      setLoading(true);
      setHasMore(true);
    } else {
      if (!hasMore || loadingMore || loading) return;
      setLoadingMore(true);
    }
    
    try {
      const statusFilter = activeTab === 'active' ? ACTIVE_STATUSES : COMPLETED_STATUSES;

      const { data, error } = await supabaseClient
        .from('orders')
        .select('id, order_number, partner_id, customer_id, items, status, order_type, total_amount, shipping_address, created_at, updated_at, payment_link_expires_at, last_payment_url, payment_retry_count')
        .eq('customer_id', currentUser.id)
        .in('status', statusFilter)
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) throw error;
      
      const ordersData = data?.map(order => ({
        id: order.id,
        orderNumber: order.order_number || `#${order.id.slice(-6)}`,
        partnerId: order.partner_id,
        customerId: order.customer_id,
        items: order.items || [],
        status: order.status || 'pending',
        orderType: order.order_type || 'product_purchase',
        fulfillmentMode: getOrderFulfillmentMode(order.order_type || 'product_purchase', order.shipping_address),
        totalAmount: order.total_amount || 0,
        shippingAddress: order.shipping_address || '',
        createdAt: new Date(order.created_at),
        updatedAt: order.updated_at ? new Date(order.updated_at) : null,
        paymentLinkExpiresAt: order.payment_link_expires_at ? new Date(order.payment_link_expires_at) : null,
        lastPaymentUrl: order.last_payment_url,
        paymentRetryCount: order.payment_retry_count || 0
      })) || [];

      setHasMore(ordersData.length === PAGE_SIZE);
      setOrders(prev => reset ? ordersData : [...prev, ...ordersData]);
    } catch (error) {
      console.error('Error fetching orders:', error);
      Alert.alert('Error', 'No se pudieron cargar los pedidos');
    } finally {
      if (reset) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  const loadMoreOrders = () => {
    if (!hasMore || loading || loadingMore) return;
    fetchOrders(false);
  };

  const onRefresh = async () => {
    if (!currentUser) return;

    setRefreshing(true);
    try {
      await Promise.all([fetchOrders(true), fetchOrderCounts()]);
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FEF3C7';
      case 'reserved': return '#FEF3C7';
      case 'payment_failed': return '#FECACA';
      case 'confirmed': return '#DBEAFE';
      case 'processing': return '#DBEAFE';
      case 'preparing': return '#DBEAFE';
      case 'ready_for_delivery': return '#DBEAFE';
      case 'shipped': return '#D1FAE5';
      case 'completed': return '#D1FAE5';
      case 'delivered': return '#D1FAE5';
      case 'cancelled': return '#FEE2E2';
      case 'refunded': return '#F3F4F6';
      default: return '#F3F4F6';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'pending': return '#92400E';
      case 'reserved': return '#92400E';
      case 'payment_failed': return '#991B1B';
      case 'confirmed': return '#1E40AF';
      case 'processing': return '#1E40AF';
      case 'preparing': return '#1E40AF';
      case 'ready_for_delivery': return '#1E40AF';
      case 'shipped': return '#065F46';
      case 'completed': return '#065F46';
      case 'delivered': return '#065F46';
      case 'cancelled': return '#991B1B';
      case 'refunded': return '#374151';
      default: return '#374151';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={16} color="#92400E" />;
      case 'reserved': return <Clock size={16} color="#92400E" />;
      case 'payment_failed': return <AlertCircle size={16} color="#991B1B" />;
      case 'confirmed': return <CheckCircle size={16} color="#1E40AF" />;
      case 'processing': return <Package size={16} color="#1E40AF" />;
      case 'preparing': return <Package size={16} color="#1E40AF" />;
      case 'ready_for_delivery': return <Clock size={16} color="#1E40AF" />;
      case 'shipped': return <Truck size={16} color="#065F46" />;
      case 'completed': return <CheckCircle size={16} color="#065F46" />;
      case 'delivered': return <CheckCircle size={16} color="#065F46" />;
      case 'cancelled': return <XCircle size={16} color="#991B1B" />;
      case 'refunded': return <RefreshCw size={16} color="#374151" />;
      default: return <Clock size={16} color="#374151" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'active') {
      return ACTIVE_STATUSES.includes(order.status);
    } else {
      return COMPLETED_STATUSES.includes(order.status);
    }
  });

  const handleReorder = (order: any) => {
    // Add items back to cart
    Alert.alert(
      'Reordenar',
      '¿Quieres agregar estos productos al carrito nuevamente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, agregar',
          onPress: () => {
            // Here you would add the items back to cart
            Alert.alert('Productos agregados', 'Los productos se han agregado al carrito');
          }
        }
      ]
    );
  };

  const handleTrackOrder = (order: any) => {
    router.push(`/orders/${order.id}?tracking=true`);
  };

  const isPickupOrder = (order: any) => order.fulfillmentMode === 'pickup';

  const handleContactSupport = () => {
    Alert.alert(
      'Contactar Soporte',
      'Puedes contactarnos por:\n\n📧 Email: soporte@dogcatify.com\n📱 WhatsApp: +54 11 1234-5678',
      [{ text: 'Entendido' }]
    );
  };

  const handleRetryPayment = async (order: any) => {
    try {
      const isExpired = order.paymentLinkExpiresAt && new Date(order.paymentLinkExpiresAt) < new Date();

      if (!isExpired && order.lastPaymentUrl) {
        // Link aún válido, abrir directamente
        const canOpen = await Linking.canOpenURL(order.lastPaymentUrl);
        if (canOpen) {
          await Linking.openURL(order.lastPaymentUrl);
        } else {
          Alert.alert('Error', 'No se pudo abrir el link de pago');
        }
      } else {
        // Link expirado o no existe, regenerar
        Alert.alert(
          'Regenerar link de pago',
          isExpired
            ? 'El link de pago ha expirado. Se generará uno nuevo.'
            : 'Se generará un nuevo link de pago.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Continuar',
              onPress: async () => {
                try {
                  Alert.alert('Generando link...', 'Por favor espera');

                  const result = await regeneratePaymentLink(order.id);

                  if (result.success && result.paymentUrl) {
                    // Actualizar la orden local
                    await fetchOrders();

                    // Abrir el nuevo link
                    const canOpen = await Linking.canOpenURL(result.paymentUrl);
                    if (canOpen) {
                      await Linking.openURL(result.paymentUrl);
                    }
                  } else {
                    Alert.alert('Error', result.error || 'No se pudo generar el link de pago');
                  }
                } catch (error) {
                  console.error('Error regenerating payment:', error);
                  Alert.alert('Error', 'Hubo un problema al generar el link de pago');
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error handling retry payment:', error);
      Alert.alert('Error', 'No se pudo procesar el reintento de pago');
    }
  };

  const renderOrder = (order: any) => (
    <Card key={order.id} style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>Pedido {order.orderNumber}</Text>
          <Text style={styles.orderDate}>
            {order.createdAt.toLocaleDateString()}
          </Text>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(order.status) }
        ]}>
          {getStatusIcon(order.status)}
          <Text style={[
            styles.statusText,
            { color: getStatusTextColor(order.status) }
          ]}>
                {getOrderStatusLabel(order.status, order.orderType, order.shippingAddress)}
          </Text>
        </View>
      </View>

      <View style={styles.orderItems}>
        <Text style={styles.itemsTitle}>Productos ({order.items.length}):</Text>
        {order.items.slice(0, 2).map((item: any, index: number) => (
          <View key={index} style={styles.orderItem}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name || 'Producto'}</Text>
              <Text style={styles.itemQuantity}>x{item.quantity || 1}</Text>
            </View>
            <Text style={styles.itemPrice}>
              {formatCurrency((item.price || 0) * (item.quantity || 1))}
            </Text>
          </View>
        ))}
        {order.items.length > 2 && (
          <Text style={styles.moreItems}>
            +{order.items.length - 2} producto{order.items.length - 2 !== 1 ? 's' : ''} más
          </Text>
        )}
      </View>

      {order.shippingAddress && (
        <View style={styles.shippingInfo}>
          <MapPin size={16} color="#6B7280" />
          <Text style={styles.shippingAddress}>{order.shippingAddress}</Text>
        </View>
      )}

      <View style={styles.orderTotal}>
        <Text style={styles.totalLabel}>Total:</Text>
        <Text style={styles.totalAmount}>{formatCurrency(order.totalAmount)}</Text>
      </View>

      <View style={styles.orderActions}>
        {order.status === 'payment_failed' && (
          <TouchableOpacity
            style={styles.retryPaymentButton}
            onPress={() => handleRetryPayment(order)}
            activeOpacity={0.7}
          >
            <RefreshCw size={18} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.retryPaymentText}>
              {order.paymentLinkExpiresAt && new Date(order.paymentLinkExpiresAt) < new Date()
                ? 'Generar nuevo link'
                : 'Reintentar pago'}
            </Text>
          </TouchableOpacity>
        )}
        {order.status === 'delivered' && (
          <Button
            title="Reordenar"
            onPress={() => handleReorder(order)}
            variant="outline"
            size="small"
          />
        )}
        {!isPickupOrder(order) && ['pending', 'reserved', 'confirmed', 'processing', 'preparing', 'ready_for_delivery', 'shipped'].includes(order.status) && (
          <Button
            title="Rastrear"
            onPress={() => handleTrackOrder(order)}
            variant="outline"
            size="small"
          />
        )}
        <Button
          title="Ver Detalles"
          onPress={() => router.push(`/orders/${order.id}`)}
          size="small"
        />
      </View>
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Mis Pedidos</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingSpinner message="Cargando pedidos..." />
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
        <Text style={styles.title}>Mis Pedidos</Text>
        <TouchableOpacity onPress={handleContactSupport} style={styles.supportButton}>
          <Phone size={20} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Activos ({counts.active})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completados ({counts.completed})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        style={styles.content}
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderOrder(item)}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMoreOrders}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        ListEmptyComponent={
          orders.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Package size={64} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No tienes pedidos</Text>
              <Text style={styles.emptySubtitle}>
                Cuando realices compras en la tienda, aparecerán aquí
              </Text>
              <Button
                title="Ir a la Tienda"
                onPress={() => router.push('/(tabs)/shop')}
                size="large"
              />
            </Card>
          ) : (
            <Card style={styles.emptyCard}>
              <Package size={64} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>
                No hay pedidos {activeTab === 'active' ? 'activos' : 'completados'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'active'
                  ? 'Tus pedidos en proceso aparecerán aquí'
                  : 'Tus pedidos entregados y cancelados aparecerán aquí'
                }
              </Text>
            </Card>
          )
        }
        ListFooterComponent={
          <>
            {loadingMore && (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text style={styles.loadMoreText}>Cargando más pedidos...</Text>
              </View>
            )}

            <Card style={styles.quickActionsCard}>
              <Text style={styles.quickActionsTitle}>Acciones Rápidas</Text>
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => router.push('/(tabs)/shop')}
                >
                  <Package size={24} color="#3B82F6" />
                  <Text style={styles.quickActionText}>Ir a Tienda</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={handleContactSupport}
                >
                  <Phone size={24} color="#10B981" />
                  <Text style={styles.quickActionText}>Soporte</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => router.push('/cart')}
                >
                  <Package size={24} color="#F59E0B" />
                  <Text style={styles.quickActionText}>Mi Carrito</Text>
                </TouchableOpacity>
              </View>
            </Card>
          </>
        }
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
  supportButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3B82F6',
  },
  content: {
    flex: 1,
  },
  ordersList: {
    padding: 16,
    paddingBottom: 8,
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
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
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
  orderCard: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  orderDate: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    marginLeft: 4,
  },
  orderItems: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  itemsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    flex: 1,
  },
  itemQuantity: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginLeft: 8,
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  moreItems: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  shippingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  shippingAddress: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 6,
    flex: 1,
  },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  totalAmount: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  orderActions: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 8,
  },
  retryPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  retryPaymentText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  quickActionsCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickAction: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  quickActionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
  },
  loadMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
});
