import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck as CheckCircle, CircleX as XCircle, Mail } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { colors, typography, spacing, radius } from '../../constants/theme';
import { confirmEmailCustom } from '../../utils/emailConfirmation';
import { envConfig } from '../../utils/envConfig';
import { supabaseClient } from '../../lib/supabase';

export default function EmailConfirmationScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);

  const ensureRuntimeConfigLoaded = async () => {
    console.log('[EmailConfirmationScreen] Reloading runtime env config before confirmation flow...');
    try {
      await envConfig.reload();
    } catch (error) {
      console.warn('[EmailConfirmationScreen] Could not preload runtime env config:', error);
    }
  };

  useEffect(() => {
    // Prevenir múltiples intentos de confirmación
    if (hasAttempted) {
      console.log('Confirmation already attempted, skipping...');
      return;
    }

    const confirmEmail = async () => {
      const { token_hash, type } = params;

      console.log('Email confirmation page loaded with params:', { token_hash, type });

      if (!token_hash) {
        setError('Token de confirmación no encontrado');
        setLoading(false);
        return;
      }

      setHasAttempted(true);

      try {
        console.log('Attempting to confirm email with token:', token_hash);

        await ensureRuntimeConfigLoaded();

        // Add a small delay to ensure database is ready
        await new Promise(resolve => setTimeout(resolve, 1000));

        const result = await confirmEmailCustom(
          token_hash as string,
          (type as 'signup' | 'password_reset') || 'signup'
        );

        console.log('Email confirmation result:', result);

        if (result.success) {
          console.log('✅ Email confirmed successfully for user:', result.userId);

          // El perfil ya fue creado durante el registro, solo confirmar el email
          console.log('✅ Email confirmed, profile was created during registration');

          // Enviar email de bienvenida solo en la primera confirmación exitosa
          if (result.email && !result.alreadyConfirmed) {
            console.log('Sending welcome email to:', result.email);
            try {
              const { sendWelcomeEmailAPI } = await import('../../utils/emailConfirmation');

              // Obtener el nombre del usuario
              const { supabaseClient } = await import('../../lib/supabase');
              const { data: profileData } = await supabaseClient
                .from('profiles')
                .select('display_name')
                .eq('id', result.userId)
                .single();

              const userName = profileData?.display_name || 'Usuario';

              // Enviar email de bienvenida
              await sendWelcomeEmailAPI(result.email, userName);
              console.log('✅ Welcome email sent successfully');
            } catch (emailError) {
              console.error('Error sending welcome email:', emailError);
              // No falla la confirmación si el email no se envía
            }
          }

          setConfirmed(true);
          setUserEmail(result.email || null);
          setError(null);
          setLoading(false);

          // Redirigir automáticamente después de 1.5 segundos
          setTimeout(() => {
            router.replace('/web-info');
          }, 1500);
        } else {
          console.error('❌ Email confirmation failed:', result.error);

          // Si el token ya fue usado, verificar si el email ya está confirmado
          if (result.error === 'TOKEN_ALREADY_USED' && result.email) {
            console.log('Token already used, checking if email is already confirmed...');

            try {
              // Verificar si el email ya está confirmado en la base de datos
              const { data: statusRows } = await supabaseClient
                .rpc('check_email_confirmation_status', { p_email: result.email });
              const profileData = statusRows?.[0];

              if (profileData?.email_confirmed) {
                console.log('Email is already confirmed, redirecting to web-info...');
                // El email ya está confirmado, redirigir directamente
                setLoading(false);
                setTimeout(() => {
                  router.replace('/web-info');
                }, 500);
                return;
              }
            } catch (checkError) {
              console.error('Error checking email confirmation status:', checkError);
            }
          }

          // Mejorar mensajes de error
          let errorMessage = 'Error al confirmar el correo';
          if (result.error === 'TOKEN_ALREADY_USED') {
            errorMessage = 'ALREADY_USED';
          } else if (result.error === 'TOKEN_EXPIRED') {
            errorMessage = 'EXPIRED';
          } else if (result.error === 'TOKEN_NOT_FOUND') {
            errorMessage = 'NOT_FOUND';
          } else if (
            result.error === 'PROFILE_UPDATE_ERROR' ||
            result.error === 'TOKEN_UPDATE_ERROR' ||
            result.error === 'AUTH_UPDATE_ERROR' ||
            result.error === 'PROFILE_NOT_FOUND' ||
            result.error === 'CONFIRMATION_TRANSACTION_FAILED' ||
            result.error === 'CONFIRMATION_FAILED' ||
            result.error === 'INTERNAL_SERVER_ERROR' ||
            result.error === 'INTERNAL_ERROR' ||
            result.error === 'MISSING_ENVIRONMENT'
          ) {
            errorMessage = 'CONFIRMATION_FAILED';
          }

          setError(errorMessage);
          setUserEmail(result.email || null);
          setConfirmed(false);
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Error in email confirmation:', error);
        setError('Error interno del servidor');
        setConfirmed(false);
        setLoading(false);
      }
    };

    confirmEmail();
  }, [params, hasAttempted]);

  const handleResendEmail = async () => {
    if (!userEmail) {
      console.error('No email available for resend');
      return;
    }

    setResendingEmail(true);
    try {
      console.log('Resending confirmation email to:', userEmail);

      await ensureRuntimeConfigLoaded();
      
      // First check if user is already confirmed
      const { data: statusRows, error: profileError } = await supabaseClient
        .rpc('check_email_confirmation_status', { p_email: userEmail });
      const existingProfile = statusRows?.[0];

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
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Confirmando tu correo...</Text>
        </Card>
      </View>
    );
  }

  if (error) {
    // Determinar el contenido basado en el tipo de error
    let title = 'No pudimos confirmar tu correo';
    let message = 'El enlace de confirmación no es válido o hubo un error.';
    let showResendButton = false;
    let buttonText = '';
    let showLoginButton = true;

    if (error === 'ALREADY_USED') {
      title = 'Este enlace ya se usó';
      message = 'Este enlace de confirmación ya se usó antes. Si todavía no podés ingresar, pedí un enlace nuevo.';
      showResendButton = true;
      showLoginButton = true;
      buttonText = resendingEmail ? 'Enviando...' : 'Enviar enlace nuevo';
    } else if (error === 'ALREADY_CONFIRMED') {
      title = 'Tu correo ya está confirmado';
      message = 'Tu correo electrónico ya está confirmado. Podés ingresar normalmente a la aplicación.';
      showResendButton = false;
      showLoginButton = true;
      buttonText = '';
    } else if (error === 'EXPIRED') {
      title = 'El enlace venció';
      message = 'Este enlace de confirmación venció. Por seguridad, los enlaces duran 24 horas.';
      showResendButton = true;
      showLoginButton = true;
      buttonText = resendingEmail ? 'Enviando...' : 'Enviar enlace nuevo';
    } else if (error === 'EMAIL_SENT') {
      title = '¡Te enviamos un enlace nuevo!';
      message = 'Revisá tu bandeja de entrada (y la carpeta de spam) y tocá el enlace nuevo para confirmar tu correo.';
      showResendButton = false;
      showLoginButton = true;
      buttonText = '';
    } else if (error === 'CONFIRMATION_FAILED') {
      title = 'No pudimos confirmar tu correo';
      message = 'Detectamos el enlace, pero no pudimos completar la validación en este momento. Podés intentarlo otra vez o pedir un enlace nuevo.';
      showResendButton = true;
      showLoginButton = true;
      buttonText = resendingEmail ? 'Enviando...' : 'Enviar enlace nuevo';
    } else if (error === 'NOT_FOUND') {
      title = 'Enlace no válido';
      message = 'Ese enlace de confirmación ya no existe o fue reemplazado por uno nuevo. Volvé a ingresar y pedí un nuevo correo de confirmación.';
      showResendButton = false;
      showLoginButton = true;
      buttonText = '';
    } else if (error === 'RESEND_ERROR') {
      title = 'No pudimos reenviar el correo';
      message = 'No se pudo reenviar el correo de confirmación. Intentá de nuevo más tarde.';
      showResendButton = true;
      showLoginButton = true;
      buttonText = resendingEmail ? 'Enviando...' : 'Intentar de nuevo';
    }

    const isPositive = error === 'EMAIL_SENT' || error === 'ALREADY_CONFIRMED';

    return (
      <View style={styles.container}>
        <Card style={styles.errorCard}>
          <View style={[styles.iconCircle, isPositive ? styles.iconCircleSuccess : styles.iconCircleDanger]}>
            {error === 'EMAIL_SENT' ? (
              <Mail size={36} color={colors.success} />
            ) : isPositive ? (
              <CheckCircle size={36} color={colors.success} />
            ) : (
              <XCircle size={36} color={colors.danger} />
            )}
          </View>
          <Text style={styles.errorTitle} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.errorMessage}>
            {message}
          </Text>

          {userEmail && (
            <View style={styles.emailInfo}>
              <Text style={styles.emailLabel}>Correo</Text>
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
            {showLoginButton && (
              <Button
                title="Ir a ingresar"
                onPress={handleGoToLogin}
                size="large"
                variant={showResendButton ? 'ghost' : 'primary'}
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
          <View style={[styles.iconCircle, styles.iconCircleSuccess]}>
            <CheckCircle size={36} color={colors.success} />
          </View>
          <Text style={styles.successTitle} accessibilityRole="header">¡Correo confirmado!</Text>
          <Text style={styles.successMessage}>
            Tu correo electrónico se confirmó correctamente. Ya podés ingresar a DogCatiFy.
          </Text>
          {userEmail && (
            <Text style={styles.emailText}>
              Cuenta confirmada: {userEmail}
            </Text>
          )}
          <View style={styles.errorActions}>
            <Button
              title="Ingresar"
              onPress={handleGoToLogin}
              size="large"
            />
          </View>
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
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  loadingCard: {
    alignItems: 'center',
    paddingVertical: spacing.huge,
    width: '100%',
    maxWidth: 400,
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.xl,
    color: colors.textSecondary,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconCircleSuccess: {
    backgroundColor: colors.successSoft,
  },
  iconCircleDanger: {
    backgroundColor: colors.dangerSoft,
  },
  errorCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    width: '100%',
    maxWidth: 400,
  },
  errorTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  errorMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  errorActions: {
    width: '100%',
    gap: spacing.sm,
  },
  successCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    width: '100%',
    maxWidth: 400,
  },
  successTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  successMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emailText: {
    ...typography.label,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  emailInfo: {
    alignSelf: 'stretch',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emailLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  emailValue: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.text,
  },
});
