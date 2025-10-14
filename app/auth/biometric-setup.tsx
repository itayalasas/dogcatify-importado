import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Image, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Fingerprint, X } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useBiometric } from '../../contexts/BiometricContext';

export default function BiometricSetup() {
  const { email, password, userName } = useLocalSearchParams<{
    email: string;
    password: string;
    userName: string;
  }>();
  
  const { 
    isBiometricSupported, 
    biometricType, 
    enableBiometric 
  } = useBiometric();
  
  const [loading, setLoading] = useState(false);

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
          '¡Biometría configurada!',
          `${biometricType || 'La autenticación biométrica'} ha sido habilitada. Ahora puedes iniciar sesión más rápido.`,
          [{ 
            text: 'Continuar', 
            onPress: () => router.replace('/(tabs)') 
          }]
        );
      } else {
        Alert.alert(
          'No se pudo configurar',
          'La biometría no se pudo configurar. Puedes intentarlo más tarde desde tu perfil.',
          [{ 
            text: 'Continuar', 
            onPress: () => router.replace('/(tabs)') 
          }]
        );
      }
    } catch (error) {
      console.error('Error enabling biometric:', error);
      Alert.alert(
        'Error',
        'Hubo un problema configurando la biometría. Puedes intentarlo más tarde desde tu perfil.',
        [{ 
          text: 'Continuar', 
          onPress: () => router.replace('/(tabs)') 
        }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  if (!isBiometricSupported) {
    // If biometric is not supported, go directly to main app
    router.replace('/(tabs)');
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/images/logo.jpg')} 
            style={styles.logo} 
          />
        </View>

        {/* Welcome Message */}
        <Text style={styles.welcomeText}>¡Hola {userName}! 👋</Text>

        {/* Biometric Icon and Title */}
        <View style={styles.biometricSection}>
          <View style={styles.biometricIconContainer}>
            <Fingerprint size={64} color="#2D6A6F" />
          </View>
          
          <Text style={styles.title}>
            Configura {biometricType || 'Face ID'}
          </Text>
          
          <Text style={styles.subtitle}>
            Inicia sesión más rápido y seguro con tu {biometricType?.toLowerCase() || 'huella dactilar'}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title={`Habilitar ${biometricType || 'Biometría'}`}
            onPress={handleEnableBiometric}
            loading={loading}
            size="large"
            style={styles.primaryButton}
          />
          
          <Button
            title="Continuar sin biometría"
            onPress={handleSkip}
            variant="outline"
            size="large"
            style={styles.secondaryButton}
          />
        </View>

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Text style={styles.securityText}>
            🔐 Tus credenciales se almacenan de forma segura en tu dispositivo
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 30,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 40,
  },
  logoContainer: {
    marginTop: 60,
    marginBottom: 50,
  },
  logo: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  },
  welcomeText: {
    fontSize: 28,
    fontFamily: 'Inter-SemiBold',
    color: '#2D6A6F',
    textAlign: 'center',
    marginBottom: 60,
  },
  biometricSection: {
    alignItems: 'center',
    marginBottom: 50,
  },
  biometricIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  actions: {
    width: '100%',
    gap: 16,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#2D6A6F',
    borderRadius: 20,
    paddingVertical: 16,
  },
  secondaryButton: {
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingVertical: 16,
  },
  securityNote: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    width: '100%',
    marginBottom: 40,
  },
  securityText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#166534',
    textAlign: 'center',
    lineHeight: 18,
  },
});