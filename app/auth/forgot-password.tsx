import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Image } from 'react-native';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { createEmailConfirmationToken, generateConfirmationUrl } from '../../utils/emailConfirmation';
import { supabaseClient } from '../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext'; 

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { t } = useLanguage();

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Por favor ingresa tu correo electrónico');
      return;
    }

    setLoading(true);
    try {
      // Verificar que el usuario existe
      const { data: userData, error: userError } = await supabaseClient
        .from('profiles')
        .select('id, display_name, email')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (userError) {
        if (userError.code === 'PGRST116') {
          Alert.alert('Usuario no encontrado', 'No existe una cuenta con este correo electrónico.');
        } else {
          throw userError;
        }
        return;
      }

      console.log('User found, creating custom password reset token...');

      // Crear token personalizado para reset de contraseña
      const token = await createEmailConfirmationToken(userData.id, email.toLowerCase().trim(), 'password_reset');
      const resetUrl = generateConfirmationUrl(token, 'password_reset');

      console.log('Sending password reset email using new API...');
      console.log('Reset URL:', resetUrl);

      // Enviar email usando la nueva API
      const { sendPasswordResetEmailAPI } = await import('../../utils/emailConfirmation');
      const emailResult = await sendPasswordResetEmailAPI(
        email.toLowerCase().trim(),
        userData.display_name || 'Usuario',
        resetUrl
      );

      if (!emailResult.success) {
        throw new Error(emailResult.error || 'Error sending password reset email');
      }

      console.log('✅ Password reset email sent successfully!');
      if (emailResult.log_id) {
        console.log('Email log ID:', emailResult.log_id);
      }

      setResetSent(true);
      Alert.alert(
        '✅ Correo enviado',
        `Se ha enviado un enlace para restablecer tu contraseña a ${email}.\n\nPor favor revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace.\n\nEl enlace expira en 24 horas.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setEmail('');
              setResetSent(false);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error resetting password:', error);
      Alert.alert('Error', 'No se pudo enviar el correo de restablecimiento. Por favor verifica tu dirección de correo e intenta nuevamente.');
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
          source={require('../../assets/images/icon.png')} 
           style={styles.logo} 
           />
      </View>

      <View style={styles.form}>
        <Text style={styles.title}>Recuperar contraseña</Text>
        <Text style={styles.subtitle}>
          Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña
        </Text>

        <Input
          label="Correo electrónico"
          placeholder="tu@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          leftIcon={<Mail size={20} color="#6B7280" />}
        />

        <Button
          title={resetSent ? "Reenviar correo" : "Enviar enlace de recuperación"}
          onPress={handleResetPassword}
          loading={loading}
          size="large"
        />

        <TouchableOpacity 
          style={styles.backToLoginButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backToLoginText}>Volver al inicio de sesión</Text>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
    fontFamily: 'Inter-Regular',
    lineHeight: 22,
  },
  backToLoginButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  backToLoginText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
});