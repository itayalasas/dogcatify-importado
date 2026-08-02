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
import { ArrowLeft, User, Mail, Lock, Briefcase } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
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
    'La contrasena debe incluir minuscula, mayuscula, numero, caracter especial y tener mas de 8 caracteres';

  const handlePasswordChange = (text: string) => {
    setPassword(text);

    if (text.length > 0 && !validatePassword(text).isValid) {
      setPasswordError(passwordRequirementsMessage);
    } else {
      setPasswordError('');
    }

    if (confirmPassword.length > 0 && text !== confirmPassword) {
      setConfirmPasswordError('Las contrasenas no coinciden');
    } else if (confirmPassword.length > 0) {
      setConfirmPasswordError('');
    }
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (text.length > 0 && text !== password) {
      setConfirmPasswordError('Las contrasenas no coinciden');
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
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contrasenas no coinciden');
      return;
    }

    if (!isPasswordValid) {
      Alert.alert('Error', passwordRequirementsMessage);
      return;
    }

    if (!acceptTerms) {
      Alert.alert('Error', 'Debes aceptar los terminos y condiciones');
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
      }

      const confirmationTitle = emailResult.success
        ? 'Registro de aliado exitoso'
        : 'Cuenta de aliado creada';
      const confirmationMessage = emailResult.success
        ? `Tu cuenta de aliado fue creada correctamente.\n\nTe enviamos un correo de confirmacion a:\n${trimmedEmail}\n\nCuando confirmes el correo, podras iniciar sesion y registrar tu negocio.`
        : `Tu cuenta de aliado fue creada correctamente, pero no pudimos enviar el correo de confirmacion automaticamente.\n\nRevisa el correo registrado o intenta reenviarlo desde la pantalla de inicio de sesion.\n\nCorreo:\n${trimmedEmail}`;

      Alert.alert(
        confirmationTitle,
        confirmationMessage,
        [{ text: 'ENTENDIDO', onPress: () => router.replace('/auth/login') }]
      );
    } catch (error: any) {
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
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Briefcase size={34} color="#2D6A6F" />
            </View>
            <Text style={styles.title}>
              {hasCurrentSession ? 'Completar alta de aliado' : t('becomePartner')}
            </Text>
            <Text style={styles.subtitle}>
              {hasCurrentSession
                ? 'Usaremos tu sesión actual para registrar tu negocio sin crear otra cuenta.'
                : t('partnerRegisterSubtitle')}
            </Text>
          </View>

          {hasCurrentSession ? (
            <View style={styles.sessionCard}>
              <Text style={styles.sessionTitle}>Sesión activa detectada</Text>
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
                leftIcon={<User size={20} color="#6B7280" />}
              />

              <Input
                label="Correo electrónico"
                placeholder="tu@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon={<Mail size={20} color="#6B7280" />}
              />

              <Input
                label="Contraseña"
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

              <Input
                label="Confirmar contraseña"
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

              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => setAcceptTerms(!acceptTerms)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}>
                  {acceptTerms && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.termsText}>
                  Acepto los términos y condiciones y la política de privacidad
                </Text>
              </TouchableOpacity>
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
            >
              <Text style={styles.loginText}>
                ¿Ya tienes una cuenta? <Text style={styles.loginLink}>Inicia sesión</Text>
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
    alignItems: 'center',
    marginBottom: 32,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 8,
    padding: 8,
    zIndex: 10,
  },
  logo: {
    width: 140,
    height: 140,
    resizeMode: 'contain',
    marginBottom: 16,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  sessionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  sessionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 6,
  },
  sessionText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
    fontFamily: 'Inter-Regular',
  },
  heroCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#134E4A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
    lineHeight: 22,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#2D6A6F',
    borderColor: '#2D6A6F',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: '#4B5563',
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
  loginButton: {
    marginTop: 14,
    alignItems: 'center',
  },
  loginText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  loginLink: {
    color: '#2D6A6F',
    fontFamily: 'Inter-SemiBold',
  },
});
