import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleX as XCircle, RefreshCw, Chrome as Home } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function PaymentFailure() {
  const { order_id, error_message } = useLocalSearchParams<{
    order_id: string;
    error_message: string;
  }>();

  const handleRetryPayment = () => {
    router.push('/cart');
  };

  const handleGoHome = () => {
    router.replace('/(tabs)');
  };

  const getErrorMessage = () => {
    if (error_message) {
      return decodeURIComponent(error_message);
    }
    return 'El pago no pudo ser procesado. Por favor intenta nuevamente.';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.errorCard}>
          <View style={styles.iconContainer}>
            <XCircle size={80} color="#EF4444" />
          </View>
          
          <Text style={styles.title}>Pago No Completado</Text>
          <Text style={styles.subtitle}>
            {getErrorMessage()}
          </Text>

          {order_id && (
            <View style={styles.orderInfo}>
              <Text style={styles.orderLabel}>Referencia del pedido:</Text>
              <Text style={styles.orderValue}>#{order_id.slice(-6)}</Text>
            </View>
          )}

          <Text style={styles.helpText}>
            Puedes intentar nuevamente o contactar con soporte si el problema persiste
          </Text>
        </Card>

        <View style={styles.actions}>
          <Button
            title="Intentar Nuevamente"
            onPress={handleRetryPayment}
            size="large"
          />
          
          <Button
            title="Volver al Inicio"
            onPress={handleGoHome}
            variant="outline"
            size="large"
          />
        </View>
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
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  errorCard: {
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 24,
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
    marginBottom: 24,
    lineHeight: 24,
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
  },
  orderLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  orderValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  helpText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    gap: 16,
  },
});