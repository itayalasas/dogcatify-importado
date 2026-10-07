import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert, Linking, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Package, Clock, Truck, CircleCheck as CheckCircle, Circle as XCircle, MapPin, Phone, Star, AlertCircle, RefreshCw, Trash2 } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ScreenHeader, IconButton, Badge, badgeColors, EmptyState, SkeletonList, SegmentedControl, toast } from '../../components/ui';
import { colors, radius, spacing, typography, touchTarget } from '../../constants/theme';
import { formatPrice } from '../../components/shop/format';
import { getOrderStatusTone } from '../../components/shop/orderStatus';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { regeneratePaymentLink } from '../../utils/mercadoPago';
import { useBackToHome } from '../../hooks/useBackToHome';
import { getOrderFulfillmentMode, getOrderStatusLabel } from '../../utils/orderFulfillment';
import { isServiceBookingOrder, resolveOrderType } from '../../utils/orderClassification';

export default function MyOrders() {
  const { currentUser } = useAuth();
  // Arriving from a payment result screen the history is cleared, so "back"
  // goes home; opened normally (e.g. from Perfil) it goes back as usual.
  const { from } = useLocalSearchParams<{ from?: string }>();
  const cameFromPayment = from === 'payment';
  const goHomeOnBack = useBackToHome(cameFromPayment);
  const handleBack = () => (cameFromPayment ? goHomeOnBack() : router.back());
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [counts, setCounts] = useState({ active: 0, completed: 0 });
  const [pickupConfirmingOrderId, setPickupConfirmingOrderId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  const PAGE_SIZE = 20;
  const ACTIVE_STATUSES = ['pending', 'reserved', 'payment_failed', 'insufficient_stock', 'confirmed', 'processing', 'preparing', 'ready_for_delivery', 'shipped'];
  const COMPLETED_STATUSES = ['completed', 'delivered', 'cancelled', 'refunded'];
  // Orders that never actually went through — nothing to fulfill, nothing to
  // notify a partner about — so the customer can remove them themselves.
  // Anything past this (confirmed onward) stays, matching the DB-level
  // restriction in the "Partners, customers and admins can delete orders"
  // RLS policy.
  const DELETABLE_STATUSES = ['pending', 'payment_failed', 'insufficient_stock'];
  const RETRYABLE_STATUSES = ['pending', 'payment_failed'];

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
          .eq('is_split_master', false)
          .in('status', ACTIVE_STATUSES),
        supabaseClient
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', currentUser.id)
          .eq('is_split_master', false)
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
        .select('id, order_number, partner_id, customer_id, items, status, order_type, service_name, booking_id, appointment_date, appointment_time, pet_name, booking_notes, total_amount, shipping_address, created_at, updated_at, payment_link_expires_at, last_payment_url, payment_retry_count, is_split_master')
        .eq('customer_id', currentUser.id)
        .eq('is_split_master', false)
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
        orderType: resolveOrderType(order),
        fulfillmentMode: getOrderFulfillmentMode(resolveOrderType(order), order.shipping_address),
        totalAmount: order.total_amount || 0,
        shippingAddress: order.shipping_address || '',
        createdAt: new Date(order.created_at),
        updatedAt: order.updated_at ? new Date(order.updated_at) : null,
        paymentLinkExpiresAt: order.payment_link_expires_at ? new Date(order.payment_link_expires_at) : null,
        lastPaymentUrl: order.last_payment_url,
        paymentRetryCount: order.payment_retry_count || 0,
        serviceName: order.service_name || null,
        bookingId: order.booking_id || null,
        appointmentDate: order.appointment_date || null,
        appointmentTime: order.appointment_time || null,
        petName: order.pet_name || null,
        bookingNotes: order.booking_notes || null,
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

  const getStatusIcon = (status: string) => {
    const color = badgeColors[getOrderStatusTone(status)].fg;
    switch (status) {
      case 'pending': return <Clock size={14} color={color} />;
      case 'reserved': return <Clock size={14} color={color} />;
      case 'payment_failed': return <AlertCircle size={14} color={color} />;
      case 'insufficient_stock': return <AlertCircle size={14} color={color} />;
      case 'confirmed': return <CheckCircle size={14} color={color} />;
      case 'processing': return <Package size={14} color={color} />;
      case 'preparing': return <Package size={14} color={color} />;
      case 'ready_for_delivery': return <Clock size={14} color={color} />;
      case 'shipped': return <Truck size={14} color={color} />;
      case 'completed': return <CheckCircle size={14} color={color} />;
      case 'delivered': return <CheckCircle size={14} color={color} />;
      case 'cancelled': return <XCircle size={14} color={color} />;
      case 'refunded': return <RefreshCw size={14} color={color} />;
      default: return <Clock size={14} color={color} />;
    }
  };

  const getOrderTitle = (order: any) => {
    const items = order.items || [];
    const first = items[0];
    const firstName = isServiceBookingOrder(order)
      ? order.serviceName || first?.service_name || first?.name || 'Servicio'
      : first?.name || 'Pedido';
    const storeName = first?.partnerName || first?.partner_name || order.partnerName || null;
    const extra = items.length > 1 ? ` y ${items.length - 1} más` : '';
    return { title: `${firstName}${extra}`, storeName };
  };

  const formatCurrency = (amount: number) => formatPrice(amount);

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
      '¿Querés agregar estos productos al carrito nuevamente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, agregar',
          onPress: () => {
            // Here you would add the items back to cart
            toast.success('Agregamos los productos al carrito');
          }
        }
      ]
    );
  };

  const handleTrackOrder = (order: any) => {
    router.push(`/orders/${order.id}?tracking=true`);
  };

  const submitPickupConfirmation = async (order: any) => {
    try {
      setPickupConfirmingOrderId(order.id);

      const now = new Date().toISOString();
      const { error } = await supabaseClient
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: now,
          updated_at: now,
        })
        .eq('id', order.id)
        .eq('customer_id', currentUser!.id);

      if (error) throw error;

      toast.success('Retiro confirmado. Le avisamos a la tienda.');

      await Promise.all([fetchOrders(true), fetchOrderCounts()]);
    } catch (error) {
      console.error('Error confirming pickup:', error);
      Alert.alert('Error', 'No se pudo confirmar el retiro del pedido');
      await Promise.all([fetchOrders(true), fetchOrderCounts()]);
    } finally {
      setPickupConfirmingOrderId(null);
    }
  };

  const handleConfirmPickup = (order: any) => {
    Alert.alert(
      'Confirmar retiro',
      '¿Ya retiraste tu compra en tienda?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, confirmar', onPress: () => { void submitPickupConfirmation(order); } },
      ]
    );
  };

  const isPickupOrder = (order: any) => order.fulfillmentMode === 'pickup';
  const isServiceOrder = (order: any) => isServiceBookingOrder(order);

  const handleContactSupport = () => {
    Alert.alert(
      'Contactar soporte',
      'Podés contactarnos por:\n\nEmail: soporte@dogcatify.com\nWhatsApp: +54 11 1234-5678',
      [{ text: 'Entendido' }]
    );
  };

  const submitDeleteOrder = async (order: any) => {
    try {
      setDeletingOrderId(order.id);

      const { error } = await supabaseClient
        .from('orders')
        .delete()
        .eq('id', order.id)
        .eq('customer_id', currentUser!.id);

      if (error) throw error;

      await Promise.all([fetchOrders(true), fetchOrderCounts()]);
    } catch (error) {
      console.error('Error deleting order:', error);
      Alert.alert('Error', 'No se pudo eliminar el pedido');
    } finally {
      setDeletingOrderId(null);
    }
  };

  const handleDeleteOrder = (order: any) => {
    Alert.alert(
      'Eliminar pedido',
      `¿Seguro que querés eliminar el pedido ${order.orderNumber}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => { void submitDeleteOrder(order); } },
      ]
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
            ? 'El link de pago venció. Vamos a generar uno nuevo.'
            : 'Vamos a generar un nuevo link de pago.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Continuar',
              onPress: async () => {
                try {
                  toast.info('Generando el link de pago...');

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
          <Text style={styles.orderNumber} numberOfLines={2}>{getOrderTitle(order).title}</Text>
          {getOrderTitle(order).storeName ? (
            <Text style={styles.orderStore} numberOfLines={1}>{getOrderTitle(order).storeName}</Text>
          ) : null}
          <Text style={styles.orderDate}>
            Pedido {order.orderNumber} · {order.createdAt.toLocaleDateString('es-UY')}
          </Text>
        </View>
        <Badge
          label={getOrderStatusLabel(order.status, order.orderType, order.shippingAddress)}
          tone={getOrderStatusTone(order.status)}
          icon={getStatusIcon(order.status)}
          size="small"
        />
      </View>

      <View style={styles.orderItems}>
        <Text style={styles.itemsTitle}>
          {isServiceOrder(order) ? `Servicios (${order.items.length})` : `Productos (${order.items.length})`}
        </Text>
        {order.items.slice(0, 2).map((item: any, index: number) => (
          <View key={index} style={styles.orderItem}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>
                {isServiceOrder(order)
                  ? item.service_name || item.name || 'Servicio'
                  : item.name || 'Producto'}
              </Text>
              <Text style={styles.itemQuantity}>x{item.quantity || 1}</Text>
            </View>
            <Text style={styles.itemPrice}>
              {formatCurrency((item.price || 0) * (item.quantity || 1))}
            </Text>
          </View>
        ))}
        {order.items.length > 2 && (
          <Text style={styles.moreItems}>
            +{order.items.length - 2} {isServiceOrder(order) ? 'servicio' : 'producto'}{order.items.length - 2 !== 1 ? 's' : ''} más
          </Text>
        )}
      </View>

      {!isServiceOrder(order) && order.shippingAddress && (
        <View style={styles.shippingInfo}>
          <MapPin size={16} color={colors.textSecondary} />
          <Text style={styles.shippingAddress}>{order.shippingAddress}</Text>
        </View>
      )}

      <View style={styles.orderTotal}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>{formatCurrency(order.totalAmount)}</Text>
      </View>

      <View style={styles.orderActions}>
        {RETRYABLE_STATUSES.includes(order.status) && (
          <Button
            title={order.paymentLinkExpiresAt && new Date(order.paymentLinkExpiresAt) < new Date()
              ? 'Generar nuevo link'
              : 'Reintentar pago'}
            onPress={() => handleRetryPayment(order)}
            icon={<RefreshCw size={18} color={colors.onPrimary} strokeWidth={2.5} />}
          />
        )}
        {DELETABLE_STATUSES.includes(order.status) && (
          <TouchableOpacity
            style={styles.deleteOrderButton}
            onPress={() => handleDeleteOrder(order)}
            activeOpacity={0.7}
            disabled={deletingOrderId === order.id}
            accessibilityRole="button"
            accessibilityState={{ disabled: deletingOrderId === order.id, busy: deletingOrderId === order.id }}
          >
            <Trash2 size={18} color={colors.danger} strokeWidth={2.5} />
            <Text style={styles.deleteOrderText}>
              {deletingOrderId === order.id ? 'Eliminando...' : 'Eliminar pedido'}
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
        {isPickupOrder(order) && order.status === 'ready_for_delivery' && (
          <Button
            title="Confirmar retiro"
            onPress={() => handleConfirmPickup(order)}
            variant="outline"
            size="small"
            loading={pickupConfirmingOrderId === order.id}
          />
        )}
        {!isServiceOrder(order) && !isPickupOrder(order) && ['pending', 'reserved', 'confirmed', 'processing', 'preparing', 'ready_for_delivery', 'shipped'].includes(order.status) && (
          <Button
            title="Rastrear"
            onPress={() => handleTrackOrder(order)}
            variant="outline"
            size="small"
          />
        )}
        <Button
          title="Ver detalle"
          onPress={() => router.push(`/orders/${order.id}`)}
          variant="secondary"
          size="small"
        />
      </View>
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Mis pedidos" onBack={handleBack} />
        <SkeletonList kind="cards" count={3} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Mis pedidos"
        onBack={handleBack}
        right={
          <IconButton
            icon={<Phone size={20} color={colors.primary} />}
            onPress={handleContactSupport}
            accessibilityLabel="Contactar soporte"
          />
        }
      />

      <View style={styles.tabBar}>
        <SegmentedControl
          options={[
            { value: 'active', label: `Activos (${counts.active})` },
            { value: 'completed', label: `Completados (${counts.completed})` },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </View>

      <FlatList
        style={styles.content}
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderOrder(item)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMoreOrders}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          orders.length === 0 ? (
            <EmptyState
              icon={<Package size={32} color={colors.primary} />}
              title="Todavía no tenés pedidos"
              description="Cuando compres en la tienda, tus pedidos van a aparecer acá."
              actionLabel="Ir a la tienda"
              onAction={() => router.push('/(tabs)/shop')}
            />
          ) : (
            <EmptyState
              icon={<Package size={32} color={colors.primary} />}
              title={`No hay pedidos ${activeTab === 'active' ? 'activos' : 'completados'}`}
              description={activeTab === 'active'
                ? 'Tus pedidos en proceso van a aparecer acá.'
                : 'Tus pedidos entregados y cancelados van a aparecer acá.'}
            />
          )
        }
        ListFooterComponent={
          <>
            {loadingMore && (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadMoreText}>Cargando más pedidos...</Text>
              </View>
            )}

            <Card style={styles.quickActionsCard}>
              <Text style={styles.quickActionsTitle}>Acciones rápidas</Text>
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => router.push('/(tabs)/shop')}
                  accessibilityRole="button"
                >
                  <Package size={24} color={colors.primary} />
                  <Text style={styles.quickActionText}>Ir a la tienda</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={handleContactSupport}
                  accessibilityRole="button"
                >
                  <Phone size={24} color={colors.primary} />
                  <Text style={styles.quickActionText}>Soporte</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => router.push('/cart')}
                  accessibilityRole="button"
                >
                  <Package size={24} color={colors.primary} />
                  <Text style={styles.quickActionText}>Mi carrito</Text>
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
  supportButton: {
    padding: spacing.sm,
  },
  placeholder: {
    width: 40,
  },
  tabBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingTop: spacing.lg,
    flexGrow: 1,
  },
  ordersList: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
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
  orderCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  orderStore: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  orderDate: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    marginLeft: spacing.xs,
  },
  orderItems: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  itemsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.sm,
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
    color: colors.text,
    flex: 1,
  },
  itemQuantity: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  moreItems: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  shippingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  shippingAddress: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginLeft: 6,
    flex: 1,
  },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  totalAmount: {
    ...typography.heading,
    color: colors.text,
  },
  orderActions: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  retryPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  retryPaymentText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: colors.white,
  },
  deleteOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
    minHeight: touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  deleteOrderText: {
    ...typography.label,
    color: colors.danger,
  },
  quickActionsCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickAction: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  quickActionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: colors.text,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  loadMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  loadMoreText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
});
