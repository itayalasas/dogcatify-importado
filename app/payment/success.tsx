import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleCheck as CheckCircle, Package, Calendar } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabaseClient } from '@/lib/supabase';
import { useCart } from '../../contexts/CartContext';
import { logResourceAction } from '../../services/auditService';
import { envConfig } from '../../utils/envConfig';
import { useBackToHome } from '../../hooks/useBackToHome';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { formatPrice } from '../../components/shop/format';

const getSingleParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

export default function PaymentSuccess() {
  useBackToHome();
  const { order_id, external_reference, type, payment_id, collection_id } = useLocalSearchParams<{
    order_id?: string;
    external_reference?: string;
    type?: string;
    payment_id?: string;
    collection_id?: string;
  }>();

  const orderId = getSingleParam(order_id) || getSingleParam(external_reference) || '';
  const paymentId = getSingleParam(payment_id) || getSingleParam(collection_id) || '';
  const paymentType = getSingleParam(type);
  const { clearCart } = useCart();
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrderDetails();
    // Limpiar el carrito cuando llegamos a la pantalla de éxito
    clearCart();
  }, [orderId, paymentId, paymentType]);

  const loadOrderDetails = async () => {
    if (!orderId) {
      console.error('No order_id provided');
      setError('No se encontró el ID de la orden');
      setLoading(false);
      return;
    }

    try {
      console.log('Loading order details:', { orderId, type: paymentType, paymentId });

      // Load order from database
      const { data: initialOrder, error: orderError } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error('Error loading order:', orderError);
        throw new Error('No se pudo cargar la orden');
      }

      if (!initialOrder) {
        throw new Error('Orden no encontrada');
      }

      let order = initialOrder;

      const deepLinkPaymentId = paymentId;
      const shouldSyncFromDeepLink = (!order.payment_id || order.status === 'pending');

      if (shouldSyncFromDeepLink) {
        try {
          const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
          const supabaseAnonKey = envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY');

          const syncPayload = deepLinkPaymentId
            ? {
                type: 'payment',
                action: 'payment.updated',
                data: { id: String(deepLinkPaymentId) }
              }
            : {
                order_id: String(orderId)
              };

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          try {
            await fetch(`${supabaseUrl}/functions/v1/mercadopago-webhook`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify(syncPayload),
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeoutId);
          }

          // Recargar orden para mostrar datos actualizados
          const { data: refreshedOrder } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

          if (refreshedOrder) {
            order = refreshedOrder;
          }
        } catch (syncError) {
          console.error('Error syncing payment from deep link:', syncError);
        }
      }

      console.log('Order loaded:', {
        id: order.id,
        status: order.status,
        total: order.total_amount,
        payment_id: order.payment_id
      });

      // Format order details for display
      const isPendingValidation = order.status === 'pending' || !order.payment_id;

      const formattedOrder = {
        id: order.id,
        displayId: order.order_number || `#${order.id.slice(-6)}`,
        total: formatPrice(order.total_amount),
        status: order.status === 'confirmed' ? 'Confirmado' :
                order.status === 'pending' ? 'Pendiente' :
                order.status,
        paymentId: order.payment_id ? `#mp${order.payment_id.slice(-6)}` : 'Pendiente',
        isBooking: order.order_type === 'service_booking',
        isSplitPurchase: Boolean(
          order.is_split_master ||
          Number(order.partner_breakdown?.total_partners || 0) > 1 ||
          Object.keys(order.partner_breakdown?.partners || {}).length > 1
        ),
        partnerName: order.partner_name,
        serviceName: order.service_name,
        items: order.items || [],
        isPendingValidation,
      };

      setOrderDetails(formattedOrder);
      setLoading(false);
      
      // Registrar pago exitoso en auditoría
      logResourceAction('PAYMENT_SUCCESS', 'payment', order.id, {
        success: true,
        resource_id: order.id,
        details: {
          order_id: order.id,
          order_number: order.order_number,
          amount: order.total_amount,
          payment_method: order.payment_method,
          order_type: order.order_type,
          partner_id: order.partner_id,
          partner_name: order.partner_name,
          customer_id: order.customer_id,
          service_name: order.service_name,
          items_count: order.items?.length || 0,
          created_at: order.created_at
        }
      }).catch(err => console.error('Error logging payment audit:', err));
      
    } catch (err: any) {
      console.error('Error loading order details:', err);
      setError(err.message || 'Error al cargar la orden');

      // Fallback: use provided parameters
      setOrderDetails({
        id: orderId,
        displayId: `#${orderId.slice(-6)}`,
        total: '—',
        status: 'Confirmado',
        paymentId: paymentId ? `#mp${paymentId}` : 'Procesando...',
        isBooking: paymentType === 'booking',
        isSplitPurchase: false,
      });
      setLoading(false);
    }
  };

  const handleViewOrders = () => {
    // Service bookings are listed in "Mis Pedidos" too, so both cases go
    // there. It is flagged as coming from a payment so its back arrow returns
    // to the home screen instead of whatever is left in the history.
    router.replace({ pathname: '/orders', params: { from: 'payment' } });
  };

  const handleGoHome = () => {
    // Usar push para ir al home
    router.push('/(tabs)');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Confirmando pago...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <CheckCircle size={56} color={orderDetails?.isPendingValidation ? colors.warning : colors.success} />
          </View>
        </View>

        <Text style={styles.title} accessibilityRole="header">{orderDetails?.isPendingValidation ? 'Pago recibido' : 'Pago exitoso'}</Text>
        <Text style={styles.subtitle}>
          {orderDetails?.isPendingValidation
            ? 'Estamos validando tu pago con Mercado Pago. Esto puede tardar unos segundos.'
            : orderDetails?.isBooking 
              ? 'Tu reserva fue confirmada y el pago se procesó correctamente.'
              : orderDetails?.isSplitPurchase
                ? 'Tu compra fue confirmada y se dividió automáticamente por tienda.'
                : 'Tu pedido fue confirmado y el pago se procesó correctamente.'
          }
        </Text>

        <Card style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>
            {orderDetails?.isBooking ? 'Detalle de la reserva' : 'Detalle del pedido'}
          </Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {orderDetails?.isBooking ? 'Número de reserva' : 'Número de pedido'}
            </Text>
            <Text style={styles.detailValue}>{orderDetails?.displayId || orderDetails?.id}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total</Text>
            <Text style={styles.detailValue}>{orderDetails?.total}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Estado</Text>
            <Text style={[styles.detailValue, orderDetails?.isPendingValidation ? styles.pendingStatus : styles.successStatus]}>
              {orderDetails?.status}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ID de pago</Text>
            <Text style={styles.detailValue}>{orderDetails?.paymentId}</Text>
          </View>
        </Card>

        <Card style={orderDetails?.isPendingValidation
          ? { ...styles.successCard, ...styles.pendingCard }
          : styles.successCard}
        >
          <Text style={styles.successTitle}>¡Gracias por tu {orderDetails?.isBooking ? 'reserva' : 'compra'}!</Text>
          <View style={styles.successList}>
            {orderDetails?.isBooking ? (
              <>
                <Text style={styles.successItem}>
                  • Recibirás una confirmación por email
                </Text>
                <Text style={styles.successItem}>
                  • El proveedor te contactará para confirmar detalles
                </Text>
                <Text style={styles.successItem}>
                  • Podés ver tus citas en la sección de servicios
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.successItem}>
                  • Recibirás una confirmación por email
                </Text>
                {orderDetails?.isSplitPurchase && (
                  <Text style={styles.successItem}>
                    • Tu compra se dividió automáticamente por tienda
                  </Text>
                )}
                <Text style={styles.successItem}>
                  • Te notificaremos cuando tu pedido sea enviado
                </Text>
                <Text style={styles.successItem}>
                  • Podés seguir tu pedido en &quot;Mis pedidos&quot;
                </Text>
              </>
            )}
          </View>
        </Card>
      </ScrollView>

      <View style={styles.actionsContainer}>
        <Button
          title={orderDetails?.isBooking ? "Ver mis citas" : "Ver mis pedidos"}
          onPress={handleViewOrders}
          variant="outline"
          size="large"
        />
        
        <Button
          title="Ir al inicio"
          onPress={handleGoHome}
          size="large"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 50,
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
    marginTop: spacing.lg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.xxl,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.display,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  detailsCard: {
    marginBottom: spacing.xl,
  },
  detailsTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  successStatus: {
    color: colors.success,
  },
  pendingStatus: {
    color: colors.warning,
  },
  successCard: {
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  pendingCard: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft,
  },
  successTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  pendingTitle: {
    color: colors.warning,
  },
  successList: {
    gap: spacing.sm,
  },
  successItem: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.text,
    lineHeight: 20,
  },
  pendingItem: {
    color: colors.warning,
  },
  actionsContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
});

