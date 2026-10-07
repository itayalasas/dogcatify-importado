import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Clock, Package } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useBackToHome } from '../../hooks/useBackToHome';
import { colors, radius, spacing, typography } from '../../constants/theme';

export default function PaymentPending() {
  useBackToHome();
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
        // Antes se mostraban valores de ejemplo fijos; ahora solo lo que llega por parámetro.
        id: order_id ? `#${String(order_id).slice(-6)}` : null,
        total: null,
        status: 'Pendiente',
        paymentId: null
      });
      setLoading(false);
    }, 1000);
  }, [order_id]);

  const handleViewOrders = () => {
    router.replace({ pathname: '/orders', params: { from: 'payment' } });
  };

  const handleGoHome = () => {
    router.replace('/(tabs)');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Verificando estado del pago...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Clock size={56} color={colors.warning} />
            </View>
          </View>

          <Text style={styles.title} accessibilityRole="header">Pago pendiente</Text>
          <Text style={styles.subtitle}>
            Tu pedido fue registrado y el pago se está procesando. Te avisamos cuando se confirme.
          </Text>

          <Card style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Detalle del pedido</Text>

            {orderDetails?.orderNumber || orderDetails?.id ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Número de pedido</Text>
                <Text style={styles.detailValue}>{orderDetails?.orderNumber || orderDetails?.id}</Text>
              </View>
            ) : null}

            {orderDetails?.total ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total</Text>
                <Text style={styles.detailValue}>{orderDetails?.total}</Text>
              </View>
            ) : null}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Estado</Text>
              <Text style={[styles.detailValue, styles.pendingStatus]}>
                {orderDetails?.status}
              </Text>
            </View>

            {orderDetails?.paymentId ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>ID de pago</Text>
                <Text style={styles.detailValue}>{orderDetails?.paymentId}</Text>
              </View>
            ) : null}
          </Card>

          <Card style={styles.infoCard}>
            <Text style={styles.infoTitle}>¿Qué sigue?</Text>
            <View style={styles.infoList}>
              <Text style={styles.infoItem}>
                • Recibirás una notificación cuando el pago sea confirmado
              </Text>
              <Text style={styles.infoItem}>
                • Podés ver el estado en &quot;Mis pedidos&quot;
              </Text>
              <Text style={styles.infoItem}>
                • El proceso puede tomar unos minutos
              </Text>
            </View>
          </Card>
        </View>
      </ScrollView>

      <View style={styles.actionsContainer}>
        <Button
          title="Ver mis pedidos"
          onPress={handleViewOrders}
          variant="outline"
          size="large"
        />

        <Button
          title="Ir al inicio"
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
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.xxl,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.display,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  detailsCard: {
    marginBottom: spacing.xl,
  },
  detailsTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  pendingStatus: {
    color: colors.warning,
  },
  infoCard: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warningSoft,
    marginBottom: spacing.xl,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.warning,
    marginBottom: spacing.md,
  },
  infoList: {
    gap: spacing.sm,
  },
  infoItem: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.text,
    lineHeight: 20,
  },
  actionsContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
});
