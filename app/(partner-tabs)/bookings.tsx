import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Clock, User, Phone, Check, X, Eye } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

export default function PartnerBookings() {
  const params = useLocalSearchParams<{ businessId?: string }>();
  const businessId = params.businessId;
  const { currentUser } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed' | 'completed'>('pending');
  const [loading, setLoading] = useState(true);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);

  useEffect(() => {
    if (!currentUser || !businessId) return;

    console.log('Loading bookings for partner ID:', businessId as string);

    // Get partner profile using Supabase
    const fetchPartnerProfile = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('partners')
          .select('*')
          .eq('id', businessId)
          .single();
        
        if (error) throw error;
        
        if (data) {
          setPartnerProfile({
            id: data.id,
            businessName: data.business_name,
            businessType: data.business_type,
            logo: data.logo,
            ...data
          });
          fetchBookings(businessId as string);
        }
      } catch (error) {
        console.error('Error fetching partner profile:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPartnerProfile();
    
    // Set up real-time subscription
    const subscription = supabaseClient
      .channel('partner-profile-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'partners',
          filter: `id=eq.${businessId}`
        }, 
        () => {
          fetchPartnerProfile();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUser, businessId]);

  const fetchBookings = (partnerId: string) => {
    const fetchBookingsData = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('bookings')
          .select('*')
          .eq('partner_id', partnerId)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const bookingsData = data.map(booking => ({
          id: booking.id,
          ...booking,
          date: new Date(booking.date),
          createdAt: booking.created_at ? new Date(booking.created_at) : new Date(),
          partnerId: booking.partner_id,
          serviceName: booking.service_name,
          customerName: booking.customer_name,
          petName: booking.pet_name,
          customerPhone: booking.customer_phone
        }));
        
        setBookings(bookingsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching bookings:', error);
        setLoading(false);
      }
    };
    
    fetchBookingsData();
    
    // Set up real-time subscription
    const subscription = supabaseClient
      .channel('bookings-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'bookings',
          filter: `partner_id=eq.${partnerId}`
        }, 
        () => {
          fetchBookingsData();
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  };

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      const { error } = await supabaseClient
        .from('bookings')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);
      
      if (error) throw error;
      
      const statusMessages = {
        confirmed: 'Reserva confirmada',
        completed: 'Reserva marcada como completada',
        cancelled: 'Reserva cancelada'
      };
      
      Alert.alert('Éxito', statusMessages[newStatus as keyof typeof statusMessages]);
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

  const filteredBookings = bookings.filter(booking => booking.status === activeTab);

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
          <Calendar size={16} color="#6B7280" />
          <Text style={styles.bookingDetailText}>
            {booking.date.toLocaleDateString()}
          </Text>
        </View>
        
        <View style={styles.bookingDetail}>
          <Clock size={16} color="#6B7280" />
          <Text style={styles.bookingDetailText}>
            {booking.time || 'Hora no especificada'}
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
          <>
            <Button
              title="Rechazar"
              onPress={() => handleUpdateBookingStatus(booking.id, 'cancelled')}
              variant="outline"
              size="small"
            />
            <Button
              title="Confirmar"
              onPress={() => handleUpdateBookingStatus(booking.id, 'confirmed')}
              size="small"
            />
          </>
        )}
        
        {booking.status === 'confirmed' && (
          <Button
            title="Marcar Completada"
            onPress={() => handleUpdateBookingStatus(booking.id, 'completed')}
            size="small"
          />
        )}
        
        <TouchableOpacity style={styles.viewButton}>
          <Eye size={16} color="#3B82F6" />
          <Text style={styles.viewButtonText}>Ver Detalles</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando reservas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!partnerProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color="#111827" />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>Reservas</Text>
              <Text style={styles.businessName}>Cargando información...</Text>
            </View>
          </View>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando información del negocio...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <View style={styles.businessInfo}>
            {partnerProfile.logo ? (
              <Image source={{ uri: partnerProfile.logo }} style={styles.businessLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>
                  {partnerProfile.businessType === 'veterinary' ? '🏥' : 
                   partnerProfile.businessType === 'grooming' ? '✂️' : 
                   partnerProfile.businessType === 'walking' ? '🚶' : 
                   partnerProfile.businessType === 'boarding' ? '🏠' : 
                   partnerProfile.businessType === 'shop' ? '🛍️' : '🏢'}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.title}>Reservas</Text>
              <Text style={styles.businessName}>{partnerProfile.businessName}</Text>
            </View>
          </View>
        </View>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pendientes ({bookings.filter(b => b.status === 'pending').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'confirmed' && styles.activeTab]}
          onPress={() => setActiveTab('confirmed')}
        >
          <Text style={[styles.tabText, activeTab === 'confirmed' && styles.activeTabText]}>
            Confirmadas ({bookings.filter(b => b.status === 'confirmed').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completadas ({bookings.filter(b => b.status === 'completed').length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {filteredBookings.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Calendar size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>
              No hay reservas {activeTab === 'pending' ? 'pendientes' : activeTab === 'confirmed' ? 'confirmadas' : 'completadas'}
            </Text>
            <Text style={styles.emptySubtitle}>
              Las reservas aparecerán aquí cuando los clientes soliciten tus servicios
            </Text>
          </Card>
        ) : (
          filteredBookings.map(renderBooking)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
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
  placeholder: {
    width: 32,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3B82F6',
  },
  content: {
    flex: 1,
    padding: 16,
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  bookingCard: {
    marginBottom: 12,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginLeft: 4,
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
  },
});