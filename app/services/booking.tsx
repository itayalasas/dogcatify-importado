import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Clock, Check } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '@/lib/supabase';
import { NotificationService } from '../../utils/notifications';
import { PaymentModal } from '../../components/PaymentModal';

export default function ServiceBooking() {
  const { serviceId, partnerId, petId } = useLocalSearchParams<{ 
    serviceId: string;
    partnerId: string;
    petId: string;
  }>();
  
  const { currentUser } = useAuth();
  const [service, setService] = useState<any>(null);
  const [pet, setPet] = useState<any>(null);
  const [partnerInfo, setPartnerInfo] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<{[key: string]: string[]}>({});
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    console.log('ServiceBooking - Received params:', { serviceId, partnerId, petId });
    
    // Validate all required parameters
    if (!serviceId || !partnerId || !petId) {
      console.error('Missing required parameters:', { serviceId, partnerId, petId });
      Alert.alert('Error', 'Información incompleta para la reserva', [
        { text: 'OK', onPress: () => router.back() }
      ]);
      return;
    }
    
    if (!currentUser) {
      console.error('No current user');
      Alert.alert('Error', 'Debes iniciar sesión para hacer una reserva', [
        { text: 'OK', onPress: () => router.replace('/auth/login') }
      ]);
      return;
    }
    
    // Validate UUID formats
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(serviceId) || !uuidRegex.test(partnerId) || !uuidRegex.test(petId)) {
      console.error('Invalid UUID format in booking params:', { serviceId, partnerId, petId });
      Alert.alert('Error', 'Datos de identificación inválidos', [
        { text: 'OK', onPress: () => router.back() }
      ]);
      return;
    }
    
    fetchData();
  }, [serviceId, partnerId, petId, currentUser]);

  const fetchData = async () => {
    try {
      // Fetch service details using Supabase
      const { data: serviceData, error: serviceError } = await supabaseClient
        .from('partner_services')
        .select('*')
        .eq('id', serviceId)
        .single();
      
      if (serviceError) throw serviceError;
      
      if (serviceData) {
        setService({
          id: serviceData.id,
          name: serviceData.name,
          description: serviceData.description,
          price: serviceData.price,
          duration: serviceData.duration,
          category: serviceData.category,
          partnerId: serviceData.partner_id,
        });
      }
      
      // Fetch pet details using Supabase
      const { data: petData, error: petError } = await supabaseClient
        .from('pets')
        .select('*')
        .eq('id', petId)
        .single();
      
      if (petError) throw petError;
      
      if (petData) {
        setPet({
          id: petData.id,
          name: petData.name,
          breed: petData.breed,
          photoURL: petData.photo_url,
        });
      }
      
      // Fetch partner details using Supabase
      const { data: partnerData, error: partnerError } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('id', partnerId)
        .single();
      
      if (partnerError) throw partnerError;
      
      if (partnerData) {
        setPartnerInfo({
          id: partnerData.id,
          businessName: partnerData.business_name,
          businessType: partnerData.business_type,
          logo: partnerData.logo,
        });
      }
      
      // Fetch partner schedule using Supabase
      const { data: scheduleData, error: scheduleError } = await supabaseClient
        .from('business_schedule')
        .select('*')
        .eq('partner_id', partnerId)
        .eq('is_active', true);
      
      if (scheduleError) throw scheduleError;
      
      const formattedSchedule = scheduleData?.map(item => ({
        id: item.id,
        partnerId: item.partner_id,
        dayOfWeek: item.day_of_week,
        startTime: item.start_time,
        endTime: item.end_time,
        slotDuration: item.slot_duration,
        maxSlots: item.max_slots,
        isActive: item.is_active,
      })) || [];
      
      setSchedule(formattedSchedule);

      // Fetch existing bookings to block time slots
      await fetchExistingBookings();
      
      // Set default selected date to the first available day
      if (scheduleData.length > 0) {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        // Find the next available day in the schedule
        const availableDays = scheduleData.map(item => item.day_of_week);
        let nextDay = dayOfWeek;
        let daysToAdd = 0;
        
        while (!availableDays.includes(nextDay)) {
          nextDay = (nextDay + 1) % 7;
          daysToAdd++;
          if (daysToAdd > 7) break; // Prevent infinite loop
        }
        
        if (daysToAdd <= 7) {
          const nextDate = new Date();
          nextDate.setDate(today.getDate() + daysToAdd);
          setSelectedDate(nextDate);
          
          // Generate available times for this date
          generateAvailableTimes(nextDate, scheduleData);
        }
      }
    } catch (error) {
      console.error('Error fetching booking data:', error);
      Alert.alert('Error', 'No se pudo cargar la información para la reserva');
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingBookings = async () => {
    try {
      // Get the next 14 days for checking bookings
      const today = new Date();
      const twoWeeksLater = new Date(today);
      twoWeeksLater.setDate(today.getDate() + 14);
      
      // Fetch existing bookings using Supabase
      const { data: bookingsData, error } = await supabaseClient
        .from('bookings')
        .select('*')
        .eq('partner_id', partnerId)
        .in('status', ['pending', 'confirmed'])
        .gte('date', today.toISOString())
        .lte('date', twoWeeksLater.toISOString());
      
      if (error) throw error;
      
      const formattedBookings = bookingsData?.map(booking => ({
        id: booking.id,
        partnerId: booking.partner_id,
        serviceId: booking.service_id,
        serviceDuration: booking.service_duration,
        date: new Date(booking.date),
        time: booking.time,
        status: booking.status,
      })) || [];
      
      // Organize bookings by date and time
      const bookedSlotsMap: {[key: string]: string[]} = {};
      
      formattedBookings.forEach(booking => {
        const bookingDate = booking.date.toDateString();
        const bookingTime = booking.time;
        const serviceDuration = booking.serviceDuration || 60; // Default to 60 minutes if not specified
        
        if (!bookedSlotsMap[bookingDate]) {
          bookedSlotsMap[bookingDate] = [];
        }
        
        // Add the booked time slot
        bookedSlotsMap[bookingDate].push(bookingTime);
        
        // Also block subsequent time slots based on service duration
        if (serviceDuration > 60) {
          const numSlotsToBlock = Math.ceil(serviceDuration / 60) - 1;
          const [hours, minutes] = bookingTime.split(':').map(Number);
          
          for (let i = 1; i <= numSlotsToBlock; i++) {
            const nextHour = hours + i;
            if (nextHour < 24) { // Ensure we don't go past midnight
              const nextTimeSlot = `${nextHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
              bookedSlotsMap[bookingDate].push(nextTimeSlot);
            }
          }
        }
      });
      
      setBookedSlots(bookedSlotsMap);
    } catch (error) {
      console.error('Error fetching existing bookings:', error);
    }
  };

  const generateAvailableTimes = (date: Date, scheduleData: any[]) => {
    const dayOfWeek = date.getDay();
    const daySchedule = scheduleData.find(item => item.day_of_week === dayOfWeek);
    
    if (!daySchedule) { 
      setAvailableTimes([]);
      return;
    }
    
    const { start_time, end_time, slot_duration } = daySchedule;
    const times: string[] = [];
    
    // Parse start and end times
    const [startHour, startMinute] = start_time.split(':').map(Number);
    const [endHour, endMinute] = end_time.split(':').map(Number);
    
    // Convert to minutes for easier calculation
    let currentMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    // Generate time slots
    while (currentMinutes + (service?.duration || slot_duration) <= endMinutes) {
      const hour = Math.floor(currentMinutes / 60);
      const minute = currentMinutes % 60; 
      const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // Check if this time slot is already booked
      const dateString = date.toDateString();
      const isBooked = bookedSlots[dateString]?.includes(timeSlot);

      // Check if subsequent slots needed for this service duration are available
      let hasConflict = false;
      if (service && service.duration > slot_duration) {
        const slotsNeeded = Math.ceil(service.duration / slot_duration);
        for (let i = 1; i < slotsNeeded; i++) {
          const nextSlotMinutes = currentMinutes + (i * slot_duration);
          if (nextSlotMinutes > endMinutes) {
            hasConflict = true;
            break;
          }
          const nextHour = Math.floor(nextSlotMinutes / 60);
          const nextMinute = nextSlotMinutes % 60;
          const nextTimeSlot = `${nextHour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`;
          if (bookedSlots[dateString]?.includes(nextTimeSlot)) {
            hasConflict = true;
            break;
          }
        }
      }
      
      if (!isBooked && !hasConflict) times.push(timeSlot);
      
      currentMinutes += slot_duration;
    }
    
    setAvailableTimes(times);
    setSelectedTime(null); // Reset selected time when date changes
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    generateAvailableTimes(date, schedule); 
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleBookService = async () => {
    if (!currentUser || !selectedDate || !selectedTime) {
      Alert.alert('Error', 'Por favor selecciona fecha y hora para la reserva');
      return;
    }
    
    // Show payment modal instead of direct booking
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async (paymentResult: any) => {
    console.log('Payment successful:', paymentResult);
    setBookingLoading(true);
    try {
      if (!currentUser || !selectedDate || !selectedTime || !service || !pet || !partnerInfo) {
        throw new Error('Información incompleta para crear la reserva');
      }
      
      // Create booking date by combining selected date and time
      const bookingDate = new Date(selectedDate);
      const [hours, minutes] = selectedTime!.split(':').map(Number);
      bookingDate.setHours(hours, minutes, 0, 0);
      
      // Calculate end time based on service duration
      const serviceDuration = service.duration || 60;
      const endDate = new Date(bookingDate);
      endDate.setMinutes(endDate.getMinutes() + serviceDuration);
      
      // Format time for display
      const formatTime = (date: Date) => {
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      };
      
      const bookingData = {
        partner_id: partnerId,
        service_id: serviceId,
        service_name: service.name,
        service_duration: service.duration || 60,
        partner_name: partnerInfo?.businessName || 'Proveedor',
        customer_id: currentUser.id,
        customer_name: currentUser.displayName || 'Usuario',
        customer_email: currentUser.email,
        customer_phone: currentUser.phone || null,
        pet_id: petId,
        pet_name: pet.name,
        date: bookingDate.toISOString(),
        time: formatTime(bookingDate),
        end_time: formatTime(endDate),
        status: 'confirmed', // Auto-confirm when payment is successful
        total_amount: service.price,
        payment_status: 'paid',
        payment_method: 'credit_card',
        payment_transaction_id: paymentResult.transactionId,
        payment_confirmed_at: new Date().toISOString(),
        notes: notes.trim() || null,
        created_at: new Date().toISOString(),
      };
      
      console.log('Final booking data:', bookingData);
      
      // Insert booking using Supabase
      const { error } = await supabaseClient
        .from('bookings')
        .insert([bookingData]);
      
      if (error) {
        console.error('Supabase booking insert error:', error);
        throw new Error(`Error al crear la reserva: ${error.message || error.details || 'Error desconocido'}`);
      }
      
      console.log('Booking created successfully');
      
      // Block the time slots in the bookedSlots state
      const dateString = selectedDate.toDateString();
      if (!bookedSlots[dateString]) {
        bookedSlots[dateString] = [];
      }
      
      // Block all time slots that overlap with this booking
      const numSlotsToBlock = Math.ceil(serviceDuration / 60);
      for (let i = 0; i < numSlotsToBlock; i++) {
        const slotTime = new Date(bookingDate);
        slotTime.setHours(slotTime.getHours() + i);
        const timeSlot = formatTime(slotTime);
        bookedSlots[dateString].push(timeSlot);
      }
      
      setBookedSlots({...bookedSlots});
      
      // Send booking confirmation email
      try {
        console.log('Sending booking confirmation email...');
        await NotificationService.sendBookingConfirmationEmail(
          currentUser.email,
          currentUser.displayName || 'Usuario',
          service.name,
          partnerInfo?.businessName || 'Proveedor',
          selectedDate.toLocaleDateString(),
          selectedTime!,
          pet.name
        );
        console.log('Booking confirmation email sent successfully');
      } catch (emailError) {
        console.error('Error sending booking confirmation email:', emailError);
        // Continue with booking process even if email fails
      }
      
      Alert.alert(
        'Reserva Exitosa',
        `¡Perfecto! Tu reserva ha sido confirmada automáticamente.\n\n📅 ${selectedDate.toLocaleDateString()} a las ${selectedTime}\n💰 Pago: ${formatPrice(service?.price || 0)}\n\nEl proveedor ha sido notificado y recibirás un correo de confirmación.`,
        [{ text: 'OK', onPress: () => router.push('/(tabs)') }]
      );
    } catch (error) {
      console.error('Error creating booking:', error);
      
      let errorMessage = 'No se pudo crear la reserva';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      Alert.alert(
        'Error al crear reserva', 
        `${errorMessage}\n\nPor favor intenta nuevamente o contacta con soporte si el problema persiste.`,
        [
          { text: 'Reintentar', onPress: () => setShowPaymentModal(true) },
          { text: 'Cancelar', style: 'cancel' }
        ]
      );
    } finally {
      setBookingLoading(false);
      setShowPaymentModal(false);
    }
  };

  const generateDateOptions = () => {
    const dates = [];
    const today = new Date();
    
    // Generate dates for the next 14 days
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      // Check if this day of week is in the schedule
      const dayOfWeek = date.getDay();
      const isAvailable = schedule.some(item => item.dayOfWeek === dayOfWeek);
      
      dates.push({ date, isAvailable });
    }
    
    return dates;
  };

  const formatDate = (date: Date) => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return {
      day: days[date.getDay()],
      date: date.getDate(),
      month: date.toLocaleString('es-ES', { month: 'short' }),
      isToday: date.toDateString() === new Date().toDateString(),
    };
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(price);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando información de reserva...</Text>
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
        <Text style={styles.title}>Reservar Servicio</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Service Summary */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            {partnerInfo?.logo ? (
              <Image source={{ uri: partnerInfo.logo }} style={styles.businessLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>
                  {partnerInfo?.businessType === 'veterinary' ? '🏥' : 
                   partnerInfo?.businessType === 'grooming' ? '✂️' : 
                   partnerInfo?.businessType === 'walking' ? '🚶' : 
                   partnerInfo?.businessType === 'boarding' ? '🏠' : 
                   partnerInfo?.businessType === 'shop' ? '🛍️' : '🏢'}
                </Text>
              </View>
            )}
            
            <View style={styles.summaryInfo}>
              <Text style={styles.businessName}>{partnerInfo?.businessName || 'Negocio'}</Text>
              <Text style={styles.serviceName}>{service?.name || 'Servicio'}</Text>
              <Text style={styles.servicePrice}>
                {service?.price ? formatPrice(service.price) : '$0.00'}
              </Text>
            </View>
          </View>
          
          <View style={styles.petInfo}>
            <Text style={styles.petInfoTitle}>Mascota seleccionada:</Text>
            <View style={styles.petRow}>
              <Image source={{ uri: pet?.photoURL }} style={styles.petImage} />
              <View style={styles.petDetails}>
                <Text style={styles.petName}>{pet?.name || 'Mascota'}</Text>
                <Text style={styles.petBreed}>{pet?.breed || 'Raza no especificada'}</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Date Selection */}
        <Card style={styles.dateCard}>
          <Text style={styles.sectionTitle}>Selecciona una fecha</Text>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.dateScroll}
          >
            {generateDateOptions().map(({ date, isAvailable }, index) => {
              const formattedDate = formatDate(date);
              const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dateOption,
                    !isAvailable && styles.unavailableDate,
                    isSelected && styles.selectedDate
                  ]}
                  onPress={() => isAvailable && handleDateSelect(date)}
                  disabled={!isAvailable}
                >
                  <Text style={[
                    styles.dayText,
                    isSelected && styles.selectedDateText
                  ]}>
                    {formattedDate.day}
                  </Text>
                  <Text style={[
                    styles.dateText,
                    isSelected && styles.selectedDateText,
                    formattedDate.isToday && styles.todayText
                  ]}>
                    {formattedDate.date}
                  </Text>
                  <Text style={[
                    styles.monthText,
                    isSelected && styles.selectedDateText
                  ]}>
                    {formattedDate.month}
                  </Text>
                  
                  {formattedDate.isToday && (
                    <View style={styles.todayBadge}>
                      <Text style={styles.todayBadgeText}>Hoy</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Card>

        {/* Time Selection */}
        {selectedDate && (
          <Card style={styles.timeCard}>
            <Text style={styles.sectionTitle}>Selecciona una hora</Text>
            
            {availableTimes.length === 0 ? (
              <Text style={styles.noTimesText}>
                No hay horarios disponibles para esta fecha
              </Text>
            ) : (
              <View style={styles.timeGrid}>
                {availableTimes.map((time, index) => {
                  const isSelected = time === selectedTime;
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.timeOption,
                        isSelected && styles.selectedTime
                      ]}
                      onPress={() => handleTimeSelect(time)}
                    >
                      <Clock 
                        size={16} 
                        color={isSelected ? '#FFFFFF' : '#6B7280'} 
                      />
                      <Text style={[
                        styles.timeText,
                        isSelected && styles.selectedTimeText
                      ]}>
                        {time}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Card>
        )}

        {/* Notes */}
        <Card style={styles.notesCard}>
          <Text style={styles.sectionTitle}>Notas para el proveedor</Text>
          <Input
            placeholder="Agrega cualquier información adicional para el proveedor..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </Card>
        
        <View style={styles.bookingButtonContainer}>
          <Button
            title="Confirmar Reserva"
            onPress={handleBookService}
            loading={bookingLoading}
            size="large"
            disabled={!selectedDate || !selectedTime}
          />
        </View>
      </ScrollView>

      {/* Payment Modal */}
      <PaymentModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
        paymentData={{
          serviceName: service?.name || 'Servicio',
          providerName: partnerInfo?.businessName || 'Proveedor',
          price: service?.price || 0,
          hasShipping: false,
          petName: pet?.name,
          date: selectedDate?.toLocaleDateString(),
          time: selectedTime || ''
        }}
      />
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
  summaryCard: {
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  businessLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  logoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoPlaceholderText: {
    fontSize: 24,
  },
  summaryInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  serviceName: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginBottom: 4,
  },
  servicePrice: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  petInfo: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  petInfoTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 8,
  },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  petImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  petDetails: {
    flex: 1,
  },
  petName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  petBreed: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  dateCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  dateScroll: {
    flexDirection: 'row',
  },
  dateOption: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 70,
    position: 'relative',
  },
  unavailableDate: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    opacity: 0.5,
  },
  selectedDate: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  dayText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 2,
  },
  monthText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  selectedDateText: {
    color: '#FFFFFF',
  },
  todayText: {
    color: '#3B82F6',
  },
  todayBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  todayBadgeText: {
    fontSize: 8,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  timeCard: {
    marginBottom: 16,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: '30%',
  },
  selectedTime: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginLeft: 4,
  },
  selectedTimeText: {
    color: '#FFFFFF',
  },
  noTimesText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  notesCard: {
    marginBottom: 16,
  },
  bookingButtonContainer: {
    marginBottom: 24,
  },
});