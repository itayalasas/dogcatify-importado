import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleCheck as CheckCircle, CircleX as XCircle } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { handleOAuth2Callback } from '../../../utils/mercadoPago';

export default function MercadoPagoCallback() {
  const { code, state, error } = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
  }>();
  
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);

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
        setPartnerId(result.partnerId);
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
    if (success && partnerId) {
      // Redirect to partner dashboard or configuration
      router.replace({
        pathname: '/(partner-tabs)/dashboard',
        params: { businessId: partnerId }
      });
    } else {
      // Redirect to partner profile or configuration
      router.replace('/profile/mercadopago-config');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00A650" />
          <Text style={styles.loadingText}>Procesando autorización de Mercado Pago...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.resultCard}>
          <View style={styles.iconContainer}>
            {success ? (
              <CheckCircle size={80} color="#00A650" />
            ) : (
              <XCircle size={80} color="#EF4444" />
            )}
          </View>
          
          <Text style={styles.title}>
            {success ? '¡Autorización Exitosa!' : 'Error de Autorización'}
          </Text>
          
          <Text style={styles.subtitle}>
            {success 
              ? 'Tu cuenta de Mercado Pago ha sido conectada correctamente. Ya puedes recibir pagos con split de comisiones automático.'
              : errorMessage || 'No se pudo completar la autorización con Mercado Pago.'
            }
          </Text>

          {success && (
            <View style={styles.successInfo}>
              <Text style={styles.successInfoTitle}>¿Qué sigue?</Text>
              <Text style={styles.successInfoText}>
                • Los pagos se dividirán automáticamente{'\n'}
                • Recibirás el 95% de cada venta{'\n'}
                • DogCatiFy retiene el 5% como comisión{'\n'}
                • Los fondos llegan directamente a tu cuenta MP
              </Text>
            </View>
          )}

          <Button
            title={success ? "Continuar al Dashboard" : "Volver a Configuración"}
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
    backgroundColor: '#F9FAFB',
    paddingTop: 50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 16,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  resultCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  successInfo: {
    backgroundColor: '#F0FDF4',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: '#00A650',
  },
  successInfoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#166534',
    marginBottom: 8,
  },
  successInfoText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#166534',
    lineHeight: 20,
  },
});