import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Modal, Platform, Animated, Alert, KeyboardAvoidingView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Mail, Lock, CircleAlert as AlertCircle, X, Check } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';
import { colors, typography, spacing, radius, shadows, hitSlop, touchTarget } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useBiometric } from '../../contexts/BiometricContext';
import { resendConfirmationEmail } from '../../utils/emailConfirmation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolvePostLoginRoute } from '../../utils/onboarding';

const SAVED_CREDENTIALS_KEY = '@saved_credentials';

// Componente de error moderno
const ErrorBanner = ({ error, onDismiss }: { 
  error: string; 
  onDismiss: () => void;
}) => {
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  };

  const getErrorMessage = (errorText: string) => {
    if (errorText.includes('Invalid login credentials')) {
      return {
        title: 'Credenciales incorrectas',
        message: 'El correo electrónico o la contraseña no son correctos. Verificalos e intentá de nuevo.',
        icon: <AlertCircle size={20} color={colors.danger} />,
        showResendButton: false
      };
    } else if (errorText.includes('Email not confirmed') || errorText.includes('confirmar tu correo')) {
      return {
        title: 'Email no confirmado',
        message: 'Tenés que confirmar tu correo electrónico antes de ingresar.',
        icon: <Mail size={20} color={colors.warning} />,
      };
    } else if (errorText.includes('Too many requests')) {
      return {
        title: 'Demasiados intentos',
        message: 'Intentaste muchas veces. Esperá unos minutos antes de volver a intentar.',
        icon: <AlertCircle size={20} color={colors.warning} />,
      };
    } else if (errorText.startsWith('Completá')) {
      return {
        title: 'Faltan datos',
        message: errorText,
        icon: <AlertCircle size={20} color={colors.warning} />,
      };
    } else if (errorText.includes('User not found')) {
      return {
        title: 'Usuario no encontrado',
        message: 'No existe una cuenta con este correo electrónico. ¿Querés registrarte?',
        icon: <AlertCircle size={20} color={colors.primary} />,
      };
    } else {
      return {
        title: 'Error de conexión',
        message: 'Hubo un problema al conectar. Revisá tu conexión e intentá de nuevo.',
        icon: <AlertCircle size={20} color={colors.danger} />,
      };
    }
  };

  const errorInfo = getErrorMessage(error);

  return (
    <Animated.View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.errorBanner, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
      <View style={styles.errorContent}>
        <View style={styles.errorIcon}>
          {errorInfo.icon}
        </View>
        <View style={styles.errorText}>
          <Text style={styles.errorTitle}>{errorInfo.title}</Text>
          <Text style={styles.errorMessage}>{errorInfo.message}</Text>
        </View>
        <TouchableOpacity
          style={styles.errorDismiss}
          onPress={handleDismiss}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Cerrar aviso"
        >
          <X size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

export default function Login() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [rememberCredentials, setRememberCredentials] = useState(false);
  const [showEmailConfirmationModal, setShowEmailConfirmationModal] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [biometricAttempted, setBiometricAttempted] = useState(false);
  const { login, authError, clearAuthError } = useAuth();
  const { t } = useLanguage();
  const {
    isBiometricSupported,
    isBiometricEnabled,
    biometricType,
    authenticateWithBiometric,
    hasDeclinedBiometricSetup
  } = useBiometric();

  // Load saved credentials on component mount
  useEffect(() => {
    loadSavedCredentials();
  }, []);

  // Auto-trigger biometric authentication when component loads
  useEffect(() => {
    const attemptBiometricLogin = async () => {
      // Only attempt once and if biometric is enabled
      if (!biometricAttempted && isBiometricEnabled && isBiometricSupported) {
        setBiometricAttempted(true);
        
        try {
          const credentials = await authenticateWithBiometric();
          if (credentials) {
            setEmail(credentials.email);
            setPassword(credentials.password);
            // Auto-login with biometric credentials
            await handleLogin(credentials.email, credentials.password);
          } else {
          }
        } catch (error) {
          // If biometric fails, just continue with normal login
        }
      }
    };

    // Small delay to ensure UI is ready
    const timer = setTimeout(attemptBiometricLogin, 500);
    return () => clearTimeout(timer);
  }, [isBiometricEnabled, isBiometricSupported, biometricAttempted]);

  // Handle auth errors from context
  useEffect(() => {
    if (authError) {
      if (authError.startsWith('EMAIL_NOT_CONFIRMED:')) {
        const userEmail = authError.split(':')[1];
        setPendingEmail(userEmail || email);
        setShowEmailConfirmationModal(true);
        setLoginError(null); // No mostrar banner de error
      } else {
        setLoginError(authError);
      }
    }
  }, [authError]);

  const loadSavedCredentials = async () => {
    try {
      const savedCredentials = await AsyncStorage.getItem(SAVED_CREDENTIALS_KEY);
      if (savedCredentials) {
        const { email: savedEmail, password: savedPassword } = JSON.parse(savedCredentials);
        if (savedEmail && savedPassword) {
          setEmail(savedEmail);
          setPassword(savedPassword);
          setRememberCredentials(true);
        }
      }
    } catch (error) {
    }
  };

  const saveCredentials = async (email: string, password: string) => {
    try {
      const credentials = { email, password };
      await AsyncStorage.setItem(SAVED_CREDENTIALS_KEY, JSON.stringify(credentials));
    } catch (error) {
    }
  };

  const clearSavedCredentials = async () => {
    try {
      await AsyncStorage.removeItem(SAVED_CREDENTIALS_KEY);
    } catch (error) {
    }
  };

  const handleLogin = async (emailParam?: string, passwordParam?: string) => {
    const loginEmail = emailParam || email;
    const loginPassword = passwordParam || password;

    if (!loginEmail || !loginPassword) {
      setLoginError('Completá tu correo y tu contraseña');
      return;
    }

    setLoading(true);
    setLoginError(null);
    clearAuthError();

    try {
      const result = await login(loginEmail, loginPassword);
      
      if (result) {
        
        // Save credentials if user opted to remember them
        if (rememberCredentials) {
          await saveCredentials(loginEmail, loginPassword);
        } else {
          // Clear saved credentials if user unchecked the option
          await clearSavedCredentials();
        }
        
        // Check if should show biometric setup. Skipped once already
        // (@biometric_setup_declined:<userId>) means never ask again on
        // login — they can still enable it later from Profile.
        const alreadyDeclined = await hasDeclinedBiometricSetup(result.id);

        if (isBiometricSupported && !isBiometricEnabled && !alreadyDeclined) {
          // Navigate to biometric setup screen instead of directly to tabs
          router.replace({
            pathname: '/auth/biometric-setup',
            params: {
              email: loginEmail,
              password: loginPassword,
              userName: result.displayName || 'Usuario',
              ...(redirect && { redirect })
            }
          });
        } else {
          const nextRoute = await resolvePostLoginRoute(result.id, redirect, result);
          router.replace(nextRoute as any);
        }
      }
    } catch (error: any) {
      
      // Verificar si es error de email no confirmado
      if (error.message?.includes('confirmar tu correo') || error.message?.includes('Email not confirmed')) {
        setPendingEmail(email);
        setShowEmailConfirmationModal(true);
      } else {
        setLoginError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
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
  };

  const handleResendConfirmationEmail = async () => {
    if (!pendingEmail) {
      return;
    }

    setResendingEmail(true);
    try {
      const result = await resendConfirmationEmail(pendingEmail);
      if (result.success) {
        setShowEmailConfirmationModal(false);
        clearAuthError();
        setPendingEmail('');
        
        toast.success('Correo enviado', `Te mandamos un nuevo enlace a ${pendingEmail}. Revisá tu bandeja de entrada.`);
      } else {
        Alert.alert('Error', result.error || 'No se pudo reenviar el correo');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo reenviar el correo de confirmación');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleCloseEmailModal = () => {
    setShowEmailConfirmationModal(false);
    clearAuthError();
    setPendingEmail('');
  };

  const dismissError = () => {
    setLoginError(null);
    clearAuthError();
  };

  const handleGoToRegister = () => {
    dismissError();
    setShowEmailConfirmationModal(false);
    setPendingEmail('');
    router.push('/auth/register');
  };

  const handleGoToBecomePartner = () => {
    dismissError();
    setShowEmailConfirmationModal(false);
    setPendingEmail('');
    router.push('/auth/become-partner');
  };

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Image
              source={require('../../assets/images/logo-transp.png')}
              style={styles.logo}
              accessibilityLabel="DogCatiFy"
            />
            <Text style={styles.title} accessibilityRole="header">¡Hola de nuevo!</Text>
            <Text style={styles.subtitle}>Ingresá para seguir conectado con tu comunidad de mascotas</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Correo electrónico"
              placeholder="tu@email.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (loginError) {
                  dismissError();
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              leftIcon={<Mail size={20} color={colors.icon} />}
            />

            <Input
              label="Contraseña"
              placeholder="Tu contraseña"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (loginError) {
                  dismissError();
                }
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              textContentType="password"
              leftIcon={<Lock size={20} color={colors.icon} />}
              showPasswordToggle
              isPasswordVisible={showPassword}
              onTogglePasswordVisibility={() => setShowPassword(!showPassword)}
            />

            {/* Error Banner - Solo se renderiza cuando hay error */}
            {loginError && (
              <ErrorBanner error={loginError} onDismiss={dismissError} />
            )}

            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberCredentialsRow}
                onPress={() => setRememberCredentials(!rememberCredentials)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberCredentials }}
                accessibilityLabel="Recordar mis datos"
              >
                <View style={[styles.checkbox, rememberCredentials && styles.checkedCheckbox]}>
                  {rememberCredentials && <Check size={14} color={colors.onPrimary} strokeWidth={3} />}
                </View>
                <Text style={styles.rememberCredentialsText}>Recordar mis datos</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/auth/forgot-password')}
                activeOpacity={0.7}
                style={styles.textLink}
                accessibilityRole="link"
              >
                <Text style={styles.forgotPasswordLink}>Olvidé mi contraseña</Text>
              </TouchableOpacity>
            </View>

            <Button
              title="Ingresar"
              onPress={() => handleLogin()}
              loading={loading}
              disabled={loading}
              size="large"
            />
          </View>

          <View style={styles.footer}>
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>¿No tenés cuenta?</Text>
              <TouchableOpacity
                onPress={handleGoToRegister}
                activeOpacity={0.7}
                style={styles.textLink}
                accessibilityRole="link"
              >
                <Text style={styles.link}>Registrate</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.textLink}
              onPress={handleGoToBecomePartner}
              accessibilityRole="link"
            >
              <Text style={styles.partnerText}>
                ¿Tenés un negocio? <Text style={styles.link}>{t('becomePartner')}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
              <View style={styles.modalIcon}>
                <Mail size={28} color={colors.primary} />
              </View>
              <Text style={styles.modalTitle} accessibilityRole="header">Confirmá tu correo</Text>
            </View>

            <Text style={styles.modalText}>
              Para continuar, tenés que confirmar tu correo electrónico.
            </Text>

            <View style={styles.emailContainer}>
              <Text style={styles.emailLabel}>Correo</Text>
              <Text style={styles.emailValue}>{pendingEmail}</Text>
            </View>

            <Text style={styles.modalInstructions}>
              Revisá tu bandeja de entrada (y la carpeta de spam) y tocá el enlace de confirmación.
            </Text>

            <View style={styles.modalActions}>
              <Button
                title={resendingEmail ? 'Enviando...' : 'Reenviar correo'}
                onPress={handleResendConfirmationEmail}
                loading={resendingEmail}
                size="large"
                style={styles.modalButton}
              />
              <Button
                title="Cancelar"
                onPress={handleCloseEmailModal}
                variant="ghost"
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
    backgroundColor: colors.surface,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.huge,
    paddingBottom: spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.display,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },

  // Error Banner Styles
  errorBanner: {
    marginBottom: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    overflow: 'hidden',
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
  },
  errorIcon: {
    marginRight: spacing.sm,
    marginTop: spacing.xxs,
  },
  errorText: {
    flex: 1,
  },
  errorTitle: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  errorMessage: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  errorDismiss: {
    padding: spacing.xxs,
    marginLeft: spacing.xs,
  },

  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: spacing.xl,
    marginTop: -spacing.xs,
  },
  rememberCredentialsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTarget,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: 6,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkedCheckbox: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rememberCredentialsText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  textLink: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  forgotPasswordLink: {
    ...typography.label,
    color: colors.primary,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  link: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    alignSelf: 'stretch',
    marginVertical: spacing.md,
  },
  partnerText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 400,
    ...shadows.lg,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  modalText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emailContainer: {
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  emailLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  emailValue: {
    ...typography.bodyStrong,
    color: colors.primaryStrong,
  },
  modalInstructions: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  modalActions: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  modalButton: {
    width: '100%',
  },
});
