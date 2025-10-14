import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleCheck as CheckCircle, Package, Calendar } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function PaymentSuccess() {
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
        id: order_id || '#abc123',
        total: '$430.00',
        status: 'Confirmado',
        paymentId: '#mp789456',
        isBooking: type === 'booking'
      });
      setLoading(false);
    }, 1000);
  }, [order_id, type]);

  const handleViewOrders = () => {
    if (orderDetails?.isBooking) {
      router.replace('/(tabs)/services');
    } else {
      router.replace('/orders');
    }
  };

  const handleGoHome = () => {
    router.replace('/(tabs)');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Confirmando pago...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <CheckCircle size={80} color="#10B981" />
        </View>

        <Text style={styles.title}>¡Pago Exitoso!</Text>
        <Text style={styles.subtitle}>
          {orderDetails?.isBooking 
            ? 'Tu reserva ha sido confirmada y el pago procesado correctamente.'
            : 'Tu pedido ha sido confirmado y el pago procesado correctamente.'
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
            <Text style={[styles.detailValue, styles.successStatus]}>
              {orderDetails?.status}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ID de pago:</Text>
            <Text style={styles.detailValue}>{orderDetails?.paymentId}</Text>
          </View>
        </Card>

        <Card style={styles.successCard}>
          <Text style={styles.successTitle}>¡Gracias por tu {orderDetails?.isBooking ? 'reserva' : 'compra'}!</Text>
          <View style={styles.successList}>
            {orderDetails?.isBooking ? (
              <>
                <Text style={styles.successItem}>
                  • Recibirás una confirmación por email
                </Text>
                <Text style={styles.successItem}>
                  • El proveedor te contactará para confirmar detalles
                </Text>
                <Text style={styles.successItem}>
                  • Puedes ver tus citas en la sección de servicios
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.successItem}>
                  • Recibirás una confirmación por email
                </Text>
                <Text style={styles.successItem}>
                  • Te notificaremos cuando tu pedido sea enviado
                </Text>
                <Text style={styles.successItem}>
                  • Puedes rastrear tu pedido en "Mis Pedidos"
                </Text>
              </>
            )}
          </View>
        </Card>
      </View>

      <View style={styles.actionsContainer}>
        <Button
          title={orderDetails?.isBooking ? "Ver Mis Citas" : "Ver Mis Pedidos"}
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
  successStatus: {
    color: '#10B981',
  },
  successCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#166534',
    marginBottom: 12,
    textAlign: 'center',
  },
  successList: {
    gap: 8,
  },
  successItem: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#166534',
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