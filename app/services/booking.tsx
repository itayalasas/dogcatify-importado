import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Clock, Check, CreditCard, X } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '@/lib/supabase';
import { NotificationService } from '../../utils/notifications';
import { createServiceBookingOrder, openMercadoPagoPayment } from '../../utils/mercadoPago';
import {
  generateAvailableTimeOptions,
  isTimeSlotAvailable,
  type AvailableTimeOption,
  type BookingSlotEntry,
  type ScheduleSlotEntry,
} from '@/utils/bookingAvailability';
import { isDateClosed, type ScheduleClosureEntry } from '@/utils/scheduleExceptions';

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
  const [schedule, setSchedule] = useState<ScheduleSlotEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableTimeOptions, setAvailableTimeOptions] = useState<AvailableTimeOption[]>([]);
  const [bookedBookings, setBookedBookings] = useState<BookingSlotEntry[]>([]);
  const [scheduleClosures, setScheduleClosures] = useState<ScheduleClosureEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (serviceId && partnerId) {
      router.replace(`/services/${serviceId}?partnerId=${partnerId}`);
      return;
    }

    router.replace('/(tabs)/services');
  };

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
        // Determinar si el servicio tiene costo:
        // 1. Si has_cost es explícitamente false → servicio gratis
        // 2. Si price es 0 → servicio gratis
        // 3. En cualquier otro caso → tiene costo
        const isFreeService = serviceData.has_cost === false || serviceData.price === 0;

        console.log('Service data loaded:', {
          id: serviceData.id,
          name: serviceData.name,
          has_cost: serviceData.has_cost,
          price: serviceData.price,
          isFreeService: isFreeService
        });

        setService({
          id: serviceData.id,
          name: serviceData.name,
          description: serviceData.description,
          price: serviceData.price || 0,
          duration: serviceData.duration,
          category: serviceData.category,
          partnerId: serviceData.partner_id,
          hasCost: !isFreeService, // False si es gratis, true si tiene costo
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
        breakStartTime: item.break_start_time,
        breakEndTime: item.break_end_time,
        slotDuration: item.slot_duration,
        maxSlots: item.max_slots,
        isActive: item.is_active,
      })) || [];
      
      setSchedule(formattedSchedule);

      const { data: closureData, error: closureError } = await supabaseClient
        .from('business_schedule_closures')
        .select('id, partner_id, closed_date, reason, closure_type, source_year')
        .eq('partner_id', partnerId)
        .order('closed_date', { ascending: true });

      if (closureError) throw closureError;

      setScheduleClosures(closureData || []);

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
        }
      }
    } catch (error) {
      console.error('Error fetching booking data:', error);
      Alert.alert('Error', 'No se pudo cargar la información para la reserva');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookedTimes = async (date: Date) => {
    if (!partnerId || !serviceId) return [];

    try {
      console.log('🔍 Fetching booked times for date:', date.toDateString(), 'service:', serviceId);

      const dateString = date.toISOString().split('T')[0];

      const { data: bookingsData, error } = await supabaseClient
        .from('bookings')
        .select('id, time, service_duration, date, status, service_id')
        .eq('partner_id', partnerId)
        .in('status', ['pending', 'pending_payment', 'confirmed'])
        .gte('date', `${dateString}T00:00:00`)
        .lte('date', `${dateString}T23:59:59`);

      if (error) {
        console.error('❌ Error fetching booked times from bookings:', error);
        return [];
      }

      const formattedBookings: BookingSlotEntry[] = bookingsData?.map((booking) => ({
        appointment_time: booking.time,
        service_duration: booking.service_duration,
      })) || [];

      console.log('⏰ Booked bookings from BOOKINGS:', formattedBookings);
      setBookedBookings(formattedBookings);

      return formattedBookings;
    } catch (error) {
      console.error('Error fetching existing bookings:', error);
      return [];
    }
  };

  const refreshAvailability = async (date: Date) => {
    const bookedBookings = await fetchBookedTimes(date);
    const timeOptions = generateAvailableTimeOptions({
      date,
      schedules: schedule,
      bookings: bookedBookings,
      serviceDuration: service?.duration || undefined,
      closures: scheduleClosures,
    });

    setAvailableTimeOptions(timeOptions);
    setSelectedTime(null);
  };

  useEffect(() => {
    if (selectedDate && schedule.length > 0 && service) {
      void refreshAvailability(selectedDate);
    }
  }, [selectedDate, schedule, service, scheduleClosures]);

  useEffect(() => {
    if (selectedDate && isDateClosed(selectedDate, scheduleClosures)) {
      setSelectedDate(null);
      setSelectedTime(null);
      setAvailableTimeOptions([]);
      setBookedBookings([]);
    }
  }, [selectedDate, scheduleClosures]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
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

      const refreshedBookings = await fetchBookedTimes(selectedDate);
      const slotStillAvailable = isTimeSlotAvailable({
        date: selectedDate,
        selectedTime,
        schedules: schedule,
        bookings: refreshedBookings,
        serviceDuration: service?.duration || undefined,
        closures: scheduleClosures,
      });

      if (!slotStillAvailable) {
        Alert.alert(
          'Horario no disponible',
          `Lo sentimos, la hora ${selectedTime} para el día ${selectedDate.toLocaleDateString()} ya no está disponible. Por favor selecciona otro horario.`,
          [
            {
              text: 'Entendido',
              onPress: () => {
                setSelectedTime(null);
              }
            }
          ]
        );
        return;
      }

      // Check if service has cost
      const serviceHasCost = service.hasCost !== false; // Default to true if undefined

      if (!serviceHasCost) {
        // Service is FREE - Create booking directly without payment
        console.log('Service is free, creating booking directly...');

        const { data: bookingData, error: bookingError } = await supabaseClient
          .from('bookings')
          .insert({
            service_id: serviceId,
            service_name: service.name,
            service_duration: service.duration || 60,
            partner_id: partnerId,
            partner_name: partnerInfo.businessName,
            customer_id: currentUser.id,
            customer_name: currentUser.displayName || currentUser.email,
            customer_email: currentUser.email,
            customer_phone: currentUser.phone || null,
            pet_id: petId,
            pet_name: pet.name,
            date: bookingDate.toISOString(),
            time: selectedTime,
            status: 'confirmed',
            total_amount: 0,
            notes: notes.trim() || null,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (bookingError) throw bookingError;

        // Send notification to partner
        try {
          const { data: partnerUser, error: partnerUserError } = await supabaseClient
            .from('partners')
            .select('user_id')
            .eq('id', partnerId)
            .single();

          if (partnerUserError || !partnerUser?.user_id) {
            console.warn('No se pudo resolver el usuario del partner para notificar:', partnerUserError);
          } else {
            const { data: profileData, error: profileError } = await supabaseClient
              .from('profiles')
              .select('push_token, fcm_token')
              .eq('id', partnerUser.user_id)
              .single();

            const pushToken = profileData?.fcm_token || profileData?.push_token;

            if (profileError || !pushToken) {
              console.warn('Partner sin token de notificación para reservas:', profileError);
            } else {
              await NotificationService.sendPushNotification(
                pushToken,
                '🎉 Nueva Reserva',
                `${currentUser.displayName || 'Un cliente'} ha reservado ${service.name} para el ${bookingDate.toLocaleDateString()}`,
                {
                  type: 'booking',
                  bookingId: bookingData.id,
                  serviceId: serviceId
                }
              );
            }
          }
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
                router.replace('/(tabs)');
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
      const isAvailable = schedule.some(item => item.dayOfWeek === dayOfWeek)
        && !isDateClosed(date, scheduleClosures);
      
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
    return <LoadingScreen message="Cargando información de reserva..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
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
            
            {availableTimeOptions.length === 0 ? (
              <Text style={styles.noTimesText}>
                No hay horarios disponibles para esta fecha
              </Text>
            ) : (
              <View style={styles.timeGrid}>
                {availableTimeOptions.map((option, index) => {
                  const { time, availableSlots, maxSlots } = option;
                  const isSelected = time === selectedTime;
                  const isBooked = availableSlots <= 0;
                  const showAvailableSlots = maxSlots > 1 && availableSlots > 1;
                  const availabilityLabel = isBooked
                    ? 'Reservado'
                    : showAvailableSlots
                      ? `${availableSlots} turnos`
                      : null;
                  const isToday = selectedDate?.toDateString() === new Date().toDateString();
                  if (isToday) {
                    const now = new Date();
                    const [hours, minutes] = time.split(':').map(Number);
                    const timeDate = new Date();
                    timeDate.setHours(hours, minutes, 0, 0);
                    if (timeDate < now) {
                      return null;
                    }
                  }
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.timeOption,
                        isSelected && styles.selectedTime,
                        isBooked && styles.bookedTimeOption,
                      ]}
                      onPress={() => !isBooked && handleTimeSelect(time)}
                      disabled={isBooked}
                    >
                      <Clock 
                        size={16} 
                        color={isBooked ? '#9CA3AF' : isSelected ? '#FFFFFF' : '#6B7280'} 
                      />
                      <View style={styles.timeLabelContainer}>
                        <Text style={[
                          styles.timeText,
                          isSelected && styles.selectedTimeText,
                          isBooked && styles.bookedTimeText
                        ]}>
                          {time}
                        </Text>
                        {availabilityLabel && (
                          <Text style={[
                            styles.availableSlotsText,
                            isSelected && styles.selectedAvailableSlotsText,
                            isBooked && styles.bookedAvailableSlotsText,
                          ]}>
                            {availabilityLabel}
                          </Text>
                        )}
                      </View>
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
      {service?.hasCost && (
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
  bookedTimeOption: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    opacity: 0.6,
  },
  timeLabelContainer: {
    marginLeft: 6,
    alignItems: 'center',
  },
  selectedTime: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginLeft: 0,
  },
  availableSlotsText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  selectedTimeText: {
    color: '#FFFFFF',
  },
  bookedTimeText: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  selectedAvailableSlotsText: {
    color: '#E0F2FE',
  },
  bookedAvailableSlotsText: {
    color: '#9CA3AF',
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
