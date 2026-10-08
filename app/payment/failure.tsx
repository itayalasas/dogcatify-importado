import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleX as XCircle, RefreshCw } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabaseClient } from '@/lib/supabase';
import { logResourceAction } from '../../services/auditService';
import { useBackToHome } from '../../hooks/useBackToHome';

import { colors, radius, spacing, typography } from '../../constants/theme';
import { formatPrice } from '../../components/shop/format';

export default function PaymentFailure() {
  useBackToHome();
  const { order_id, type } = useLocalSearchParams<{
    order_id: string;
    type?: string;
  }>();

  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (order_id) {
      cancelFailedOrder();
    } else {
      setLoading(false);
    }
  }, [order_id, type]);

  const cancelFailedOrder = async () => {
    try {
      console.log('Cancelling failed order:', order_id);

      // Fetch order details
      const { data: order, error: fetchError } = await supabaseClient
        .from('orders')
        .select('*, partners(business_name)')
        .eq('id', order_id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching order:', fetchError);
        setOrderDetails({
          id: order_id || '#failed',
          orderNumber: '#failed',
          total: '—',
          status: 'Fallido',
          isBooking: type === 'booking'
        });
        setLoading(false);
        return;
      }

      if (!order) {
        console.log('Order not found:', order_id);
        setOrderDetails({
          id: order_id || '#failed',
          orderNumber: '#failed',
          total: '—',
          status: 'Fallido',
          isBooking: type === 'booking'
        });
        setLoading(false);
        return;
      }

      // Update order status to cancelled
      const { error: updateError } = await supabaseClient
        .from('orders')
        .update({
          status: 'cancelled',
          payment_status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', order_id);

      if (updateError) {
        console.error('Error updating order status:', updateError);
      } else {
        console.log('Order cancelled successfully');
      }

      // If this is a booking, update booking status as well
      if (order.booking_id) {
        const { error: bookingError } = await supabaseClient
          .from('bookings')
          .update({
            status: 'cancelled',
            payment_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', order.booking_id);

        if (bookingError) {
          console.error('Error updating booking status:', bookingError);
        } else {
          console.log('Booking cancelled successfully');
        }
      }

      // If order has items, restore stock for products
      if (order.items && Array.isArray(order.items) && order.items.length > 0) {
        console.log('Restoring stock for cancelled order items');
        for (const item of order.items) {
          if (item.type !== 'service' && item.id) {
            // Only restore stock for products, not services
            const { data: productData, error: productFetchError } = await supabaseClient
              .from('partner_products')
              .select('stock')
              .eq('id', item.id)
              .maybeSingle();

            if (productFetchError) {
              console.error(`Error fetching stock for product ${item.id}:`, productFetchError);
              continue;
            }

            const currentStock = Number(productData?.stock || 0);
            const { error: stockError } = await supabaseClient
              .from('partner_products')
              .update({
                stock: currentStock + Number(item.quantity || 1),
                updated_at: new Date().toISOString()
              })
              .eq('id', item.id);

            if (stockError) {
              console.error(`Error restoring stock for product ${item.id}:`, stockError);
            }
          }
        }
      }

      // Format currency
      const formatCurrency = (amount: number) => formatPrice(amount);

      setOrderDetails({
        id: order_id,
        orderNumber: order.order_number || `#${order_id.slice(-6)}`,
        total: formatCurrency(order.total_amount || 0),
        status: 'Fallido',
        isBooking: type === 'booking' || !!order.booking_id,
        partnerName: order.partners?.business_name
      });
      
      // Registrar pago fallido en auditoría
      await logResourceAction('PAYMENT_FAILED', 'payment', order_id, {
        success: false,
        error_message: 'User cancelled or payment declined',
        resource_id: order_id,
        details: {
          order_id: order_id,
          order_number: order.order_number,
          amount: order.total_amount,
          payment_method: order.payment_method,
          order_type: order.order_type,
          partner_id: order.partner_id,
          partner_name: order.partners?.business_name,
          customer_id: order.customer_id,
          reason: 'User cancelled or payment declined',
          status_before_cancel: order.status,
          created_at: order.created_at
        }
      }).catch(err => console.error('Error logging payment failure audit:', err));
      
    } catch (error) {
      console.error('Error in cancelFailedOrder:', error);
      setOrderDetails({
        id: order_id || '#failed',
        orderNumber: '#failed',
        total: '—',
        status: 'Fallido',
        isBooking: type === 'booking'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetryPayment = () => {
    if (orderDetails?.isBooking) {
      router.push('/(tabs)/services');
    } else {
      // No volver al carrito, ir a la tienda para comenzar de nuevo
      router.push('/(tabs)/shop');
    }
  };

  const handleGoHome = () => {
    router.push('/(tabs)');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Verificando estado del pago...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <XCircle size={56} color={colors.danger} />
          </View>
        </View>

        <Text style={styles.title} accessibilityRole="header">No pudimos procesar el pago</Text>
        <Text style={styles.subtitle}>
          {orderDetails?.isBooking 
            ? 'Hubo un problema con el pago de tu reserva. Podés intentarlo de nuevo.'
            : 'Hubo un problema con el pago de tu pedido. Podés intentarlo de nuevo.'
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
            <Text style={styles.detailValue}>{orderDetails?.orderNumber || orderDetails?.id}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total</Text>
            <Text style={styles.detailValue}>{orderDetails?.total}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Estado</Text>
            <Text style={[styles.detailValue, styles.failureStatus]}>
              {orderDetails?.status}
            </Text>
          </View>
        </Card>

        <Card style={styles.errorCard}>
          <Text style={styles.errorTitle}>Posibles causas</Text>
          <View style={styles.errorList}>
            <Text style={styles.errorItem}>
              • Fondos insuficientes en la tarjeta
            </Text>
            <Text style={styles.errorItem}>
              • Datos de tarjeta incorrectos
            </Text>
            <Text style={styles.errorItem}>
              • Problema temporal con el procesador
            </Text>
            <Text style={styles.errorItem}>
              • Límites de transacción excedidos
            </Text>
          </View>
        </Card>
      </ScrollView>

      <View style={styles.actionsContainer}>
        <Button
          title={orderDetails?.isBooking ? "Intentar la reserva de nuevo" : "Intentar el pago de nuevo"}
          onPress={handleRetryPayment}
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
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.title,
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
  failureStatus: {
    color: colors.danger,
  },
  errorCard: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  errorTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.danger,
    marginBottom: spacing.md,
  },
  errorList: {
    gap: spacing.sm,
  },
  errorItem: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.text,
    lineHeight: 20,
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
