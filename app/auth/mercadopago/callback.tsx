import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleCheck as CheckCircle, CircleX as XCircle } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { handleOAuth2Callback } from '../../../utils/mercadoPago';
import { colors, typography, spacing, radius } from '../../../constants/theme';

export default function MercadoPagoCallback() {
  const { code, state, error } = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
  }>();
  
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
  }, [code, state, error]);

  const handleCallback = async () => {
    try {
      if (error) {
        setErrorMessage(`Error de autorización: ${error}`);
        setLoading(false);
        return;
      }

      if (!code || !state) {
        setErrorMessage('Parámetros de autorización faltantes');
        setLoading(false);
        return;
      }

      console.log('Processing OAuth2 callback...');
      const result = await handleOAuth2Callback(code, state);

      if (result.success) {
        setSuccess(true);
      } else {
        setErrorMessage(result.error || 'Error desconocido durante la autorización');
      }
    } catch (error) {
      console.error('Error in OAuth2 callback:', error);
      setErrorMessage('Error procesando la autorización de Mercado Pago');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    router.replace('/profile/mercadopago-config');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Procesando autorización de Mercado Pago...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.resultCard}>
          <View style={[styles.iconContainer, { backgroundColor: success ? colors.successSoft : colors.dangerSoft }]}>
            {success ? (
              <CheckCircle size={40} color={colors.success} />
            ) : (
              <XCircle size={40} color={colors.danger} />
            )}
          </View>
          
          <Text style={styles.title} accessibilityRole="header">
            {success ? 'Mercado Pago conectado' : 'No pudimos conectar Mercado Pago'}
          </Text>
          
          <Text style={styles.subtitle}>
            {success 
              ? 'Tu cuenta de Mercado Pago quedó conectada correctamente para este aliado y sus negocios.'
              : errorMessage || 'No se pudo completar la autorización con Mercado Pago.'
            }
          </Text>

          {success && (
            <View style={styles.successInfo}>
              <Text style={styles.successInfoTitle}>¿Qué sigue?</Text>
              <Text style={styles.successInfoText}>
                • La conexión quedó registrada para todos tus negocios.{'\n'}
                • Los cobros van a usar la cuenta de este aliado.{'\n'}
                • DogCatiFy aplica su comisión automáticamente.
              </Text>
            </View>
          )}

          <Button
            title="Volver a configuración"
            onPress={handleContinue}
            size="large"
          />
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  resultCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
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
    marginBottom: spacing.xxl,
  },
  successInfo: {
    backgroundColor: colors.successSoft,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.xxl,
    width: '100%',
  },
  successInfoTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  successInfoText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
