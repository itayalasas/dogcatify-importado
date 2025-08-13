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
  const [resendingEmail, setResendingEmail] = useState(false);

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
          
          // Mejorar mensajes de error
          let errorMessage = 'Error al confirmar el email';
          if (result.error === 'TOKEN_ALREADY_USED') {
            errorMessage = 'ALREADY_USED';
          } else if (result.error === 'TOKEN_EXPIRED') {
            errorMessage = 'EXPIRED';
          } else if (result.error === 'TOKEN_NOT_FOUND') {
            errorMessage = 'NOT_FOUND';
          }
          
          setError(errorMessage);
          setUserEmail(result.email || null);
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

  const handleResendEmail = async () => {
    if (!userEmail) {
      console.error('No email available for resend');
      return;
    }

    setResendingEmail(true);
    try {
      console.log('Resending confirmation email to:', userEmail);
      
      // First check if user is already confirmed
      const { data: existingProfile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('email_confirmed, display_name')
        .eq('email', userEmail)
        .single();
      
      if (!profileError && existingProfile?.email_confirmed) {
        console.log('User is already confirmed, showing appropriate message');
        setError('ALREADY_CONFIRMED');
        setResendingEmail(false);
        return;
      }
      
      const { resendConfirmationEmail } = await import('../../utils/emailConfirmation');
      const result = await resendConfirmationEmail(userEmail);
      
      if (result.success) {
        console.log('✅ Email resent successfully');
        setError('EMAIL_SENT');
      } else {
        console.error('❌ Failed to resend email:', result.error);
        setError('RESEND_ERROR');
      }
    } catch (error) {
      console.error('❌ Error resending email:', error);
      setError('RESEND_ERROR');
    } finally {
      setResendingEmail(false);
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

  if (error) {
    // Determinar el contenido basado en el tipo de error
    let title, message, showResendButton, buttonText;
    
    if (error === 'ALREADY_USED') {
      title = 'Enlace Ya Utilizado';
      message = 'Este enlace de confirmación ya fue utilizado anteriormente. Si aún no puedes iniciar sesión, puedes solicitar un nuevo enlace.';
      showResendButton = true;
      buttonText = resendingEmail ? 'Enviando...' : 'Enviar Nuevo Enlace';
    } else if (error === 'ALREADY_CONFIRMED') {
      title = '✅ Email Ya Confirmado';
      message = 'Tu correo electrónico ya está confirmado. Puedes iniciar sesión normalmente en la aplicación.';
      showResendButton = false;
      buttonText = '';
    } else if (error === 'EXPIRED') {
      title = 'Enlace Expirado';
      message = 'Este enlace de confirmación ha expirado. Los enlaces son válidos por 24 horas por seguridad.';
      showResendButton = true;
      buttonText = resendingEmail ? 'Enviando...' : 'Enviar Nuevo Enlace';
    } else if (error === 'EMAIL_SENT') {
      title = '¡Nuevo Enlace Enviado!';
      message = `Se ha enviado un nuevo enlace de confirmación a tu correo electrónico. Por favor revisa tu bandeja de entrada y haz clic en el nuevo enlace.`;
      showResendButton = false;
      buttonText = '';
    } else if (error === 'RESEND_ERROR') {
      title = 'Error al Reenviar';
      message = 'No se pudo reenviar el correo de confirmación. Por favor intenta nuevamente más tarde.';
      showResendButton = true;
      buttonText = resendingEmail ? 'Enviando...' : 'Intentar Nuevamente';
    } else {
      title = 'Error de Confirmación';
      message = 'El enlace de confirmación no es válido o ha ocurrido un error.';
      showResendButton = false;
      buttonText = '';
    }
    
    return (
      <View style={styles.container}>
        <Card style={styles.errorCard}>
          {error === 'EMAIL_SENT' ? (
            <CheckCircle size={64} color="#10B981" />
          ) : (
            <XCircle size={64} color="#EF4444" />
          )}
          <Text style={[
            styles.errorTitle,
            error === 'EMAIL_SENT' && styles.successTitle
          ]}>
            {title}
          </Text>
          <Text style={[
            styles.errorMessage,
            error === 'EMAIL_SENT' && styles.successMessage
          ]}>
            {message}
          </Text>
          
          {userEmail && (
            <View style={styles.emailInfo}>
              <Text style={styles.emailLabel}>Correo:</Text>
              <Text style={styles.emailValue}>{userEmail}</Text>
            </View>
          )}
          
          <View style={styles.errorActions}>
            {showResendButton && (
              <Button
                title={buttonText}
                onPress={handleResendEmail}
                loading={resendingEmail}
                disabled={resendingEmail}
                size="large"
              />
            )}
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
 
  emailInfo: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emailLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginBottom: 4,
  },
  emailValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#334155',
  },
  
});