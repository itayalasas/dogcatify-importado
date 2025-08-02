import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleCheck as CheckCircle, Circle as XCircle, Mail } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { verifyEmailConfirmationToken, resendConfirmationEmail } from '../../utils/emailConfirmation';

export default function ConfirmScreen() {
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResendForm, setShowResendForm] = useState(false);
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  const params = useLocalSearchParams();

  // En web, mostrar mensaje informativo si no hay parámetros de confirmación
  useEffect(() => {
    if (Platform.OS === 'web' && !params.token_hash) {
      // Mostrar página informativa para acceso web sin token
      setError('Esta aplicación está diseñada para dispositivos móviles. Para confirmar tu email, usa el enlace que recibiste en tu correo.');
      setLoading(false);
      return;
    }
  }, [params]);

  useEffect(() => {
    if (Platform.OS === 'web' && !params.token_hash) {
      return; // No procesar si es web sin token
    }
    handleEmailConfirmation();
  }, []);

  const handleEmailConfirmation = async () => {
    try {
      setLoading(true);
      setError(null);

      // Extract parameters from URL
      const token_hash = params.token_hash as string;
      const type = (params.type as string) || 'signup';

      console.log('Custom confirmation parameters:', { token_hash, type });

      if (!token_hash) {
        setError('Enlace de confirmación inválido o incompleto');
        setLoading(false);
        setShowResendForm(true);
        return;
      }

      // Verify token using our custom system
      const result = await verifyEmailConfirmationToken(token_hash, type as 'signup' | 'password_reset');

      if (!result.success) {
        console.error('Custom confirmation failed:', result.error);
        setError(result.error || 'Error al confirmar email');
        setShowResendForm(true);
        setLoading(false);
        return;
      }

      if (result.userId && result.email) {
        console.log('Custom email confirmation successful for:', result.email);
        setUserEmail(result.email);
        setConfirmed(true);
      }

    } catch (error) {
      console.error('Custom confirmation error:', error);
      setError('Error al procesar la confirmación');
      setLoading(false);
      setShowResendForm(true);
    } finally {
      setLoading(false);
    }
  };

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

  const handleGoToLogin = () => {
    router.replace('/web-info');
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
            onPress={handleGoToLogin}
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

          <TouchableOpacity style={styles.linkButton} onPress={handleGoToLogin}>
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
          onPress={handleGoToLogin}
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