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
  hint = 'Seras redirigido a Mercado Pago',
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
        <View style={styles.card}>
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

          <Text style={styles.title}>Procesando pago...</Text>
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
    backgroundColor: 'rgba(17, 24, 39, 0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 26,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 12,
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
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginTop: 4,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter-SemiBold',
    color: '#059669',
    textAlign: 'center',
    marginBottom: 24,
  },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 18,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#00A650',
  },
  hint: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
