import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Image, TextInput } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { Mail, Lock, Eye, EyeOff, Check, Fingerprint } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useBiometric } from '../../contexts/BiometricContext'; 

export default function Login() {
  const { redirectTo } = useLocalSearchParams<{ redirectTo?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showBiometricOption, setShowBiometricOption] = useState(false);
  const { login } = useAuth();
  const { t } = useLanguage();
  const { authError, clearAuthError } = useAuth();
  const { 
    isBiometricSupported, 
    isBiometricEnabled, 
    biometricType, 
    enableBiometric, 
    authenticateWithBiometric,
    checkBiometricStatus
  } = useBiometric();

  // Check for biometric availability on component mount
  React.useEffect(() => {
    checkBiometricAvailability();
    // Clear any previous auth errors when component mounts
    clearAuthError();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      // Skip biometric check in Expo Go
      if (__DEV__) {
        console.log('Skipping biometric check in development');
        return;
      }

      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      console.log('Biometric availability:', { compatible, enrolled });
    } catch (error) {
      console.error('Error checking biometric availability:', error);
    }
  };

  // Cargar credenciales guardadas al iniciar
  React.useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('remembered_email');
        const savedPassword = await AsyncStorage.getItem('remembered_password');
        
        if (savedEmail && savedPassword) {
          setEmail(savedEmail);
          setPassword(savedPassword);
          setRememberPassword(true);
        }
      } catch (error) {
        console.error('Error loading saved credentials:', error);
      }
    };
    
    loadSavedCredentials();
  }, []);

  React.useEffect(() => {
    // Check biometric status when component mounts
    checkBiometricStatus();
  }, [checkBiometricStatus]);

  // Show auth error if it exists
  React.useEffect(() => {
    if (authError) {
      Alert.alert(
        'Error de cuenta',
        authError,
        [
          { 
            text: 'Crear nueva cuenta', 
            onPress: () => {
              clearAuthError();
              router.push('/auth/register');
            }
          },
          { 
            text: 'Entendido', 
            onPress: () => clearAuthError(),
            style: 'cancel'
          }
        ]
      );
    }
  }, [authError]);

  const handleLogin = async () => {
    // Clear any previous errors
    clearAuthError();
    
    // Validate credentials are provided
    if (!email || !password) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }
    
    // Guardar credenciales si rememberPassword está activado
    if (rememberPassword) {
      try {
        await AsyncStorage.setItem('remembered_email', email);
        // No guardar la contraseña en texto plano en producción
        // Esto es solo para demostración
        await AsyncStorage.setItem('remembered_password', password);
      } catch (error) {
        console.error('Error saving credentials:', error);
      }
    } else {
      // Limpiar credenciales guardadas
      try {
        await AsyncStorage.removeItem('remembered_email');
        await AsyncStorage.removeItem('remembered_password');
      } catch (error) {
        console.error('Error removing credentials:', error);
      }
    }

    // Proceed with credential login
    await handleCredentialLogin();
  };

  const handleBiometricButtonPress = async () => {
    if (!isBiometricEnabled || !isBiometricSupported) {
      Alert.alert('Biometría no disponible', 'La autenticación biométrica no está configurada o no está disponible en este dispositivo.');
      return;
    }

    await handleBiometricLogin();
  };

  const handleBiometricLogin = async () => {
    if (!isBiometricEnabled || !isBiometricSupported) {
      Alert.alert('Biometría no disponible', 'La autenticación biométrica no está configurada o no está disponible en este dispositivo.');
      return false;
    }

    setBiometricLoading(true);
    try {
      console.log('Starting biometric login...');
      const credentials = await authenticateWithBiometric();
      
      if (credentials) {
        console.log('Biometric authentication successful, logging in...');
        const result = await login(credentials.email, credentials.password);
        
        if (result) {
          const isAdmin = result?.email?.toLowerCase() === 'admin@dogcatify.com';
          if (isAdmin) {
            router.replace('/(admin-tabs)/requests');
          } else {
            if (redirectTo) {
              router.replace(`/${redirectTo}` as any);
            } else {
              router.replace('/(tabs)');
            }
          }
          return true;
        }
      }
      return false;
    } catch (error: any) {
      console.error('Biometric login error:', error);
      Alert.alert('Error', 'No se pudo autenticar con biometría. Intenta con tu correo y contraseña.');
      return false;
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleCredentialLogin = async () => {
    setLoading(true);
    try {
      console.log('Attempting login with credentials:', email);
      try {
        const result = await login(email, password);
        
        if (result) {
          // Show biometric setup option after successful login
          if (isBiometricSupported && !isBiometricEnabled && email && password) {
            setShowBiometricOption(true);
          } else {
            // Redirect based on user type after successful login
            const isAdmin = result?.email?.toLowerCase() === 'admin@dogcatify.com';
            if (isAdmin) {
              console.log('Admin login, redirecting to admin tabs');
              router.replace('/(admin-tabs)/requests');
            } else {
              console.log('Regular user login, redirecting to regular tabs');
              // Verificar si hay un deep link pendiente
              if (redirectTo) {
                console.log('Redirecting to deep link after login:', redirectTo);
                router.replace(`/${redirectTo}` as any);
              } else {
                router.replace('/(tabs)');
              }
            }
          }
        }
      } catch (error: any) {
        console.error('Login error details:', error);
        
        // Manejar errores específicos de autenticación
        if (error.message.includes('confirma tu correo')) {
          Alert.alert(
            'Correo electrónico no confirmado',
            'Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace de confirmación.',
            [
              { 
                text: 'Reenviar correo', 
                onPress: async () => {
                  // Mostrar loading en el botón
                  Alert.alert(
                    'Reenviando correo...',
                    'Por favor espera mientras enviamos un nuevo correo de confirmación.',
                    [],
                    { cancelable: false }
                  );
                  
                  try {
                    const { resendConfirmationEmail } = await import('../../utils/emailConfirmation');
                    const result = await resendConfirmationEmail(email);
                    
                    if (!result.success) {
                      throw new Error(result.error || 'Error al reenviar confirmación');
                    }
                    
                    // Cerrar el loading y mostrar éxito
                    Alert.alert(
                      '✅ Correo Reenviado', 
                      `Se ha enviado un nuevo correo de confirmación a ${email}.\n\nPor favor revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace de confirmación.\n\nEl enlace expira en 24 horas.`,
                      [{ text: 'Entendido', style: 'default' }]
                    );
                  } catch (resendError) {
                    console.error('Error resending confirmation email:', resendError);
                    Alert.alert(
                      '❌ Error al Reenviar', 
                      resendError.message || 'No se pudo reenviar el correo de confirmación. Por favor verifica tu conexión e intenta más tarde.',
                      [{ text: 'Entendido', style: 'default' }]
                    );
                  }
                }
              },
              { text: 'Entendido', style: 'default' }
            ]
          );
        } else if (error.message.includes('Email not confirmed')) {
          Alert.alert(
            'Correo electrónico no confirmado',
            'Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada y haz clic en el enlace de confirmación.',
            [
              { 
                text: 'Reenviar correo', 
                onPress: async () => {
                  // Mostrar loading en el botón
                  Alert.alert(
                    'Reenviando correo...',
                    'Por favor espera mientras enviamos un nuevo correo de confirmación.',
                    [],
                    { cancelable: false }
                  );
                  
                  try {
                    const { resendConfirmationEmail } = await import('../../utils/emailConfirmation');
                    const result = await resendConfirmationEmail(email);
                    
                    if (!result.success) {
                      throw new Error(result.error || 'Error al reenviar confirmación');
                    }
                    
                    // Cerrar el loading y mostrar éxito
                    Alert.alert(
                      '✅ Correo Reenviado', 
                      `Se ha enviado un nuevo correo de confirmación a ${email}.\n\nPor favor revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace de confirmación.\n\nEl enlace expira en 24 horas.`,
                      [{ text: 'Entendido', style: 'default' }]
                    );
                  } catch (resendError) {
                    console.error('Error resending confirmation email:', resendError);
                    Alert.alert(
                      '❌ Error al Reenviar', 
                      resendError.message || 'No se pudo reenviar el correo de confirmación. Por favor verifica tu conexión e intenta más tarde.',
                      [{ text: 'Entendido', style: 'default' }]
                    );
                  }
                }
              },
              { text: 'Entendido', style: 'default' }
            ]
          );
        } else if (error.message.includes('Invalid login credentials') || 
                   error.message.includes('invalid_credentials') ||
                   error.message.includes('Invalid email or password')) {
          Alert.alert(
            'Credenciales incorrectas',
            'El correo electrónico o la contraseña son incorrectos. Por favor verifica tus datos e intenta nuevamente.',
            [{ text: 'Entendido', style: 'default' }]
          );
        } else if (error.message.includes('User not found') || 
                   error.message.includes('user_not_found') ||
                   error.message.includes('Invalid user')) {
          Alert.alert(
            'Usuario no encontrado',
            'No existe una cuenta con este correo electrónico. ¿Deseas crear una cuenta nueva?',
            [
              { text: 'Cancelar', style: 'cancel' },
              { 
                text: 'Crear cuenta', 
                onPress: () => router.push('/auth/register')
              }
            ]
          );
        } else if (error.message.includes('Email not confirmed')) {
          Alert.alert(
            'Correo electrónico no confirmado',
            'Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada y haz clic en el enlace de confirmación.',
            [
              { 
                text: 'Reenviar correo', 
                onPress: async () => {
                  // Mostrar loading en el botón
                  Alert.alert(
                    'Reenviando correo...',
                    'Por favor espera mientras enviamos un nuevo correo de confirmación.',
                    [],
                    { cancelable: false }
                  );
                  
                  try {
                    const { resendConfirmationEmail } = await import('../../utils/emailConfirmation');
                    const result = await resendConfirmationEmail(email);
                    
                    if (!result.success) {
                      throw new Error(result.error || 'Error al reenviar confirmación');
                    }
                    
                    // Cerrar el loading y mostrar éxito
                    Alert.alert(
                      '✅ Correo Reenviado', 
                      `Se ha enviado un nuevo correo de confirmación a ${email}.\n\nPor favor revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace de confirmación.\n\nEl enlace expira en 24 horas.`,
                      [{ text: 'Entendido', style: 'default' }]
                    );
                  } catch (resendError) {
                    console.error('Error resending confirmation email:', resendError);
                    Alert.alert(
                      '❌ Error al Reenviar', 
                      resendError.message || 'No se pudo reenviar el correo de confirmación. Por favor verifica tu conexión e intenta más tarde.',
                      [{ text: 'Entendido', style: 'default' }]
                    );
                  }
                }
              },
              { text: 'Entendido', style: 'default' }
            ]
          );
        } else if (error.message.includes('Too many requests')) {
          Alert.alert(
            'Demasiados intentos',
            'Has realizado demasiados intentos de inicio de sesión. Por favor espera unos minutos antes de intentar nuevamente.',
            [{ text: 'Entendido', style: 'default' }]
          );
        } else if (error.message.includes('User not found')) {
          Alert.alert(
            'Usuario no encontrado',
            'No existe una cuenta con este correo electrónico. ¿Deseas crear una cuenta nueva?',
            [
              { text: 'Cancelar', style: 'cancel' },
              { 
                text: 'Crear cuenta', 
                onPress: () => router.push('/auth/register')
              }
            ]
          );
        } else {
          Alert.alert(
            'Error de inicio de sesión',
            'Ocurrió un error al intentar iniciar sesión. Por favor verifica tu conexión a internet e intenta nuevamente.',
            [{ text: 'Entendido', style: 'default' }]
          );
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnableBiometric = async () => {
    console.log('Attempting to enable biometric with credentials');
    const success = await enableBiometric(email, password);
    if (success) {
      console.log('Biometric successfully enabled');
      Alert.alert(
        'Autenticación biométrica habilitada',
        `Ahora puedes usar tu ${biometricType || 'biometría'} para iniciar sesión rápidamente. Esta opción aparecerá la próxima vez que inicies la aplicación.`,
        [
          { 
            text: 'OK', 
            onPress: () => {
              const isAdmin = email.toLowerCase() === 'admin@dogcatify.com';
              if (isAdmin) {
                router.replace('/(admin-tabs)/requests');
              } else {
                router.replace('/(tabs)');
              }
            }
          }
        ]
      );
      setShowBiometricOption(false);
    } else {
      console.error('Failed to enable biometric');
      Alert.alert('Error', 'No se pudo habilitar la autenticación biométrica');
      // Redirect even if biometric setup failed
      if (email === 'admin@dogcatify.com') {
        router.replace('/(admin-tabs)/requests');
      } else {
        router.replace('/(tabs)');
      }
    }
  };

  const skipBiometricSetup = () => {
    setShowBiometricOption(false);
    // Redirect when skipping biometric setup
    const isAdmin = email.toLowerCase() === 'admin@dogcatify.com';
    if (isAdmin) {
      router.replace('/(admin-tabs)/requests');
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Image 
          source={require('../../assets/images/logo.jpg')} 
          style={styles.logo} 
        />
        <Text style={styles.title}>¡Bienvenido de vuelta!</Text>
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
              {showPassword ? <EyeOff size={20} color="#6B7280" /> : <Eye size={20} color="#6B7280" />}
            </TouchableOpacity>
          }
        />

        <View style={styles.rememberContainer}>
          <TouchableOpacity 
            style={styles.rememberRow} 
            onPress={() => setRememberPassword(!rememberPassword)}
          >
            <View style={[styles.checkbox, rememberPassword && styles.checkedCheckbox]}>
              {rememberPassword && <Check size={16} color="#FFFFFF" />}
            </View>
            <Text style={styles.rememberText}>Recordar contraseña</Text>
          </TouchableOpacity>
        </View>

        {/* Show biometric button if biometric is enabled, otherwise show regular login */}
        {isBiometricSupported && isBiometricEnabled ? (
          <TouchableOpacity
            style={styles.biometricMainButton}
            onPress={handleBiometricButtonPress}
            disabled={biometricLoading}
          >
            <Fingerprint size={24} color="#FFFFFF" />
            <Text style={styles.biometricMainButtonText}>
              {biometricLoading ? 'Autenticando...' : `Iniciar con ${biometricType || 'Biometría'}`}
            </Text>
          </TouchableOpacity>
        ) : (
          <Button
            title={t('signIn')}
            onPress={handleLogin}
            loading={loading}
            size="large"
          />
        )}

        {/* Alternative login option when biometric is primary */}
        {isBiometricSupported && isBiometricEnabled && (
          <TouchableOpacity
            style={styles.alternativeLoginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.alternativeLoginText}>
              Usar correo y contraseña
            </Text>
          </TouchableOpacity>
        )}

        {/* Biometric Setup Option */}
        {showBiometricOption && isBiometricSupported && !isBiometricEnabled && (
          <View style={styles.biometricSetup}>
            <Text style={styles.biometricSetupTitle} numberOfLines={2}>
              🔒 Habilitar acceso rápido
            </Text>
            <Text style={styles.biometricSetupText} numberOfLines={3}>
              ¿Quieres usar tu {biometricType} para iniciar sesión más rápido la próxima vez?
            </Text>
            <View style={styles.biometricSetupButtons}>
              <View style={styles.biometricButton}>
                <Button title="Ahora no" onPress={skipBiometricSetup} variant="outline" size="small" />
              </View>
              <View style={styles.biometricButton}>
                <Button title="Habilitar" onPress={handleEnableBiometric} size="small" />
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity 
          style={styles.forgotPasswordButton}
          onPress={() => router.push('/auth/forgot-password')}
        >
          <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('dontHaveAccount')}{' '}
            <Link href="/auth/register" style={styles.link}>
              {t('signUp')}
            </Link>
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 30, // Add padding at the top to show status bar
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 140,
    height: 140,
    resizeMode: 'contain',
    marginBottom: 8,
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
  footer: {
    alignItems: 'center',
    marginTop: 8,
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
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedCheckbox: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  rememberText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  forgotPasswordButton: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
  biometricLoginSection: {
    marginTop: 24,
    marginBottom: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    paddingHorizontal: 16,
  },
  biometricLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  biometricLoginText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  biometricMainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D6A6F',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 44,
    gap: 8,
    marginBottom: 12,
  },
  biometricMainButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  alternativeLoginButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 12,
  },
  alternativeLoginText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },
  biometricSetup: {
    backgroundColor: '#F0F9FF',
    padding: 20,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    width: '100%',
  },
  biometricSetupTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
    flexWrap: 'wrap',
  },
  biometricSetupText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  biometricSetupButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  biometricButton: {
    flex: 1,
    maxWidth: '48%',
  },
});