import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Image, Alert, Animated, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScanFace, Fingerprint, Zap, ShieldCheck, Lock } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';
import { colors, typography, spacing, radius, touchTarget } from '../../constants/theme';
import { useBiometric } from '../../contexts/BiometricContext';
import { useAuth } from '../../contexts/AuthContext';
import { resolvePostLoginRoute } from '../../utils/onboarding';

export default function BiometricSetup() {
  const { email, password, userName, redirect } = useLocalSearchParams<{
    email: string;
    password: string;
    userName: string;
    redirect?: string;
  }>();

  const {
    isBiometricSupported,
    biometricType,
    enableBiometric,
    markBiometricSetupDeclined,
  } = useBiometric();
  const { currentUser, clearPostLoginFlow } = useAuth();

  const [loading, setLoading] = useState(false);
  const isFaceId = (biometricType || 'Face ID').toLowerCase().includes('face');
  const BiometricIcon = isFaceId ? ScanFace : Fingerprint;

  // Soft pulsing ring behind the icon — the same "breathing" cue Face
  // ID/Touch ID prompts in most polished apps (banking apps, Duolingo,
  // Revolut) use to signal "this is a live scanner", not a static graphic.
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const ringScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const ringOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  const navigateToPostLoginRoute = async () => {
    clearPostLoginFlow();

    if (!currentUser?.id) {
      router.replace({
        pathname: '/auth/login',
        params: redirect ? { redirect } : undefined,
      });
      return;
    }

    const nextRoute = await resolvePostLoginRoute(currentUser.id, redirect, currentUser);
    router.replace(nextRoute as any);
  };

  const handleEnableBiometric = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'No encontramos tus datos de ingreso. Volvé a ingresar e intentá de nuevo.');
      return;
    }

    setLoading(true);
    try {
      const success = await enableBiometric(email, password);

      if (success) {
        toast.success(
          `¡${biometricType || 'Biometría'} activado!`,
          'La próxima vez vas a poder ingresar sin escribir tu contraseña.'
        );
        navigateToPostLoginRoute();
      } else {
        navigateToPostLoginRoute();
      }
    } catch (error) {
      console.error('Error enabling biometric:', error);
      navigateToPostLoginRoute();
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (currentUser?.id) {
      await markBiometricSetupDeclined(currentUser.id);
    }
    navigateToPostLoginRoute();
  };

  useEffect(() => {
    if (!isBiometricSupported) {
      navigateToPostLoginRoute();
    }
  }, [isBiometricSupported, currentUser?.id, redirect]);

  if (!isBiometricSupported) return null;

  const benefits = [
    { icon: Zap, text: 'Entrá a la app en un segundo, sin escribir tu contraseña' },
    { icon: ShieldCheck, text: `Solo vos podés acceder, aunque alguien tenga tu teléfono` },
    { icon: Lock, text: 'Tus credenciales nunca salen de tu dispositivo' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/logo-transp.png')}
            style={styles.logo}
            accessibilityLabel="DogCatiFy"
          />
        </View>

        <Text style={styles.welcomeText}>¡Hola, {userName}! 👋</Text>

        <View style={styles.heroContainer}>
          <Animated.View
            style={[
              styles.pulseRing,
              { transform: [{ scale: ringScale }], opacity: ringOpacity },
            ]}
          />
          <View style={styles.iconContainer}>
            <BiometricIcon size={56} color={colors.primary} strokeWidth={1.75} />
          </View>
        </View>

        <Text style={styles.title} accessibilityRole="header">{biometricType || 'Face ID'}</Text>
        <Text style={styles.subtitle}>Ingresá más rápido y seguro</Text>

        <View style={styles.benefitsList}>
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <View key={index} style={styles.benefitRow}>
                <View style={styles.benefitIconContainer}>
                  <Icon size={18} color={colors.primary} strokeWidth={2} />
                </View>
                <Text style={styles.benefitText}>{benefit.text}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.actions}>
          <Button
            title={`Activar ${biometricType || 'Biometría'}`}
            onPress={handleEnableBiometric}
            loading={loading}
            size="large"
            style={styles.primaryButton}
          />

          <TouchableOpacity
            onPress={handleSkip}
            style={styles.skipButton}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Ahora no"
          >
            <Text style={styles.skipButtonText}>Ahora no</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  logoContainer: {
    marginBottom: spacing.lg,
  },
  logo: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  welcomeText: {
    ...typography.heading,
    fontFamily: typography.label.fontFamily,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
  },
  heroContainer: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  pulseRing: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  iconContainer: {
    width: 108,
    height: 108,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  title: {
    ...typography.display,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
  },
  benefitsList: {
    width: '100%',
    gap: spacing.md,
    marginBottom: spacing.xxxl,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  benefitIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    ...typography.bodySmall,
    flex: 1,
    color: colors.textSecondary,
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.xs,
  },
  primaryButton: {
    width: '100%',
  },
  skipButton: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  skipButtonText: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
