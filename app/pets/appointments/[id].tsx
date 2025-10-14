import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Clock, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Star, MessageSquare, Send } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { supabaseClient, getPet } from '@/lib/supabase';

export default function PetAppointments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  const [pet, setPet] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [existingReviews, setExistingReviews] = useState<{[key: string]: any}>({});

  useEffect(() => {
    if (!id) return;
    
    fetchPetDetails();
    fetchAppointments();
  }, [id]);

  const fetchPetDetails = async () => {
    try {
      const petData = await getPet(id as string);
      setPet(petData);
    } catch (error) {
      console.error('Error fetching pet details:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      const { data: appointmentsData, error } = await supabaseClient
        .from('bookings')
        .select('*')
        .eq('pet_id', id)
        .order('date', { ascending: true });
      
      if (error) throw error;
      
      const formattedAppointments = appointmentsData?.map(appointment => ({
        ...appointment,
        date: appointment.date ? new Date(appointment.date) : new Date(),
        serviceName: appointment.service_name,
        partnerName: appointment.partner_name,
        totalAmount: appointment.total_amount,
      })) || [];
      
      setAppointments(formattedAppointments);
      
      // Fetch existing reviews for completed appointments
      await fetchExistingReviews(formattedAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingReviews = async (appointments: any[]) => {
    try {
      const completedAppointments = appointments.filter(apt => apt.status === 'completed');
      if (completedAppointments.length === 0) return;
      
      const bookingIds = completedAppointments.map(apt => apt.id);
      
      // Validate that all booking IDs are valid UUIDs
      const validBookingIds = bookingIds.filter(id => {
        // More strict validation
        if (!id || typeof id !== 'string' || id.length === 0) {
          console.log('Invalid booking ID (empty or not string):', id);
          return false;
        }
        
        // Filter out obviously invalid values
        const invalidValues = ['booking', 'undefined', 'null', 'temp-', 'order_'];
        if (invalidValues.some(invalid => id.includes(invalid))) {
          console.log('Invalid booking ID (contains invalid pattern):', id);
          return false;
        }
        
        // Check if it's a valid UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const isValidUUID = uuidRegex.test(id);
        
        if (!isValidUUID) {
          console.log('Invalid booking ID (not UUID format):', id);
        }
        
        return isValidUUID;
      });
      
      if (validBookingIds.length === 0) {
        console.log('No valid booking IDs found for reviews');
        return;
      }
      
      console.log('Valid booking IDs for reviews:', validBookingIds);
      
      const { data: reviews, error } = await supabaseClient
        .from('service_reviews')
        .select('*')
        .in('booking_id', validBookingIds);
      
      if (error) {
        console.error('Error fetching reviews:', error);
        return; // Don't throw, just return
      }
      
      const reviewsMap: {[key: string]: any} = {};
      reviews?.forEach(review => {
        reviewsMap[review.booking_id] = review;
      });
      
      setExistingReviews(reviewsMap);
    } catch (error) {
      console.error('Error fetching existing reviews:', error);
    }
  };

  const handleAddReview = (appointment: any) => {
    setSelectedAppointment(appointment);
    setRating(0);
    setReviewComment('');
    setShowReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedAppointment || rating === 0) {
      Alert.alert('Error', 'Por favor selecciona una calificación');
      return;
    }

    setSubmittingReview(true);
    try {
      const reviewData = {
        booking_id: selectedAppointment.id,
        partner_id: selectedAppointment.partner_id,
        service_id: selectedAppointment.service_id,
        customer_id: currentUser!.id,
        pet_id: selectedAppointment.pet_id,
        rating: rating,
        comment: reviewComment.trim() || null,
      };

      const { error } = await supabaseClient
        .from('service_reviews')
        .insert(reviewData);

      if (error) throw error;

      // Update local state
      setExistingReviews(prev => ({
        ...prev,
        [selectedAppointment.id]: {
          ...reviewData,
          id: 'temp-' + Date.now(),
          created_at: new Date().toISOString()
        }
      }));

      setShowReviewModal(false);
      Alert.alert('Éxito', 'Reseña enviada correctamente');
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', 'No se pudo enviar la reseña');
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderStarRating = (currentRating: number, onPress?: (rating: number) => void, size: number = 24) => {
    return (
      <View style={styles.starRating}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onPress && onPress(star)}
            disabled={!onPress}
          >
            <Star
              size={size}
              color={star <= currentRating ? '#F59E0B' : '#E5E7EB'}
              fill={star <= currentRating ? '#F59E0B' : 'none'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <AlertCircle size={16} color="#92400E" />;
      case 'confirmed': return <CheckCircle size={16} color="#065F46" />;
      case 'completed': return <CheckCircle size={16} color="#1E40AF" />;
      case 'cancelled': return <AlertCircle size={16} color="#991B1B" />;
      default: return <Clock size={16} color="#374151" />;
    }
  };

  const filteredAppointments = appointments.filter(appointment => {
    const now = new Date();
    if (activeTab === 'upcoming') {
      return appointment.date >= now || appointment.status === 'pending' || appointment.status === 'confirmed';
    } else {
      return appointment.date < now || appointment.status === 'completed' || appointment.status === 'cancelled';
    }
  });

  const handleBookAppointment = () => {
    router.push('/(tabs)/services');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Citas</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando citas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Citas</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.petInfo}>
        <Text style={styles.petName}>{pet?.name || 'Mascota'}</Text>
        <Text style={styles.petBreed}>{pet?.breed || 'Raza no especificada'}</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            Próximas Citas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
            Historial
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.appointmentsCard}>
          <View style={styles.calendarHeader}>
            <Calendar size={20} color="#3B82F6" />
            <Text style={styles.calendarTitle}>
              {activeTab === 'upcoming' ? 'Próximas Citas' : 'Historial de Citas'}
            </Text>
          </View>

          {filteredAppointments.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                No hay {activeTab === 'upcoming' ? 'próximas citas' : 'historial de citas'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'upcoming' 
                  ? 'Programa una cita para tu mascota' 
                  : 'Las citas completadas aparecerán aquí'}
              </Text>
              {activeTab === 'upcoming' && (
                <Button
                  title="Reservar Cita"
                  onPress={handleBookAppointment}
                  size="medium"
                />
              )}
            </View>
          ) : (
            <View>
              {filteredAppointments.map((appointment) => (
                <View key={appointment.id} style={styles.appointmentItem}>
                  <View style={styles.appointmentHeader}>
                    <Text style={styles.appointmentService}>{appointment.serviceName}</Text>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(appointment.status) }
                    ]}>
                      {getStatusIcon(appointment.status)}
                      <Text style={[
                        styles.statusText,
                        { color: getStatusTextColor(appointment.status) }
                      ]}>
                        {getStatusText(appointment.status)}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.appointmentProvider}>{appointment.partnerName}</Text>
                  
                  <View style={styles.appointmentDetails}>
                    <View style={styles.appointmentDetail}>
                      <Calendar size={16} color="#6B7280" />
                      <Text style={styles.appointmentDetailText}>
                        {appointment.date.toLocaleDateString()}
                      </Text>
                    </View>
                    
                    <View style={styles.appointmentDetail}>
                      <Clock size={16} color="#6B7280" />
                      <Text style={styles.appointmentDetailText}>
                        {appointment.time}
                      </Text>
                    </View>
                  </View>
                  
                  {appointment.notes && (
                    <Text style={styles.appointmentNotes}>
                      Notas: {appointment.notes}
                    </Text>
                  )}
                  
                  {/* Review section for completed appointments */}
                  {appointment.status === 'completed' && (
                    <View style={styles.reviewSection}>
                      {existingReviews[appointment.id] ? (
                        <View style={styles.existingReview}>
                          <Text style={styles.reviewTitle}>Tu reseña:</Text>
                          {renderStarRating(existingReviews[appointment.id].rating, undefined, 20)}
                          {existingReviews[appointment.id].comment && (
                            <Text style={styles.reviewComment}>
                              {existingReviews[appointment.id].comment}
                            </Text>
                          )}
                          <Text style={styles.reviewDate}>
                            {new Date(existingReviews[appointment.id].created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity 
                          style={styles.addReviewButton}
                          onPress={() => handleAddReview(appointment)}
                        >
                          <Star size={16} color="#F59E0B" />
                          <Text style={styles.addReviewText}>Agregar reseña</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </Card>
        
        {activeTab === 'upcoming' && (
          <View style={styles.bookButtonContainer}>
            <Button
              title="Reservar Nueva Cita"
              onPress={handleBookAppointment}
              size="large"
            />
          </View>
        )}
      </ScrollView>

      {/* Review Modal */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Calificar Servicio</Text>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedAppointment && (
              <View style={styles.appointmentInfo}>
                <Text style={styles.appointmentServiceName}>
                  {selectedAppointment.serviceName}
                </Text>
                <Text style={styles.appointmentPartnerName}>
                  {selectedAppointment.partnerName}
                </Text>
              </View>
            )}

            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>Calificación *</Text>
              {renderStarRating(rating, setRating, 32)}
            </View>

            <View style={styles.commentSection}>
              <Text style={styles.commentLabel}>Comentario (opcional)</Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Comparte tu experiencia con este servicio..."
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalActions}>
              <View style={styles.modalButtonsContainer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowReviewModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    rating === 0 && styles.disabledSubmitButton
                  ]}
                  onPress={handleSubmitReview}
                  disabled={rating === 0 || submittingReview}
                >
                  <Text style={[
                    styles.submitButtonText,
                    rating === 0 && styles.disabledSubmitButtonText
                  ]}>
                    {submittingReview ? 'Enviando...' : 'Enviar Reseña'}
                  </Text>
                </TouchableOpacity>
              </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  petInfo: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  petName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  petBreed: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
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
    fontSize: 14,
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
  appointmentsCard: {
    marginBottom: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  appointmentItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  appointmentService: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    marginLeft: 4,
  },
  appointmentProvider: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 8,
  },
  appointmentDetails: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  appointmentDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  appointmentDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 6,
  },
  appointmentNotes: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontStyle: 'italic',
  },
  bookButtonContainer: {
    marginBottom: 24,
  },
  reviewSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  existingReview: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
  },
  reviewTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  reviewComment: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  addReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  addReviewText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#92400E',
    marginLeft: 6,
  },
  starRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
  appointmentInfo: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  appointmentServiceName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  appointmentPartnerName: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  ratingSection: {
    marginBottom: 20,
  },
  ratingLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 12,
  },
  commentSection: {
    marginBottom: 24,
  },
  commentLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    minHeight: 100,
  },
  modalActions: {
    marginTop: 24,
  },
  modalButtonsContainer: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2D6A6F',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#2D6A6F',
  },
  submitButton: {
    backgroundColor: '#2D6A6F',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  disabledSubmitButton: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  disabledSubmitButtonText: {
    color: '#D1D5DB',
  },
});