import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck as CheckCircle, Lock, ArrowLeft } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabaseClient } from '../../lib/supabase';
import { envConfig } from '../../utils/envConfig';
import { validatePassword, getPasswordStrengthKey, PASSWORD_MIN_LENGTH_EXCLUSIVE } from '../../utils/passwordValidation';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const passwordValidation = validatePassword(newPassword);
  const passwordRules = passwordValidation.rules.map((rule) => ({
    ...rule,
    label:
      rule.key === 'passwordRuleLowercase'
        ? 'Al menos una letra minúscula'
        : rule.key === 'passwordRuleUppercase'
          ? 'Al menos una letra mayúscula'
          : rule.key === 'passwordRuleNumber'
            ? 'Al menos un número'
            : rule.key === 'passwordRuleSpecialChar'
              ? 'Al menos un carácter especial'
              : 'Más de 8 caracteres',
  }));
  const passwordScore = passwordValidation.score;
  const isPasswordValid = passwordValidation.isValid;
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const getPasswordStrength = () => {
    const key = getPasswordStrengthKey(passwordScore);
    if (key === 'passwordStrengthWeak') return 'Débil';
    if (key === 'passwordStrengthMedium') return 'Media';
    return 'Fuerte';
  };

  useEffect(() => {
    // Don't re-validate token if password was already updated
    if (passwordUpdated) {
      return;
    }
    
    const validateToken = async () => {
      const { token } = params;
      
      if (!token) {
        setError('Token de recuperación no encontrado');
        setLoading(false);
        return;
      }

      setResetToken(token as string);

      try {
        console.log('Validating password reset token:', token);
        
        // Verify the password reset token
        const { data: tokenData, error } = await supabaseClient
          .from('email_confirmations')
          .select('*')
          .eq('token_hash', token)
          .eq('type', 'password_reset')
          .eq('is_confirmed', false)
          .single();

        if (error || !tokenData) {
          console.error('Token validation error:', error);
          setError('Token no válido o ya utilizado');
          setLoading(false);
          return;
        }

        // Check if token has expired
        const now = new Date();
        const expiresAt = new Date(tokenData.expires_at);
        
        if (now > expiresAt) {
          setError('El token ha expirado. Solicita un nuevo enlace de recuperación.');
          setLoading(false);
          return;
        }

        // Token is valid
        console.log('Password reset token is valid for user:', tokenData.email);
        setValidToken(true);
        setUserId(tokenData.user_id);
        setUserEmail(tokenData.email);
        setError(null);
      } catch (error) {
        console.error('Error validating reset token:', error);
        setError('Error al validar el token de recuperación');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [params, passwordUpdated]);

  const handlePasswordReset = async () => {
    console.log('handlePasswordReset called');
    
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Por favor completa ambos campos de contraseña');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length <= PASSWORD_MIN_LENGTH_EXCLUSIVE) {
      Alert.alert('Error', 'La contraseña debe tener más de 8 caracteres');
      return;
    }

    if (!isPasswordValid) {
      Alert.alert('Error', 'La contraseña debe incluir minúscula, mayúscula, número, carácter especial y tener más de 8 caracteres');
      return;
    }

    if (!userId || !resetToken) {
      console.log('Missing userId or token:', { userId, token: resetToken });
      Alert.alert('Error', 'Información de reset inválida');
      return;
    }

    setUpdatingPassword(true);
    console.log('Starting password reset process...');
    
    try {
      console.log('Calling reset-password function...');
      
      // Call our Edge Function to reset password securely
      const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
      console.log('Supabase URL:', supabaseUrl);

      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({
          userId,
          newPassword,
          token: resetToken
        }),
      });

      console.log('Response status:', response.status);
      
      const result = await response.json();
      console.log('Reset password function result:', result);

      if (!response.ok || !result.success) {
        console.error('Reset password failed:', result);
        throw new Error(result.error || 'Error al actualizar contraseña');
      }

      setPasswordUpdated(true);
      console.log('Password updated successfully');
      
      // Don't show alert immediately, let the UI update first
      setTimeout(() => {
        Alert.alert(
          'Contraseña actualizada',
          'Tu contraseña ha sido cambiada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.',
          [{ text: 'OK', onPress: () => handleGoToLogin() }]
        );
      }, 500);
      
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

  const handleRequestNewToken = () => {
    router.replace('/auth/forgot-password');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Card style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#2D6A6F" />
          <Text style={styles.loadingText}>Validando token de recuperación...</Text>
        </Card>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Card style={styles.errorCard}>
          <Lock size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Token Inválido</Text>
          <Text style={styles.errorText}>{error}</Text>
          
          <View style={styles.errorActions}>
            <Button
              title="Solicitar Nuevo Enlace"
              onPress={handleRequestNewToken}
              size="large"
            />
            <Button
              title="Ir al Login"
              onPress={handleGoToLogin}
              variant="outline"
              size="large"
            />
          </View>
        </Card>
      </View>
    );
  }

  if (passwordUpdated) {
    return (
      <View style={styles.container}>
        <Card style={styles.successCard}>
          <CheckCircle size={64} color="#10B981" />
          <Text style={styles.successTitle}>¡Contraseña Actualizada!</Text>
          <Text style={styles.successText}>
            Tu contraseña ha sido cambiada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.
          </Text>
          {userEmail && (
            <Text style={styles.emailText}>
              Cuenta: {userEmail}
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

  if (validToken) {
    return (
      <View style={styles.container}>
        <Card style={styles.passwordCard}>
          <View style={styles.iconContainer}>
            <Lock size={64} color="#2D6A6F" />
          </View>
          
          <Text style={styles.passwordTitle}>Restablecer Contraseña</Text>
          <Text style={styles.passwordText}>
            Ingresa tu nueva contraseña para la cuenta: {userEmail}
          </Text>

          <View style={styles.passwordForm}>
            <Input
              label="Nueva contraseña"
              placeholder={`Mínimo ${PASSWORD_MIN_LENGTH_EXCLUSIVE + 1} caracteres`}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            {newPassword.length > 0 && (
              <View style={styles.passwordFeedbackContainer}>
                <View style={styles.passwordStrengthHeader}>
                  <Text style={styles.passwordStrengthLabel}>Fortaleza</Text>
                  <Text style={styles.passwordStrengthValue}>{getPasswordStrength()}</Text>
                </View>
                <View style={styles.passwordStrengthBarBackground}>
                  <View
                    style={[
                      styles.passwordStrengthBarFill,
                      { width: `${(passwordScore / passwordRules.length) * 100}%` },
                    ]}
                  />
                </View>

                <View style={styles.passwordRulesList}>
                  {passwordRules.map((rule) => (
                    <Text
                      key={rule.label}
                      style={[
                        styles.passwordRuleText,
                        rule.valid ? styles.passwordRuleValid : styles.passwordRulePending,
                      ]}
                    >
                      {rule.valid ? '✓' : '○'} {rule.label}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            <Input
              label="Confirmar contraseña"
              placeholder="Repite la nueva contraseña"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            {confirmPassword.length > 0 && (
              <Text
                style={[
                  styles.confirmPasswordStatus,
                  passwordsMatch ? styles.passwordRuleValid : styles.confirmPasswordError,
                ]}
              >
                {passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
              </Text>
            )}

            <Button
              title={updatingPassword ? "Actualizando..." : "Cambiar Contraseña"}
              onPress={handlePasswordReset}
              loading={updatingPassword}
              disabled={!newPassword || !confirmPassword || !isPasswordValid || !passwordsMatch || updatingPassword}
              size="large"
            />
          </View>

          <Text style={styles.securityNote}>
            🔒 Tu nueva contraseña será encriptada y almacenada de forma segura.
          </Text>
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
  errorText: {
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
    marginBottom: 16,
  },
  passwordFeedbackContainer: {
    marginTop: -8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  passwordStrengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  passwordStrengthLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  passwordStrengthValue: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#2D6A6F',
  },
  passwordStrengthBarBackground: {
    height: 6,
    borderRadius: 99,
    backgroundColor: '#D1D5DB',
    overflow: 'hidden',
    marginBottom: 10,
  },
  passwordStrengthBarFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: '#2D6A6F',
  },
  passwordRulesList: {
    gap: 6,
  },
  passwordRuleText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
  },
  passwordRuleValid: {
    color: '#2D6A6F',
  },
  passwordRulePending: {
    color: '#6B7280',
  },
  confirmPasswordStatus: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    marginTop: -8,
    marginBottom: 8,
  },
  confirmPasswordError: {
    color: '#374151',
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
  securityNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});