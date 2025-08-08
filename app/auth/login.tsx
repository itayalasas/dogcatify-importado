import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image, TouchableOpacity, Modal, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import { Mail, Lock, Eye, EyeOff, Fingerprint } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useBiometric } from '../../contexts/BiometricContext';
import { resendConfirmationEmail } from '../../utils/emailConfirmation';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_CREDENTIALS_KEY = '@saved_credentials';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [rememberCredentials, setRememberCredentials] = useState(false);
  const [showEmailConfirmationModal, setShowEmailConfirmationModal] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const { login, authError, clearAuthError } = useAuth();
  const { t } = useLanguage();
  const { 
    isBiometricSupported, 
    isBiometricEnabled, 
    biometricType, 
    authenticateWithBiometric
  } = useBiometric();

  // Load saved credentials and check for biometric authentication on component mount
  useEffect(() => {
    const initializeLogin = async () => {
      // First try to load saved credentials
      await loadSavedCredentials();
      
      // Then check for biometric authentication if enabled
      if (isBiometricEnabled && isBiometricSupported) {
        setTimeout(async () => {
          try {
            const credentials = await authenticateWithBiometric();
            if (credentials) {
              setEmail(credentials.email);
              setPassword(credentials.password);
              // Auto-login with biometric credentials
              handleLogin(credentials.email, credentials.password);
            }
          } catch (error) {
            console.log('Biometric authentication cancelled or failed');
          }
        }, 500);
      }
    };

    initializeLogin();
  }, [isBiometricEnabled, isBiometricSupported]);

  const loadSavedCredentials = async () => {
    try {
      const savedCredentials = await AsyncStorage.getItem(SAVED_CREDENTIALS_KEY);
      if (savedCredentials) {
        const { email: savedEmail, password: savedPassword } = JSON.parse(savedCredentials);
        if (savedEmail && savedPassword) {
          setEmail(savedEmail);
          setPassword(savedPassword);
          setRememberCredentials(true);
          console.log('Loaded saved credentials for:', savedEmail);
        }
      }
    } catch (error) {
      console.error('Error loading saved credentials:', error);
    }
  };

  const saveCredentials = async (email: string, password: string) => {
    try {
      const credentials = { email, password };
      await AsyncStorage.setItem(SAVED_CREDENTIALS_KEY, JSON.stringify(credentials));
      console.log('Credentials saved successfully');
    } catch (error) {
      console.error('Error saving credentials:', error);
    }
  };

  const clearSavedCredentials = async () => {
    try {
      await AsyncStorage.removeItem(SAVED_CREDENTIALS_KEY);
      console.log('Saved credentials cleared');
    } catch (error) {
      console.error('Error clearing saved credentials:', error);
    }
  };

  // Handle auth errors from context
  useEffect(() => {
    if (authError) {
      if (authError.startsWith('EMAIL_NOT_CONFIRMED:')) {
        const userEmail = authError.split(':')[1];
        setPendingEmail(userEmail || email);
        setShowEmailConfirmationModal(true);
      }
    }
  }, [authError]);

  const handleLogin = async (emailParam?: string, passwordParam?: string) => {
    const loginEmail = emailParam || email;
    const loginPassword = passwordParam || password;

    if (!loginEmail || !loginPassword) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    setLoading(true);
    clearAuthError();

    try {
      console.log('Attempting login with credentials:', loginEmail);
      const result = await login(loginEmail, loginPassword);
      
      if (result) {
        console.log('Login successful');
        
        // Save credentials if user opted to remember them
        if (rememberCredentials) {
          await saveCredentials(loginEmail, loginPassword);
        } else {
          // Clear saved credentials if user unchecked the option
          await clearSavedCredentials();
        }
        
        // Check if should show biometric setup
        if (isBiometricSupported && !isBiometricEnabled) {
          // Navigate to biometric setup screen instead of directly to tabs
          router.replace({
            pathname: '/auth/biometric-setup',
            params: { 
              email: loginEmail, 
              password: loginPassword,
              userName: result.displayName || 'Usuario'
            }
          });
        } else {
          // Go directly to main app
          router.replace('/(tabs)');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Don't show alert for email confirmation errors - the modal will handle it
      if (!error.message?.includes('confirmar tu correo')) {
        Alert.alert(t('error'), error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!pendingEmail) {
      Alert.alert('Error', 'Por favor ingresa tu correo electrónico');
      return;
    }

    setResendingEmail(true);
    try {
      const result = await resendConfirmationEmail(pendingEmail);
      if (result.success) {
        // Close modal first
        setShowEmailConfirmationModal(false);
        clearAuthError();
        
        // Then show success alert
        Alert.alert(
          'Correo enviado',
          `Se ha enviado un nuevo correo de confirmación a ${pendingEmail}.\n\nRevisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace de confirmación.`,
          [{ 
            text: 'Entendido', 
            onPress: () => {
              // Clear form and stay on login screen
              setEmail('');
              setPassword('');
              setPendingEmail('');
            }
          }]
        );
      } else {
        Alert.alert('Error', result.error || 'No se pudo reenviar el correo');
      }
    } catch (error) {
      console.error('Resend email error:', error);
      Alert.alert('Error', 'No se pudo reenviar el correo de confirmación');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleCloseEmailModal = () => {
    setShowEmailConfirmationModal(false);
    clearAuthError();
    // Clear form when closing modal
    setEmail('');
    setPassword('');
    setPendingEmail('');
  };

  return (
    <>
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
            secureTextEntry={!showPassword}
            leftIcon={<Lock size={20} color="#6B7280" />}
            rightIcon={
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <EyeOff size={20} color="#6B7280" />
                ) : (
                  <Eye size={20} color="#6B7280" />
                )}
              </TouchableOpacity>
            }
          />

          <View style={styles.rememberCredentialsContainer}>
            <TouchableOpacity 
              style={styles.rememberCredentialsRow} 
              onPress={() => setRememberCredentials(!rememberCredentials)}
            >
              <View style={[styles.checkbox, rememberCredentials && styles.checkedCheckbox]}>
                {rememberCredentials && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.rememberCredentialsText}>
                Recordar mis credenciales
              </Text>
            </TouchableOpacity>
          </View>

          <Button
            title={t('signIn')}
            onPress={() => handleLogin()}
            loading={loading}
            disabled={loading}
            size="large"
          />

          <View style={styles.forgotPasswordContainer}>
            <Link href="/auth/forgot-password" style={styles.forgotPasswordLink}>
              {t('forgotPassword')}
            </Link>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('dontHaveAccount')}{' '}
            <Link href="/auth/register" style={styles.link}>
              {t('signUp')}
            </Link>
          </Text>
        </View>
      </ScrollView>

      {/* Email Confirmation Modal */}
      <Modal
        visible={showEmailConfirmationModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseEmailModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📧 Confirma tu correo</Text>
            </View>
            
            <Text style={styles.modalText}>
              Para continuar, debes confirmar tu correo electrónico.
            </Text>
            
            <View style={styles.emailContainer}>
              <Text style={styles.emailLabel}>Email:</Text>
              <Text style={styles.emailValue}>{pendingEmail}</Text>
            </View>
            
            <Text style={styles.modalInstructions}>
              Revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace de confirmación.
            </Text>
            
            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                onPress={handleCloseEmailModal}
                variant="outline"
                size="large"
                style={styles.modalButton}
              />
              <Button
                title={resendingEmail ? 'Enviando...' : 'Reenviar correo'}
                onPress={handleResendEmail}
                loading={resendingEmail}
                size="large"
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    padding: 20,
    paddingTop: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 140,
    height: 140,
    resizeMode: 'contain',
    marginBottom: 16,
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
  saveCredentialsContainer: {
    marginBottom: 20,
  },
  rememberCredentialsContainer: {
    marginBottom: 20,
  },
  rememberCredentialsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkedCheckbox: {
    backgroundColor: '#2D6A6F',
    borderColor: '#2D6A6F',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  rememberCredentialsText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    flex: 1,
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordLink: {
    color: '#3B82F6',
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  emailContainer: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  emailLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
    marginBottom: 4,
  },
  emailValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
  },
  modalInstructions: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'column',
    gap: 12,
  },
  modalButton: {
    width: '100%',
  },
});