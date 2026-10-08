import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check, Lock } from 'lucide-react-native';
import { colors, radius, spacing, typography, shadows } from '../constants/theme';

interface MercadoPagoRedirectModalProps {
  visible: boolean;
  message: string;
  progress: Animated.Value;
  hint?: string;
}

const STEPS = ['Preparando tu pago', 'Creando la orden', 'Abriendo Mercado Pago'];

// El paso activo sale del mensaje real que manda la pantalla y, si el mensaje
// no lo dice, de la barra de progreso. Nunca retrocede mientras está visible.
const stepFromMessage = (message: string): number => {
  const text = message.toLowerCase();
  if (text.includes('abriendo') || text.includes('redirig')) return 2;
  if (text.includes('creando') || text.includes('orden')) return 1;
  return 0;
};

const stepFromProgress = (value: number): number => {
  if (value >= 70) return 2;
  if (value >= 35) return 1;
  return 0;
};

export function MercadoPagoRedirectModal({
  visible,
  message,
  progress,
  hint = 'Serás redirigido a Mercado Pago',
}: MercadoPagoRedirectModalProps) {
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const [progressStep, setProgressStep] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!visible) {
      setProgressStep(0);
      return;
    }
    const id = progress.addListener(({ value }) => {
      const next = stepFromProgress(value);
      setProgressStep((current) => (next > current ? next : current));
    });
    return () => progress.removeListener(id);
  }, [visible, progress]);

  useEffect(() => {
    const values = [ringA, ringB, shimmer, cardAnim];
    if (!visible) {
      values.forEach((v) => {
        v.stopAnimation();
        v.setValue(0);
      });
      return;
    }

    Animated.spring(cardAnim, {
      toValue: 1,
      friction: 8,
      tension: 70,
      useNativeDriver: true,
    }).start();

    if (reduceMotion) return;

    const ring = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );

    const loops = [
      ring(ringA, 0),
      ring(ringB, 900),
      Animated.loop(
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [visible, reduceMotion, ringA, ringB, shimmer, cardAnim]);

  const activeStep = Math.max(stepFromMessage(message), progressStep);

  const ringStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.45, 0] }),
    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.6] }) }],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardAnim,
              transform: [
                { scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
              ],
            },
          ]}
          accessibilityRole="progressbar"
          accessibilityLabel={`Procesando pago. ${message}`}
          accessibilityLiveRegion="polite"
        >
          <View style={styles.logoStage}>
            <Animated.View style={[styles.ring, ringStyle(ringA)]} />
            <Animated.View style={[styles.ring, ringStyle(ringB)]} />
            <View style={styles.logoCircle}>
              <Image
                source={require('@/assets/images/mercadopago.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </View>

          <Text style={styles.title}>Procesando tu pago</Text>
          <Text style={styles.subtitle}>{message}</Text>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progress.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['4%', '100%'],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.shimmer,
                  {
                    transform: [
                      {
                        translateX: shimmer.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-80, 320],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </Animated.View>
          </View>

          <View style={styles.steps}>
            {STEPS.map((label, index) => {
              const done = index < activeStep;
              const active = index === activeStep;
              return (
                <View key={label} style={styles.stepRow}>
                  <View
                    style={[
                      styles.stepDot,
                      done && styles.stepDotDone,
                      active && styles.stepDotActive,
                    ]}
                  >
                    {done ? (
                      <Check size={12} color={colors.onPrimary} strokeWidth={3} />
                    ) : (
                      <View style={[styles.stepInner, active && styles.stepInnerActive]} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepText,
                      done && styles.stepTextDone,
                      active && styles.stepTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.hintRow}>
            <Lock size={13} color={colors.textSecondary} />
            <Text style={styles.hint}>{hint}</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const LOGO_CIRCLE = 104;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    ...shadows.lg,
  },
  logoStage: {
    width: LOGO_CIRCLE * 1.7,
    height: LOGO_CIRCLE * 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  ring: {
    position: 'absolute',
    width: LOGO_CIRCLE,
    height: LOGO_CIRCLE,
    borderRadius: LOGO_CIRCLE / 2,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  logoCircle: {
    width: LOGO_CIRCLE,
    height: LOGO_CIRCLE,
    borderRadius: LOGO_CIRCLE / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  logo: {
    width: 72,
    height: 72,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  steps: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotActive: {
    borderColor: colors.primary,
  },
  stepInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  stepInnerActive: {
    backgroundColor: colors.primary,
  },
  stepText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  stepTextDone: {
    color: colors.textSecondary,
  },
  stepTextActive: {
    ...typography.label,
    color: colors.text,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    flexShrink: 1,
  },
});
