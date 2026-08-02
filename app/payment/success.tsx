import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleCheck as CheckCircle, Package, Calendar } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabaseClient } from '@/lib/supabase';
import { useCart } from '../../contexts/CartContext';
import { logResourceAction } from '../../services/auditService';
import { envConfig } from '../../utils/envConfig';

const getSingleParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

export default function PaymentSuccess() {
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
      setError('No se encontró el ID de la orden');
      setLoading(false);
      return;
    }

    try {

      // Load order from database
      const { data: initialOrder, error: orderError } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) {
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
        }
      }


      // Format order details for display
      const isPendingValidation = order.status === 'pending' || !order.payment_id;

      const formattedOrder = {
        id: order.id,
        displayId: order.order_number || `#${order.id.slice(-6)}`,
        total: new Intl.NumberFormat('es-UY', {
          style: 'currency',
          currency: 'UYU',
        }).format(order.total_amount),
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
      }).catch(err => undefined);
      
    } catch (err: any) {
      setError(err.message || 'Error al cargar la orden');

      // Fallback: use provided parameters
      setOrderDetails({
        id: orderId,
        displayId: `#${orderId.slice(-6)}`,
        total: '$430.00',
        status: 'Confirmado',
        paymentId: paymentId ? `#mp${paymentId}` : 'Procesando...',
        isBooking: paymentType === 'booking',
        isSplitPurchase: false,
      });
      setLoading(false);
    }
  };

  const handleViewOrders = () => {
    // Usar push en lugar de replace porque ya limpiamos el historial al llegar aquí
    if (orderDetails?.isBooking) {
      router.push('/(tabs)/services');
    } else {
      router.push('/orders');
    }
  };

  const handleGoHome = () => {
    // Usar push para ir al home
    router.push('/(tabs)');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Confirmando pago...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <CheckCircle size={80} color="#10B981" />
        </View>

        <Text style={styles.title}>{orderDetails?.isPendingValidation ? 'Pago Recibido' : 'Pago Exitoso'}</Text>
        <Text style={styles.subtitle}>
          {orderDetails?.isPendingValidation
            ? 'Estamos validando tu pago con Mercado Pago. Esto puede tardar unos segundos.'
            : orderDetails?.isBooking 
              ? 'Tu reserva ha sido confirmada y el pago procesado correctamente.'
              : orderDetails?.isSplitPurchase
                ? 'Tu compra ha sido confirmada y se dividió automáticamente por tienda.'
                : 'Tu pedido ha sido confirmado y el pago procesado correctamente.'
          }
        </Text>

        <Card style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>
            {orderDetails?.isBooking ? 'Detalles de la Reserva' : 'Detalles del Pedido'}
          </Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {orderDetails?.isBooking ? 'Número de reserva:' : 'Número de pedido:'}
            </Text>
            <Text style={styles.detailValue}>{orderDetails?.displayId || orderDetails?.id}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total:</Text>
            <Text style={styles.detailValue}>{orderDetails?.total}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Estado:</Text>
            <Text style={[styles.detailValue, orderDetails?.isPendingValidation ? styles.pendingStatus : styles.successStatus]}>
              {orderDetails?.status}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ID de pago:</Text>
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
                  • Puedes ver tus citas en la sección de servicios
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
                  • Puedes rastrear tu pedido en "Mis Pedidos"
                </Text>
              </>
            )}
          </View>
        </Card>
      </View>

      <View style={styles.actionsContainer}>
        <Button
          title={orderDetails?.isBooking ? "Ver Mis Citas" : "Ver Mis Pedidos"}
          onPress={handleViewOrders}
          variant="outline"
          size="large"
        />
        
        <Button
          title="Ir al Inicio"
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
    backgroundColor: '#F9FAFB',
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
    color: '#6B7280',
    marginTop: 16,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingBottom: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  detailsCard: {
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  successStatus: {
    color: '#10B981',
  },
  pendingStatus: {
    color: '#D97706',
  },
  successCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 20,
  },
  pendingCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  successTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#166534',
    marginBottom: 12,
    textAlign: 'center',
  },
  pendingTitle: {
    color: '#92400E',
  },
  successList: {
    gap: 8,
  },
  successItem: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#166534',
    lineHeight: 20,
  },
  pendingItem: {
    color: '#92400E',
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
});

