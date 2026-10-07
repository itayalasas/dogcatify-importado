import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { CheckCircle, XCircle, Calendar, Clock } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui';
import { colors, radius, spacing, typography, shadows } from '../../constants/theme';
import { envConfig } from '../../utils/envConfig';

interface BookingData {
  order_id: string;
  customer_name: string;
  service_name: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
}

export default function ConfirmBooking() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);

  useEffect(() => {
    if (token) {
      confirmBooking(token);
    } else {
      setError('El enlace de confirmación está incompleto.');
      setLoading(false);
    }
  }, [token]);

  const confirmBooking = async (tokenHash: string) => {
    try {
      const response = await fetch(
        `${envConfig.get('EXPO_PUBLIC_SUPABASE_URL')}/functions/v1/confirm-booking?token=${tokenHash}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al confirmar la reserva');
      }

      setSuccess(true);
      setBookingData(data.booking);
    } catch (err: any) {
      setError(err.message || 'Error al confirmar la reserva');
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Confirmando tu reserva...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('../../assets/images/logo-transp.png')}
          style={styles.logo}
        />

        {success ? (
          <>
            <View style={styles.iconContainer}>
              <CheckCircle size={72} color={colors.success} />
            </View>

            <Text style={styles.title} accessibilityRole="header">¡Reserva confirmada!</Text>
            <Text style={styles.message}>
              Tu turno quedó confirmado. Te esperamos.
            </Text>

            {bookingData && (
              <View style={styles.detailsCard}>
                <Text style={styles.detailsTitle}>Detalles de la reserva</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Servicio:</Text>
                  <Text style={styles.detailValue}>{bookingData.service_name}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Calendar size={16} color={colors.textTertiary} />
                  <Text style={styles.detailLabel}>Fecha:</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(bookingData.appointment_date)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Clock size={16} color={colors.textTertiary} />
                  <Text style={styles.detailLabel}>Hora:</Text>
                  <Text style={styles.detailValue}>{bookingData.appointment_time}</Text>
                </View>

                <Badge label="Confirmada" tone="success" style={styles.statusBadge} />
              </View>
            )}

            <Button
              title="Ir a mis reservas"
              onPress={() => router.replace('/orders')}
              size="large"
            />
          </>
        ) : (
          <>
            <View style={styles.iconContainer}>
              <XCircle size={72} color={colors.danger} />
            </View>

            <Text style={styles.title} accessibilityRole="header">No pudimos confirmar la reserva</Text>
            <Text style={styles.errorMessage}>{error}</Text>

            <View style={styles.errorCard}>
              <Text style={styles.errorCardTitle}>Posibles causas:</Text>
              <Text style={styles.errorCardText}>
                • El enlace ya fue utilizado{'\n'}
                • El enlace venció{'\n'}
                • La reserva fue cancelada{'\n'}
                • El enlace no es válido
              </Text>
            </View>

            <Button
              title="Volver al inicio"
              onPress={() => router.replace('/(tabs)')}
              size="large"
            />
          </>
        )}
      </View>
    </View>
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
  },
  loadingText: {
    marginTop: spacing.lg,
    ...typography.label,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 96,
    height: 96,
    resizeMode: 'contain',
    marginBottom: spacing.xl,
  },
  iconContainer: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.display,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
  },
  errorMessage: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xxxl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.md,
  },
  detailsTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  detailLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  detailValue: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    marginTop: spacing.md,
  },
  errorCard: {
    width: '100%',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xxxl,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorCardTitle: {
    ...typography.label,
    fontWeight: '600',
    color: '#991B1B',
    marginBottom: spacing.sm,
  },
  errorCardText: {
    ...typography.bodySmall,
    color: '#991B1B',
  },
});
