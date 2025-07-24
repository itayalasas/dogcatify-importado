import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { Link, router } from 'expo-router';
import { Mail, Lock, User } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button'; 
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { t } = useLanguage();

  const handleRegister = async () => {
    if (!email || !password || !displayName || !confirmPassword) {
      Alert.alert(t('error'), t('fillAllFields'));
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
        'Cuenta creada - Confirma tu correo',
        'Hemos enviado un correo de confirmación a tu dirección de email. Por favor revisa tu bandeja de entrada y confirma tu cuenta para poder iniciar sesión.',
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

        <Button
          title={t('createAccount')}
          onPress={handleRegister}
          loading={loading}
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
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 180,
    height: 180,
    resizeMode: 'contain',
    marginBottom: 20,
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
    marginTop: 24,
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