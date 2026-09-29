import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Image, Alert, Animated, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScanFace, Fingerprint, Zap, ShieldCheck, Lock } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
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
      Alert.alert('Error', 'Información de credenciales no disponible');
      return;
    }

    setLoading(true);
    try {
      const success = await enableBiometric(email, password);

      if (success) {
        Alert.alert(
          `¡${biometricType || 'Biometría'} activado!`,
          `Ahora podés iniciar sesión con solo mirar tu teléfono.`,
          [{ text: 'Continuar', onPress: () => navigateToPostLoginRoute() }]
        );
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
          />
        </View>

        <Text style={styles.welcomeText}>¡Hola {userName}! 👋</Text>

        <View style={styles.heroContainer}>
          <Animated.View
            style={[
              styles.pulseRing,
              { transform: [{ scale: ringScale }], opacity: ringOpacity },
            ]}
          />
          <View style={styles.iconContainer}>
            <BiometricIcon size={56} color="#2D6A6F" strokeWidth={1.75} />
          </View>
        </View>

        <Text style={styles.title}>{biometricType || 'Face ID'}</Text>
        <Text style={styles.subtitle}>Iniciá sesión más rápido y seguro</Text>

        <View style={styles.benefitsList}>
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <View key={index} style={styles.benefitRow}>
                <View style={styles.benefitIconContainer}>
                  <Icon size={18} color="#2D6A6F" strokeWidth={2} />
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

          <TouchableOpacity onPress={handleSkip} style={styles.skipButton} disabled={loading}>
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
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 16,
  },
  logo: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  welcomeText: {
    fontSize: 18,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 36,
  },
  heroContainer: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pulseRing: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#2D6A6F',
  },
  iconContainer: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  title: {
    fontSize: 26,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  benefitsList: {
    width: '100%',
    gap: 14,
    marginBottom: 36,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 19,
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#2D6A6F',
    borderRadius: 16,
    paddingVertical: 16,
  },
  skipButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  skipButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#9CA3AF',
  },
});
