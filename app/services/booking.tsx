import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Clock, Check, CreditCard, X } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '@/lib/supabase';
import { NotificationService } from '../../utils/notifications';
import { createServiceBookingOrder, openMercadoPagoPayment } from '../../utils/mercadoPago';

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
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);

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
        console.log('Service data loaded:', {
          id: serviceData.id,
          name: serviceData.name,
          has_cost: serviceData.has_cost,
          price: serviceData.price
        });

        setService({
          id: serviceData.id,
          name: serviceData.name,
          description: serviceData.description,
          price: serviceData.price,
          duration: serviceData.duration,
          category: serviceData.category,
          partnerId: serviceData.partner_id,
          hasCost: serviceData.has_cost === true || serviceData.has_cost === null, // Only false if explicitly false
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
      // Include pending_payment to block slots while payment is being processed
      const { data: bookingsData, error } = await supabaseClient
        .from('bookings')
        .select('*')
        .eq('partner_id', partnerId)
        .in('status', ['pending', 'pending_payment', 'confirmed'])
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

  const handlePayWithMercadoPago = async () => {
    setShowPaymentMethodModal(false);
    await handleBookService();
  };

  const handleBookService = async () => {
    if (!currentUser || !selectedDate || !selectedTime) {
      Alert.alert('Error', 'Por favor selecciona fecha y hora para la reserva');
      return;
    }

    if (!service || !pet || !partnerInfo) {
      Alert.alert('Error', 'Información incompleta para crear la reserva');
      return;
    }

    setBookingLoading(true);
    try {
      console.log('Creating service booking order...');

      // Create booking date by combining selected date and time
      const bookingDate = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(':').map(Number);
      bookingDate.setHours(hours, minutes, 0, 0);

      // Check if service has cost
      const serviceHasCost = service.hasCost !== false; // Default to true if undefined

      if (!serviceHasCost) {
        // Service is FREE - Create booking directly without payment
        console.log('Service is free, creating booking directly...');

        const { data: bookingData, error: bookingError } = await supabaseClient
          .from('bookings')
          .insert({
            service_id: serviceId,
            partner_id: partnerId,
            customer_id: currentUser.id,
            pet_id: petId,
            booking_date: bookingDate.toISOString(),
            booking_time: selectedTime,
            status: 'confirmed',
            notes: notes.trim() || null,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (bookingError) throw bookingError;

        // Send notification to partner
        try {
          await NotificationService.sendNotification(
            partnerId,
            '🎉 Nueva Reserva',
            `${currentUser.displayName || 'Un cliente'} ha reservado ${service.name} para el ${bookingDate.toLocaleDateString()}`,
            {
              type: 'booking',
              bookingId: bookingData.id,
              serviceId: serviceId
            }
          );
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }

        Alert.alert(
          '¡Reserva Confirmada!',
          `Tu reserva para ${service.name} el ${bookingDate.toLocaleDateString()} a las ${selectedTime} ha sido confirmada.`,
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/(tabs)/');
              }
            }
          ]
        );
        return;
      }

      // Service has cost - Process payment with Mercado Pago
      const result = await createServiceBookingOrder({
        serviceId: serviceId,
        partnerId: partnerId,
        customerId: currentUser.id,
        petId: petId,
        date: bookingDate,
        time: selectedTime,
        notes: notes.trim() || null,
        serviceName: service.name,
        partnerName: partnerInfo.businessName,
        petName: pet.name,
        totalAmount: service.price,
        customerInfo: currentUser
      });

      if (!result.success) {
        throw new Error(result.error || 'No se pudo crear la orden');
      }

      if (!result.paymentUrl) {
        throw new Error('No se pudo obtener la URL de pago');
      }

      console.log('Opening Mercado Pago for payment...');

      // Open Mercado Pago (app or web)
      const isTestMode = result.paymentUrl.includes('sandbox.mercadopago');
      const openResult = await openMercadoPagoPayment(result.paymentUrl, isTestMode);

      if (!openResult.success) {
        Alert.alert(
          'Error',
          openResult.error || 'No se pudo abrir Mercado Pago',
          [
            { text: 'OK' }
          ]
        );
      } else {
        console.log(openResult.openedInApp
          ? '✅ Opened in Mercado Pago app'
          : '🌐 Opened in browser');
      }
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
          { text: 'OK' }
        ]
      );
    } finally {
      setBookingLoading(false);
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
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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
              <Text style={[styles.servicePrice, !service?.hasCost && styles.servicePriceFree]}>
                {service?.hasCost === false ? 'GRATIS' : (service?.price ? formatPrice(service.price) : '$0.00')}
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
            title={bookingLoading ? 'Procesando...' : (service?.hasCost === false ? 'Confirmar Reserva' : 'Pagar')}
            onPress={() => {
              console.log('Button pressed - Service hasCost:', service?.hasCost);
              console.log('Service full object:', service);

              if (service?.hasCost === false) {
                // Service is free, confirm directly
                console.log('Service is free, confirming directly');
                handleBookService();
              } else {
                // Service has cost, show payment modal
                console.log('Service has cost, showing payment modal');
                setShowPaymentMethodModal(true);
              }
            }}
            loading={bookingLoading}
            size="large"
            disabled={!selectedDate || !selectedTime}
          />
        </View>
      </ScrollView>

      {/* Modal de Métodos de Pago - Solo se muestra si el servicio tiene costo */}
      {service?.hasCost === true && (
        <Modal
          visible={showPaymentMethodModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPaymentMethodModal(false)}
        >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Método de Pago</Text>
              <TouchableOpacity onPress={() => setShowPaymentMethodModal(false)} style={styles.closeButton}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.methodsContent}>
              <View style={styles.methodsHeader}>
                <CreditCard size={40} color="#2D6A6F" />
                <Text style={styles.methodsTitle}>Selecciona tu método de pago</Text>
                <Text style={styles.methodsSubtitle}>
                  Total: {formatPrice(service?.price || 0)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.paymentMethodCard}
                onPress={handlePayWithMercadoPago}
              >
                <View style={styles.paymentMethodIcon}>
                  <Image
                    source={require('@/assets/images/mercadopago.png')}
                    style={styles.mercadoPagoIcon}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Mercado Pago</Text>
                  <Text style={styles.paymentMethodDescription}>
                    Pago seguro con tarjetas, transferencias y más
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paymentMethodCard, styles.disabledMethod]}
                disabled
              >
                <View style={[styles.paymentMethodIcon, { backgroundColor: '#F3F4F6' }]}>
                  <CreditCard size={32} color="#9CA3AF" />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={[styles.paymentMethodTitle, { color: '#9CA3AF' }]}>Tarjeta de Crédito/Débito</Text>
                  <Text style={[styles.paymentMethodDescription, { color: '#9CA3AF' }]}>
                    Visa, Mastercard, American Express
                  </Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.paymentNote}>
                Serás redirigido para completar el pago de forma segura
              </Text>
            </View>
          </View>
        </View>
        </Modal>
      )}
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
  servicePriceFree: {
    color: '#3B82F6',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    minHeight: 450,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  methodsContent: {
    padding: 20,
  },
  methodsHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  mercadoPagoIcon: {
    width: 48,
    height: 48,
  },
  methodsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginTop: 12,
    textAlign: 'center',
  },
  methodsSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#10B981',
    marginTop: 4,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  disabledMethod: {
    opacity: 0.5,
  },
  paymentMethodIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  paymentMethodDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  paymentNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
});
