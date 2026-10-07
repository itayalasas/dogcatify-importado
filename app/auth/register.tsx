import React, { useState } from 'react';
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
import { ArrowLeft, User, Mail, Lock, Check, CheckCircle2, Circle } from 'lucide-react-native';
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
import {
  validatePassword,
  getPasswordStrengthKey,
  PASSWORD_MIN_LENGTH_EXCLUSIVE,
} from '../../utils/passwordValidation';

export default function Register() {
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

  const { t } = useLanguage();
  const { clearAuthError } = useAuth();

  const passwordValidation = validatePassword(password);
  const passwordRules = passwordValidation.rules.map((rule) => ({
    ...rule,
    label:
      rule.key === 'passwordRuleLowercase'
        ? 'Al menos una letra minúscula'
        : rule.key === 'passwordRuleUppercase'
          ? 'Al menos una letra mayúscula'
          : rule.key === 'passwordRuleNumber'
            ? 'Al menos un número'
            : rule.key === 'passwordRuleSpecialChar'
              ? 'Al menos un carácter especial'
              : 'Más de 8 caracteres',
  }));
  const passwordScore = passwordValidation.score;
  const isPasswordValid = passwordValidation.isValid;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const getPasswordStrength = () => {
    const key = getPasswordStrengthKey(passwordScore);
    if (key === 'passwordStrengthWeak') return 'Débil';
    if (key === 'passwordStrengthMedium') return 'Media';
    return 'Fuerte';
  };

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

  const isFormValid =
    !!fullName.trim() &&
    !!email.trim() &&
    isPasswordValid &&
    !!confirmPassword &&
    passwordsMatch &&
    !passwordError &&
    !confirmPasswordError &&
    acceptTerms;

  const handlePrivacyPress = () => {
    router.push('/legal/privacy-policy');
  };

  const handleTermsPress = () => {
    router.push('/legal/terms-of-service');
  };

  const handleRegister = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert('Error', t('fillAllFields'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', t('passwordsDontMatch'));
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
    console.log('=== STARTING REGISTRATION PROCESS ===');
    console.log('Email:', email.toLowerCase().trim());
    console.log('Full name:', fullName.trim());

    try {
      const trimmedEmail = email.toLowerCase().trim();
      const trimmedName = fullName.trim();

      console.log('Step 1: Creating user with Supabase Auth...');
      const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedName,
            account_role: 'owner',
            is_owner: true,
            is_partner: false,
          },
          emailRedirectTo: undefined,
        },
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        throw new Error(authError.message);
      }

      if (!authData.user) {
        console.error('No user returned from signup');
        throw new Error('Error creating user');
      }

      console.log('Step 2: User created successfully. User ID:', authData.user.id);
      console.log('Step 3: Profile will be auto-created by database trigger with name:', trimmedName);

      console.log('Step 4: Creating email confirmation token using helper function...');
      const confirmationToken = await createEmailConfirmationToken(
        authData.user.id,
        trimmedEmail,
        'signup'
      );
      console.log('Step 5: Confirmation token created:', confirmationToken);

      console.log('Step 6: Generating confirmation URL using helper function...');
      const confirmationUrl = generateConfirmationUrl(confirmationToken, 'signup');
      console.log('Step 7: Confirmation URL generated:', confirmationUrl);

      console.log('Step 8: Sending confirmation email using API helper function...');
      const emailResult = await sendConfirmationEmailAPI(
        trimmedEmail,
        trimmedName,
        confirmationUrl
      );

      if (!emailResult.success) {
        console.error('Email sending failed:', emailResult.error);
        console.warn('User registered but email not sent. Manual intervention may be needed.');
      } else {
        console.log('Email sent successfully');
        if (emailResult.log_id) {
          console.log('Email log ID:', emailResult.log_id);
        }
      }

      console.log('=== REGISTRATION COMPLETED ===');

      const confirmationTitle = emailResult.success ? 'Registro exitoso' : 'Cuenta creada';
      const confirmationMessage = emailResult.success
        ? `Tu cuenta se creó correctamente.\n\nTe enviamos un correo de confirmación a:\n${trimmedEmail}\n\nRevisá tu bandeja de entrada y la carpeta de spam, y tocá el enlace de confirmación.\n\nEl enlace vence en 24 horas.`
        : `Tu cuenta se creó, pero no pudimos enviar el correo de confirmación automáticamente.\n\nRevisá tu conexión o reenviá el correo desde la pantalla de ingreso.\n\nCorreo registrado:\n${trimmedEmail}`;

      // signUp() above triggers Supabase's own SIGNED_IN event, which
      // AuthContext's onAuthStateChange listener treats like a login attempt:
      // it checks app-level confirmation, finds the brand-new account
      // unconfirmed, and sets a global EMAIL_NOT_CONFIRMED authError before
      // signing back out. If that error is still in context when login.tsx
      // mounts next, its own authError effect pops the "reenviar correo"
      // modal immediately — even though the user never tried to log in.
      // Clear it here so login.tsx starts clean; the modal should only ever
      // appear from a real login attempt.
      clearAuthError();

      Alert.alert(
        confirmationTitle,
        confirmationMessage,
        [{ text: 'Entendido', onPress: () => {
          clearAuthError();
          router.replace('/auth/login');
        } }]
      );
    } catch (error: any) {
      console.error('Registration error:', error);
      console.error('Error stack:', error.stack);
      Alert.alert(
        'No pudimos crear tu cuenta',
        getFriendlyAuthErrorMessage(error, 'owner')
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

        <View style={styles.header}>
          <Image
            source={require('../../assets/images/logo-transp.png')}
            style={styles.logo}
            accessibilityLabel="DogCatiFy"
          />
          <Text style={styles.title} accessibilityRole="header">Creá tu cuenta</Text>
          <Text style={styles.subtitle}>{t('createAccountSubtitle')}</Text>
        </View>

        <View style={styles.form}>
          <Input
            label={t('fullName')}
            placeholder="Tu nombre completo"
            value={fullName}
            onChangeText={setFullName}
            autoComplete="name"
            textContentType="name"
            leftIcon={<User size={20} color={colors.icon} />}
          />

          <Input
            label={t('email')}
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
            label={t('password')}
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

          {password.length > 0 && (
            <View style={styles.passwordFeedbackContainer}>
              <View style={styles.passwordStrengthHeader}>
                <Text style={styles.passwordStrengthLabel}>Seguridad de la contraseña</Text>
                <Text style={styles.passwordStrengthValue}>{getPasswordStrength()}</Text>
              </View>

              <View style={styles.passwordStrengthBarBackground}>
                <View
                  style={[
                    styles.passwordStrengthBarFill,
                    { width: `${(passwordScore / passwordRules.length) * 100}%` },
                  ]}
                />
              </View>

              <View style={styles.passwordRulesList}>
                {passwordRules.map((rule) => (
                  <View key={rule.label} style={styles.passwordRuleRow}>
                    {rule.valid ? (
                      <CheckCircle2 size={16} color={colors.success} />
                    ) : (
                      <Circle size={16} color={colors.textTertiary} />
                    )}
                    <Text
                      style={[
                        styles.passwordRuleText,
                        rule.valid ? styles.passwordRuleValid : styles.passwordRulePending,
                      ]}
                    >
                      {rule.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <Input
            label={t('confirmPassword')}
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

          <View style={styles.termsContainer}>
            <TouchableOpacity
              onPress={() => setAcceptTerms(!acceptTerms)}
              style={styles.checkboxTouch}
              hitSlop={hitSlop}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptTerms }}
              accessibilityLabel="Acepto las políticas de privacidad y los términos de servicio"
            >
              <View style={[styles.checkboxBox, acceptTerms && styles.checkboxChecked]}>
                {acceptTerms && <Check size={14} color={colors.onPrimary} strokeWidth={3} />}
              </View>
            </TouchableOpacity>

            <Text style={styles.termsText}>
              Acepto las{' '}
              <Text style={styles.termsLink} onPress={handlePrivacyPress} accessibilityRole="link">
                políticas de privacidad
              </Text>{' '}
              y los{' '}
              <Text style={styles.termsLink} onPress={handleTermsPress} accessibilityRole="link">
                términos de servicio
              </Text>
            </Text>
          </View>

          <Button
            title={loading ? 'Creando cuenta...' : t('createAccount')}
            onPress={handleRegister}
            loading={loading}
            disabled={!isFormValid || loading}
            size="large"
          />

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.textLink}
              onPress={() => router.replace('/auth/login')}
              accessibilityRole="link"
            >
              <Text style={styles.footerText}>
                {t('alreadyHaveAccount')} <Text style={styles.link}>{t('signIn')}</Text>
              </Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.textLink}
              onPress={() => router.push('/auth/become-partner')}
              accessibilityRole="link"
            >
              <Text style={styles.footerText}>
                ¿Tenés un negocio? <Text style={styles.link}>{t('becomePartner')}</Text>
              </Text>
            </TouchableOpacity>
          </View>
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
  logo: {
    width: 88,
    height: 88,
    resizeMode: 'contain',
    marginBottom: spacing.md,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    marginBottom: spacing.xl,
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
  passwordFeedbackContainer: {
    marginTop: -spacing.xs,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
  },
  passwordStrengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  passwordStrengthLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  passwordStrengthValue: {
    ...typography.label,
    fontFamily: typography.bodyStrong.fontFamily,
    fontWeight: '600',
    color: colors.primary,
  },
  passwordStrengthBarBackground: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  passwordStrengthBarFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  passwordRulesList: {
    gap: spacing.sm,
  },
  passwordRuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  passwordRuleText: {
    ...typography.bodySmall,
    flex: 1,
  },
  passwordRuleValid: {
    color: colors.success,
  },
  passwordRulePending: {
    color: colors.textSecondary,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xxl,
  },
  checkboxTouch: {
    marginRight: spacing.md,
    paddingTop: spacing.xxs,
  },
  checkboxBox: {
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
    color: colors.textSecondary,
    flex: 1,
  },
  termsLink: {
    color: colors.primary,
    fontFamily: typography.label.fontFamily,
    textDecorationLine: 'underline',
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  textLink: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  link: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    alignSelf: 'stretch',
    marginVertical: spacing.sm,
  },
});
