import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Clock, User, Phone, Check, X, Eye, MapPin, DollarSign } from 'lucide-react-native';
import { Card, Button, Badge, IconButton, EmptyState, SkeletonList, toast } from '../../components/ui';
import type { BadgeTone } from '../../components/ui';
import { BusinessTypeAvatar } from '../../components/partner/BusinessTypeAvatar';
import { formatMoney } from '../../components/partner/format';
import { colors, radius, spacing, typography, touchTarget } from '../../constants/theme';
import { OneTimeTooltip } from '../../components/ui/OneTimeTooltip';
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
            console.error('Error updating expired partner bookings:', expiredUpdateError);
          }
        }

        const normalizedBookings = bookingsData.map(normalizeBookingStatus);

        setBookings(normalizedBookings);
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
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
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
      
      toast.success(statusMessages[newStatus as keyof typeof statusMessages]);
      
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

  const formatCurrency = (amount: number) => formatMoney(amount);

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Pagado';
      case 'pending': return 'Pendiente';
      case 'failed': return 'Fallido';
      default: return 'No especificado';
    }
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'credit_card': return 'Tarjeta de crédito';
      case 'debit_card': return 'Tarjeta de débito';
      case 'cash': return 'Efectivo';
      case 'transfer': return 'Transferencia';
      default: return 'No especificado';
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
        <Badge label={getStatusText(booking.status)} tone={getStatusTone(booking.status)} />
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.bookingDetail}>
          <Calendar size={16} color={colors.textSecondary} />
          <Text style={styles.bookingDetailText}>
            {booking.date.toLocaleDateString()}
          </Text>
        </View>
        
        <View style={styles.bookingDetail}>
          <Clock size={16} color={colors.textSecondary} />
          <Text style={styles.bookingDetailText}>
            {booking.time || 'Hora no especificada'}
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
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => handleUpdateBookingStatus(booking.id, 'cancelled')}
              disabled={updatingBooking === booking.id}
              accessibilityRole="button"
              accessibilityLabel="Rechazar reserva"
            >
              <X size={16} color={colors.onPrimary} />
              <Text style={styles.rejectButtonText}>
                {updatingBooking === booking.id ? 'Rechazando...' : 'Rechazar'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => handleUpdateBookingStatus(booking.id, 'confirmed')}
              disabled={updatingBooking === booking.id}
              accessibilityRole="button"
              accessibilityLabel="Confirmar reserva"
            >
              <Check size={16} color={colors.onPrimary} />
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
            accessibilityRole="button"
            accessibilityLabel="Marcar reserva como completada"
          >
            <Check size={16} color={colors.onPrimary} />
            <Text style={styles.completeButtonText}>
              {updatingBooking === booking.id ? 'Completando...' : 'Marcar como completada'}
            </Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={styles.viewButton}
          onPress={() => handleViewDetails(booking)}
          accessibilityRole="button"
          accessibilityLabel="Ver detalles de la reserva"
        >
          <Eye size={16} color={colors.primary} />
          <Text style={styles.viewButtonText}>Ver detalles</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <SkeletonList kind="cards" count={3} style={{ padding: spacing.lg }} />
      </SafeAreaView>
    );
  }

  if (!partnerProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <IconButton
              icon={<ArrowLeft size={24} color={colors.text} />}
              onPress={() => router.back()}
              accessibilityLabel="Volver"
            />
            <View>
              <Text style={styles.title}>Reservas</Text>
              <Text style={styles.businessName}>Cargando información...</Text>
            </View>
          </View>
          <View style={styles.placeholder} />
        </View>
        <SkeletonList kind="cards" count={3} style={{ padding: spacing.lg }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <IconButton
            icon={<ArrowLeft size={24} color={colors.text} />}
            onPress={() => router.back()}
            accessibilityLabel="Volver"
          />
          <View style={styles.businessInfo}>
            {partnerProfile.logo ? (
              <Image source={{ uri: partnerProfile.logo }} style={styles.businessLogo} />
            ) : (
              <BusinessTypeAvatar type={partnerProfile.businessType} size={40} style={styles.logoPlaceholder} />
            )}
            <View>
              <Text style={styles.title}>Reservas</Text>
              <Text style={styles.businessName}>{partnerProfile.businessName}</Text>
            </View>
          </View>
        </View>
      </View>

      <OneTimeTooltip
        hintKey="partner_bookings_tabs"
        userId={currentUser?.id}
        text="Tip: confirmá las reservas pendientes para que tus clientes sepan que las viste"
        placement="bottom"
      >
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
            onPress={() => setActiveTab('pending')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'pending' }}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
              Pendientes ({bookings.filter(b => b.status === 'pending').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'confirmed' && styles.activeTab]}
            onPress={() => setActiveTab('confirmed')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'confirmed' }}
          >
            <Text style={[styles.tabText, activeTab === 'confirmed' && styles.activeTabText]}>
              Confirmadas ({bookings.filter(b => b.status === 'confirmed').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
            onPress={() => setActiveTab('completed')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'completed' }}
          >
            <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
              Completadas ({bookings.filter(b => b.status === 'completed').length})
            </Text>
          </TouchableOpacity>
        </View>
      </OneTimeTooltip>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {filteredBookings.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              icon={<Calendar size={32} color={colors.primary} />}
              title={`No hay reservas ${activeTab === 'pending' ? 'pendientes' : activeTab === 'confirmed' ? 'confirmadas' : 'completadas'}`}
              description="Las reservas van a aparecer acá cuando tus clientes pidan tus servicios."
            />
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
              <Text style={styles.modalTitle} accessibilityRole="header">Detalles de la reserva</Text>
              <IconButton
                icon={<X size={22} color={colors.textSecondary} />}
                onPress={() => setShowDetailsModal(false)}
                accessibilityLabel="Cerrar"
              />
            </View>

            {selectedBooking && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Service Information */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Servicio</Text>
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
                  <Text style={styles.detailSectionTitle}>Cliente</Text>
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
                  <Text style={styles.detailSectionTitle}>🐾 Mascota</Text>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Nombre:</Text>
                    <Text style={styles.detailValue}>{selectedBooking.petName || 'No especificado'}</Text>
                  </View>
                </View>

                {/* Appointment Information */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Cita</Text>
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
                    <Badge label={getStatusText(selectedBooking.status)} tone={getStatusTone(selectedBooking.status)} size="small" />
                  </View>
                </View>

                {/* Payment Information */}
                {(selectedBooking.paymentStatus || selectedBooking.paymentMethod || selectedBooking.totalAmount) && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Pago</Text>
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
                    <Text style={styles.detailSectionTitle}>Notas del cliente</Text>
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesText}>{selectedBooking.notes}</Text>
                    </View>
                  </View>
                )}

                {/* Timestamps */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Registro</Text>
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
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 70,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  placeholder: {
    width: 32,
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: colors.textTertiary,
    textAlign: 'center',
  },
  activeTabText: {
    color: colors.primary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textTertiary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  bookingCard: {
    marginBottom: spacing.md,
    marginHorizontal: spacing.xs,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
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
  pendingActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    gap: 6,
  },
  rejectButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.surface,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    gap: 6,
  },
  confirmButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.surface,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    gap: 6,
    marginBottom: spacing.sm,
  },
  completeButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.surface,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  viewButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: colors.primary,
    marginLeft: spacing.xs,
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
  },
  paidBadge: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: colors.success,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: colors.text,
  },
  modalCloseText: {
    fontSize: 18,
    color: colors.textTertiary,
  },
  modalBody: {
    flex: 1,
    marginBottom: spacing.xl,
  },
  detailSection: {
    marginBottom: spacing.xl,
  },
  detailSectionTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  detailLabel: {
    ...typography.label,
    color: colors.textTertiary,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    flex: 2,
    textAlign: 'right',
  },
  statusBadgeInModal: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    alignSelf: 'flex-end',
  },
  statusTextInModal: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  notesContainer: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  modalActions: {
    paddingTop: 10,
  },
});
