import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Clock, Package } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function PaymentPending() {
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
        id: order_id || '#4bc2c1',
        total: '$650',
        status: 'Pendiente',
        paymentId: '#877848'
      });
      setLoading(false);
    }, 1000);
  }, [order_id]);

  const handleViewOrders = () => {
    router.replace('/orders');
  };

  const handleGoHome = () => {
    router.replace('/(tabs)');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>Verificando estado del pago...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Clock size={80} color="#F59E0B" />
        </View>

        <Text style={styles.title}>Pago Pendiente</Text>
        <Text style={styles.subtitle}>
          Tu pago está siendo procesado. Te notificaremos cuando se complete.
        </Text>

        <Card style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Detalles del Pedido</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Número de pedido:</Text>
            <Text style={styles.detailValue}>{orderDetails?.id}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total:</Text>
            <Text style={styles.detailValue}>{orderDetails?.total}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Estado:</Text>
            <Text style={[styles.detailValue, styles.pendingStatus]}>
              {orderDetails?.status}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ID de pago:</Text>
            <Text style={styles.detailValue}>{orderDetails?.paymentId}</Text>
          </View>
        </Card>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>¿Qué sigue?</Text>
          <View style={styles.infoList}>
            <Text style={styles.infoItem}>
              • Recibirás una notificación cuando el pago sea confirmado
            </Text>
            <Text style={styles.infoItem}>
              • Puedes verificar el estado en "Mis Pedidos"
            </Text>
            <Text style={styles.infoItem}>
              • El proceso puede tomar unos minutos
            </Text>
          </View>
        </Card>
      </View>

      <View style={styles.actionsContainer}>
        <Button
          title="Ver Mis Pedidos"
          onPress={handleViewOrders}
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
  pendingStatus: {
    color: '#F59E0B',
  },
  infoCard: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
    marginBottom: 12,
  },
  infoList: {
    gap: 8,
  },
  infoItem: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
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