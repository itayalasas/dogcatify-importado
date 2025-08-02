import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image, TouchableOpacity } from 'react-native';
import { Link, router } from 'expo-router';
import { Mail, Lock, User, Check, ExternalLink } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button'; 
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { t } = useLanguage();

  const handleRegister = async () => {
    if (!email || !password || !displayName || !confirmPassword) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    if (!acceptedPolicies) {
      Alert.alert('Error', 'Debes aceptar las políticas de privacidad y términos de servicio para continuar');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('error'), t('passwordsDontMatch'));
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('error'), t('passwordTooShort'));
      return;
    }

    setLoading(true);
    try {
      console.log('Registering user:', email, displayName);
      await register(email, password, displayName);
      console.log('User registered successfully');
      Alert.alert(
        '¡Registro exitoso!',
        `Tu cuenta ha sido creada. Hemos enviado un correo de confirmación a ${email}.\n\nPor favor revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace de confirmación antes de iniciar sesión.\n\nEl enlace expira en 24 horas.`,
        [
          {
            text: 'OK',
            onPress: () => router.replace('/auth/login')
          }
        ]
      );
    } catch (error: any) {
      console.error('Registration error:', error);
      Alert.alert(t('error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPrivacyPolicy = async () => {
    try {
      const url = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || 'https://dogcatify.com/privacy-policy';
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'No se pudo abrir el enlace de políticas de privacidad');
      }
    } catch (error) {
      console.error('Error opening privacy policy:', error);
      Alert.alert('Error', 'No se pudo abrir el enlace de políticas de privacidad');
    }
  };

  const handleOpenTermsOfService = async () => {
    try {
      const url = process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL || 'https://dogcatify.com/terms-of-service';
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'No se pudo abrir el enlace de términos de servicio');
      }
    } catch (error) {
      console.error('Error opening terms of service:', error);
      Alert.alert('Error', 'No se pudo abrir el enlace de términos de servicio');
    }
  };
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Image 
          source={require('../../assets/images/logo.jpg')} 
          style={styles.logo} 
        />
        <Text style={styles.title}>Únete a nosotros</Text>
        <Text style={styles.subtitle}>{t('createAccountSubtitle')}</Text>
      </View>

      <View style={styles.form}>
        <Input
          label={t('fullName')}
          placeholder={t('fullName')}
          value={displayName}
          onChangeText={setDisplayName}
          leftIcon={<User size={20} color="#6B7280" />}
        />

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

        <Input
          label={t('confirmPassword')}
          placeholder={t('confirmPassword')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          leftIcon={<Lock size={20} color="#6B7280" />}
        />

        <View style={styles.policiesContainer}>
          <TouchableOpacity 
            style={styles.policiesRow} 
            onPress={() => setAcceptedPolicies(!acceptedPolicies)}
          >
            <View style={[styles.checkbox, acceptedPolicies && styles.checkedCheckbox]}>
              {acceptedPolicies && <Check size={16} color="#FFFFFF" />}
            </View>
            <View style={styles.policiesTextContainer}>
              <Text style={styles.policiesText}>
                Acepto las{' '}
                <TouchableOpacity onPress={handleOpenPrivacyPolicy}>
                  <Text style={styles.linkText}>políticas de privacidad</Text>
                </TouchableOpacity>
                {' '}y los{' '}
                <TouchableOpacity onPress={handleOpenTermsOfService}>
                  <Text style={styles.linkText}>términos de servicio</Text>
                </TouchableOpacity>
              </Text>
            </View>
          </TouchableOpacity>
          
         
        </View>
        <Button
          title={t('createAccount')}
          onPress={handleRegister}
          loading={loading}
          disabled={loading || !acceptedPolicies}
          size="large"
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('alreadyHaveAccount')}{' '}
            <Link href="/auth/login" style={styles.link}>
              {t('signIn')}
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
    marginBottom: 8,
  },
  logo: {
    width: 140,
    height: 140,
    resizeMode: 'contain',
    marginBottom: 4,
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
  policiesContainer: {
    marginBottom: 20,
  },
  policiesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  checkbox: {
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
  checkedCheckbox: {
    backgroundColor: '#2D6A6F',
    borderColor: '#2D6A6F',
  },
  policiesTextContainer: {
    flex: 1,
  },
  policiesText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  linkText: {
    color: '#3B82F6',
    fontFamily: 'Inter-SemiBold',
    textDecorationLine: 'underline',
  },
  policiesLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  policyLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flex: 1,
    justifyContent: 'center',
  },
  policyLinkText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginLeft: 4,
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
});