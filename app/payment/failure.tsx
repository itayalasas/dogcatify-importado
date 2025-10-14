import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleX as XCircle, RefreshCw } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function PaymentFailure() {
  const { order_id, type } = useLocalSearchParams<{
    order_id: string;
    type?: string;
  }>();

  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading order details
    setTimeout(() => {
      setOrderDetails({
        id: order_id || '#failed123',
        total: '$430.00',
        status: 'Fallido',
        isBooking: type === 'booking'
      });
      setLoading(false);
    }, 1000);
  }, [order_id, type]);

  const handleRetryPayment = () => {
    if (orderDetails?.isBooking) {
      router.replace('/(tabs)/services');
    } else {
      router.replace('/cart');
    }
  };

  const handleGoHome = () => {
    router.replace('/(tabs)');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#EF4444" />
          <Text style={styles.loadingText}>Verificando estado del pago...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <XCircle size={80} color="#EF4444" />
        </View>

        <Text style={styles.title}>Pago No Procesado</Text>
        <Text style={styles.subtitle}>
          {orderDetails?.isBooking 
            ? 'Hubo un problema procesando el pago de tu reserva. Puedes intentar nuevamente.'
            : 'Hubo un problema procesando el pago de tu pedido. Puedes intentar nuevamente.'
          }
        </Text>

        <Card style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>
            {orderDetails?.isBooking ? 'Detalles de la Reserva' : 'Detalles del Pedido'}
          </Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {orderDetails?.isBooking ? 'Número de reserva:' : 'Número de pedido:'}
            </Text>
            <Text style={styles.detailValue}>{orderDetails?.id}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total:</Text>
            <Text style={styles.detailValue}>{orderDetails?.total}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Estado:</Text>
            <Text style={[styles.detailValue, styles.failureStatus]}>
              {orderDetails?.status}
            </Text>
          </View>
        </Card>

        <Card style={styles.errorCard}>
          <Text style={styles.errorTitle}>Posibles causas:</Text>
          <View style={styles.errorList}>
            <Text style={styles.errorItem}>
              • Fondos insuficientes en la tarjeta
            </Text>
            <Text style={styles.errorItem}>
              • Datos de tarjeta incorrectos
            </Text>
            <Text style={styles.errorItem}>
              • Problema temporal con el procesador
            </Text>
            <Text style={styles.errorItem}>
              • Límites de transacción excedidos
            </Text>
          </View>
        </Card>
      </View>

      <View style={styles.actionsContainer}>
        <Button
          title={orderDetails?.isBooking ? "Intentar Reserva Nuevamente" : "Intentar Pago Nuevamente"}
          onPress={handleRetryPayment}
          variant="outline"
          size="large"
        />
        
        <Button
          title="Ir al Inicio"
          onPress={handleGoHome}
          size="large"
        />
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
    paddingBottom: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  detailsCard: {
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  failureStatus: {
    color: '#EF4444',
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#991B1B',
    marginBottom: 12,
  },
  errorList: {
    gap: 8,
  },
  errorItem: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#991B1B',
    lineHeight: 20,
  },
  actionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 60,
    paddingTop: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 16,
    marginBottom: 20,
  },
});