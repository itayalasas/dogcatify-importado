import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck as CheckCircle, Circle as XCircle, Mail } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { resendConfirmationEmail } from '../../utils/emailConfirmation';
import { supabaseClient } from '../../lib/supabase';

export default function ConfirmScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResendForm, setShowResendForm] = useState(false);
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const confirmEmail = async () => {
      const { token_hash, type = 'signup' } = params;
      
      if (!token_hash) {
        setError('Token de confirmación no encontrado');
        setLoading(false);
        setShowResendForm(true);
        return;
      }

      // ONLY handle signup confirmations here
      if (type !== 'signup') {
        setError('Esta página es solo para confirmación de registro. Para recuperar contraseña, usa el enlace correcto.');
        setLoading(false);
        return;
      }
      try {
        // Find and verify the signup confirmation token
        const { data: tokenData, error } = await supabaseClient
          .from('email_confirmations')
          .select('*')
          .eq('token_hash', token_hash)
          .eq('type', 'signup')
          .eq('is_confirmed', false)
          .single();

        if (error || !tokenData) {
          setError('Token no encontrado o ya utilizado');
          setLoading(false);
          setShowResendForm(true);
          return;
        }

        // Check if token has expired
        const now = new Date();
        const expiresAt = new Date(tokenData.expires_at);
        
        if (now > expiresAt) {
          setError('Token expirado. Solicita un nuevo enlace de confirmación.');
          setLoading(false);
          setShowResendForm(true);
          return;
        }

        // Mark token as confirmed
        const { error: updateError } = await supabaseClient
          .from('email_confirmations')
          .update({
            is_confirmed: true,
            confirmed_at: new Date().toISOString()
          })
          .eq('id', tokenData.id);

        if (updateError) {
          console.error('Error updating token:', updateError);
          setError('Error al confirmar token');
          setLoading(false);
          return;
        }

        // Update user profile to mark email as confirmed
        const { error: profileError } = await supabaseClient
          .from('profiles')
          .update({
            email_confirmed: true,
            email_confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', tokenData.user_id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
          // Don't fail the confirmation if profile update fails
        }
        
        console.log('Email confirmation successful for:', tokenData.email);
        setUserEmail(tokenData.email);
        setConfirmed(true);
      } catch (error) {
        console.error('Email confirmation error:', error);
        setError('Error al procesar la confirmación');
        setLoading(false);
        setShowResendForm(true);
      } finally {
        setLoading(false);
      }
    };

    confirmEmail();
  }, [params]);

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu email');
      return;
    }

    try {
      setResending(true);
      const result = await resendConfirmationEmail(email.trim());

      if (!result.success) {
        Alert.alert('Error', result.error || 'No se pudo reenviar el email de confirmación');
      } else {
        Alert.alert('Éxito', 'Email de confirmación reenviado. Revisa tu bandeja de entrada.');
        setShowResendForm(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Ocurrió un error al reenviar el email');
    } finally {
      setResending(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Por favor completa ambos campos de contraseña');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (!userId || !resetToken) {
      Alert.alert('Error', 'Información de reset inválida');
      return;
    }

    setUpdatingPassword(true);
    try {
      // Call our Edge Function to reset password securely
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          newPassword,
          token: resetToken
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al actualizar contraseña');
      }

      setPasswordUpdated(true);
      Alert.alert(
        'Contraseña actualizada',
        'Tu contraseña ha sido cambiada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.',
        [{ text: 'OK', onPress: () => router.replace('/web-info') }]
      );

    } catch (error: any) {
      console.error('Error updating password:', error);
      Alert.alert('Error', error.message || 'No se pudo actualizar la contraseña');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleGoToLogin = () => {
    if (Platform.OS === 'web') {
      router.replace('/web-info');
    } else {
      router.replace('/auth/login');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Card style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#2D6A6F" />
          <Text style={styles.loadingText}>Confirmando tu email...</Text>
        </Card>
      </View>
    );
  }

  if (confirmed) {
    return (
      <View style={styles.container}>
        <Card style={styles.successCard}>
          <CheckCircle size={64} color="#10B981" />
          <Text style={styles.successTitle}>¡Email Confirmado!</Text>
          <Text style={styles.successText}>
            Tu cuenta ha sido activada exitosamente. Ya puedes iniciar sesión y disfrutar de todas las funciones de DogCatiFy.
          </Text>
          {userEmail && (
            <Text style={styles.emailText}>
              Email confirmado: {userEmail}
            </Text>
          )}
          <Button
            title="Ir a Iniciar Sesión"
            onPress={() => router.replace('/web-info')}
            size="large"
          />
        </Card>
      </View>
    );
  }

  if (error && showResendForm) {
    return (
      <View style={styles.container}>
        <Card style={styles.errorCard}>
          <XCircle size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Error de Confirmación</Text>
          <Text style={styles.errorText}>{error}</Text>
          
          <View style={styles.resendContainer}>
            <Text style={styles.resendTitle}>Reenviar Email de Confirmación</Text>
            <Text style={styles.resendDescription}>
              Ingresa tu email para recibir un nuevo enlace de confirmación
            </Text>
            
            <Input
              label="Email"
              placeholder="tu@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon={<Mail size={20} color="#6B7280" />}
            />
            
            <Button
              title={resending ? 'Enviando...' : 'Reenviar Confirmación'}
              onPress={handleResendConfirmation}
              loading={resending}
              size="large"
            />
          </View>

          <TouchableOpacity style={styles.linkButton} onPress={() => router.replace('/auth/login')}>
            <Text style={styles.linkText}>Volver al Login</Text>
          </TouchableOpacity>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card style={styles.errorCard}>
        <XCircle size={64} color="#EF4444" />
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>
          {error || 'Ocurrió un error inesperado'}
        </Text>
        <Button
          title="Volver al Login"
          onPress={() => router.replace('/auth/login')}
          size="large"
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F9FAFB',
    paddingTop: 50,
  },
  loadingCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  successCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  emailText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  passwordCard: {
    alignItems: 'center',
    paddingVertical: 40,
    width: '100%',
    maxWidth: 400,
  },
  iconContainer: {
    marginBottom: 16,
  },
  passwordTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  passwordText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  passwordForm: {
    width: '100%',
    gap: 16,
  },
  errorCard: {
    alignItems: 'center',
    paddingVertical: 40,
    width: '100%',
    maxWidth: 400,
  },
  errorTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#EF4444',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  resendContainer: {
    width: '100%',
    marginBottom: 24,
  },
  resendTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  resendDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  linkButton: {
    marginTop: 16,
  },
  linkText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    textAlign: 'center',
  },
});