import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Platform, Linking } from 'react-native';
import { router, Stack } from 'expo-router';
import { ArrowLeft, User, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import { generateConfirmationToken } from '../../utils/emailConfirmation';

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
      const { data: authData, error: authError } = await supabase.auth.signUp({
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

      console.log('Step 3: Creating email confirmation record...');
      const confirmationToken = generateConfirmationToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { error: confirmationError } = await supabase
        .from('email_confirmations')
        .insert({
          user_id: authData.user.id,
          email: trimmedEmail,
          token: confirmationToken,
          type: 'signup',
          expires_at: expiresAt.toISOString(),
          is_confirmed: false,
        });

      if (confirmationError) {
        console.error('Error creating confirmation record:', confirmationError);
        throw new Error('Error creating confirmation record');
      }

      console.log('Step 4: Confirmation record created. Token:', confirmationToken);

      const confirmationUrl = `dogcatify://auth/confirm?token=${confirmationToken}&email=${encodeURIComponent(trimmedEmail)}`;
      console.log('Step 5: Confirmation URL:', confirmationUrl);

      console.log('Step 6: Preparing to send confirmation email...');
      const emailApiUrl = process.env.EXPO_PUBLIC_EMAIL_API_URL;
      const emailApiKey = process.env.EXPO_PUBLIC_EMAIL_API_KEY;

      console.log('Email API Configuration:', {
        hasUrl: !!emailApiUrl,
        urlValue: emailApiUrl,
        hasKey: !!emailApiKey,
        keyLength: emailApiKey?.length,
      });

      if (!emailApiUrl || !emailApiKey) {
        console.error('❌ Email API configuration missing!');
        throw new Error('Email configuration missing');
      }

      console.log('Step 7: Calling email API directly...');
      const emailPayload = {
        template_name: 'confirmation',
        recipient_email: trimmedEmail,
        data: {
          client_name: trimmedName,
          confirmation_url: confirmationUrl,
        },
      };

      console.log('Email payload:', JSON.stringify(emailPayload, null, 2));

      const emailResponse = await fetch(emailApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${emailApiKey}`,
        },
        body: JSON.stringify(emailPayload),
      });

      console.log('Email API response status:', emailResponse.status);
      const emailResponseText = await emailResponse.text();
      console.log('Email API response body:', emailResponseText);

      if (!emailResponse.ok) {
        console.error('❌ Email API returned error:', emailResponse.status);
        console.error('Error details:', emailResponseText);
      } else {
        console.log('✅ Email sent successfully!');
        try {
          const emailResult = JSON.parse(emailResponseText);
          console.log('Email result parsed:', emailResult);
        } catch (e) {
          console.log('Could not parse email response as JSON');
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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