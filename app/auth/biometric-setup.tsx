import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Image, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Fingerprint, ArrowRight, X } from 'lucide-react-native';
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
        <Card style={styles.setupCard}>
          {/* Skip button */}
          <View style={styles.skipButtonContainer}>
            <Button
              title="Omitir"
              onPress={handleSkip}
              variant="outline"
              size="small"
            />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Image 
              source={require('../../assets/images/logo.jpg')} 
              style={styles.logo} 
            />
            <Text style={styles.welcomeText}>¡Hola {userName}! 👋</Text>
          </View>

          {/* Biometric Icon */}
          <View style={styles.biometricContainer}>
            <View style={styles.biometricIconContainer}>
              <Fingerprint size={80} color="#2D6A6F" />
            </View>
            
            <Text style={styles.title}>
              Configura {biometricType || 'Biometría'}
            </Text>
            
            <Text style={styles.subtitle}>
              Inicia sesión más rápido y seguro con tu {biometricType?.toLowerCase() || 'huella dactilar'}
            </Text>
          </View>

          {/* Benefits */}
          <View style={styles.benefitsContainer}>
            <View style={styles.benefit}>
              <View style={styles.benefitIcon}>
                <Text style={styles.benefitEmoji}>⚡</Text>
              </View>
              <Text style={styles.benefitText}>Acceso instantáneo</Text>
            </View>
            
            <View style={styles.benefit}>
              <View style={styles.benefitIcon}>
                <Text style={styles.benefitEmoji}>🔒</Text>
              </View>
              <Text style={styles.benefitText}>Máxima seguridad</Text>
            </View>
            
            <View style={styles.benefit}>
              <View style={styles.benefitIcon}>
                <Text style={styles.benefitEmoji}>🚀</Text>
              </View>
              <Text style={styles.benefitText}>Sin contraseñas</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              title={`Habilitar ${biometricType || 'Biometría'}`}
              onPress={handleEnableBiometric}
              loading={loading}
              size="large"
            />
            
            <Button
              title="Continuar sin biometría"
              onPress={handleSkip}
              variant="outline"
              size="large"
            />
          </View>

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Text style={styles.securityText}>
              🔐 Tus credenciales se almacenan de forma segura en tu dispositivo
            </Text>
          </View>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 30,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  setupCard: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    position: 'relative',
  },
  skipButtonContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 18,
    fontFamily: 'Inter-Medium',
    color: '#2D6A6F',
    textAlign: 'center',
  },
  biometricContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  biometricIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#BAE6FD',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  benefitsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  benefit: {
    alignItems: 'center',
    flex: 1,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EBF8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  benefitEmoji: {
    fontSize: 24,
  },
  benefitText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    textAlign: 'center',
  },
  actions: {
    gap: 16,
    marginBottom: 24,
  },
  securityNote: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  securityText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#166534',
    textAlign: 'center',
    lineHeight: 16,
  },
});