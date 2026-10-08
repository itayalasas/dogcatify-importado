import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Clock, User, Phone, CircleCheck } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { Card, Button, Badge, IconButton, EmptyState, SkeletonList, toast } from '../../components/ui';
import type { BadgeTone } from '../../components/ui';
import { BusinessTypeAvatar } from '../../components/partner/BusinessTypeAvatar';
import { colors, radius, spacing, typography } from '../../constants/theme';

const logDebug = (message: string, data?: any) => {
  console.log(`[PartnerAgenda] ${message}`, data || '');
};

export default function PartnerAgenda() {
  const { partnerId } = useLocalSearchParams<{ partnerId: string }>();
  const { currentUser } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!partnerId) return;
    
    const fetchPartnerProfile = async () => {
      try {
        console.log('Fetching partner profile for ID:', partnerId);
        const { data, error } = await supabaseClient
          .from('partners')
          .select('*')
          .eq('id', partnerId)
          .single();
        
        if (error) {
          console.error('Error fetching partner profile:', error);
          setError(`Error al cargar perfil: ${error.message}`);
          return;
        }
        
        if (data) {
          console.log('Partner profile loaded:', data.business_name);
          setPartnerProfile({
            id: data.id,
            businessName: data.business_name,
            businessType: data.business_type,
            logo: data.logo,
            ...data
          });
        }
        
        fetchBookings();
      } catch (error) {
        console.error('Error in fetchPartnerProfile:', error);
        setError('Error al cargar la información del negocio');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPartnerProfile();
  }, [partnerId]);

  useEffect(() => {
    if (partnerId) {
      fetchBookings();
    }
  }, [selectedDate, partnerId]);

  const getBookingDateTime = (booking: any) => {
    const baseDate = booking.date ? new Date(booking.date) : new Date();
    const bookingDateTime = new Date(baseDate);

    if (booking.time && typeof booking.time === 'string') {
      const timeMatch = booking.time.match(/^(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        bookingDateTime.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
      }
    } else {
      bookingDateTime.setHours(23, 59, 59, 999);
    }

    return bookingDateTime;
  };

  const isExpiredBooking = (booking: any) => {
    if (!booking) return false;
    if (!['pending', 'confirmed'].includes(booking.status)) return false;

    return getBookingDateTime(booking) < new Date();
  };

  const normalizeBookingStatus = (booking: any) => {
    if (isExpiredBooking(booking)) {
      return {
        ...booking,
        status: 'completed',
      };
    }

    return booking;
  };

  const fetchBookings = async () => {
    if (!partnerId) return;
    
    setError(null);
    try {
      console.log('Fetching bookings for partner:', partnerId);
      console.log('Selected date:', selectedDate.toISOString().split('T')[0]);
      
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      const { data, error, count } = await supabaseClient
        .from('bookings')
        .select('*', { count: 'exact' })
        .eq('partner_id', partnerId)
        .gte('date', `${dateStr}T00:00:00.000Z`)
        .lt('date', `${dateStr}T23:59:59.999Z`)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching bookings:', error);
        setError(`Error al cargar reservas: ${error.message}`);
        return;
      }
      
      console.log(`Found ${count} bookings for date ${dateStr}`);
      console.log('Bookings data:', data);
      
      const bookingsData = data.map(booking => ({
        id: booking.id,
        ...booking,
        date: booking.date ? new Date(booking.date) : new Date(),
        createdAt: booking.created_at ? new Date(booking.created_at) : new Date(),
        partnerId: booking.partner_id,
        serviceName: booking.service_name,
        customerName: booking.customer_name,
        petName: booking.pet_name,
        customerPhone: booking.customer_phone,
        status: booking.status || 'pending'
      }));

      const expiredBookings = bookingsData.filter(isExpiredBooking);
      if (expiredBookings.length > 0) {
        const expiredIds = expiredBookings.map((booking) => booking.id);
        const { error: expiredUpdateError } = await supabaseClient
          .from('bookings')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .in('id', expiredIds);

        if (expiredUpdateError) {
          console.error('Error updating expired bookings in agenda:', expiredUpdateError);
        }
      }

      const normalizedBookings = bookingsData.map(normalizeBookingStatus);

      setBookings(normalizedBookings);
      console.log('Processed bookings:', normalizedBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setError('Error al cargar las reservas');
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      logDebug(`Updating booking ${bookingId} to status: ${newStatus}`);
      const { error } = await supabaseClient
        .from('bookings')
        .update({
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);
      
      if (error) throw error;
      
      // Update local state immediately for better UX
      setBookings(prevBookings => 
        prevBookings.map(booking => 
          booking.id === bookingId 
            ? { ...booking, status: newStatus }
            : booking
        )
      );
      
      const statusMessages = {
        confirmed: 'Reserva confirmada',
        completed: 'Reserva marcada como completada',
        cancelled: 'Reserva cancelada',
        pending: 'Reserva restaurada a pendiente'
      };
      
      toast.success(statusMessages[newStatus as keyof typeof statusMessages]);
      
      // Refresh data from server
      fetchBookings();
    } catch (error) {
      console.error('Error updating booking status:', error);
      Alert.alert('Error', 'No se pudo actualizar la reserva');
    }
  };

  const getStatusTone = (status: string): BadgeTone => {
    switch (status) {
      case 'pending': return 'warning';
      case 'confirmed': return 'success';
      case 'completed': return 'primary';
      case 'cancelled': return 'danger';
      default: return 'neutral';
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchBookings();
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'confirmed': return 'Confirmada';
      case 'completed': return 'Completada';
      case 'cancelled': return 'Cancelada';
      default: return 'Desconocido';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric', 
      month: 'long',
      day: 'numeric'
    });
  };

  const generateDateOptions = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = -3; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  };

  const renderBooking = (booking: any) => (
    <Card key={booking.id} style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <View style={styles.bookingInfo}>
          <Text style={styles.serviceName}>{booking.serviceName || 'Servicio'}</Text>
          <Text style={styles.customerName}>
            {booking.customerName || 'Cliente'}
          </Text>
        </View>
        <Badge label={getStatusText(booking.status)} tone={getStatusTone(booking.status)} />
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.bookingDetail}>
          <Clock size={16} color={colors.textSecondary} />
          <Text style={styles.bookingDetailText}>
            {booking.time || booking.date.toLocaleTimeString('es-ES', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
        
        {booking.petName && (
          <View style={styles.bookingDetail}>
            <User size={16} color={colors.textSecondary} />
            <Text style={styles.bookingDetailText}>
              Mascota: {booking.petName}
            </Text>
          </View>
        )}
        
        {booking.customerPhone && (
          <View style={styles.bookingDetail}>
            <Phone size={16} color={colors.textSecondary} />
            <Text style={styles.bookingDetailText}>
              {booking.customerPhone}
            </Text>
          </View>
        )}
      </View>

      {booking.notes && (
        <View style={styles.notesSection}>
          <Text style={styles.notesTitle}>Notas:</Text>
          <Text style={styles.notesText}>{booking.notes}</Text>
        </View>
      )}

      <View style={styles.bookingActions}>
        {booking.status === 'pending' && (
          <View style={styles.pendingActions}>
            <Button
              title="Rechazar"
              onPress={() => handleUpdateBookingStatus(booking.id, 'cancelled')}
              variant="outline"
              size="medium"
              style={styles.rejectButton}
            />
            <Button
              title="Confirmar"
              onPress={() => handleUpdateBookingStatus(booking.id, 'confirmed')}
              size="medium"
              style={styles.confirmButton}
            />
          </View>
        )}
        
        {booking.status === 'confirmed' && (
          <View style={styles.confirmedActions}>
            <Button
              title="Cancelar"
              onPress={() => handleUpdateBookingStatus(booking.id, 'cancelled')}
              variant="outline"
              size="medium"
              style={styles.cancelButton}
            />
            <Button
              title="Completar"
              onPress={() => handleUpdateBookingStatus(booking.id, 'completed')}
              size="medium"
              style={styles.completeButton}
            />
          </View>
        )}
        
        {booking.status === 'cancelled' && (
          <View style={styles.cancelledActions}>
            <Button
              title="Restaurar a pendiente"
              onPress={() => handleUpdateBookingStatus(booking.id, 'pending')}
              size="medium"
              style={styles.restoreButton}
            />
          </View>
        )}
        
        {booking.status === 'completed' && (
          <View style={styles.completedActions}>
            <Badge
              label="Servicio completado"
              tone="success"
              icon={<CircleCheck size={14} color={colors.success} />}
            />
          </View>
        )}
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <IconButton
            icon={<ArrowLeft size={24} color={colors.text} />}
            onPress={() => router.push({
              pathname: '/(partner-tabs)/dashboard',
              params: { businessId: partnerId }
            })}
            accessibilityLabel="Volver al panel"
          />
          <View style={styles.businessInfo}>
            {partnerProfile?.logo ? (
              <Image source={{ uri: partnerProfile.logo }} style={styles.businessLogo} />
            ) : (
              <BusinessTypeAvatar type={partnerProfile?.businessType} size={40} style={styles.logoPlaceholder} />
            )}
            <View>
              <Text style={styles.title}>Agenda</Text>
              <Text style={styles.businessName}>{partnerProfile?.businessName}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Date Selector */}
      <View style={styles.dateSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {generateDateOptions().map((date, index) => {
            const isSelected = date.toDateString() === selectedDate.toDateString();
            const isToday = date.toDateString() === new Date().toDateString();
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateOption,
                  isSelected && styles.selectedDateOption
                ]}
                onPress={() => setSelectedDate(date)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={date.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' })}
              >
                <Text style={[
                  styles.dateDay,
                  isSelected && styles.selectedDateText
                ]}>
                  {date.toLocaleDateString('es-ES', { weekday: 'short' })}
                </Text>
                <Text style={[
                  styles.dateNumber,
                  isSelected && styles.selectedDateText,
                  isToday && !isSelected && styles.todayText
                ]}>
                  {date.getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.selectedDateInfo}>
        <Text style={styles.selectedDateInfoText}>
          {formatDate(selectedDate)}
        </Text>
        <Text style={styles.bookingsCount}>
          {bookings.length} reserva{bookings.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button
              title="Reintentar"
              onPress={() => {
                setError(null);
                fetchBookings();
              }}
              variant="outline"
              size="small"
              fullWidth={false}
            />
          </View>
        )}
        
        {loading ? (
          <SkeletonList kind="cards" count={3} />
        ) : !error && bookings.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              icon={<Calendar size={32} color={colors.primary} />}
              title="No hay reservas para este día"
              description="Las reservas van a aparecer acá cuando tus clientes pidan tus servicios."
            />
          </Card>
        ) : !error && (
          bookings.map(renderBooking)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'column',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  backButton: {
    padding: 6,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
    flex: 1,
  },
  businessLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.md,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  logoPlaceholderText: {
    fontSize: 20,
  },
  businessName: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  dateSelector: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateOption: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.xs,
    borderRadius: radius.md,
    minWidth: 60,
  },
  selectedDateOption: {
    backgroundColor: colors.primary,
  },
  dateDay: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  dateNumber: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: colors.text,
  },
  selectedDateText: {
    color: colors.surface,
  },
  todayText: {
    color: colors.primary,
  },
  selectedDateInfo: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedDateHeaderText: {
    ...typography.bodyStrong,
    color: colors.text,
    textTransform: 'capitalize',
  },
  selectedDateInfoText: {
    ...typography.bodyStrong,
    color: colors.text,
    textTransform: 'capitalize',
  },
  bookingsCount: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  errorContainer: {
    backgroundColor: colors.dangerSoft,
    padding: spacing.lg,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  errorText: {
    ...typography.label,
    color: '#991B1B',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 6,
  },
  retryButtonText: {
    ...typography.label,
    color: colors.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    ...typography.body,
    color: colors.textTertiary,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  bookingCard: {
    marginBottom: spacing.md,
  },
  bookingHeader: {
    marginTop: spacing.md,
  },
  pendingActions: {
    flexDirection: 'column',
    gap: spacing.md,
    width: '100%',
  },
  confirmedActions: {
    flexDirection: 'column',
    gap: spacing.md,
    width: '100%',
  },
  cancelledActions: {
    width: '100%',
    alignItems: 'center',
  },
  completedActions: {
    width: '100%',
    alignItems: 'center',
  },
  rejectButton: {
    width: '100%',
    backgroundColor: colors.surface,
    borderColor: colors.danger,
    borderWidth: 1,
  },
  confirmButton: {
    width: '100%',
    backgroundColor: colors.success,
  },
  cancelButton: {
    width: '100%',
    backgroundColor: colors.surface,
    borderColor: '#F59E0B',
    borderWidth: 1,
  },
  completeButton: {
    width: '100%',
    backgroundColor: colors.primary,
  },
  restoreButton: {
    width: '100%',
    backgroundColor: '#8B5CF6',
  },
  completedText: {
    ...typography.label,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  paidBadge: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: colors.success,
  },
  bookingInfo: {
    flex: 1,
  },
  serviceName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  customerName: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  bookingDetails: {
    marginBottom: spacing.md,
  },
  bookingDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  bookingDetailText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  notesSection: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  notesTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  notesText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    lineHeight: 20,
  },
  bookingActions: {
    marginTop: spacing.sm,
  },
  actionButtonContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    flex: 1,
  },
  actionButton: {
    flex: 1,
  },
});
