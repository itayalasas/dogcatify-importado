import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { ArrowLeft, User, Mail, Lock, Briefcase, Check, CircleCheck as CheckCircle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { colors, typography, spacing, radius, hitSlop, touchTarget } from '../../constants/theme';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import {
  createEmailConfirmationToken,
  generateConfirmationUrl,
  sendConfirmationEmailAPI,
} from '../../utils/emailConfirmation';
import { getFriendlyAuthErrorMessage } from '../../utils/authErrorMessages';
import { validatePassword, PASSWORD_MIN_LENGTH_EXCLUSIVE } from '../../utils/passwordValidation';

const AUTO_BIOMETRIC_SUPPRESS_KEY = '@dogcatify_skip_auto_biometric_once';

export default function BecomePartner() {
  const { t } = useLanguage();
  const { currentUser } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const hasCurrentSession = Boolean(currentUser?.id);

  useEffect(() => {
    if (currentUser?.displayName && !fullName) {
      setFullName(currentUser.displayName);
    }

    if (currentUser?.email && !email) {
      setEmail(currentUser.email);
    }
  }, [currentUser?.displayName, currentUser?.email]);

  const passwordValidation = validatePassword(password);
  const isPasswordValid = passwordValidation.isValid;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const passwordRequirementsMessage =
    'La contraseña debe incluir minúscula, mayúscula, número, carácter especial y tener más de 8 caracteres';

  const handlePasswordChange = (text: string) => {
    setPassword(text);

    if (text.length > 0 && !validatePassword(text).isValid) {
      setPasswordError(passwordRequirementsMessage);
    } else {
      setPasswordError('');
    }

    if (confirmPassword.length > 0 && text !== confirmPassword) {
      setConfirmPasswordError('Las contraseñas no coinciden');
    } else if (confirmPassword.length > 0) {
      setConfirmPasswordError('');
    }
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (text.length > 0 && text !== password) {
      setConfirmPasswordError('Las contraseñas no coinciden');
    } else {
      setConfirmPasswordError('');
    }
  };

  const handleRegister = async () => {
    if (hasCurrentSession) {
      router.replace('/partner-register');
      return;
    }

    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Completá todos los campos');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (!isPasswordValid) {
      Alert.alert('Error', passwordRequirementsMessage);
      return;
    }

    if (!acceptTerms) {
      Alert.alert('Error', 'Tenés que aceptar los términos y condiciones');
      return;
    }

    setLoading(true);

    try {
      const trimmedEmail = email.toLowerCase().trim();
      const trimmedName = fullName.trim();

      const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedName,
            account_role: 'partner',
            is_owner: false,
            is_partner: true,
          },
          emailRedirectTo: undefined,
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Error al crear la cuenta');
      }

      await supabaseClient.auth.signOut().catch(() => undefined);
      await AsyncStorage.setItem(AUTO_BIOMETRIC_SUPPRESS_KEY, '1').catch(() => undefined);

      const confirmationToken = await createEmailConfirmationToken(
        authData.user.id,
        trimmedEmail,
        'signup'
      );

      const confirmationUrl = generateConfirmationUrl(confirmationToken, 'signup');
      const emailResult = await sendConfirmationEmailAPI(
        trimmedEmail,
        trimmedName,
        confirmationUrl
      );

      if (!emailResult.success) {
        console.warn('Partner confirmation email could not be sent:', emailResult.error);
      }

      const confirmationTitle = emailResult.success
        ? 'Registro de aliado exitoso'
        : 'Cuenta de aliado creada';
      const confirmationMessage = emailResult.success
        ? `Tu cuenta de aliado se creó correctamente.\n\nTe enviamos un correo de confirmación a:\n${trimmedEmail}\n\nCuando confirmes el correo, vas a poder ingresar y registrar tu negocio.`
        : `Tu cuenta de aliado se creó correctamente, pero no pudimos enviar el correo de confirmación automáticamente.\n\nRevisá el correo registrado o reenvialo desde la pantalla de ingreso.\n\nCorreo:\n${trimmedEmail}`;

      Alert.alert(
        confirmationTitle,
        confirmationMessage,
        [{ text: 'Entendido', onPress: () => router.replace('/auth/login') }]
      );
    } catch (error: any) {
      console.error('Partner registration error:', error);
      Alert.alert(
        'No pudimos crear la cuenta',
        getFriendlyAuthErrorMessage(error, 'partner')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
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
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.topBar}>
          <IconButton
            icon={<ArrowLeft size={24} color={colors.text} />}
            onPress={() => router.back()}
            accessibilityLabel="Volver"
          />
        </View>

        <View style={styles.form}>
          <View style={styles.header}>
            <View style={styles.heroIcon}>
              <Briefcase size={32} color={colors.primary} />
            </View>
            <Text style={styles.title} accessibilityRole="header">
              {hasCurrentSession ? 'Completá tu alta de aliado' : t('becomePartner')}
            </Text>
            <Text style={styles.subtitle}>
              {hasCurrentSession
                ? 'Vamos a usar tu sesión actual para registrar tu negocio sin crear otra cuenta.'
                : t('partnerRegisterSubtitle')}
            </Text>
          </View>

          {hasCurrentSession ? (
            <View style={styles.sessionCard}>
              <View style={styles.sessionTitleRow}>
                <CheckCircle size={18} color={colors.success} />
                <Text style={styles.sessionTitle}>Ya tenés una sesión activa</Text>
              </View>
              <Text style={styles.sessionText}>
                Estás conectado como {currentUser?.email || 'tu cuenta actual'}.
                Vamos a usar esa misma cuenta para completar el alta de tu negocio como aliado.
              </Text>
            </View>
          ) : (
            <>
              <Input
                label="Nombre completo"
                placeholder="Tu nombre completo"
                value={fullName}
                onChangeText={setFullName}
                autoComplete="name"
                textContentType="name"
                leftIcon={<User size={20} color={colors.icon} />}
              />

              <Input
                label="Correo electrónico"
                placeholder="tu@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                leftIcon={<Mail size={20} color={colors.icon} />}
              />

              <Input
                label="Contraseña"
                placeholder={`Mínimo ${PASSWORD_MIN_LENGTH_EXCLUSIVE + 1} caracteres`}
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType="newPassword"
                leftIcon={<Lock size={20} color={colors.icon} />}
                showPasswordToggle={true}
                isPasswordVisible={showPassword}
                onTogglePasswordVisibility={() => setShowPassword(!showPassword)}
                error={passwordError}
              />

              <Input
                label="Confirmar contraseña"
                placeholder="Repetí tu contraseña"
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                textContentType="newPassword"
                leftIcon={<Lock size={20} color={colors.icon} />}
                showPasswordToggle={true}
                isPasswordVisible={showConfirmPassword}
                onTogglePasswordVisibility={() => setShowConfirmPassword(!showConfirmPassword)}
                error={confirmPasswordError}
                helperText={passwordsMatch ? 'Las contraseñas coinciden' : undefined}
              />

              <View style={styles.termsRow}>
                <TouchableOpacity
                  onPress={() => setAcceptTerms(!acceptTerms)}
                  activeOpacity={0.8}
                  hitSlop={hitSlop}
                  style={styles.checkboxTouch}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: acceptTerms }}
                  accessibilityLabel="Acepto los términos y condiciones y la política de privacidad"
                >
                  <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}>
                    {acceptTerms && <Check size={14} color={colors.onPrimary} strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
                <Text style={styles.termsText}>
                  Acepto los{' '}
                  <Text style={styles.termsLink} onPress={() => router.push('/legal/terms-of-service')} accessibilityRole="link">
                    términos y condiciones
                  </Text>{' '}
                  y la{' '}
                  <Text style={styles.termsLink} onPress={() => router.push('/legal/privacy-policy')} accessibilityRole="link">
                    política de privacidad
                  </Text>
                </Text>
              </View>
            </>
          )}

          <Button
            title={hasCurrentSession ? 'Ir al registro de negocio' : 'Crear cuenta de aliado'}
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            size="large"
          />

          {!hasCurrentSession && (
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => router.replace('/auth/login')}
              accessibilityRole="link"
            >
              <Text style={styles.loginText}>
                ¿Ya tenés cuenta? <Text style={styles.loginLink}>Ingresá</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxl,
  },
  topBar: {
    marginLeft: -spacing.md,
    marginBottom: spacing.xs,
    alignItems: 'flex-start',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  sessionCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sessionTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  sessionText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
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
    maxWidth: 340,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xxl,
  },
  checkboxTouch: {
    marginRight: spacing.md,
    paddingTop: spacing.xxs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsText: {
    ...typography.bodySmall,
    flex: 1,
    color: colors.textSecondary,
  },
  termsLink: {
    color: colors.primary,
    fontFamily: typography.label.fontFamily,
    textDecorationLine: 'underline',
  },
  loginButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget,
  },
  loginText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loginLink: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
});
