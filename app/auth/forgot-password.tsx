import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Mail, KeyRound } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { toast } from '../../components/ui/Toast';
import { colors, typography, spacing, radius, touchTarget } from '../../constants/theme';
import { requestPasswordReset } from '../../utils/emailConfirmation';
import { useLanguage } from '../../contexts/LanguageContext'; 

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { t } = useLanguage();

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Ingresá tu correo electrónico');
      return;
    }

    setLoading(true);
    try {
      // El edge function verifica que el usuario existe, crea el token y
      // envía el email, todo server-side; el token nunca vuelve a este
      // cliente.
      const resetResult = await requestPasswordReset(email.toLowerCase().trim());

      if (!resetResult.success) {
        if (resetResult.error === 'No existe una cuenta con este correo electrónico') {
          Alert.alert('Usuario no encontrado', resetResult.error);
          return;
        }
        throw new Error(resetResult.error || 'Error sending password reset email');
      }

      console.log('✅ Password reset email sent successfully!');

      setResetSent(true);
      toast.show(
        'success',
        'Correo enviado',
        `Te mandamos un enlace a ${email}. Revisá tu bandeja de entrada (y spam). Vence en 24 horas.`,
        5000
      );
      setEmail('');
      setResetSent(false);
    } catch (error) {
      console.error('Error resetting password:', error);
      Alert.alert('Error', 'No pudimos enviar el correo. Revisá la dirección e intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <IconButton
          icon={<ArrowLeft size={24} color={colors.text} />}
          onPress={() => router.replace('/auth/login')}
          accessibilityLabel="Volver a ingresar"
        />
      </View>

      <View style={styles.form}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <KeyRound size={32} color={colors.primary} />
          </View>
          <Text style={styles.title} accessibilityRole="header">Recuperá tu contraseña</Text>
          <Text style={styles.subtitle}>
            Ingresá tu correo electrónico y te enviamos un enlace para crear una contraseña nueva.
          </Text>
        </View>

        <Input
          label="Correo electrónico"
          placeholder="tu@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          leftIcon={<Mail size={20} color={colors.icon} />}
        />

        <Button
          title={resetSent ? 'Reenviar correo' : 'Enviar enlace'}
          onPress={handleResetPassword}
          loading={loading}
          size="large"
        />

        <TouchableOpacity
          style={styles.backToLoginButton}
          onPress={() => router.replace('/auth/login')}
          accessibilityRole="link"
        >
          <Text style={styles.backToLoginText}>Volver a ingresar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.huge,
    paddingBottom: spacing.xxxl,
  },
  topBar: {
    marginLeft: -spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  backToLoginButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget,
  },
  backToLoginText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
});
