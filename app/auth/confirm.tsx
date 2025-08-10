import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck as CheckCircle, CircleX as XCircle, Mail } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { confirmEmailCustom } from '../../utils/emailConfirmation';

export default function EmailConfirmationScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const confirmEmail = async () => {
      const { token_hash, type } = params;
      
      console.log('Email confirmation page loaded with params:', { token_hash, type });
      
      if (!token_hash) {
        setError('Token de confirmación no encontrado');
        setLoading(false);
        return;
      }

      try {
        console.log('Attempting to confirm email with token:', token_hash);
        
        // Add a small delay to ensure database is ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const result = await confirmEmailCustom(
          token_hash as string, 
          (type as 'signup' | 'password_reset') || 'signup'
        );
        
        console.log('Email confirmation result:', result);

        if (result.success) {
          console.log('✅ Email confirmed successfully for user:', result.userId);
          
          // Solo marcar como confirmado - el perfil ya se creó en el registro
          console.log('Email confirmed, profile already exists from registration');
          
          setConfirmed(true);
          setUserEmail(result.email || null);
          setError(null);
        } else {
          console.error('❌ Email confirmation failed:', result.error);
          setError(result.error || 'Error al confirmar el email');
          setConfirmed(false);
        }
      } catch (error) {
        console.error('❌ Error in email confirmation:', error);
        setError('Error interno del servidor');
        setConfirmed(false);
      } finally {
        setLoading(false);
      }
    };

    confirmEmail();
  }, [params]);

  const handleGoToLogin = () => {
    if (Platform.OS === 'web') {
      router.replace('/web-info');
    } else {
      router.replace('/auth/login');
    }
  };

  const handleResendEmail = () => {
    router.replace('/auth/forgot-password');
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

  if (error) {
    return (
      <View style={styles.container}>
        <Card style={styles.errorCard}>
          <XCircle size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Error de Confirmación</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          
          <View style={styles.errorActions}>
            <Button
              title="Ir al Login"
              onPress={handleGoToLogin}
              size="large"
            />
            <Button
              title="Solicitar Nuevo Enlace"
              onPress={handleResendEmail}
              variant="outline"
              size="large"
            />
          </View>
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
          <Text style={styles.successMessage}>
            Tu correo electrónico ha sido confirmado exitosamente. Ya puedes iniciar sesión en DogCatiFy.
          </Text>
          {userEmail && (
            <Text style={styles.emailText}>
              Cuenta confirmada: {userEmail}
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

  return null;
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
  errorMessage: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  errorActions: {
    width: '100%',
    gap: 12,
  },
  successCard: {
    alignItems: 'center',
    paddingVertical: 40,
    width: '100%',
    maxWidth: 400,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  successMessage: {
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
});