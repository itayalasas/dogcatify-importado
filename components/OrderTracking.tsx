import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, Animated, Easing, AccessibilityInfo } from 'react-native';
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

type StepStatus = TrackingStep['status'];

const STEP_STAGGER_MS = 90;

const useReduceMotion = () => {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => mounted && setReduceMotion(value))
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduceMotion;
};

interface TrackingStepRowProps {
  step: TrackingStep;
  isLast: boolean;
  delay: number;
  reduceMotion: boolean;
  statusColor: string;
  backgroundColor: string;
  showActiveBadge: boolean;
  retryLabel: string;
  onRetry: () => void;
}

// Una fila del seguimiento: entra con un leve deslizamiento, la línea hacia el
// siguiente paso se "llena" cuando el paso está completo y el paso en curso late.
const TrackingStepRow: React.FC<TrackingStepRowProps> = ({
  step,
  isLast,
  delay,
  reduceMotion,
  statusColor,
  backgroundColor,
  showActiveBadge,
  retryLabel,
  onRetry,
}) => {
  const Icon = step.icon;
  const appear = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const lineFill = useRef(new Animated.Value(reduceMotion || step.status !== 'completed' ? (step.status === 'completed' ? 1 : 0) : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      appear.setValue(1);
      lineFill.setValue(step.status === 'completed' ? 1 : 0);
      return;
    }

    Animated.timing(appear, {
      toValue: 1,
      duration: 320,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (step.status === 'completed' && !isLast) {
      Animated.timing(lineFill, {
        toValue: 1,
        duration: 420,
        delay: delay + 220,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }).start();
    }
  }, [appear, lineFill, delay, reduceMotion, step.status, isLast]);

  useEffect(() => {
    if (reduceMotion || step.status !== 'active') {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion, step.status]);

  const isPending = step.status === 'pending';

  return (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: appear,
          transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
      accessible={step.status !== 'failed'}
      accessibilityLabel={`${step.label}. ${step.description}${step.date ? `. ${step.date}` : ''}${step.status === 'active' ? '. En proceso' : step.status === 'completed' ? '. Completado' : ''}`}
    >
      <View style={styles.stepIndicator}>
        <View style={styles.iconWrapper}>
          {step.status === 'active' && !reduceMotion && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulseRing,
                {
                  borderColor: statusColor,
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                  transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
                },
              ]}
            />
          )}
          <Animated.View
            style={[
              styles.iconCircle,
              {
                backgroundColor,
                borderColor: statusColor,
                borderWidth: step.status === 'active' ? 2 : 1.5,
                transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
              },
            ]}
          >
            <Icon
              size={step.status === 'active' ? 20 : 18}
              color={statusColor}
              strokeWidth={step.status === 'completed' ? 3 : 2}
            />
          </Animated.View>
        </View>

        {!isLast && (
          <View style={styles.line}>
            <Animated.View
              style={[
                styles.lineFill,
                {
                  backgroundColor: step.status === 'completed' ? statusColor : 'transparent',
                  height: lineFill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                },
              ]}
            />
          </View>
        )}
      </View>

      <View style={styles.stepContent}>
        <View style={styles.stepTextContainer}>
          <Text
            style={[
              styles.stepLabel,
              {
                color: !isPending ? colors.text : colors.textTertiary,
                fontFamily: step.status === 'active' ? 'Inter-Bold' : 'Inter-SemiBold',
              },
            ]}
          >
            {step.label}
          </Text>
          {step.date && <Text style={styles.stepDate}>{step.date}</Text>}
        </View>

        <Text style={[styles.stepDescription, { color: !isPending ? colors.textSecondary : colors.textTertiary }]}>
          {step.description}
        </Text>

        {showActiveBadge && (
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>En proceso</Text>
          </View>
        )}

        {step.status === 'failed' && (
          <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.7} accessibilityRole="button">
            <RefreshCw size={18} color={colors.onPrimary} strokeWidth={2.5} />
            <Text style={styles.retryButtonText}>{retryLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

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
  const reduceMotion = useReduceMotion();
  // Solo la primera vez escalonamos la entrada; los cambios en vivo animan sin demora.
  const hasAnimatedRef = useRef(false);
  useEffect(() => {
    hasAnimatedRef.current = true;
  }, []);
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

  const visibleSteps = steps.filter((step) => step.id !== 'cancelled' || isCancelled);
  const hasProblem = visibleSteps.some((step) => step.status === 'cancelled' || step.status === 'failed');
  const completedCount = visibleSteps.filter((step) => step.status === 'completed').length;
  const activeStep = visibleSteps.find((step) => step.status === 'active');
  const progressValue = visibleSteps.length > 0
    ? Math.min(1, (completedCount + (activeStep ? 0.5 : 0)) / visibleSteps.length)
    : 0;

  return (
    <View style={styles.container}>
      {!hasProblem && visibleSteps.length > 1 && (
        <TrackingProgress
          value={progressValue}
          label={activeStep?.label || (completedCount === visibleSteps.length ? '¡Listo!' : visibleSteps[completedCount]?.label || '')}
          reduceMotion={reduceMotion}
        />
      )}

      {visibleSteps.map((step, index) => (
        <TrackingStepRow
          key={`${step.id}-${step.status}`}
          step={step}
          isLast={index === visibleSteps.length - 1}
          delay={hasAnimatedRef.current ? 0 : index * STEP_STAGGER_MS}
          reduceMotion={reduceMotion}
          statusColor={getStatusColor(step.status)}
          backgroundColor={getBackgroundColor(step.status)}
          showActiveBadge={step.status === 'active' && !isPaymentFailed}
          retryLabel={isPaymentLinkExpired ? 'Generar nuevo link' : 'Reintentar pago'}
          onRetry={handleRetryPayment}
        />
      ))}
    </View>
  );
};

// Barra de progreso arriba del seguimiento ("En preparación", 60%).
const TrackingProgress: React.FC<{ value: number; label: string; reduceMotion: boolean }> = ({
  value,
  label,
  reduceMotion,
}) => {
  const progress = useRef(new Animated.Value(reduceMotion ? value : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(value);
      return;
    }
    Animated.timing(progress, {
      toValue: value,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, value, reduceMotion]);

  return (
    <View style={styles.progressContainer} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.progressPercent}>{Math.round(value * 100)}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>
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
  iconWrapper: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 2,
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
    borderRadius: 1,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  lineFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  progressContainer: {
    marginBottom: spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    ...typography.bodyStrong,
    color: colors.primaryStrong,
    flex: 1,
  },
  progressPercent: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
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
