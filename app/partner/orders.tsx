import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Package, DollarSign, Truck, Clock, MapPin, User, Phone } from 'lucide-react-native';
import { Card, Button, IconButton, EmptyState, SkeletonList, toast } from '../../components/ui';
import { formatMoney, formatNumber } from '../../components/partner/format';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { OrderStatusBanner } from '../../components/OrderStatusBanner';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { getOrderFulfillmentMode, getOrderStatusLabel } from '../../utils/orderFulfillment';
import { isOrderChatOpen, openOrderChat } from '../../utils/orderChat';
import { useOrderChatUnread } from '../../hooks/useOrderChatUnread';

export default function PartnerOrders() {
  const params = useLocalSearchParams<{
    partnerId?: string | string[];
    businessId?: string | string[];
    activeTab?: 'pending' | 'processing' | 'completed' | string | string[];
    openOrderId?: string | string[];
  }>();

  const normalizeParam = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;

  const normalizedPartnerId = Array.isArray(params.partnerId)
    ? params.partnerId[0]
    : (params.partnerId || (Array.isArray(params.businessId) ? params.businessId[0] : params.businessId));
  const initialTab = normalizeParam(params.activeTab);
  const initialOpenOrderId = normalizeParam(params.openOrderId);
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'processing' | 'completed'>(
    initialTab === 'processing' || initialTab === 'completed' ? initialTab : 'pending'
  );
  const [loading, setLoading] = useState(true);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(initialOpenOrderId || null);
  const orderChatUnread = useOrderChatUnread(normalizedPartnerId, currentUser?.id);

  useEffect(() => {
    if (!currentUser || !normalizedPartnerId) return;

    console.log('Loading orders for partner ID:', normalizedPartnerId as string);

    // Get partner profile using Supabase
    const fetchPartnerProfile = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('partners')
          .select('*')
          .eq('id', normalizedPartnerId)
          .single();
        
        if (error) throw error;
        
        if (data) {
          setPartnerProfile({
            id: data.id,
            businessName: data.business_name,
            businessType: data.business_type,
            ...data
          });
          fetchOrders(normalizedPartnerId as string);
        }
      } catch (error) {
        console.error('Error fetching partner profile:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPartnerProfile();
    
    // Set up real-time subscription
    const subscription = supabaseClient
      .channel('partner-profile-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'partners',
          filter: `id=eq.${normalizedPartnerId}`
        }, 
        () => {
          fetchPartnerProfile();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUser, normalizedPartnerId]);

  const isOrderForPartner = (order: any, partnerId: string) => {
    if (order?.is_split_master) return false;

    if (order?.partner_id === partnerId) return true;

    if (order?.partner_breakdown?.partners && Object.prototype.hasOwnProperty.call(order.partner_breakdown.partners, partnerId)) {
      return true;
    }

    if (Array.isArray(order?.items)) {
      return order.items.some((item: any) => item?.partnerId === partnerId || item?.partner_id === partnerId);
    }

    return false;
  };

  const resolveOrderType = (order: any) => {
    const rawType = String(order?.orderType || order?.order_type || '').toLowerCase();

    if (rawType === 'service_booking') {
      return 'service_booking';
    }

    const hasServiceBookingData =
      Boolean(order?.booking_id) ||
      Boolean(order?.service_id) ||
      Boolean(order?.service_name) ||
      Boolean(order?.appointment_date) ||
      Boolean(order?.appointment_time) ||
      (Array.isArray(order?.items) && order.items.some((item: any) =>
        item?.type === 'service' ||
        Boolean(item?.service_name) ||
        Boolean(item?.booking_id)
      ));

    return hasServiceBookingData ? 'service_booking' : (rawType || 'product_purchase');
  };

  const fetchOrders = (partnerId: string) => {
    const fetchOrdersData = async () => {
      try {
        const breakdownFilter = JSON.stringify({ partners: { [partnerId]: {} } });

        const { data, error } = await supabaseClient
          .from('orders')
          .select('*')
          .or(`partner_id.eq.${partnerId},partner_breakdown.cs.${breakdownFilter}`)
          .eq('is_split_master', false)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const ordersData = (data || [])
          .filter(order => isOrderForPartner(order, partnerId))
          .map(order => ({
          id: order.id,
          orderNumber: order.order_number,
          ...order,
          partnerId: order.partner_id,
          customerId: order.customer_id,
          orderType: resolveOrderType(order),
          totalAmount: order.total_amount,
          shippingAddress: order.shipping_address,
          shippingCost: order.shipping_cost || 0,
          fulfillmentMode: getOrderFulfillmentMode(resolveOrderType(order), order.shipping_address),
          createdAt: new Date(order.created_at),
          updatedAt: order.updated_at ? new Date(order.updated_at) : null,
          serviceName: order.service_name || order.serviceName || null,
          bookingId: order.booking_id || null,
          appointmentDate: order.appointment_date || null,
          appointmentTime: order.appointment_time || null,
          petName: order.pet_name || null,
          bookingNotes: order.booking_notes || null,
        }));
        
        setOrders(ordersData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching orders:', error);
        setLoading(false);
      }
    };
    
    fetchOrdersData();
    
    // Set up real-time subscription
    const subscription = supabaseClient
      .channel('orders-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `partner_id=eq.${partnerId}`
        }, 
        () => {
          fetchOrdersData();
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  };

  const getFulfillmentMode = (order: any) => {
    return order.fulfillmentMode || getOrderFulfillmentMode(resolveOrderType(order), order.shippingAddress);
  };

  const getReadyStatusMessage = (order: any) => {
    return getFulfillmentMode(order) === 'pickup'
      ? 'Pedido listo para retirar en tienda'
      : 'Pedido listo para entrega';
  };

  const handleOpenOrderChat = async (order: any) => {
    const result = await openOrderChat(order.id, order.orderNumber);
    if (!result.ok) {
      toast.error(
        result.reason === 'closed' ? 'El chat de este pedido ya está cerrado' : 'No pudimos abrir el chat',
        result.reason === 'closed' ? undefined : 'Probá de nuevo en un momento.'
      );
    }
  };

  const handleUpdateOrderStatus = async (order: any, newStatus: string) => {
    try {
      // Optimistic update: actualizar el estado localmente primero
      setOrders(prevOrders =>
        prevOrders.map(prevOrder =>
          prevOrder.id === order.id
            ? { ...prevOrder, status: newStatus, updatedAt: new Date() }
            : prevOrder
        )
      );

      const { error } = await supabaseClient
        .from('orders')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;

      const statusMessages = {
        processing: 'Pedido en procesamiento',
        ready_for_delivery: getReadyStatusMessage(order),
        shipped: 'Pedido enviado',
        delivered: 'Pedido entregado',
        cancelled: 'Pedido cancelado'
      };

      toast.success(statusMessages[newStatus as keyof typeof statusMessages]);
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'No se pudo actualizar el pedido');
      // Revertir el cambio optimista recargando los datos
      if (normalizedPartnerId) {
        fetchOrders(normalizedPartnerId as string);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FEF3C7';
      case 'reserved': return '#FEF3C7';
      case 'payment_failed': return '#FECACA';
      case 'insufficient_stock': return '#FEE2E2';
      case 'confirmed': return '#D5E8E9';
      case 'processing': return '#D5E8E9';
      case 'preparing': return '#D5E8E9';
      case 'ready_for_delivery': return '#D1FAE5';
      case 'shipped': return '#D1FAE5';
      case 'delivered': return '#D1FAE5';
      case 'completed': return '#D1FAE5';
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
      case 'insufficient_stock': return '#991B1B';
      case 'confirmed': return '#1C4245';
      case 'processing': return '#1C4245';
      case 'preparing': return '#1C4245';
      case 'ready_for_delivery': return '#065F46';
      case 'shipped': return '#065F46';
      case 'delivered': return '#065F46';
      case 'completed': return '#065F46';
      case 'cancelled': return '#991B1B';
      case 'refunded': return '#374151';
      default: return '#374151';
    }
  };

  const getStatusText = (status: string, orderType?: string, shippingAddress?: string | null) => {
    return getOrderStatusLabel(status, orderType, shippingAddress);
  };

  const isServiceOrder = (order: any) => resolveOrderType(order) === 'service_booking';

  const isPendingTabOrder = (order: any) => {
    if (isServiceOrder(order)) {
      return ['pending', 'reserved', 'payment_failed'].includes(order.status);
    }
    return ['pending', 'insufficient_stock'].includes(order.status);
  };

  const isProcessingTabOrder = (order: any) => {
    if (isServiceOrder(order)) {
      return order.status === 'confirmed';
    }
    return ['confirmed', 'processing', 'preparing', 'ready_for_delivery', 'shipped'].includes(order.status);
  };

  const isCompletedTabOrder = (order: any) => {
    if (isServiceOrder(order)) {
      return ['completed', 'cancelled', 'refunded'].includes(order.status);
    }
    return ['delivered', 'cancelled', 'refunded'].includes(order.status);
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'pending') return isPendingTabOrder(order);
    if (activeTab === 'processing') return isProcessingTabOrder(order);
    return isCompletedTabOrder(order);
  });

  useEffect(() => {
    if (!initialOpenOrderId || orders.length === 0) return;

    const targetOrder = orders.find(order => order.id === initialOpenOrderId);
    if (!targetOrder) return;

    if (isPendingTabOrder(targetOrder)) {
      setActiveTab('pending');
    } else if (isProcessingTabOrder(targetOrder)) {
      setActiveTab('processing');
    } else {
      setActiveTab('completed');
    }

    setExpandedOrderId(initialOpenOrderId);
  }, [orders, initialOpenOrderId]);

  const formatCurrency = (amount: number) => formatMoney(amount);

  const shouldShowDetailToggle = (order: any) => {
    if (isServiceOrder(order)) {
      return order.status === 'confirmed';
    }

    return ['confirmed', 'insufficient_stock', 'processing', 'preparing', 'shipped'].includes(order.status);
  };

  // Helper function to get customer profile data
  const getCustomerInfo = async (customerId: string) => {
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('display_name, email, phone')
        .eq('id', customerId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching customer info:', error);
      return null;
    }
  };

  const renderOrder = (order: any) => (
    <Card key={order.id} style={styles.orderCard}>
      {(() => {
        const fulfillmentMode = getFulfillmentMode(order);
        const isPickupOrder = fulfillmentMode === 'pickup';

        return (
          <>
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>Pedido {order.orderNumber || `#${order.id.slice(-6)}`}</Text>
          <Text style={styles.customerName}>Cliente</Text>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(order.status) }
        ]}>
          <Text style={[
          styles.statusText,
          { color: getStatusTextColor(order.status) }
        ]}>
          {getStatusText(order.status, order.orderType, order.shippingAddress)}
          </Text>
        </View>
      </View>

      <View style={styles.orderItems}>
        <Text style={styles.itemsTitle}>{isServiceOrder(order) ? 'Servicios:' : 'Productos:'}</Text>
        {order.items && Array.isArray(order.items) && order.items.map((item: any, index: number) => (
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
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.orderDetail}>
          <Clock size={16} color="#6B7280" />
          <Text style={styles.orderDetailText}>
            {order.createdAt.toLocaleDateString()} {order.createdAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </Text>
        </View>

        {order.shippingAddress && (
          <View style={styles.orderDetail}>
            <MapPin size={16} color="#6B7280" />
            <Text style={styles.orderDetailText}>
              {order.shippingAddress}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.orderPricing}>
        {/* Subtotal de productos */}
        <View style={styles.pricingRow}>
          <Text style={styles.pricingLabel}>Subtotal:</Text>
          <Text style={styles.pricingValue}>
            {formatCurrency(order.items?.reduce((sum: number, item: any) =>
              sum + ((item.price || 0) * (item.quantity || 1)), 0) || 0)}
          </Text>
        </View>

        {/* Costo de envío si existe */}
        {order.shippingCost && order.shippingCost > 0 && (
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Envío:</Text>
            <Text style={styles.pricingValue}>{formatCurrency(order.shippingCost)}</Text>
          </View>
        )}

        {/* Total final */}
        <View style={styles.orderTotal}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalAmount}>{formatCurrency(order.totalAmount || 0)}</Text>
        </View>
      </View>

      <View style={styles.orderActions}>
        {shouldShowDetailToggle(order) && (
          <TouchableOpacity
            style={styles.detailToggleButton}
            onPress={() => setExpandedOrderId(prev => prev === order.id ? null : order.id)}
            accessibilityRole="button"
            accessibilityState={{ expanded: expandedOrderId === order.id }}
          >
            <Text style={styles.detailToggleText}>
              {expandedOrderId === order.id ? 'Ocultar detalle' : 'Ver detalle para preparación'}
            </Text>
          </TouchableOpacity>
        )}

        {expandedOrderId === order.id && (
          <View style={styles.preparationDetailsCard}>
            <Text style={styles.preparationDetailsTitle}>
              {isServiceOrder(order) ? 'Detalle de la reserva' : 'Detalle operativo'}
            </Text>

            <View style={styles.preparationRow}>
              <User size={16} color="#374151" />
              <Text style={styles.preparationText}>
                Cliente: {order.customer_name || order.customerName || order.customer_id || 'No disponible'}
              </Text>
            </View>

            {isServiceOrder(order) ? (
              <>
                {!!(order.serviceName || order.service_name) && (
                  <View style={styles.preparationRow}>
                    <Package size={16} color="#374151" />
                    <Text style={styles.preparationText}>
                      Servicio: {order.serviceName || order.service_name}
                    </Text>
                  </View>
                )}

                {!!order.petName && (
                  <View style={styles.preparationRow}>
                    <User size={16} color="#374151" />
                    <Text style={styles.preparationText}>Mascota: {order.petName}</Text>
                  </View>
                )}

                {(order.appointmentDate || order.appointmentTime) && (
                  <View style={styles.preparationRow}>
                    <Clock size={16} color="#374151" />
                    <Text style={styles.preparationText}>
                      {[
                        order.appointmentDate,
                        order.appointmentTime ? `a las ${order.appointmentTime}` : null,
                      ].filter(Boolean).join(' ')}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              !!order.shippingAddress && (
                <View style={styles.preparationRow}>
                  <MapPin size={16} color="#374151" />
                  <Text style={styles.preparationText}>Entrega: {order.shippingAddress}</Text>
                </View>
              )
            )}

            {(order.notes || order.special_instructions || order.delivery_notes) && (
              <View style={styles.preparationNotesBox}>
                <Text style={styles.preparationNotesTitle}>Notas del pedido</Text>
                <Text style={styles.preparationNotesText}>
                  {order.notes || order.special_instructions || order.delivery_notes}
                </Text>
              </View>
            )}

            {Array.isArray(order.items) && order.items.length > 0 && (
              <View style={styles.preparationItemsBox}>
                <Text style={styles.preparationItemsTitle}>
                  {isServiceOrder(order) ? 'Servicios incluidos' : 'Checklist de armado'}
                </Text>
                {order.items.map((item: any, index: number) => (
                  <View key={`${order.id}-detail-${index}`} style={styles.preparationItemRow}>
                    <Text style={styles.preparationItemName}>
                      {item.quantity || 1} x {isServiceOrder(order)
                        ? item.service_name || item.name || 'Servicio'
                        : item.name || 'Producto'}
                    </Text>
                    <Text style={styles.preparationItemSubtotal}>
                      {formatCurrency((item.price || 0) * (item.quantity || 1))}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {(isOrderChatOpen(order.status) || orderChatUnread.conversationByOrder[order.id]) && (
          <Button
            title={
              orderChatUnread.byOrder[order.id]
                ? `Responder al cliente (${orderChatUnread.byOrder[order.id]} ${orderChatUnread.byOrder[order.id] === 1 ? 'mensaje nuevo' : 'mensajes nuevos'})`
                : orderChatUnread.conversationByOrder[order.id]
                  ? 'Ver chat con el cliente'
                  : 'Chatear con el cliente'
            }
            onPress={() => handleOpenOrderChat(order)}
            variant={orderChatUnread.byOrder[order.id] ? 'primary' : 'outline'}
            size="small"
          />
        )}

        {order.status === 'pending' && !isServiceOrder(order) && (
          <>
            <Button
              title="Cancelar"
              onPress={() => handleUpdateOrderStatus(order, 'cancelled')}
              variant="outline"
              size="small"
            />
            <Button
              title="Procesar"
              onPress={() => handleUpdateOrderStatus(order, 'processing')}
              size="small"
            />
          </>
        )}

        {isServiceOrder(order) && order.status === 'confirmed' && (
          <>
            <Button
              title="Cancelar"
              onPress={() => handleUpdateOrderStatus(order, 'cancelled')}
              variant="outline"
              size="small"
            />
            <Button
              title="Marcar como completado"
              onPress={() => handleUpdateOrderStatus(order, 'completed')}
              size="small"
            />
          </>
        )}
        
        {!isServiceOrder(order) && ['confirmed', 'processing', 'preparing'].includes(order.status) && (
          <Button
            title={isPickupOrder ? 'Marcar listo para retirar' : 'Marcar listo para entrega'}
            onPress={() => handleUpdateOrderStatus(order, 'ready_for_delivery')}
            size="small"
          />
        )}

        {!isServiceOrder(order) && order.status === 'ready_for_delivery' && (
          <View style={styles.readyForDeliveryInfo}>
            <Text style={styles.readyForDeliveryText}>
              {isPickupOrder ? 'Ya pueden retirar el pedido en tienda' : 'Esperando que un repartidor tome el pedido'}
            </Text>
          </View>
        )}
        
        {!isServiceOrder(order) && order.status === 'shipped' && (
          <Button
            title="Marcar como entregado"
            onPress={() => handleUpdateOrderStatus(order, 'delivered')}
            size="small"
          />
        )}
      </View>
          </>
        );
      })()}
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <SkeletonList kind="cards" count={3} style={{ padding: spacing.lg }} />
      </SafeAreaView>
    );
  }

  if (!partnerProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <IconButton
              icon={<ArrowLeft size={24} color={colors.text} />}
              onPress={() => router.back()}
              accessibilityLabel="Volver"
            />
            <View>
              <Text style={styles.title}>Gestionar pedidos</Text>
              <Text style={styles.businessName}>Cargando información...</Text>
            </View>
          </View>
          <View style={styles.placeholder} />
        </View>
        <SkeletonList kind="cards" count={3} style={{ padding: spacing.lg }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <IconButton
            icon={<ArrowLeft size={24} color={colors.text} />}
            onPress={() => router.back()}
            accessibilityLabel="Volver"
          />
          <View style={styles.businessInfo}>
            {partnerProfile.logo ? (
              <Image source={{ uri: partnerProfile.logo }} style={styles.businessLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Package size={20} color={colors.primary} />
              </View>
            )}
            <View>
              <Text style={styles.title}>Gestionar pedidos</Text>
              <Text style={styles.businessName}>{partnerProfile.businessName}</Text>
            </View>
          </View>
        </View>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.bannerContainer}>
        <OrderStatusBanner />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'pending' }}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pendientes ({orders.filter(isPendingTabOrder).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'processing' && styles.activeTab]}
          onPress={() => setActiveTab('processing')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'processing' }}
        >
          <Text style={[styles.tabText, activeTab === 'processing' && styles.activeTabText]}>
            En proceso ({orders.filter(isProcessingTabOrder).length})
            {orderChatUnread.total > 0 ? ` · ${orderChatUnread.total} sin leer` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'completed' }}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completados ({orders.filter(isCompletedTabOrder).length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>Resumen de pedidos</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{formatNumber(orders.length)}</Text>
              <Text style={styles.statLabel}>Pedidos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {orders.filter(isPendingTabOrder).length}
              </Text>
              <Text style={styles.statLabel}>Pendientes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {orders.filter(isCompletedTabOrder).length}
              </Text>
              <Text style={styles.statLabel}>Completados</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {formatCurrency(orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0))}
              </Text>
              <Text style={styles.statLabel}>Ingresos</Text>
            </View>
          </View>
        </Card>

        {filteredOrders.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              icon={<Package size={32} color={colors.primary} />}
              title={`No hay pedidos ${activeTab === 'pending' ? 'pendientes' : activeTab === 'processing' ? 'en proceso' : 'completados'}`}
              description="Los pedidos van a aparecer acá cuando tus clientes compren."
            />
          </Card>
        ) : (
          filteredOrders.map(renderOrder)
        )}
      </ScrollView>
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
    padding: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  businessLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.md,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  logoPlaceholderText: {
    fontSize: 20,
  },
  businessName: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  placeholder: {
    width: 32,
  },
  bannerContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
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
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: colors.textTertiary,
  },
  activeTabText: {
    color: colors.primary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textTertiary,
  },
  statsCard: {
    marginBottom: spacing.lg,
  },
  statsTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: colors.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  orderCard: {
    marginBottom: spacing.md,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  customerName: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
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
    marginBottom: spacing.sm,
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  itemQuantity: {
    ...typography.label,
    color: colors.textTertiary,
    marginLeft: spacing.sm,
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  orderDetails: {
    marginBottom: spacing.md,
  },
  orderDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  orderDetailText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  orderPricing: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pricingLabel: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  pricingValue: {
    ...typography.label,
    color: colors.textSecondary,
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
    ...typography.bodyStrong,
    color: colors.text,
  },
  totalAmount: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: colors.success,
  },
  orderActions: {
    flexDirection: 'column',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  readyForDeliveryInfo: {
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: 10,
  },
  readyForDeliveryText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#065F46',
    textAlign: 'center',
  },
  detailToggleButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
  },
  detailToggleText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.primaryStrong,
  },
  preparationDetailsCard: {
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: 10,
    backgroundColor: '#F8FBFF',
    padding: spacing.md,
    gap: spacing.sm,
  },
  preparationDetailsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E3A8A',
  },
  preparationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  preparationText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  preparationNotesBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  preparationNotesTitle: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  preparationNotesText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  preparationItemsBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  preparationItemsTitle: {
    ...typography.captionStrong,
    color: colors.textSecondary,
  },
  preparationItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preparationItemName: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  preparationItemSubtotal: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  orderActionButton: {
    marginBottom: spacing.xs,
    gap: spacing.md,
    marginTop: spacing.md,
  },
  actionButton: {
    width: '100%',
  },
});
