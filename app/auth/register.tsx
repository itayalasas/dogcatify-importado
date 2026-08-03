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
import { ArrowLeft, User, Mail, Lock } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabaseClient } from '../../lib/supabase';
import {
  requestEmailConfirmation,
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
      Alert.alert('Error', 'Debes aceptar los términos y condiciones');
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
          },
          emailRedirectTo: undefined,
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Error creating user');
      }


      const emailResult = await requestEmailConfirmation(
        trimmedEmail,
        'signup',
        authData.user.id,
        trimmedName,
      );

      if (!emailResult.success) {
      } else {
        if (emailResult.log_id) {
        }
      }


      const confirmationTitle = emailResult.success ? 'Registro exitoso' : 'Cuenta creada';
      const confirmationMessage = emailResult.success
        ? `Tu cuenta ha sido creada exitosamente.\n\nHemos enviado un correo de confirmación a:\n${trimmedEmail}\n\nPor favor revisa tu bandeja de entrada y la carpeta de spam, y haz clic en el enlace de confirmación.\n\nEl enlace expira en 24 horas.`
        : `Tu cuenta ha sido creada, pero no pudimos enviar el correo de confirmación automáticamente.\n\nRevisa tu conexión o intenta reenviar el correo desde la pantalla de inicio de sesión.\n\nCorreo registrado:\n${trimmedEmail}`;

      Alert.alert(
        confirmationTitle,
        confirmationMessage,
        [{ text: 'ENTENDIDO', onPress: () => router.replace('/auth/login') }]
      );
    } catch (error: any) {
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

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Image
            source={require('../../assets/images/logo-transp.png')}
            style={styles.logo}
          />
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>¡Únete a DogCatiFy! 🐾</Text>
          <Text style={styles.subtitle}>{t('createAccountSubtitle')}</Text>

          <Input
            label={t('fullName')}
            placeholder="Tu nombre completo"
            value={fullName}
            onChangeText={setFullName}
            leftIcon={<User size={20} color="#6B7280" />}
          />

          <Input
            label={t('email')}
            placeholder="tu@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={<Mail size={20} color="#6B7280" />}
          />

          <Input
            label={t('password')}
            placeholder={`Mínimo ${PASSWORD_MIN_LENGTH_EXCLUSIVE + 1} caracteres`}
            value={password}
            onChangeText={handlePasswordChange}
            secureTextEntry={!showPassword}
            leftIcon={<Lock size={20} color="#6B7280" />}
            showPasswordToggle={true}
            isPasswordVisible={showPassword}
            onTogglePasswordVisibility={() => setShowPassword(!showPassword)}
            error={passwordError}
          />

          {password.length > 0 && (
            <View style={styles.passwordFeedbackContainer}>
              <View style={styles.passwordStrengthHeader}>
                <Text style={styles.passwordStrengthLabel}>Fortaleza</Text>
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
                  <Text
                    key={rule.label}
                    style={[
                      styles.passwordRuleText,
                      rule.valid ? styles.passwordRuleValid : styles.passwordRulePending,
                    ]}
                  >
                    {rule.valid ? '✓' : '○'} {rule.label}
                  </Text>
                ))}
              </View>
            </View>
          )}

          <Input
            label={t('confirmPassword')}
            placeholder="Repite tu contraseña"
            value={confirmPassword}
            onChangeText={handleConfirmPasswordChange}
            secureTextEntry={!showConfirmPassword}
            leftIcon={<Lock size={20} color="#6B7280" />}
            showPasswordToggle={true}
            isPasswordVisible={showConfirmPassword}
            onTogglePasswordVisibility={() => setShowConfirmPassword(!showConfirmPassword)}
            error={confirmPasswordError}
          />

          {confirmPassword.length > 0 && (
            <Text
              style={[
                styles.confirmPasswordStatus,
                passwordsMatch ? styles.passwordRuleValid : styles.confirmPasswordError,
              ]}
            >
              {passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
            </Text>
          )}

          <View style={styles.termsContainer}>
            <View style={styles.checkbox}>
              <TouchableOpacity
                onPress={() => setAcceptTerms(!acceptTerms)}
                style={[styles.checkboxBox, acceptTerms && styles.checkboxChecked]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {acceptTerms && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>

              <Text style={styles.termsText}>
                Acepto las{' '}
                <Text style={styles.termsLink} onPress={handlePrivacyPress}>
                  políticas de privacidad
                </Text>{' '}
                y los{' '}
                <Text style={styles.termsLink} onPress={handleTermsPress}>
                  términos de servicio
                </Text>
              </Text>
            </View>
          </View>

          <Button
            title={loading ? 'Creando cuenta...' : t('createAccount')}
            onPress={handleRegister}
            loading={loading}
            disabled={!isFormValid || loading}
            size="large"
          />

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.replace('/auth/login')}
          >
            <Text style={styles.loginText}>
              {t('alreadyHaveAccount')} <Text style={styles.loginLink}>{t('signIn')}</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.partnerButton}
            onPress={() => router.push('/auth/become-partner')}
          >
            <Text style={styles.partnerText}>
              ¿Sos aliado? <Text style={styles.partnerLink}>{t('becomePartner')}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  logo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
    fontFamily: 'Inter-Regular',
    lineHeight: 22,
  },
  passwordFeedbackContainer: {
    marginTop: -4,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  passwordStrengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  passwordStrengthLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  passwordStrengthValue: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#2D6A6F',
  },
  passwordStrengthBarBackground: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
    overflow: 'hidden',
    marginBottom: 16,
  },
  passwordStrengthBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2D6A6F',
  },
  passwordRulesList: {
    gap: 8,
  },
  passwordRuleText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  passwordRuleValid: {
    color: '#2D6A6F',
  },
  passwordRulePending: {
    color: '#6B7280',
  },
  confirmPasswordStatus: {
    marginTop: -4,
    marginBottom: 16,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    lineHeight: 20,
  },
  confirmPasswordError: {
    color: '#DC2626',
  },
  termsContainer: {
    marginBottom: 24,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2D6A6F',
    borderColor: '#2D6A6F',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  termsText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },
  termsLink: {
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },
  loginButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  loginText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  loginLink: {
    color: '#3B82F6',
    fontFamily: 'Inter-Medium',
  },
  partnerButton: {
    marginTop: 14,
    alignItems: 'center',
  },
  partnerText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  partnerLink: {
    color: '#2D6A6F',
    fontFamily: 'Inter-SemiBold',
  },
});
