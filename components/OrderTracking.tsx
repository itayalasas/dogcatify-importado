import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Package, CheckCircle, Truck, Home, Clock, XCircle, AlertCircle, RefreshCw } from 'lucide-react-native';
import { type OrderFulfillmentMode } from '../utils/orderFulfillment';
import { colors, radius, spacing, typography } from '../constants/theme';

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
  fulfillmentMode?: OrderFulfillmentMode;
  orderDate?: Date;
  cancelledDate?: Date;
  paymentLinkExpiresAt?: Date;
  lastPaymentUrl?: string;
  onRetryPayment?: () => void;
}

export const OrderTracking: React.FC<OrderTrackingProps> = ({
  orderStatus,
  orderType = 'product_purchase',
  fulfillmentMode = 'shipping',
  orderDate,
  cancelledDate,
  paymentLinkExpiresAt,
  lastPaymentUrl,
  onRetryPayment
}) => {
  const isPaymentFailed = orderStatus === 'payment_failed';
  const isInsufficientStock = orderStatus === 'insufficient_stock';
  const isPaymentPending = orderStatus === 'pending';
  const isPaymentLinkExpired = paymentLinkExpiresAt ? new Date(paymentLinkExpiresAt) < new Date() : true;

  const handleRetryPayment = async () => {
    if (isPaymentLinkExpired && onRetryPayment) {
      // Si el link expiró, regenerar nueva preferencia
      Alert.alert(
        'Link de pago vencido',
        'El link de pago venció. Vamos a generar uno nuevo.',
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
    const isPickupOrder = fulfillmentMode === 'pickup';

    if (isInsufficientStock) {
      return [
        {
          id: 'insufficient_stock',
          label: 'Sin stock',
          description: 'No hay stock suficiente para completar este pedido. Te contactaremos pronto.',
          icon: AlertCircle,
          status: 'failed',
          date: orderDate?.toLocaleDateString('es-UY', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })
        }
      ];
    }

    // Para servicios (reservas), solo mostrar estados simples
    if (isServiceBooking) {
      const serviceSteps: TrackingStep[] = [];

      // Agregar estado de pago fallido si aplica
      if (isPaymentFailed) {
        serviceSteps.push({
          id: 'payment_failed',
          label: 'Pago fallido',
          description: isPaymentLinkExpired
            ? 'El link de pago venció. Generá uno nuevo para continuar.'
            : 'Hubo un problema con el pago. Intentá nuevamente.',
          icon: AlertCircle,
          status: 'failed',
          date: orderDate?.toLocaleDateString('es-UY', {
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
        description: isPaymentFailed ? 'Reintentá el pago para continuar' : 'Tu pedido fue registrado',
        icon: Clock,
        status: isPaymentFailed ? 'active' : 'completed',
        date: !isPaymentFailed ? orderDate?.toLocaleDateString('es-UY', {
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
        status: ['pending', 'reserved'].includes(orderStatus) || isPaymentFailed ? 'pending' :
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
          date: cancelledDate?.toLocaleDateString('es-UY', {
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

    // Para productos, mostrar seguimiento según el tipo de entrega
    if (isPickupOrder) {
      const pickupSteps: TrackingStep[] = [
        {
          id: 'pending',
          label: 'Pedido recibido',
          description: 'Tu pedido fue registrado',
          icon: Clock,
          status: 'completed',
          date: orderDate?.toLocaleDateString('es-UY', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })
        },
        {
          id: 'confirmed',
          label: 'Pedido confirmado',
          description: 'La tienda confirmó tu pedido',
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
          status: ['pending', 'reserved', 'confirmed'].includes(orderStatus) ? 'pending' :
                  ['processing', 'preparing'].includes(orderStatus) ? 'active' :
                  isCancelled ? 'cancelled' :
                  'completed'
        },
        {
          id: 'ready_for_delivery',
          label: 'Listo para retirar',
          description: 'Tu pedido está listo para pasar a buscar',
          icon: Package,
          status: ['pending', 'reserved', 'confirmed', 'processing', 'preparing'].includes(orderStatus) ? 'pending' :
                  ['ready_for_delivery', 'shipped'].includes(orderStatus) ? 'active' :
                  isCancelled ? 'cancelled' :
                  'completed'
        },
        {
          id: 'delivered',
          label: 'Retirado',
          description: 'Confirmaste que retiraste el pedido en tienda',
          icon: Home,
          status: orderStatus === 'delivered' || orderStatus === 'completed' ? 'completed' :
                  isCancelled ? 'cancelled' :
                  'pending'
        }
      ];

      if (isCancelled) {
        pickupSteps.push({
          id: 'cancelled',
          label: 'Pedido cancelado',
          description: 'El pedido fue cancelado',
          icon: XCircle,
          status: 'cancelled',
          date: cancelledDate?.toLocaleDateString('es-UY', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })
        });
      }

      return pickupSteps;
    }

    // Para productos con envío, mostrar seguimiento completo
    const productSteps: TrackingStep[] = [
      {
        id: 'pending',
        label: 'Pedido recibido',
        description: 'Tu pedido fue registrado',
        icon: Clock,
        status: 'completed',
        date: orderDate?.toLocaleDateString('es-UY', {
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
        status: ['pending', 'reserved', 'confirmed'].includes(orderStatus) ? 'pending' :
          ['processing', 'preparing'].includes(orderStatus) ? 'active' :
                isCancelled ? 'cancelled' :
                'completed'
      },
      {
        id: 'ready_for_delivery',
        label: 'Listo para entrega',
        description: 'Tu pedido está listo y esperando repartidor',
        icon: CheckCircle,
        status: ['pending', 'reserved', 'confirmed', 'processing', 'preparing'].includes(orderStatus) ? 'pending' :
                orderStatus === 'ready_for_delivery' ? 'active' :
                isCancelled ? 'cancelled' :
                'completed'
      },
      {
        id: 'shipped',
        label: 'En camino',
        description: 'Tu pedido está en camino',
        icon: Truck,
        status: ['pending', 'reserved', 'confirmed', 'processing', 'preparing', 'ready_for_delivery'].includes(orderStatus) ? 'pending' :
                orderStatus === 'shipped' ? 'active' :
                isCancelled ? 'cancelled' :
                'completed'
      },
      {
        id: 'delivered',
        label: 'Entregado',
        description: '¡Tu pedido fue entregado!',
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
        date: cancelledDate?.toLocaleDateString('es-UY', {
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
      case 'completed': return colors.success;
      case 'active': return colors.primary;
      case 'cancelled': return colors.danger;
      case 'failed': return colors.warning;
      case 'pending': return colors.borderStrong;
    }
  };

  const getBackgroundColor = (status: 'completed' | 'active' | 'pending' | 'cancelled' | 'failed') => {
    switch (status) {
      case 'completed': return colors.successSoft;
      case 'active': return colors.primarySoft;
      case 'cancelled': return colors.dangerSoft;
      case 'failed': return colors.warningSoft;
      case 'pending': return colors.surfaceAlt;
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
          <View
            key={step.id}
            style={styles.stepContainer}
            accessible={step.status !== 'failed'}
            accessibilityLabel={`${step.label}. ${step.description}${step.date ? `. ${step.date}` : ''}${step.status === 'active' ? '. En proceso' : step.status === 'completed' ? '. Completado' : ''}`}
          >
            <View style={styles.stepIndicator}>
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor,
                    borderColor: statusColor,
                    borderWidth: step.status === 'active' ? 2 : 1.5
                  }
                ]}
              >
                <Icon
                  size={step.status === 'active' ? 20 : 18}
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
                      color: step.status !== 'pending' ? colors.text : colors.textTertiary,
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
                  { color: step.status !== 'pending' ? colors.textSecondary : colors.textTertiary }
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
                  accessibilityRole="button"
                >
                  <RefreshCw size={18} color={colors.onPrimary} strokeWidth={2.5} />
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
    paddingVertical: spacing.sm,
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  stepIndicator: {
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    minHeight: 24,
  },
  stepContent: {
    flex: 1,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  stepTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  stepLabel: {
    ...typography.bodyStrong,
    fontSize: 15,
    flex: 1,
  },
  stepDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  stepDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  activeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: colors.primaryStrong,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    borderRadius: radius.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: colors.white,
  },
});
