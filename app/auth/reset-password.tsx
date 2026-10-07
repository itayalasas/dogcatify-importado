import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck as CheckCircle, Lock, ShieldCheck, Circle } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from '../../components/ui/Toast';
import { colors, typography, spacing, radius } from '../../constants/theme';
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
        setError('No encontramos el enlace de recuperación. Pedí uno nuevo.');
        setLoading(false);
        return;
      }

      setResetToken(token as string);

      try {
        console.log('Validating password reset token:', token);

        // Verify the password reset token via a SECURITY DEFINER RPC scoped
        // to this exact token (email_confirmations no longer allows a direct
        // anon SELECT, since that let anyone dump every user's tokens).
        const { data: rows, error } = await supabaseClient
          .rpc('validate_confirmation_token', { p_token_hash: token, p_type: 'password_reset' });

        const tokenData = rows?.[0];

        if (error || !tokenData || tokenData.is_confirmed) {
          console.error('Token validation error:', error);
          setError('Este enlace no es válido o ya se usó.');
          setLoading(false);
          return;
        }

        if (!tokenData.is_valid) {
          setError('El enlace venció. Pedí un nuevo enlace de recuperación.');
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
        setError('No pudimos validar el enlace de recuperación.');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [params, passwordUpdated]);

  const handlePasswordReset = async () => {
    console.log('handlePasswordReset called');
    
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Completá los dos campos de contraseña');
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
      Alert.alert('Error', 'El enlace de recuperación no es válido');
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
        toast.success('Contraseña actualizada', 'Ya podés ingresar con tu nueva contraseña.');
        handleGoToLogin();
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
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Validando el enlace de recuperación...</Text>
        </Card>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Card style={styles.errorCard}>
          <View style={[styles.iconCircle, styles.iconCircleDanger]}>
            <Lock size={36} color={colors.danger} />
          </View>
          <Text style={styles.errorTitle} accessibilityRole="header">Enlace no válido</Text>
          <Text style={styles.errorText}>{error}</Text>
          
          <View style={styles.errorActions}>
            <Button
              title="Pedir un enlace nuevo"
              onPress={handleRequestNewToken}
              size="large"
            />
            <Button
              title="Volver a ingresar"
              onPress={handleGoToLogin}
              variant="ghost"
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
          <View style={[styles.iconCircle, styles.iconCircleSuccess]}>
            <CheckCircle size={36} color={colors.success} />
          </View>
          <Text style={styles.successTitle} accessibilityRole="header">¡Contraseña actualizada!</Text>
          <Text style={styles.successText}>
            Tu contraseña se cambió correctamente. Ya podés ingresar con tu nueva contraseña.
          </Text>
          {userEmail && (
            <Text style={styles.emailText}>
              Cuenta: {userEmail}
            </Text>
          )}
          <Button
            title="Ingresar"
            onPress={handleGoToLogin}
            size="large"
          />
        </Card>
      </View>
    );
  }

  if (validToken) {
    return (
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.passwordCard}>
          <View style={[styles.iconCircle, styles.iconCirclePrimary]}>
            <Lock size={36} color={colors.primary} />
          </View>

          <Text style={styles.passwordTitle} accessibilityRole="header">Creá una contraseña nueva</Text>
          <Text style={styles.passwordText}>
            Para la cuenta <Text style={styles.emailStrong}>{userEmail}</Text>
          </Text>

          <View style={styles.passwordForm}>
            <Input
              label="Nueva contraseña"
              placeholder={`Mínimo ${PASSWORD_MIN_LENGTH_EXCLUSIVE + 1} caracteres`}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              leftIcon={<Lock size={20} color={colors.icon} />}
            />

            {newPassword.length > 0 && (
              <View style={styles.passwordFeedbackContainer}>
                <View style={styles.passwordStrengthHeader}>
                  <Text style={styles.passwordStrengthLabel}>Seguridad de la contraseña</Text>
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
                    <View key={rule.label} style={styles.passwordRuleRow}>
                      {rule.valid ? (
                        <CheckCircle size={16} color={colors.success} />
                      ) : (
                        <Circle size={16} color={colors.textTertiary} />
                      )}
                      <Text
                        style={[
                          styles.passwordRuleText,
                          rule.valid ? styles.passwordRuleValid : styles.passwordRulePending,
                        ]}
                      >
                        {rule.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <Input
              label="Confirmar contraseña"
              placeholder="Repetí la nueva contraseña"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              leftIcon={<Lock size={20} color={colors.icon} />}
              error={confirmPassword.length > 0 && !passwordsMatch ? 'Las contraseñas no coinciden' : undefined}
              helperText={passwordsMatch ? 'Las contraseñas coinciden' : undefined}
            />

            <Button
              title={updatingPassword ? "Actualizando..." : "Cambiar contraseña"}
              onPress={handlePasswordReset}
              loading={updatingPassword}
              disabled={!newPassword || !confirmPassword || !isPasswordValid || !passwordsMatch || updatingPassword}
              size="large"
            />
          </View>

          <View style={styles.securityNoteRow}>
            <ShieldCheck size={14} color={colors.textTertiary} />
            <Text style={styles.securityNote}>
              Tu nueva contraseña se guarda cifrada y de forma segura.
            </Text>
          </View>
        </Card>
      </ScrollView>
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
  scrollContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    paddingTop: spacing.huge,
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
    textAlign: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconCircleDanger: {
    backgroundColor: colors.dangerSoft,
  },
  iconCircleSuccess: {
    backgroundColor: colors.successSoft,
  },
  iconCirclePrimary: {
    backgroundColor: colors.primarySoft,
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
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  errorActions: {
    width: '100%',
    gap: spacing.sm,
  },
  passwordCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    width: '100%',
    maxWidth: 400,
  },
  passwordTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  passwordText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  emailStrong: {
    fontFamily: typography.bodyStrong.fontFamily,
    fontWeight: '600',
    color: colors.text,
  },
  passwordForm: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  passwordFeedbackContainer: {
    marginTop: -spacing.xs,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  passwordStrengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  passwordStrengthLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  passwordStrengthValue: {
    ...typography.label,
    fontFamily: typography.bodyStrong.fontFamily,
    fontWeight: '600',
    color: colors.primary,
  },
  passwordStrengthBarBackground: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  passwordStrengthBarFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  passwordRulesList: {
    gap: spacing.xs,
  },
  passwordRuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  passwordRuleText: {
    ...typography.bodySmall,
    flex: 1,
  },
  passwordRuleValid: {
    color: colors.success,
  },
  passwordRulePending: {
    color: colors.textSecondary,
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
  successText: {
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
  securityNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  securityNote: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    flexShrink: 1,
  },
});
