import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { CheckCircle, XCircle, Calendar, Clock } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';

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
      setError('Token no proporcionado');
      setLoading(false);
    }
  }, [token]);

  const confirmBooking = async (tokenHash: string) => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/confirm-booking?token=${tokenHash}`,
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
          <ActivityIndicator size="large" color="#2D6A6F" />
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
              <CheckCircle size={80} color="#10B981" />
            </View>

            <Text style={styles.title}>¡Reserva Confirmada!</Text>
            <Text style={styles.message}>
              Tu cita ha sido confirmada exitosamente
            </Text>

            {bookingData && (
              <View style={styles.detailsCard}>
                <Text style={styles.detailsTitle}>Detalles de la reserva</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Servicio:</Text>
                  <Text style={styles.detailValue}>{bookingData.service_name}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Calendar size={16} color="#6B7280" />
                  <Text style={styles.detailLabel}>Fecha:</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(bookingData.appointment_date)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Clock size={16} color="#6B7280" />
                  <Text style={styles.detailLabel}>Hora:</Text>
                  <Text style={styles.detailValue}>{bookingData.appointment_time}</Text>
                </View>

                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Confirmada</Text>
                </View>
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
              <XCircle size={80} color="#EF4444" />
            </View>

            <Text style={styles.title}>Error al Confirmar</Text>
            <Text style={styles.errorMessage}>{error}</Text>

            <View style={styles.errorCard}>
              <Text style={styles.errorCardTitle}>Posibles causas:</Text>
              <Text style={styles.errorCardText}>
                • El enlace ya fue utilizado{'\n'}
                • El enlace ha expirado{'\n'}
                • La reserva fue cancelada{'\n'}
                • El token es inválido
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
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
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
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  errorMessage: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 24,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  detailsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#065F46',
  },
  errorCard: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorCardTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#991B1B',
    marginBottom: 8,
  },
  errorCardText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#991B1B',
    lineHeight: 20,
  },
});
