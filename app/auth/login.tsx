import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image, TouchableOpacity } from 'react-native';
import { Link, router } from 'expo-router';
import { Mail, Lock, Fingerprint } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useBiometric } from '../../contexts/BiometricContext';
import { useLanguage } from '../../contexts/LanguageContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const { login } = useAuth();
  const { 
    isBiometricAvailable, 
    isBiometricEnabled, 
    authenticateWithBiometric, 
    enableBiometric,
    getStoredCredentials 
  } = useBiometric();
  const { t } = useLanguage();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    setLoading(true);
    try {
      const user = await login(email, password);
      if (user) {
        // Check if biometric is available and not yet enabled
        if (isBiometricAvailable && !isBiometricEnabled) {
          setShowBiometricSetup(true);
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert(t('error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const credentials = await getStoredCredentials();
      if (credentials) {
        const success = await authenticateWithBiometric();
        if (success) {
          setEmail(credentials.email);
          setPassword(credentials.password);
          // Auto-login with stored credentials
          const user = await login(credentials.email, credentials.password);
          if (user) {
            router.replace('/(tabs)');
          }
        }
      } else {
        Alert.alert('Error', 'No hay credenciales guardadas para autenticación biométrica');
      }
    } catch (error) {
      console.error('Biometric login error:', error);
      Alert.alert('Error', 'No se pudo autenticar con biometría');
    }
  };

  const handleEnableBiometric = async () => {
    try {
      if (!email || !password) {
        Alert.alert('Error', 'Email y contraseña son requeridos para configurar biometría');
        return;
      }

      const success = await enableBiometric(email, password);
      if (success) {
        setShowBiometricSetup(false);
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Error enabling biometric:', error);
      Alert.alert('Error', 'No se pudo configurar la autenticación biométrica');
      skipBiometricSetup();
    }
  };

  const skipBiometricSetup = () => {
    setShowBiometricSetup(false);
    router.replace('/(tabs)');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Image 
          source={require('../../assets/images/logo.jpg')} 
          style={styles.logo} 
        />
        <Text style={styles.title}>{t('welcomeBack')}</Text>
        <Text style={styles.subtitle}>{t('signInSubtitle')}</Text>
      </View>

      <View style={styles.form}>
        <Input
          label={t('email')}
          placeholder={t('email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          leftIcon={<Mail size={20} color="#6B7280" />}
        />

        <Input
          label={t('password')}
          placeholder={t('password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          leftIcon={<Lock size={20} color="#6B7280" />}
        />

        <Button
          title={t('signIn')}
          onPress={handleLogin}
          loading={loading}
          size="large"
        />

        {/* Biometric Login Button */}
        {isBiometricEnabled && (
          <TouchableOpacity 
            style={styles.biometricButton}
            onPress={handleBiometricLogin}
          >
            <Fingerprint size={24} color="#3B82F6" />
            <Text style={styles.biometricButtonText}>
              Iniciar sesión con biometría
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.footer}>
          <Link href="/auth/forgot-password" style={styles.link}>
            {t('forgotPassword')}
          </Link>
          
          <Text style={styles.footerText}>
            {t('dontHaveAccount')}{' '}
            <Link href="/auth/register" style={styles.link}>
              {t('signUp')}
            </Link>
          </Text>
        </View>
      </View>

      {/* Biometric Setup Modal */}
      {showBiometricSetup && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Fingerprint size={48} color="#3B82F6" />
              <Text style={styles.modalTitle}>Habilitar acceso rápido</Text>
              <Text style={styles.modalSubtitle}>
                ¿Quieres usar tu Reconocimiento facial para iniciar sesión más rápido la próxima vez?
              </Text>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.skipButton}
                onPress={skipBiometricSetup}
              >
                <Text style={styles.skipButtonText}>Ahora no</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.enableButton}
                onPress={handleEnableBiometric}
              >
                <Text style={styles.enableButtonText}>Habilitar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 30,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 180,
    height: 180,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF8FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  biometricButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
    gap: 16,
  },
  footerText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  link: {
    color: '#3B82F6',
    fontFamily: 'Inter-SemiBold',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  skipButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2D6A6F',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#2D6A6F',
  },
  enableButton: {
    flex: 1,
    backgroundColor: '#2D6A6F',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  enableButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
});