import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Clock, User, Phone } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

const logDebug = (message: string, data?: any) => {
  console.log(`[PartnerAgenda] ${message}`, data || '');
};

export default function PartnerAgenda() {
  const { partnerId } = useLocalSearchParams<{ partnerId: string }>();
  const { currentUser } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
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
      
      setBookings(bookingsData);
      console.log('Processed bookings:', bookingsData);
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
      
      Alert.alert('Éxito', statusMessages[newStatus as keyof typeof statusMessages]);
      
      // Refresh data from server
      fetchBookings();
    } catch (error) {
      console.error('Error updating booking status:', error);
      Alert.alert('Error', 'No se pudo actualizar la reserva');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FEF3C7';
      case 'confirmed': return '#D1FAE5';
      case 'completed': return '#DBEAFE';
      case 'cancelled': return '#FEE2E2';
      default: return '#F3F4F6';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'pending': return '#92400E';
      case 'confirmed': return '#065F46';
      case 'completed': return '#1E40AF';
      case 'cancelled': return '#991B1B';
      default: return '#374151';
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
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(booking.status) }
        ]}>
          <Text style={[
            styles.statusText,
            { color: getStatusTextColor(booking.status) }
          ]}>
            {getStatusText(booking.status)}
          </Text>
        </View>
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.bookingDetail}>
          <Clock size={16} color="#6B7280" />
          <Text style={styles.bookingDetailText}>
            {booking.time || booking.date.toLocaleTimeString('es-ES', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
        
        {booking.petName && (
          <View style={styles.bookingDetail}>
            <User size={16} color="#6B7280" />
            <Text style={styles.bookingDetailText}>
              Mascota: {booking.petName}
            </Text>
          </View>
        )}
        
        {booking.customerPhone && (
          <View style={styles.bookingDetail}>
            <Phone size={16} color="#6B7280" />
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
        
        {(booking.status === 'confirmed' || booking.payment_status === 'paid') && (
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
              title="Restaurar a Pendiente"
              onPress={() => handleUpdateBookingStatus(booking.id, 'pending')}
              size="medium"
              style={styles.restoreButton}
            />
          </View>
        )}
        
        {booking.status === 'completed' && (
          <View style={styles.completedActions}>
            <Text style={styles.completedText}>✅ Servicio completado</Text>
          </View>
        )}
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.push({
            pathname: '/(partner-tabs)/dashboard',
            params: { businessId: partnerId }
          })} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <View style={styles.businessInfo}>
            {partnerProfile?.logo ? (
              <Image source={{ uri: partnerProfile.logo }} style={styles.businessLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>
                  {partnerProfile?.businessType === 'veterinary' ? '🏥' : 
                   partnerProfile?.businessType === 'grooming' ? '✂️' : 
                   partnerProfile?.businessType === 'walking' ? '🚶' : 
                   partnerProfile?.businessType === 'boarding' ? '🏠' : 
                   partnerProfile?.businessType === 'shop' ? '🛍️' : '📅'}
                </Text>
              </View>
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
        <Text style={styles.selectedDateText}>
          {formatDate(selectedDate)}
        </Text>
        <Text style={styles.bookingsCount}>
          {bookings.length} reserva{bookings.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setError(null);
                fetchBookings();
              }}
            >
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando agenda...</Text>
          </View>
        ) : !error && bookings.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Calendar size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No hay reservas para este día</Text>
            <Text style={styles.emptySubtitle}>
              Las reservas aparecerán aquí cuando los clientes soliciten tus servicios
            </Text>
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
    backgroundColor: '#F9FAFB',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButton: {
    padding: 6,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    flex: 1,
  },
  businessLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoPlaceholderText: {
    fontSize: 20,
  },
  businessName: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  dateSelector: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dateOption: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 12,
    minWidth: 60,
  },
  selectedDateOption: {
    backgroundColor: '#3B82F6',
  },
  dateDay: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 4,
  },
  dateNumber: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  selectedDateText: {
    color: '#FFFFFF',
  },
  todayText: {
    color: '#3B82F6',
  },
  selectedDateInfo: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  selectedDateText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    textTransform: 'capitalize',
  },
  bookingsCount: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#991B1B',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  bookingCard: {
    marginBottom: 12,
  },
  bookingHeader: {
    marginTop: 12,
  },
  pendingActions: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  confirmedActions: {
    flexDirection: 'column',
    gap: 12,
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
    backgroundColor: '#FFFFFF',
    borderColor: '#EF4444',
    borderWidth: 1,
  },
  confirmButton: {
    width: '100%',
    backgroundColor: '#10B981',
  },
  cancelButton: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderColor: '#F59E0B',
    borderWidth: 1,
  },
  completeButton: {
    width: '100%',
    backgroundColor: '#3B82F6',
  },
  restoreButton: {
    width: '100%',
    backgroundColor: '#8B5CF6',
  },
  completedText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#10B981',
    textAlign: 'center',
    marginBottom: 12,
  },
  paidBadge: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  bookingInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  customerName: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  bookingDetails: {
    marginBottom: 12,
  },
  bookingDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bookingDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginLeft: 6,
  },
  notesSection: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  notesTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  bookingActions: {
    marginTop: 8,
  },
  actionButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  actionButton: {
    flex: 1,
  },
});