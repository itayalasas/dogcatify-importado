import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing, typography, shadows } from '../constants/theme';

interface MercadoPagoRedirectModalProps {
  visible: boolean;
  message: string;
  progress: Animated.Value;
  hint?: string;
}

export function MercadoPagoRedirectModal({
  visible,
  message,
  progress,
  hint = 'Serás redirigido a Mercado Pago',
}: MercadoPagoRedirectModalProps) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      floatAnim.stopAnimation();
      pulseAnim.stopAnimation();
      floatAnim.setValue(0);
      pulseAnim.setValue(0);
      return;
    }

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [visible, floatAnim, pulseAnim]);

  const logoTranslateY = floatAnim.interpolate({
    inputRange: [-1, 0],
    outputRange: [-8, 0],
  });

  const logoScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View
          style={styles.card}
          accessibilityRole="progressbar"
          accessibilityLabel={`Procesando pago. ${message}`}
          accessibilityLiveRegion="polite"
        >
          <View style={styles.logoStage}>
            <Animated.View
              style={[
                styles.logoWrap,
                {
                  transform: [{ translateY: logoTranslateY }, { scale: logoScale }],
                },
              ]}
            >
              <Image
                source={require('@/assets/images/mercadopago.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </Animated.View>
          </View>

          <Text style={styles.title}>Procesando pago</Text>
          <Text style={styles.subtitle}>{message}</Text>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progress.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          <Text style={styles.hint}>{hint}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
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
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    ...shadows.lg,
  },
  logoStage: {
    width: 206,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoWrap: {
    width: 190,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 190,
    height: 82,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
