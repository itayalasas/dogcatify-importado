import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Platform, Linking, KeyboardAvoidingView } from 'react-native';
import { router, Stack } from 'expo-router';
import { ArrowLeft, User, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabaseClient } from '../../lib/supabase';
import { createEmailConfirmationToken, generateConfirmationUrl, sendConfirmationEmailAPI } from '../../utils/emailConfirmation';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Computed property to check if form is valid
  const isFormValid = fullName.trim() && 
                     email.trim() && 
                     password.length >= 6 && 
                     confirmPassword && 
                     password === confirmPassword && 
                     acceptTerms;

  const { register } = useAuth();
  const { t } = useLanguage();

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

    if (password.length < 6) {
      Alert.alert('Error', t('passwordTooShort'));
      return;
    }

    if (!acceptTerms) {
      Alert.alert('Error', 'Debes aceptar los términos y condiciones');
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
        password: password,
        options: {
          data: {
            full_name: trimmedName,
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

      console.log('Step 3: Creating email confirmation token using helper function...');
      const confirmationToken = await createEmailConfirmationToken(
        authData.user.id,
        trimmedEmail,
        'signup'
      );
      console.log('Step 4: Confirmation token created:', confirmationToken);

      console.log('Step 5: Generating confirmation URL using helper function...');
      const confirmationUrl = generateConfirmationUrl(confirmationToken, 'signup');
      console.log('Step 6: Confirmation URL generated:', confirmationUrl);

      console.log('Step 7: Sending confirmation email using API helper function...');
      const emailResult = await sendConfirmationEmailAPI(
        trimmedEmail,
        trimmedName,
        confirmationUrl
      );

      if (!emailResult.success) {
        console.error('❌ Email sending failed:', emailResult.error);
        console.warn('User registered but email not sent. Manual intervention may be needed.');
      } else {
        console.log('✅ Email sent successfully!');
        if (emailResult.log_id) {
          console.log('Email log ID:', emailResult.log_id);
        }
      }

      console.log('=== REGISTRATION COMPLETED ===');

      Alert.alert(
        '¡Registro exitoso! 🎉',
        `Tu cuenta ha sido creada exitosamente.\n\n📧 Hemos enviado un correo de confirmación a:\n${trimmedEmail}\n\nPor favor revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace de confirmación.\n\n⏰ El enlace expira en 24 horas.`,
        [{ text: 'ENTENDIDO', onPress: () => router.replace('/auth/login') }]
      );
    } catch (error: any) {
      console.error('❌ Registration error:', error);
      console.error('Error stack:', error.stack);
      Alert.alert('Error', error.message || 'Error al crear la cuenta');
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
            source={require('../../assets/images/logo.jpg')}
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
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          leftIcon={<Lock size={20} color="#6B7280" />}
          showPasswordToggle={true}
          isPasswordVisible={showPassword}
          onTogglePasswordVisibility={() => setShowPassword(!showPassword)}
        />

        <Input
          label={t('confirmPassword')}
          placeholder="Repite tu contraseña"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirmPassword}
          leftIcon={<Lock size={20} color="#6B7280" />}
          showPasswordToggle={true}
          isPasswordVisible={showConfirmPassword}
          onTogglePasswordVisibility={() => setShowConfirmPassword(!showConfirmPassword)}
        />

        <View style={styles.termsContainer}>
          <TouchableOpacity 
            style={styles.checkbox}
            onPress={() => setAcceptTerms(!acceptTerms)}
          >
            <View style={[styles.checkboxBox, acceptTerms && styles.checkboxChecked]}>
              {acceptTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              Acepto las{' '}
              <Text style={styles.termsLink} onPress={handlePrivacyPress}>políticas de privacidad</Text>
              {' '}y los{' '}
              <Text style={styles.termsLink} onPress={handleTermsPress}>términos de servicio</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Button
          title={loading ? "Creando cuenta..." : t('createAccount')}
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
});