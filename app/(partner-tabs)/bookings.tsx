import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Clock, User, Phone, Check, X, Eye, MapPin, DollarSign } from 'lucide-react-native';
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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [updatingBooking, setUpdatingBooking] = useState<string | null>(null);

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
    setUpdatingBooking(bookingId);
    try {
      console.log('Updating booking status:', { bookingId, newStatus });
      
      const { error } = await supabaseClient
        .from('bookings')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);
      
      if (error) throw error;
      
      console.log('Booking status updated successfully');
      
      const statusMessages = {
        confirmed: 'Reserva confirmada',
        completed: 'Reserva marcada como completada',
        cancelled: 'Reserva cancelada'
      };
      
      Alert.alert('Éxito', statusMessages[newStatus as keyof typeof statusMessages]);
      
      // Refresh bookings immediately to show updated status
      if (businessId) {
        fetchBookings(businessId as string);
      }
    } catch (error) {
      console.error('Error updating booking status:', error);
      Alert.alert('Error', 'No se pudo actualizar la reserva');
    } finally {
      setUpdatingBooking(null);
    }
  };

  const handleViewDetails = (booking: any) => {
    setSelectedBooking(booking);
    setShowDetailsModal(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'paid': return '✅ Pagado';
      case 'pending': return '⏳ Pendiente';
      case 'failed': return '❌ Fallido';
      default: return '❓ No especificado';
    }
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'credit_card': return '💳 Tarjeta de crédito';
      case 'debit_card': return '💳 Tarjeta de débito';
      case 'cash': return '💵 Efectivo';
      case 'transfer': return '🏦 Transferencia';
      default: return '❓ No especificado';
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
          <View style={styles.pendingActions}>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => handleUpdateBookingStatus(booking.id, 'cancelled')}
              disabled={updatingBooking === booking.id}
            >
              <X size={16} color="#FFFFFF" />
              <Text style={styles.rejectButtonText}>
                {updatingBooking === booking.id ? 'Rechazando...' : 'Rechazar'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => handleUpdateBookingStatus(booking.id, 'confirmed')}
              disabled={updatingBooking === booking.id}
            >
              <Check size={16} color="#FFFFFF" />
              <Text style={styles.confirmButtonText}>
                {updatingBooking === booking.id ? 'Confirmando...' : 'Confirmar'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        
        {booking.status === 'confirmed' && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => handleUpdateBookingStatus(booking.id, 'completed')}
            disabled={updatingBooking === booking.id}
          >
            <Check size={16} color="#FFFFFF" />
            <Text style={styles.completeButtonText}>
              {updatingBooking === booking.id ? 'Completando...' : 'Marcar Completada'}
            </Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={styles.viewButton}
          onPress={() => handleViewDetails(booking)}
        >
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

      {/* Booking Details Modal */}
      <Modal
        visible={showDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalles de la Reserva</Text>
              <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedBooking && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Service Information */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>📋 Información del Servicio</Text>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Servicio:</Text>
                    <Text style={styles.detailValue}>{selectedBooking.serviceName || 'No especificado'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Duración:</Text>
                    <Text style={styles.detailValue}>{selectedBooking.serviceDuration || 60} minutos</Text>
                  </View>
                  {selectedBooking.totalAmount && (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Precio:</Text>
                      <Text style={styles.detailValue}>{formatCurrency(selectedBooking.totalAmount)}</Text>
                    </View>
                  )}
                </View>

                {/* Customer Information */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>👤 Información del Cliente</Text>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Nombre:</Text>
                    <Text style={styles.detailValue}>{selectedBooking.customerName || 'No especificado'}</Text>
                  </View>
                  {selectedBooking.customerEmail && (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Email:</Text>
                      <Text style={styles.detailValue}>{selectedBooking.customerEmail}</Text>
                    </View>
                  )}
                  {selectedBooking.customerPhone && (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Teléfono:</Text>
                      <Text style={styles.detailValue}>{selectedBooking.customerPhone}</Text>
                    </View>
                  )}
                </View>

                {/* Pet Information */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>🐾 Información de la Mascota</Text>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Nombre:</Text>
                    <Text style={styles.detailValue}>{selectedBooking.petName || 'No especificado'}</Text>
                  </View>
                </View>

                {/* Appointment Information */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>📅 Información de la Cita</Text>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Fecha:</Text>
                    <Text style={styles.detailValue}>{selectedBooking.date.toLocaleDateString()}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Hora:</Text>
                    <Text style={styles.detailValue}>{selectedBooking.time || 'No especificada'}</Text>
                  </View>
                  {selectedBooking.endTime && (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Hora de fin:</Text>
                      <Text style={styles.detailValue}>{selectedBooking.endTime}</Text>
                    </View>
                  )}
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Estado:</Text>
                    <View style={[
                      styles.statusBadgeInModal,
                      { backgroundColor: getStatusColor(selectedBooking.status) }
                    ]}>
                      <Text style={[
                        styles.statusTextInModal,
                        { color: getStatusTextColor(selectedBooking.status) }
                      ]}>
                        {getStatusText(selectedBooking.status)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Payment Information */}
                {(selectedBooking.paymentStatus || selectedBooking.paymentMethod || selectedBooking.totalAmount) && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>💳 Información de Pago</Text>
                    {selectedBooking.paymentStatus && (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Estado del pago:</Text>
                        <Text style={styles.detailValue}>{getPaymentStatusText(selectedBooking.paymentStatus)}</Text>
                      </View>
                    )}
                    {selectedBooking.paymentMethod && (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Método de pago:</Text>
                        <Text style={styles.detailValue}>{getPaymentMethodText(selectedBooking.paymentMethod)}</Text>
                      </View>
                    )}
                    {selectedBooking.paymentConfirmedAt && (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Pago confirmado:</Text>
                        <Text style={styles.detailValue}>
                          {new Date(selectedBooking.paymentConfirmedAt).toLocaleDateString()} a las{' '}
                          {new Date(selectedBooking.paymentConfirmedAt).toLocaleTimeString()}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Notes */}
                {selectedBooking.notes && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>📝 Notas del Cliente</Text>
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesText}>{selectedBooking.notes}</Text>
                    </View>
                  </View>
                )}

                {/* Timestamps */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>🕒 Información de Registro</Text>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Reserva creada:</Text>
                    <Text style={styles.detailValue}>
                      {selectedBooking.createdAt.toLocaleDateString()} a las{' '}
                      {selectedBooking.createdAt.toLocaleTimeString()}
                    </Text>
                  </View>
                  {selectedBooking.updatedAt && (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Última actualización:</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedBooking.updatedAt).toLocaleDateString()} a las{' '}
                        {new Date(selectedBooking.updatedAt).toLocaleTimeString()}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <Button
                title="Cerrar"
                onPress={() => setShowDetailsModal(false)}
                variant="outline"
                size="large"
              />
            </View>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    minHeight: 70,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#3B82F6',
  },
  content: {
    flex: 1,
    padding: 16,
    paddingBottom: 100,
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
    marginHorizontal: 4,
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
    marginTop: 8,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  rejectButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  confirmButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
    marginBottom: 8,
  },
  completeButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
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
  paidBadge: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#6B7280',
  },
  modalBody: {
    flex: 1,
    marginBottom: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 2,
    textAlign: 'right',
  },
  statusBadgeInModal: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-end',
  },
  statusTextInModal: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  notesContainer: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  modalActions: {
    paddingTop: 10,
  },
});