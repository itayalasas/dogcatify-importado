import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleCheck as CheckCircle, Package, Chrome as Home } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabaseClient } from '../../lib/supabase';

export default function PaymentSuccess() {
  const { order_id, payment_id, status } = useLocalSearchParams<{
    order_id: string;
    payment_id: string;
    status: string;
  }>();
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (order_id) {
      fetchOrderDetails();
    }
  }, [order_id]);

  const fetchOrderDetails = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('id', order_id)
        .single();
      
      if (error) throw error;
      setOrder(data);
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoHome = () => {
    router.replace('/(tabs)');
  };

  const handleViewOrders = () => {
    router.push('/orders');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Verificando pago...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.successCard}>
          <View style={styles.iconContainer}>
            <CheckCircle size={80} color="#10B981" />
          </View>
          
          <Text style={styles.title}>¡Pago Exitoso!</Text>
          <Text style={styles.subtitle}>
            Tu pedido ha sido confirmado y está siendo procesado
          </Text>

          {order && (
            <View style={styles.orderDetails}>
              <Text style={styles.orderTitle}>Detalles del Pedido</Text>
              
              <View style={styles.orderInfo}>
                <Text style={styles.orderLabel}>Número de pedido:</Text>
                <Text style={styles.orderValue}>#{order.id.slice(-6)}</Text>
              </View>
              
              <View style={styles.orderInfo}>
                <Text style={styles.orderLabel}>Total pagado:</Text>
                <Text style={styles.orderValue}>
                  ${order.total_amount?.toLocaleString() || '0'}
                </Text>
              </View>
              
              <View style={styles.orderInfo}>
                <Text style={styles.orderLabel}>Estado:</Text>
                <Text style={[styles.orderValue, styles.statusConfirmed]}>
                  Confirmado
                </Text>
              </View>
              
              {payment_id && (
                <View style={styles.orderInfo}>
                  <Text style={styles.orderLabel}>ID de pago:</Text>
                  <Text style={styles.orderValue}>#{payment_id.slice(-6)}</Text>
                </View>
              )}
            </View>
          )}

          <Text style={styles.nextSteps}>
            Recibirás actualizaciones por email sobre el estado de tu pedido
          </Text>
        </Card>

        <View style={styles.actions}>
          <Button
            title="Ver Mis Pedidos"
            onPress={handleViewOrders}
            variant="outline"
            size="large"
          />
          
          <Button
            title="Volver al Inicio"
            onPress={handleGoHome}
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
  successCard: {
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
    marginBottom: 32,
    lineHeight: 24,
  },
  orderDetails: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  orderTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  statusConfirmed: {
    color: '#10B981',
  },
  nextSteps: {
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