import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Package, Clock, Truck, CircleCheck as CheckCircle, Circle as XCircle, MapPin, Phone, Star, MessageSquare, MessageCircle, ChevronRight, RefreshCw, Trash2 } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { OrderStatusBanner } from '../../components/OrderStatusBanner';
import { ScreenHeader, IconButton, Badge, EmptyState, Skeleton, SkeletonCard, toast } from '../../components/ui';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { formatPrice } from '../../components/shop/format';
import { getOrderStatusTone } from '../../components/shop/orderStatus';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { regeneratePaymentLink } from '../../utils/mercadoPago';
import { OrderTracking } from '../../components/OrderTracking';
import { StoreRouteMap } from '../../components/StoreRouteMap';
import { getOrderFulfillmentMode, getOrderStatusLabel } from '../../utils/orderFulfillment';
import { isServiceBookingOrder } from '../../utils/orderClassification';
import { isOrderChatOpen, openOrderChat, ORDER_CHAT_UPCOMING_STATUSES } from '../../utils/orderChat';

// See app/orders/index.tsx for the matching DB-level restriction (RLS policy)
// on which statuses a customer can delete — this list must stay in sync.
const DELETABLE_STATUSES = ['pending', 'payment_failed', 'insufficient_stock'];
const RETRYABLE_STATUSES = ['pending', 'payment_failed'];

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [partnerAddress, setPartnerAddress] = useState<string>('');  
  const [partnerName, setPartnerName] = useState<string>('');
  const [partnerLocation, setPartnerLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickupConfirming, setPickupConfirming] = useState(false);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);

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

    // Suscripción en tiempo real para actualizar el pedido cuando cambie el estado
    const orderSubscription = supabaseClient
      .channel(`order_${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${id}`
        },
        (payload) => {
          console.log('📦 Order detail updated in real-time:', payload.new);
          // Actualizar el pedido en el estado local
          setOrder((prevOrder: any) => ({
            ...prevOrder,
            status: payload.new.status,
            updatedAt: new Date(payload.new.updated_at)
          }));
        }
      )
      .subscribe();

    // Cleanup: desuscribirse cuando el componente se desmonte
    return () => {
      orderSubscription.unsubscribe();
    };
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
        setPartnerAddress('');
        setPartnerName('');
        setPartnerLocation(null);

        setOrder({
          id: data.id,
          orderNumber: data.order_number,
          partnerId: data.partner_id,
          customerId: data.customer_id,
          items: data.items || [],
          status: data.status || 'pending',
          orderType: data.order_type || 'product_purchase',
          fulfillmentMode: getOrderFulfillmentMode(data.order_type || 'product_purchase', data.shipping_address),
          totalAmount: data.total_amount || 0,
          subtotalAmount: data.subtotal,
          shippingCost: Number(data.shipping_cost || 0),
          shippingAddress: data.shipping_address || '',
          createdAt: new Date(data.created_at),
          updatedAt: data.updated_at ? new Date(data.updated_at) : null,
          lastPaymentUrl: data.last_payment_url,
          paymentLinkExpiresAt: data.payment_link_expires_at ? new Date(data.payment_link_expires_at) : null,
        });

        // 1. Try partner_breakdown first (works for service bookings where trigger stores it)
        let resolvedAddress = '';
        if (data.partner_breakdown && data.partner_id) {
          const pbPartner = data.partner_breakdown?.partners?.[data.partner_id];
          if (pbPartner?.partner_address) {
            resolvedAddress = pbPartner.partner_address;
          }
        }

        // 2. Query direct partners table to enrich the order with store data
        if (data.partner_id) {
          const { data: partnerData } = await supabaseClient
            .from('partners')
            .select('business_name, address, calle, numero, barrio, codigo_postal, latitud, longitud')
            .eq('id', data.partner_id)
            .single();
          if (partnerData) {
            setPartnerName(partnerData.business_name || '');
            const parts = [
              partnerData.calle,
              partnerData.numero,
              partnerData.barrio,
              partnerData.codigo_postal,
            ].filter(Boolean);
            if (!resolvedAddress) {
              resolvedAddress = parts.length > 0
                ? parts.join(', ')
                : partnerData.address || '';
            }

            const latitude = Number(partnerData.latitud);
            const longitude = Number(partnerData.longitud);
            if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
              setPartnerLocation({ latitude, longitude });
            } else {
              setPartnerLocation(null);
            }
          }
        }

        if (resolvedAddress) setPartnerAddress(resolvedAddress);
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
      Alert.alert('Error', 'No se pudo cargar el detalle del pedido');
    } finally {
      setLoading(false);
    }
  };

  const isServiceOrder = isServiceBookingOrder(order);
  const shippingAddressText = (order?.shippingAddress || '').trim();
  const isStorePickup = !isServiceOrder && (
    shippingAddressText.toLowerCase().startsWith('retiro en tienda') ||
    shippingAddressText.toLowerCase().includes('retiro')
  );

  const shippingCost = isServiceOrder ? 0 : Number(order?.shippingCost || 0);
  const subtotalAmount = Number(
    order?.subtotalAmount ?? Math.max(0, Number(order?.totalAmount || 0) - shippingCost)
  );

  const formatCurrency = (amount: number) => formatPrice(amount);

  const handleOpenStoreChat = async () => {
    if (!order || openingChat) return;
    setOpeningChat(true);
    const result = await openOrderChat(order.id, order.orderNumber);
    setOpeningChat(false);
    if (!result.ok) {
      toast.error(
        result.reason === 'closed' ? 'El chat de este pedido ya está cerrado' : 'No pudimos abrir el chat',
        result.reason === 'closed' ? undefined : 'Probá de nuevo en un momento.'
      );
    }
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contactar soporte',
      `Pedido ${order.orderNumber || `#${order.id.slice(-6)}`}\n\nPodés contactarnos por:\n\nEmail: soporte@dogcatify.com\nWhatsApp: +54 11 1234-5678`,
      [{ text: 'Entendido' }]
    );
  };

  const submitPickupConfirmation = async () => {
    if (!order || !currentUser) {
      return;
    }

    try {
      setPickupConfirming(true);

      const now = new Date().toISOString();
      const { error } = await supabaseClient
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: now,
          updated_at: now,
        })
        .eq('id', order.id)
        .eq('customer_id', currentUser.id);

      if (error) throw error;

      toast.success('Retiro confirmado. Le avisamos a la tienda.');

      await fetchOrderDetails();
    } catch (error) {
      console.error('Error confirming pickup:', error);
      Alert.alert('Error', 'No se pudo confirmar el retiro del pedido');
    } finally {
      setPickupConfirming(false);
    }
  };

  const handleConfirmPickup = () => {
    Alert.alert(
      'Confirmar retiro',
      '¿Ya retiraste tu compra en tienda?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, confirmar', onPress: () => { void submitPickupConfirmation(); } },
      ]
    );
  };

  const handleRetryPayment = async () => {
    if (!order) return;

    try {
      const isExpired = order.paymentLinkExpiresAt && new Date(order.paymentLinkExpiresAt) < new Date();

      if (!isExpired && order.lastPaymentUrl) {
        const canOpen = await Linking.canOpenURL(order.lastPaymentUrl);
        if (canOpen) {
          await Linking.openURL(order.lastPaymentUrl);
        } else {
          Alert.alert('Error', 'No se pudo abrir el link de pago');
        }
        return;
      }

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
                setRetryingPayment(true);
                const result = await regeneratePaymentLink(order.id);

                if (result.success && result.paymentUrl) {
                  await fetchOrderDetails();
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
              } finally {
                setRetryingPayment(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error handling retry payment:', error);
      Alert.alert('Error', 'No se pudo procesar el reintento de pago');
    }
  };

  const submitDeleteOrder = async () => {
    if (!order || !currentUser) return;

    try {
      setDeletingOrder(true);

      const { error } = await supabaseClient
        .from('orders')
        .delete()
        .eq('id', order.id)
        .eq('customer_id', currentUser.id);

      if (error) throw error;

      router.back();
    } catch (error) {
      console.error('Error deleting order:', error);
      Alert.alert('Error', 'No se pudo eliminar el pedido');
      setDeletingOrder(false);
    }
  };

  const handleDeleteOrder = () => {
    if (!order) return;

    Alert.alert(
      'Eliminar pedido',
      `¿Seguro que querés eliminar el pedido ${order.orderNumber || `#${order.id.slice(-6)}`}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => { void submitDeleteOrder(); } },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Detalle del pedido" />
        <View style={styles.skeletonWrap} accessibilityRole="progressbar" accessibilityLabel="Cargando detalle del pedido">
          <Skeleton height={96} borderRadius={radius.lg} />
          <SkeletonCard imageHeight={120} style={styles.skeletonGap} />
          <Skeleton height={140} borderRadius={radius.lg} style={styles.skeletonGap} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Detalle del pedido" />
        <EmptyState
          icon={<Package size={32} color={colors.primary} />}
          title="No encontramos el pedido"
          description="Puede que se haya eliminado o que no tengas acceso."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Detalle del pedido"
        right={
          <IconButton
            icon={<MessageSquare size={20} color={colors.primary} />}
            onPress={handleContactSupport}
            accessibilityLabel="Contactar soporte"
          />
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <OrderStatusBanner />

        {/* Chat con la tienda: solo con el pedido confirmado y en curso */}
        {isOrderChatOpen(order.status) ? (
          <TouchableOpacity
            style={styles.chatCard}
            onPress={handleOpenStoreChat}
            disabled={openingChat}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Chatear con ${partnerName || 'la tienda'}`}
            accessibilityState={{ busy: openingChat }}
          >
            <View style={styles.chatIcon}>
              <MessageCircle size={22} color={colors.onPrimary} />
            </View>
            <View style={styles.chatTextContainer}>
              <Text style={styles.chatTitle} numberOfLines={1}>
                Chateá con {partnerName || 'la tienda'}
              </Text>
              <Text style={styles.chatSubtitle}>
                {openingChat ? 'Abriendo el chat…' : 'Consultá lo que necesites. Te avisamos cuando te respondan.'}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.primary} />
          </TouchableOpacity>
        ) : ORDER_CHAT_UPCOMING_STATUSES.includes(order.status) ? (
          <View style={styles.chatHint}>
            <MessageCircle size={16} color={colors.textSecondary} />
            <Text style={styles.chatHintText}>
              Cuando {partnerName || 'la tienda'} confirme tu pedido vas a poder chatear desde acá.
            </Text>
          </View>
        ) : null}

        {/* Order Status */}
        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.orderNumber}>Pedido {order.orderNumber || `#${order.id.slice(-6)}`}</Text>
            <Badge
              label={getOrderStatusLabel(order.status, order.orderType, order.shippingAddress)}
              tone={getOrderStatusTone(order.status)}
            />
          </View>

          <Text style={styles.orderDate}>
            Realizado el {order.createdAt.toLocaleDateString('es-UY')} a las {order.createdAt.toLocaleTimeString('es-UY', {hour: '2-digit', minute:'2-digit'})}
          </Text>

          {order.updatedAt && (
            <Text style={styles.lastUpdate}>
              Última actualización: {order.updatedAt.toLocaleDateString('es-UY')}
            </Text>
          )}
        </Card>

        {/* Order Tracking Timeline */}
        <Card style={styles.trackingCard}>
          <Text style={styles.sectionTitle}>Seguimiento del pedido</Text>
          <OrderTracking
            orderStatus={order.status}
            orderType={order.orderType}
            fulfillmentMode={order.fulfillmentMode}
            orderDate={order.createdAt}
            cancelledDate={order.status === 'cancelled' ? order.updatedAt : undefined}
          />
        </Card>

        {/* Order Items */}
        <Card style={styles.itemsCard}>
          <Text style={styles.sectionTitle}>
            {isServiceOrder ? `Servicios (${order.items.length})` : `Productos (${order.items.length})`}
          </Text>
          
          {order.items.map((item: any, index: number) => (
            <View key={index} style={styles.orderItem}>
              {item.image && (
                <Image source={{ uri: item.image }} style={styles.itemImage} />
              )}
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>
                  {isServiceOrder
                    ? item.service_name || item.name || 'Servicio'
                    : item.name || 'Producto'}
                </Text>
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
        {!isServiceOrder && order.shippingAddress && (
          <Card style={styles.shippingCard}>
            <Text style={styles.sectionTitle}>{isStorePickup ? 'Retiro en tienda' : 'Información de envío'}</Text>
            <View style={styles.shippingInfo}>
              <MapPin size={20} color={colors.textSecondary} />
              <Text style={styles.shippingAddress}>
                {isStorePickup && partnerAddress ? partnerAddress : order.shippingAddress}
              </Text>
            </View>
            {isStorePickup && (partnerAddress || partnerLocation) && (
              <StoreRouteMap
                storeName={partnerName || order.items?.[0]?.partnerName || 'Tienda'}
                storeAddress={partnerAddress || order.shippingAddress}
                destinationCoordinates={partnerLocation}
              />
            )}
          </Card>
        )}

        {/* Order Summary */}
        <Card style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Resumen del pedido</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(subtotalAmount)}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {isServiceOrder ? 'Envío' : isStorePickup ? 'Retiro en tienda' : 'Envío'}
            </Text>
            <Text style={styles.summaryValue}>
              {isServiceOrder || isStorePickup ? 'Sin costo' : formatCurrency(shippingCost)}
            </Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(order.totalAmount)}</Text>
          </View>
        </Card>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {RETRYABLE_STATUSES.includes(order.status) && (
            <Button
              title={
                order.paymentLinkExpiresAt && new Date(order.paymentLinkExpiresAt) < new Date()
                  ? 'Generar nuevo link de pago'
                  : 'Reintentar pago'
              }
              onPress={handleRetryPayment}
              loading={retryingPayment}
              size="large"
            />
          )}

          {DELETABLE_STATUSES.includes(order.status) && (
            <Button
              onPress={handleDeleteOrder}
              loading={deletingOrder}
              variant="outline"
              size="large"
              style={styles.deleteOrderButton}
            >
              <Text style={styles.deleteOrderButtonText}>
                {deletingOrder ? 'Eliminando...' : 'Eliminar pedido'}
              </Text>
            </Button>
          )}

          {isStorePickup && order.status === 'ready_for_delivery' && (
            <Button
              title="Confirmar retiro"
              onPress={handleConfirmPickup}
              loading={pickupConfirming}
              size="large"
            />
          )}

          {order.status === 'delivered' && (
            <Button
              title="Reordenar productos"
              onPress={() => {
                toast.success('Los productos se agregaron al carrito');
                router.push('/cart');
              }}
              size="large"
            />
          )}
          
          <Button
            title="Contactar soporte"
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
  skeletonWrap: {
    padding: spacing.lg,
  },
  skeletonGap: {
    marginTop: spacing.lg,
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
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: colors.danger,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  statusCard: {
    marginBottom: spacing.lg,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    minHeight: 64,
  },
  chatIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatTextContainer: {
    flex: 1,
  },
  chatTitle: {
    ...typography.bodyStrong,
    color: colors.primaryStrong,
  },
  chatSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginTop: 2,
  },
  chatHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  chatHintText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  trackingCard: {
    marginBottom: spacing.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  orderNumber: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.lg,
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  orderDate: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  lastUpdate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  itemsCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.md,
  },
  orderItem: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: radius.sm,
    marginRight: spacing.md,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  itemPartner: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  itemPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemQuantity: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  itemPrice: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: colors.success,
  },
  shippingCard: {
    marginBottom: spacing.lg,
  },
  shippingInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  shippingAddress: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.text,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 20,
  },
  summaryCard: {
    marginBottom: spacing.lg,
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
    gap: spacing.md,
  },
  deleteOrderButton: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  deleteOrderButtonText: {
    color: colors.danger,
    fontFamily: 'Inter-Medium',
    fontWeight: '600',
    fontSize: 16,
  },
});
