import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Package, CheckCircle, Truck, Home, Clock, XCircle, AlertCircle, RefreshCw } from 'lucide-react-native';

interface TrackingStep {
  id: string;
  label: string;
  description: string;
  icon: any;
  status: 'completed' | 'active' | 'pending' | 'cancelled' | 'failed';
  date?: string;
}

interface OrderTrackingProps {
  orderStatus: string;
  orderType?: 'product_purchase' | 'service_booking';
  orderDate?: Date;
  cancelledDate?: Date;
  paymentLinkExpiresAt?: Date;
  lastPaymentUrl?: string;
  onRetryPayment?: () => void;
}

export const OrderTracking: React.FC<OrderTrackingProps> = ({
  orderStatus,
  orderType = 'product_purchase',
  orderDate,
  cancelledDate,
  paymentLinkExpiresAt,
  lastPaymentUrl,
  onRetryPayment
}) => {
  const isPaymentFailed = orderStatus === 'payment_failed';
  const isPaymentPending = orderStatus === 'pending';
  const isPaymentLinkExpired = paymentLinkExpiresAt ? new Date(paymentLinkExpiresAt) < new Date() : true;

  const handleRetryPayment = async () => {
    if (isPaymentLinkExpired && onRetryPayment) {
      // Si el link expiró, regenerar nueva preferencia
      Alert.alert(
        'Link de pago expirado',
        'El link de pago ha expirado. Se generará uno nuevo.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Generar nuevo link',
            onPress: () => onRetryPayment()
          }
        ]
      );
    } else if (lastPaymentUrl) {
      // Si el link aún es válido, abrir directamente
      try {
        const canOpen = await Linking.canOpenURL(lastPaymentUrl);
        if (canOpen) {
          await Linking.openURL(lastPaymentUrl);
        } else {
          Alert.alert('Error', 'No se pudo abrir el link de pago');
        }
      } catch (error) {
        Alert.alert('Error', 'No se pudo abrir el link de pago');
      }
    } else if (onRetryPayment) {
      // No hay link, generar nuevo
      onRetryPayment();
    }
  };

  const getTrackingSteps = (): TrackingStep[] => {
    const isCancelled = orderStatus === 'cancelled';
    const isServiceBooking = orderType === 'service_booking';

    // Para servicios (reservas), solo mostrar estados simples
    if (isServiceBooking) {
      const serviceSteps: TrackingStep[] = [];

      // Agregar estado de pago fallido si aplica
      if (isPaymentFailed) {
        serviceSteps.push({
          id: 'payment_failed',
          label: 'Pago fallido',
          description: isPaymentLinkExpired
            ? 'El link de pago expiró. Genera uno nuevo para continuar.'
            : 'Hubo un problema con el pago. Intenta nuevamente.',
          icon: AlertCircle,
          status: 'failed',
          date: orderDate?.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })
        });
      }

      serviceSteps.push({
        id: 'pending',
        label: isPaymentFailed ? 'Esperando pago' : 'Pedido recibido',
        description: isPaymentFailed ? 'Reintenta el pago para continuar' : 'Tu pedido ha sido registrado',
        icon: Clock,
        status: isPaymentFailed ? 'active' : 'completed',
        date: !isPaymentFailed ? orderDate?.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        }) : undefined
      });

      serviceSteps.push({
        id: 'confirmed',
        label: 'Pedido confirmado',
        description: 'El vendedor confirmó tu pedido',
        icon: CheckCircle,
        status: orderStatus === 'pending' || isPaymentFailed ? 'pending' :
                isCancelled ? 'cancelled' :
                orderStatus === 'confirmed' ? 'active' :
                'completed'
      });

      if (isCancelled) {
        serviceSteps.push({
          id: 'cancelled',
          label: 'Pedido cancelado',
          description: 'El pedido fue cancelado',
          icon: XCircle,
          status: 'cancelled',
          date: cancelledDate?.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })
        });
      } else {
        serviceSteps.push({
          id: 'completed',
          label: 'Completado',
          description: '¡Servicio completado!',
          icon: Home,
          status: orderStatus === 'completed' ? 'completed' : 'pending'
        });
      }

      return serviceSteps;
    }

    // Para productos, mostrar seguimiento completo
    const productSteps: TrackingStep[] = [
      {
        id: 'pending',
        label: 'Pedido recibido',
        description: 'Tu pedido ha sido registrado',
        icon: Clock,
        status: 'completed',
        date: orderDate?.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        })
      },
      {
        id: 'confirmed',
        label: 'Pedido confirmado',
        description: 'El vendedor confirmó tu pedido',
        icon: CheckCircle,
        status: orderStatus === 'pending' ? 'pending' :
                isCancelled ? 'cancelled' :
                'completed'
      },
      {
        id: 'processing',
        label: 'En preparación',
        description: 'Estamos preparando tu pedido',
        icon: Package,
        status: ['pending', 'confirmed'].includes(orderStatus) ? 'pending' :
                orderStatus === 'processing' ? 'active' :
                isCancelled ? 'cancelled' :
                'completed'
      },
      {
        id: 'shipped',
        label: 'En camino',
        description: 'Tu pedido está en camino',
        icon: Truck,
        status: ['pending', 'confirmed', 'processing'].includes(orderStatus) ? 'pending' :
                orderStatus === 'shipped' ? 'active' :
                isCancelled ? 'cancelled' :
                'completed'
      },
      {
        id: 'delivered',
        label: 'Entregado',
        description: '¡Tu pedido ha sido entregado!',
        icon: Home,
        status: orderStatus === 'delivered' || orderStatus === 'completed' ? 'completed' :
                isCancelled ? 'cancelled' :
                'pending'
      }
    ];

    if (isCancelled) {
      productSteps.push({
        id: 'cancelled',
        label: 'Pedido cancelado',
        description: 'El pedido fue cancelado',
        icon: XCircle,
        status: 'cancelled',
        date: cancelledDate?.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        })
      });
    }

    return productSteps;
  };

  const steps = getTrackingSteps();
  const isCancelled = orderStatus === 'cancelled';

  const getStatusColor = (status: 'completed' | 'active' | 'pending' | 'cancelled' | 'failed') => {
    switch (status) {
      case 'completed': return '#10B981';
      case 'active': return '#3B82F6';
      case 'cancelled': return '#EF4444';
      case 'failed': return '#F59E0B';
      case 'pending': return '#D1D5DB';
    }
  };

  const getBackgroundColor = (status: 'completed' | 'active' | 'pending' | 'cancelled' | 'failed') => {
    switch (status) {
      case 'completed': return '#D1FAE5';
      case 'active': return '#DBEAFE';
      case 'cancelled': return '#FEE2E2';
      case 'failed': return '#FEF3C7';
      case 'pending': return '#F3F4F6';
    }
  };

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isLast = index === steps.length - 1;
        const statusColor = getStatusColor(step.status);
        const backgroundColor = getBackgroundColor(step.status);

        // Hide cancelled step if not cancelled
        if (step.id === 'cancelled' && !isCancelled) {
          return null;
        }

        return (
          <View key={step.id} style={styles.stepContainer}>
            <View style={styles.stepIndicator}>
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor,
                    borderColor: statusColor,
                    borderWidth: step.status === 'active' ? 3 : 2
                  }
                ]}
              >
                <Icon
                  size={step.status === 'active' ? 24 : 20}
                  color={statusColor}
                  strokeWidth={step.status === 'completed' ? 3 : 2}
                />
              </View>

              {!isLast && (
                <View
                  style={[
                    styles.line,
                    { backgroundColor: statusColor }
                  ]}
                />
              )}
            </View>

            <View style={styles.stepContent}>
              <View style={styles.stepTextContainer}>
                <Text
                  style={[
                    styles.stepLabel,
                    {
                      color: step.status !== 'pending' ? '#111827' : '#9CA3AF',
                      fontFamily: step.status === 'active' ? 'Inter-Bold' : 'Inter-SemiBold'
                    }
                  ]}
                >
                  {step.label}
                </Text>
                {step.date && (
                  <Text style={styles.stepDate}>{step.date}</Text>
                )}
              </View>

              <Text
                style={[
                  styles.stepDescription,
                  { color: step.status !== 'pending' ? '#6B7280' : '#D1D5DB' }
                ]}
              >
                {step.description}
              </Text>

              {step.status === 'active' && !isPaymentFailed && (
                <View style={styles.activeBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeText}>En proceso</Text>
                </View>
              )}

              {step.status === 'failed' && (
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleRetryPayment}
                  activeOpacity={0.7}
                >
                  <RefreshCw size={18} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.retryButtonText}>
                    {isPaymentLinkExpired ? 'Generar nuevo link' : 'Reintentar pago'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  stepIndicator: {
    alignItems: 'center',
    marginRight: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  line: {
    width: 3,
    flex: 1,
    marginTop: 4,
    marginBottom: 4,
    minHeight: 40,
  },
  stepContent: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 16,
  },
  stepTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepLabel: {
    fontSize: 16,
    flex: 1,
  },
  stepDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 8,
  },
  stepDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
    marginRight: 6,
  },
  activeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
});
