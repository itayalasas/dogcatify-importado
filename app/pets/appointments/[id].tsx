import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal, TextInput, Platform, Keyboard, Pressable, Dimensions, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { X, Calendar, Clock, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Star, MessageSquare, Send } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { supabaseClient, getPet } from '@/lib/supabase';
import { colors, spacing, radius, fontSize } from '../../../constants/theme';
import { HealthHeader } from '../../../components/health';
import { toast } from '../../../components/ui/Toast';
import { Badge, BadgeTone, EmptyState, IconButton, SegmentedControl, SkeletonList } from '../../../components/ui';

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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchPetDetails(), fetchAppointments()]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    
    fetchPetDetails();
    fetchAppointments();
  }, [id]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates?.height || 0);
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const getAppointmentDateTime = (appointment: any) => {
    const baseDate = appointment.date ? new Date(appointment.date) : new Date();
    const appointmentDateTime = new Date(baseDate);

    if (appointment.time && typeof appointment.time === 'string') {
      const timeMatch = appointment.time.match(/^(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        appointmentDateTime.setHours(hours, minutes, 0, 0);
      }
    } else {
      appointmentDateTime.setHours(23, 59, 59, 999);
    }

    return appointmentDateTime;
  };

  const isExpiredAppointment = (appointment: any) => {
    if (!appointment) return false;

    const activeStatuses = ['pending', 'confirmed'];
    if (!activeStatuses.includes(appointment.status)) {
      return false;
    }

    return getAppointmentDateTime(appointment) < new Date();
  };

  const normalizeAppointmentStatus = (appointment: any) => {
    if (isExpiredAppointment(appointment)) {
      return {
        ...appointment,
        status: 'completed',
      };
    }

    return appointment;
  };

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

      const expiredAppointments = formattedAppointments.filter(isExpiredAppointment);
      if (expiredAppointments.length > 0) {
        const expiredIds = expiredAppointments.map(appointment => appointment.id);
        const { error: expiredUpdateError } = await supabaseClient
          .from('bookings')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .in('id', expiredIds);

        if (expiredUpdateError) {
          console.error('Error updating expired appointments:', expiredUpdateError);
        }
      }

      const normalizedAppointments = formattedAppointments.map(normalizeAppointmentStatus);

      setAppointments(normalizedAppointments);
      
      // Fetch existing reviews for completed appointments
      await fetchExistingReviews(normalizedAppointments);
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
      Alert.alert('Error', 'Elegí una calificación');
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
      toast.success('¡Gracias por tu reseña!');
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
            style={onPress ? styles.starButton : undefined}
            accessibilityRole={onPress ? 'button' : 'image'}
            accessibilityLabel={onPress ? `${star} ${star === 1 ? 'estrella' : 'estrellas'}` : undefined}
            accessibilityState={onPress ? { selected: star <= currentRating } : undefined}
          >
            <Star
              size={size}
              color={star <= currentRating ? colors.warning : colors.border}
              fill={star <= currentRating ? colors.warning : 'none'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return colors.warningSoft;
      case 'confirmed': return colors.successSoft;
      case 'completed': return colors.primaryMuted;
      case 'cancelled': return colors.dangerSoft;
      default: return colors.surfaceAlt;
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'pending': return colors.warning;
      case 'confirmed': return colors.success;
      case 'completed': return colors.primaryStrong;
      case 'cancelled': return colors.danger;
      default: return colors.textSecondary;
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <AlertCircle size={14} color={colors.warning} />;
      case 'confirmed': return <CheckCircle size={14} color={colors.success} />;
      case 'completed': return <CheckCircle size={14} color={colors.primary} />;
      case 'cancelled': return <AlertCircle size={14} color={colors.danger} />;
      default: return <Clock size={14} color={colors.textSecondary} />;
    }
  };

  const filteredAppointments = appointments.filter(appointment => {
    const now = new Date();
    const appointmentDateTime = getAppointmentDateTime(appointment);

    if (activeTab === 'upcoming') {
      return appointmentDateTime >= now && ['pending', 'confirmed'].includes(appointment.status);
    } else {
      return appointmentDateTime < now || ['completed', 'cancelled'].includes(appointment.status);
    }
  });

  const handleBookAppointment = () => {
    router.push('/(tabs)/services');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <HealthHeader title="Citas" />
        <SkeletonList kind="cards" count={3} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <HealthHeader title="Citas" />

      <View style={styles.petInfo}>
        <Text style={styles.petName}>{pet?.name || 'Mascota'}</Text>
        <Text style={styles.petBreed}>{pet?.breed || 'Raza no especificada'}</Text>
      </View>

      <View style={styles.segmentWrapper}>
        <SegmentedControl
          options={[
            { value: 'upcoming', label: 'Próximas' },
            { value: 'past', label: 'Historial' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <Card style={styles.appointmentsCard}>
          <View style={styles.calendarHeader}>
            <Calendar size={20} color={colors.primary} />
            <Text style={styles.calendarTitle}>
              {activeTab === 'upcoming' ? 'Próximas citas' : 'Historial de citas'}
            </Text>
          </View>

          {filteredAppointments.length === 0 ? (
            <EmptyState
              icon={<Calendar size={32} color={colors.primary} />}
              title={activeTab === 'upcoming' ? 'No hay próximas citas' : 'Todavía no hay historial'}
              description={activeTab === 'upcoming'
                ? 'Reservá una cita para tu mascota con un profesional de confianza.'
                : 'Las citas completadas van a aparecer acá.'}
              actionLabel={activeTab === 'upcoming' ? 'Reservar cita' : undefined}
              onAction={activeTab === 'upcoming' ? handleBookAppointment : undefined}
            />
          ) : (
            <View>
              {filteredAppointments.map((appointment) => (
                <View key={appointment.id} style={styles.appointmentItem}>
                  <View style={styles.appointmentHeader}>
                    <Text style={styles.appointmentService}>{appointment.serviceName}</Text>
                    <Badge
                      label={getStatusText(appointment.status)}
                      tone={getStatusTone(appointment.status)}
                      icon={getStatusIcon(appointment.status)}
                      size="small"
                    />
                  </View>
                  
                  <Text style={styles.appointmentProvider}>{appointment.partnerName}</Text>
                  
                  <View style={styles.appointmentDetails}>
                    <View style={styles.appointmentDetail}>
                      <Calendar size={16} color={colors.textSecondary} />
                      <Text style={styles.appointmentDetailText}>
                        {appointment.date.toLocaleDateString('es-UY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    
                    <View style={styles.appointmentDetail}>
                      <Clock size={16} color={colors.textSecondary} />
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
                          accessibilityRole="button"
                        >
                          <Star size={16} color={colors.warning} />
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
              title="Reservar nueva cita"
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
        <Pressable
          style={[
            styles.modalOverlay,
            keyboardHeight > 0 ? styles.modalOverlayKeyboardVisible : styles.modalOverlayCentered,
          ]}
          onPress={Keyboard.dismiss}
        >
            <Pressable
              style={[
                styles.modalContent,
                keyboardHeight > 0 && {
                  maxHeight: Dimensions.get('window').height - keyboardHeight - 48,
                },
              ]}
              onPress={(event) => event.stopPropagation()}
            >
              <ScrollView
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                showsVerticalScrollIndicator={false}
              >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Calificar servicio</Text>
              <IconButton
                icon={<X size={22} color={colors.textSecondary} />}
                onPress={() => setShowReviewModal(false)}
                accessibilityLabel="Cerrar"
              />
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
                placeholder="Contá tu experiencia con este servicio..."
                placeholderTextColor={colors.placeholder}
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>

            <View style={styles.modalActions}>
              <View style={styles.modalButtonsContainer}>
                <Button
                  title="Cancelar"
                  variant="outline"
                  onPress={() => setShowReviewModal(false)}
                  fullWidth={false}
                  style={styles.modalButton}
                />
                <Button
                  title="Enviar reseña"
                  onPress={handleSubmitReview}
                  disabled={rating === 0}
                  loading={submittingReview}
                  fullWidth={false}
                  style={styles.modalButton}
                />
              </View>
            </View>
              </ScrollView>
            </Pressable>
          </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  segmentWrapper: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  starButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButton: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  title: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  placeholder: {
    width: 32,
  },
  petInfo: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0,
    borderBottomColor: colors.border,
  },
  petName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: colors.text,
  },
  petBreed: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
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
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.primary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  appointmentsCard: {
    marginBottom: spacing.lg,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  calendarTitle: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  appointmentItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  appointmentService: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    marginLeft: spacing.xs,
  },
  appointmentProvider: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  appointmentDetails: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  appointmentDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  appointmentDetailText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginLeft: 6,
  },
  appointmentNotes: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  bookButtonContainer: {
    marginBottom: spacing.xxl,
  },
  reviewSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
  },
  existingReview: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  reviewTitle: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  reviewComment: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  reviewDate: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  addReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  addReviewText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Medium',
    color: colors.warning,
    marginLeft: 6,
  },
  starRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalOverlayCentered: {
    justifyContent: 'center',
  },
  modalOverlayKeyboardVisible: {
    justifyContent: 'flex-start',
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.md,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
  },
  modalScrollContent: {
    paddingBottom: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-Bold',
    color: colors.text,
  },
  modalCloseText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
  },
  appointmentInfo: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
  },
  appointmentServiceName: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  appointmentPartnerName: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  ratingSection: {
    marginBottom: spacing.xl,
  },
  ratingLabel: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  commentSection: {
    marginBottom: spacing.xxl,
  },
  commentLabel: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.text,
    minHeight: 100,
  },
  modalActions: {
    marginTop: spacing.xxl,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  cancelButtonText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Medium',
    color: colors.primary,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  disabledSubmitButton: {
    backgroundColor: colors.textTertiary,
  },
  submitButtonText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Medium',
    color: colors.white,
  },
  disabledSubmitButtonText: {
    color: colors.borderStrong,
  },
});
