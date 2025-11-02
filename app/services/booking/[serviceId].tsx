import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal, TextInput, ActivityIndicator, Linking, Image, Animated } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Calendar, Clock, CreditCard, X, Lock, User, FileText, CircleCheck as CheckCircle } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { LoadingScreen } from '../../../components/ui/LoadingScreen';
import { useAuth } from '../../../contexts/AuthContext';
import { supabaseClient } from '@/lib/supabase';
import { createServiceBookingOrder, openMercadoPagoPayment, isTestEnvironment } from '../../../utils/mercadoPago';

interface CardType {
  name: string;
  pattern: RegExp;
  color: string;
}

const cardTypes: CardType[] = [
  { name: 'Visa', pattern: /^4/, color: '#1A1F71' },
  { name: 'Mastercard', pattern: /^5[1-5]/, color: '#EB001B' },
  { name: 'American Express', pattern: /^3[47]/, color: '#006FCF' },
  { name: 'Diners Club', pattern: /^3[0689]/, color: '#0079BE' },
];

const documentTypes = [
  { value: 'CI', label: 'Cédula de Identidad' },
  { value: 'RUT', label: 'RUT' },
  { value: 'PASSPORT', label: 'Pasaporte' },
  { value: 'OTHER', label: 'Otro' }
];

export default function ServiceBooking() {
  const { serviceId, partnerId, petId, boardingCategory, discount } = useLocalSearchParams<{
    serviceId: string;
    partnerId: string;
    petId: string;
    boardingCategory?: string;
    discount?: string;
  }>();
  
  const { currentUser } = useAuth();
  
  // Service and booking data
  const [service, setService] = useState<any>(null);
  const [partner, setPartner] = useState<any>(null);
  const [pet, setPet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Date and time selection
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [partnerSchedule, setPartnerSchedule] = useState<any[]>([]);
  
  // Payment flow
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('Preparando tu pago con Mercado Pago');
  const [paymentStep, setPaymentStep] = useState<'methods' | 'card' | 'processing'>('methods');
  const progressAnim = useRef(new Animated.Value(0)).current;
  const isProcessingPayment = useRef(false); // Flag para saber si estamos procesando pago
  
  // Card form data
  const [fullName, setFullName] = useState('');
  const [documentType, setDocumentType] = useState('CI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [detectedCardType, setDetectedCardType] = useState<CardType | null>(null);
  const [showDocumentTypes, setShowDocumentTypes] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);

  useEffect(() => {
    if (serviceId && partnerId && petId) {
      fetchBookingData();
    }

    // Apply discount from promotion if provided
    if (discount) {
      const discountValue = parseFloat(discount);
      if (!isNaN(discountValue) && discountValue > 0 && discountValue <= 100) {
        setAppliedDiscount(discountValue);
      }
    }
  }, [serviceId, partnerId, petId, discount]);

  // Animar barra de progreso cuando se activa el loading
  useEffect(() => {
    if (paymentLoading) {
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 100,
        duration: 4500,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(0);
    }
  }, [paymentLoading]);

  // Ocultar loader cuando el usuario regresa a la pantalla (al volver de MercadoPago)
  useFocusEffect(
    React.useCallback(() => {
      console.log('📱 useFocusEffect triggered - isProcessingPayment:', isProcessingPayment.current);

      // CRÍTICO: NO ocultar el loader si estamos procesando pago
      if (isProcessingPayment.current) {
        console.log('⚠️  Estamos procesando pago, NO ocultar loader');
        return;
      }

      // CRÍTICO: Esperar 500ms antes de ocultar el loader para evitar que se oculte durante la apertura de MP
      // Esto permite que Mercado Pago se abra completamente antes de ocultar el loader
      const timer = setTimeout(() => {
        if (paymentLoading && !isProcessingPayment.current) {
          console.log('🔄 Usuario regresó a la pantalla de reserva, ocultando loader');
          setPaymentLoading(false);
          setPaymentMessage('Preparando tu pago con Mercado Pago');
        }
      }, 500);

      return () => clearTimeout(timer);
    }, [paymentLoading])
  );

  // Detect card type based on number
  useEffect(() => {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    const detected = cardTypes.find(type => type.pattern.test(cleanNumber));
    setDetectedCardType(detected || null);
  }, [cardNumber]);

  const fetchBookingData = async () => {
    try {
      // Fetch service details
      const { data: serviceData, error: serviceError } = await supabaseClient
        .from('partner_services')
        .select('*')
        .eq('id', serviceId)
        .single();

      if (serviceError) throw serviceError;
      setService(serviceData);

      // Fetch partner details
      const { data: partnerData, error: partnerError } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('id', partnerId)
        .single();

      if (partnerError) throw partnerError;
      setPartner(partnerData);

      // Fetch pet details
      const { data: petData, error: petError } = await supabaseClient
        .from('pets')
        .select('*')
        .eq('id', petId)
        .single();

      if (petError) throw petError;
      setPet(petData);

      // Fetch partner schedule
      const { data: scheduleData, error: scheduleError } = await supabaseClient
        .from('business_schedule')
        .select('*')
        .eq('partner_id', partnerId)
        .eq('is_active', true);

      if (scheduleError) throw scheduleError;
      setPartnerSchedule(scheduleData || []);

      // Generate available times
      await generateAvailableTimes();
    } catch (error) {
      console.error('Error fetching booking data:', error);
      Alert.alert('Error', 'No se pudo cargar la información de la reserva');
    } finally {
      setLoading(false);
    }
  };

  const generateAvailableTimes = async () => {
    const times = [];
    for (let hour = 9; hour <= 17; hour++) {
      times.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    setAvailableTimes(times);
  };

  const fetchBookedTimes = async (date: Date) => {
    if (!partnerId || !serviceId) return;

    try {
      console.log('Fetching booked times for date:', date.toDateString(), 'service:', serviceId);

      const dateString = date.toISOString().split('T')[0];

      // IMPORTANTE: Consultar ORDERS (no bookings) porque ahí están las reservas confirmadas
      // Filtrar por:
      // 1. service_id = el servicio actual
      // 2. appointment_date = la fecha seleccionada
      // 3. status != 'cancelled' (solo reservas activas)
      const { data: orders, error: ordersError } = await supabaseClient
        .from('orders')
        .select('appointment_time, status, order_type')
        .eq('service_id', serviceId)
        .gte('appointment_date', `${dateString}T00:00:00`)
        .lte('appointment_date', `${dateString}T23:59:59`)
        .neq('status', 'cancelled')
        .eq('order_type', 'service_booking');

      if (ordersError) {
        console.error('Error fetching booked times from orders:', ordersError);
        return;
      }

      // Extraer las horas ya reservadas
      const bookedTimeSlots = orders
        ?.filter(order => order.appointment_time) // Solo las que tienen hora
        .map(order => order.appointment_time) || [];

      console.log('Booked times for date from ORDERS:', bookedTimeSlots);
      setBookedTimes(bookedTimeSlots);
    } catch (error) {
      console.error('Error fetching booked times:', error);
    }
  };

  // Fetch booked times when date or service changes
  useEffect(() => {
    if (selectedDate && partnerId && serviceId) {
      fetchBookedTimes(selectedDate);
    }
  }, [selectedDate, partnerId, serviceId]);

  // Validar fecha seleccionada cuando cambia la categoría
  useEffect(() => {
    if (selectedDate && boardingCategory) {
      const dayOfWeek = selectedDate.getDay();

      // Validar fin de semana
      if (boardingCategory === 'Fin de semana') {
        // Si la fecha seleccionada no es viernes (5), sábado (6) o domingo (0), resetear
        if (dayOfWeek !== 5 && dayOfWeek !== 6 && dayOfWeek !== 0) {
          setSelectedDate(null);
        }
      }

      // Validar semanal (solo lunes)
      if (boardingCategory === 'Semanal') {
        // Si la fecha seleccionada no es lunes (1), resetear
        if (dayOfWeek !== 1) {
          setSelectedDate(null);
        }
      }
    }
  }, [boardingCategory]);

  const generateAvailableDates = () => {
    const dates = [];
    const today = new Date();
    const now = new Date();

    // Obtener los días de la semana que tienen horario configurado
    const scheduledDays = partnerSchedule.map(s => s.day_of_week);

    // Si no hay horarios configurados, no mostrar fechas
    if (scheduledDays.length === 0) {
      return dates;
    }

    // Generar fechas para el mes en curso
    const daysInMonth = 30; // Aproximadamente un mes

    for (let i = 0; i < daysInMonth; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayOfWeek = date.getDay();

      // Verificar si este día tiene horario configurado
      const daySchedule = partnerSchedule.find(s => s.day_of_week === dayOfWeek);

      if (!daySchedule) continue;

      // Si es hoy, verificar si aún está dentro del horario
      if (i === 0) {
        const [endHour, endMinute] = daySchedule.end_time.split(':').map(Number);
        const endTime = new Date(now);
        endTime.setHours(endHour, endMinute, 0, 0);

        // Si ya pasó la hora de cierre, saltar este día
        if (now > endTime) {
          continue;
        }
      }

      // Aplicar filtros adicionales según la categoría de boarding
      if (boardingCategory === 'Fin de semana') {
        // Solo viernes, sábado y domingo
        if (dayOfWeek !== 5 && dayOfWeek !== 6 && dayOfWeek !== 0) {
          continue;
        }
      } else if (boardingCategory === 'Semanal') {
        // Solo lunes
        if (dayOfWeek !== 1) {
          continue;
        }
      }

      dates.push(date);

      // Limitar la cantidad de fechas mostradas
      if (boardingCategory === 'Fin de semana' && dates.length >= 9) break;
      if (boardingCategory === 'Semanal' && dates.length >= 7) break;
      if (!boardingCategory && dates.length >= 7) break;
    }

    return dates;
  };

  const formatDate = (date: Date) => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    
    return {
      dayName: days[date.getDay()],
      day: date.getDate(),
      month: months[date.getMonth()],
      fullDate: date.toLocaleDateString('es-ES')
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getServicePrice = () => {
    if (!service) return 0;

    if (boardingCategory) {
      switch (boardingCategory) {
        case 'Diario':
          return service.price_daily || service.price || 0;
        case 'Nocturno':
          return service.price_overnight || service.price || 0;
        case 'Fin de semana':
          return service.price_weekend || service.price || 0;
        case 'Semanal':
          return service.price_weekly || service.price || 0;
        default:
          return service.price || 0;
      }
    }

    return service.price || 0;
  };

  // Card formatting functions
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const handleCardNumberChange = (value: string) => {
    const formatted = formatCardNumber(value);
    if (formatted.replace(/\s/g, '').length <= 16) {
      setCardNumber(formatted);
    }
  };

  const handleExpiryChange = (value: string) => {
    const formatted = formatExpiryDate(value);
    if (formatted.length <= 5) {
      setExpiryDate(formatted);
    }
  };

  const handleCvvChange = (value: string) => {
    const v = value.replace(/[^0-9]/gi, '');
    if (v.length <= 4) {
      setCvv(v);
    }
  };

  const handleConfirmBooking = () => {
    if (!selectedDate) {
      Alert.alert('Error', 'Por favor selecciona una fecha');
      return;
    }
    // Solo validar hora si NO es un servicio de pensión
    if (!boardingCategory && !selectedTime) {
      Alert.alert('Error', 'Por favor selecciona una hora');
      return;
    }

    // Verificar si el servicio es gratuito
    const servicePrice = getServicePrice();
    const isFreeService = service?.has_cost === false || servicePrice === 0;

    console.log('Confirming booking - Price:', servicePrice, 'Is Free:', isFreeService);

    if (isFreeService) {
      // Servicio gratuito - crear reserva directamente sin pago
      handleFreeServiceBooking();
    } else {
      // Servicio con costo - mostrar modal de pago
      setShowPaymentModal(true);
    }
  };

  const handleFreeServiceBooking = async () => {
    if (!selectedDate || !service || !partner || !pet || !currentUser) {
      Alert.alert('Error', 'Información de reserva incompleta');
      return;
    }

    setPaymentLoading(true);
    setPaymentMessage('Confirmando tu reserva...');

    try {
      // Crear fecha y hora de la reserva
      const bookingDate = new Date(selectedDate);
      if (selectedTime) {
        const [hours, minutes] = selectedTime.split(':').map(Number);
        bookingDate.setHours(hours, minutes, 0, 0);
      }

      // Crear la reserva directamente sin pago
      const { data: bookingData, error: bookingError } = await supabaseClient
        .from('bookings')
        .insert({
          service_id: serviceId,
          service_name: service.name,
          service_duration: service.duration || 60,
          partner_id: partnerId,
          partner_name: partner.business_name,
          customer_id: currentUser.id,
          customer_name: currentUser.displayName || currentUser.email,
          customer_email: currentUser.email,
          customer_phone: currentUser.phoneNumber || null,
          pet_id: petId,
          pet_name: pet.name,
          date: bookingDate.toISOString(),
          time: selectedTime || null,
          status: 'confirmed',
          total_amount: 0,
          notes: notes.trim() || null,
          boarding_category: boardingCategory || null,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Enviar notificación al partner
      try {
        const { default: NotificationService } = await import('../../utils/notifications');
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

      setPaymentLoading(false);

      const timeInfo = boardingCategory
        ? `📦 Tipo: ${boardingCategory}`
        : selectedTime ? `🕐 ${selectedTime}` : '';

      Alert.alert(
        '¡Reserva Confirmada! 🎉',
        `Tu reserva ha sido confirmada:\n\n📅 ${selectedDate.toLocaleDateString()}\n${timeInfo}\n\nRecibirás una notificación de confirmación.`,
        [{ text: 'Perfecto', onPress: () => router.replace('/(tabs)/services') }]
      );
    } catch (error) {
      console.error('Error creating free booking:', error);
      setPaymentLoading(false);
      Alert.alert(
        'Error',
        'No se pudo crear la reserva. Por favor intenta nuevamente.',
        [{ text: 'OK' }]
      );
    }
  };

  const handlePaymentMethodSelect = (method: string) => {
    if (method === 'mercadopago') {
      handleMercadoPagoPayment();
    } else if (method === 'card') {
      setPaymentStep('card');
    }
  };

  const handleMercadoPagoPayment = async () => {
    if (!selectedDate || !service || !partner || !pet) {
      Alert.alert('Error', 'Información de reserva incompleta');
      return;
    }
    // Validar hora solo si NO es servicio de pensión
    if (!boardingCategory && !selectedTime) {
      Alert.alert('Error', 'Por favor selecciona una hora');
      return;
    }

    console.log('💳 ========== INICIO handleMercadoPagoPayment (BOOKING) ==========');

    // CRÍTICO: Activar flag de procesamiento para evitar que useFocusEffect oculte el loader
    isProcessingPayment.current = true;
    console.log('🚩 isProcessingPayment = true');

    setPaymentLoading(true);
    setPaymentStep('processing');
    setPaymentMessage('Preparando tu reserva...');
    console.log('✅ paymentLoading = true, loader DEBE estar visible');

    // Cerrar el modal de pago para mostrar el loader en pantalla completa
    setShowPaymentModal(false);
    console.log('✅ Modal de pago cerrado');

    // Guardar el tiempo de inicio para garantizar 5 segundos mínimos
    const startTime = Date.now();
    const MIN_LOADING_TIME = 5000; // 5 segundos
    console.log(`⏱️  Tiempo mínimo de loading: ${MIN_LOADING_TIME}ms`);

    try {
      // Esperar 800ms para que el loader sea visible
      await new Promise(resolve => setTimeout(resolve, 800));

      console.log('=== Iniciando flujo de Mercado Pago ===');
      console.log('Datos de la reserva:', {
        serviceId: service.id,
        partnerId: partner.id,
        customerId: currentUser!.id,
        petId: pet.id,
        date: selectedDate.toISOString(),
        time: selectedTime || 'N/A', // Para servicios de pensión, la hora no aplica
        serviceName: service.name,
        totalAmount: service.price
      });

      // VALIDACIÓN CRÍTICA: Verificar que no exista una reserva para esta fecha/hora/servicio
      if (selectedTime && selectedTime !== 'N/A') {
        const dateString = selectedDate.toISOString().split('T')[0];

        console.log('🔍 Validando disponibilidad de horario...');
        const { data: existingOrders, error: checkError } = await supabaseClient
          .from('orders')
          .select('id, appointment_time, status')
          .eq('service_id', service.id)
          .gte('appointment_date', `${dateString}T00:00:00`)
          .lte('appointment_date', `${dateString}T23:59:59`)
          .eq('appointment_time', selectedTime)
          .neq('status', 'cancelled')
          .eq('order_type', 'service_booking');

        if (checkError) {
          console.error('❌ Error verificando disponibilidad:', checkError);
          throw new Error('No se pudo verificar la disponibilidad del horario');
        }

        if (existingOrders && existingOrders.length > 0) {
          console.warn('⚠️ Ya existe una reserva para esta fecha/hora/servicio:', existingOrders);
          setPaymentLoading(false);
          setPaymentStep('methods');
          Alert.alert(
            'Horario No Disponible',
            `Lo sentimos, la hora ${selectedTime} para el día ${selectedDate.toLocaleDateString()} ya no está disponible. Por favor selecciona otro horario.`,
            [
              {
                text: 'Entendido',
                onPress: () => {
                  // Recargar los horarios ocupados
                  fetchBookedTimes(selectedDate);
                  setSelectedTime(null);
                }
              }
            ]
          );
          return;
        }

        console.log('✅ Horario disponible, continuando con la reserva...');
      }

      const originalPrice = getServicePrice();
      const finalPrice = appliedDiscount > 0
        ? originalPrice * (1 - appliedDiscount / 100)
        : originalPrice;

      const bookingData = {
        serviceId: service.id,
        partnerId: partner.id,
        customerId: currentUser!.id,
        petId: pet.id,
        date: selectedDate,
        time: selectedTime || 'N/A', // Para servicios de pensión, la hora no aplica
        notes: notes.trim() || null,
        serviceName: service.name,
        partnerName: partner.business_name,
        petName: pet.name,
        totalAmount: finalPrice,
        customerInfo: {
          id: currentUser!.id,
          email: currentUser!.email,
          displayName: currentUser!.displayName || 'Usuario',
          phone: currentUser!.phone || null
        },
        discountPercentage: appliedDiscount || 0,
        originalPrice: originalPrice
      };

      setPaymentMessage('Creando orden de reserva...');
      console.log('Llamando a createServiceBookingOrder...');
      const result = await createServiceBookingOrder(bookingData);
      console.log('Resultado de createServiceBookingOrder:', result);

      if (result.success && result.paymentUrl) {
        console.log('✅ Orden creada exitosamente');
        console.log('URL de pago:', result.paymentUrl);
        console.log('ID de orden:', result.orderId);

        // Detect environment from payment URL
        const isTestMode = result.paymentUrl!.includes('sandbox');

        // Open Mercado Pago directly without showing alert
        try {
          // Update message while opening
          setPaymentMessage('Abriendo Mercado Pago...');

          // Calcular tiempo restante para completar 5 segundos
          const elapsedTime = Date.now() - startTime;
          const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);

          if (remainingTime > 0) {
            console.log(`⏳ Esperando ${remainingTime}ms para completar tiempo mínimo de loading`);
            await new Promise(resolve => setTimeout(resolve, remainingTime));
          }

          // Open Mercado Pago in browser
          console.log('🚀 Abriendo Mercado Pago...');
          const openResult = await openMercadoPagoPayment(result.paymentUrl!, isTestMode);
          console.log('📱 openMercadoPagoPayment completado:', openResult);

          if (!openResult.success) {
            console.error('❌ Error abriendo Mercado Pago');

            // CRÍTICO: Desactivar flag de procesamiento si falla
            isProcessingPayment.current = false;
            console.log('🚩 isProcessingPayment = false (error al abrir MP)');

            Alert.alert(
              'Error',
              openResult.error || 'No se pudo abrir Mercado Pago. Por favor intenta nuevamente.'
            );
            // CRÍTICO: Ocultar loader si falló
            setPaymentLoading(false);
            setPaymentMessage('Preparando tu pago con Mercado Pago');
          } else {
            console.log('✅ Mercado Pago abierto exitosamente');
            console.log('⏳ Loader DEBE permanecer visible hasta que el usuario regrese');

            // CRÍTICO: Desactivar flag de procesamiento DESPUÉS de abrir MP exitosamente
            // Esto permite que useFocusEffect oculte el loader cuando el usuario regrese
            isProcessingPayment.current = false;
            console.log('🚩 isProcessingPayment = false (MP abierto, esperando retorno del usuario)');

            // IMPORTANTE: NO ocultar el loader aquí, se ocultará automáticamente cuando el usuario vuelva a la app
            // El useFocusEffect se encarga de ocultar el loader cuando regresa
          }
        } catch (linkError) {
          console.error('Error abriendo URL de Mercado Pago:', linkError);
          Alert.alert('Error', 'No se pudo abrir Mercado Pago. Por favor intenta nuevamente.');
        }
      } else {
        console.error('❌ Error en la respuesta:', result.error);
        throw new Error(result.error || 'Error creando la orden');
      }
    } catch (error: any) {
      console.error('❌ Error with Mercado Pago payment:', error);

      // CRÍTICO: Desactivar flag de procesamiento si hay error
      isProcessingPayment.current = false;
      console.log('🚩 isProcessingPayment = false (error en pago)');

      // CRÍTICO: Ocultar loader inmediatamente
      setPaymentLoading(false);
      setPaymentMessage('Preparando tu pago con Mercado Pago');

      let errorMessage = 'No se pudo procesar el pago con Mercado Pago';
      if (error.message) {
        errorMessage = error.message;
      }

      // Esperar para asegurar que el loader se oculte completamente
      setTimeout(() => {
        Alert.alert(
          'Error al procesar el pago',
          errorMessage + '\n\nPor favor verifica que el partner tenga Mercado Pago configurado e intenta nuevamente.',
          [
            { text: 'Reintentar', onPress: () => {
              setPaymentStep('methods');
              setShowPaymentModal(true);
            }},
            { text: 'Cancelar', style: 'cancel' }
          ]
        );
      }, 300);
    }
  };

  const validateCardForm = () => {
    return fullName.trim() && 
           documentNumber.trim() && 
           cardNumber.replace(/\s/g, '').length >= 13 && 
           expiryDate.length === 5 && 
           cvv.length >= 3;
  };

  const handleCardPayment = async () => {
    if (!validateCardForm()) {
      Alert.alert('Error', 'Por favor completa todos los campos correctamente');
      return;
    }

    setProcessing(true);
    try {
      // Simulate payment processing (3 seconds)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Simulate 90% success rate
      const isSuccess = Math.random() > 0.1;

      if (isSuccess) {
        // Clear sensitive data immediately
        setCardNumber('');
        setExpiryDate('');
        setCvv('');
        setFullName('');
        setDocumentNumber('');
        
        setShowPaymentModal(false);
        
        const timeInfo = boardingCategory
          ? `📦 Tipo: ${boardingCategory}`
          : `🕐 ${selectedTime}`;

        Alert.alert(
          '¡Pago Exitoso! 🎉',
          `Tu reserva ha sido confirmada:\n\n📅 ${selectedDate?.toLocaleDateString()}\n${timeInfo}\n💰 ${formatCurrency(getServicePrice())}\n\nRecibirás una confirmación por email.`,
          [{ text: 'Perfecto', onPress: () => router.replace('/(tabs)/services') }]
        );
      } else {
        Alert.alert(
          'Pago Rechazado',
          'Tu pago no pudo ser procesado. Por favor verifica los datos de tu tarjeta e intenta nuevamente.',
          [{ text: 'Reintentar' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Ocurrió un error procesando el pago. Intenta nuevamente.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Cargando información de la reserva..." />;
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
        {/* Service Info */}
        <Card style={styles.serviceCard}>
          <Text style={styles.serviceName}>{service?.name}</Text>
          {boardingCategory && (
            <Text style={styles.boardingCategory}>Tipo: {boardingCategory}</Text>
          )}
          <Text style={styles.partnerName}>{partner?.business_name}</Text>
          <Text style={styles.petName}>Para: {pet?.name}</Text>
          <Text style={styles.servicePrice}>
            {formatCurrency(getServicePrice())}
          </Text>
        </Card>

        {/* Date Selection */}
        <Card style={styles.dateCard}>
          <Text style={styles.sectionTitle}>Selecciona una fecha</Text>
          {boardingCategory === 'Fin de semana' && (
            <Text style={styles.weekendInfo}>
              📅 Solo puedes reservar de viernes a domingo
            </Text>
          )}
          {boardingCategory === 'Semanal' && (
            <Text style={styles.weekendInfo}>
              📅 La reserva inicia cada lunes por una semana completa
            </Text>
          )}
          {generateAvailableDates().length === 0 ? (
            <View style={styles.noScheduleContainer}>
              <Text style={styles.noScheduleText}>
                📅 No hay horarios disponibles configurados
              </Text>
              <Text style={styles.noScheduleSubtext}>
                El negocio aún no ha configurado su agenda de trabajo
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datesScroll}>
              {generateAvailableDates().map((date, index) => {
              const dateInfo = formatDate(date);
              const isSelected = selectedDate?.toDateString() === date.toDateString();
              const today = new Date();
              const isToday = date.toDateString() === today.toDateString();

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dateOption,
                    isSelected && styles.selectedDateOption,
                    isToday && !isSelected && styles.todayDateOption
                  ]}
                  onPress={() => setSelectedDate(date)}
                >
                  {isToday && (
                    <View style={styles.todayBadge}>
                      <Text style={styles.todayBadgeText}>●</Text>
                    </View>
                  )}
                  <Text style={[
                    styles.dayName,
                    isSelected && styles.selectedDateText,
                    isToday && !isSelected && styles.todayText
                  ]}>
                    {isToday ? 'Hoy' : dateInfo.dayName}
                  </Text>
                  <Text style={[
                    styles.dayNumber,
                    isSelected && styles.selectedDateText,
                    isToday && !isSelected && styles.todayText
                  ]}>
                    {dateInfo.day}
                  </Text>
                  <Text style={[
                    styles.monthName,
                    isSelected && styles.selectedDateText,
                    isToday && !isSelected && styles.todayText
                  ]}>
                    {dateInfo.month}
                  </Text>
                </TouchableOpacity>
              );
            })}
            </ScrollView>
          )}
        </Card>

        {/* Time Selection - Solo mostrar si NO es servicio de pensión */}
        {selectedDate && !boardingCategory && (
          <Card style={styles.timeCard}>
            <Text style={styles.sectionTitle}>Selecciona una hora</Text>
            <View style={styles.timesGrid}>
              {availableTimes.map((time) => {
                const isBooked = bookedTimes.includes(time);
                return (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timeOption,
                    selectedTime === time && styles.selectedTimeOption,
                    isBooked && styles.bookedTimeOption
                  ]}
                  onPress={() => !isBooked && setSelectedTime(time)}
                  disabled={isBooked}
                >
                  <Clock size={16} color={
                    isBooked ? "#9CA3AF" :
                    selectedTime === time ? "#FFFFFF" : "#6B7280"
                  } />
                  <Text style={[
                    styles.timeText,
                    selectedTime === time && styles.selectedTimeText,
                    isBooked && styles.bookedTimeText
                  ]}>
                    {time}
                  </Text>
                </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        )}

        {/* Notes - Hidden for now */}
        {/* <Card style={styles.notesCard}>
          <Text style={styles.sectionTitle}>Notas para el proveedor</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Agrega cualquier información adicional para el proveedor"
            placeholderTextColor="#9CA3AF"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Card> */}
      </ScrollView>

      {/* Fixed Confirm Button */}
      {selectedDate && (boardingCategory || selectedTime) && (
        <View style={styles.confirmContainer}>
          <View style={styles.confirmSummary}>
            <Text style={styles.confirmDate}>
              {boardingCategory
                ? `${selectedDate.toLocaleDateString()} - ${boardingCategory}`
                : `${selectedDate.toLocaleDateString()} a las ${selectedTime}`
              }
            </Text>
            <Text style={styles.confirmPrice}>
              {formatCurrency(getServicePrice())}
            </Text>
          </View>
          <Button
            title="Confirmar Reserva"
            onPress={handleConfirmBooking}
            size="large"
          />
        </View>
      )}

      {/* Payment Modal - Single Modal with Steps */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {paymentStep === 'methods' ? 'Método de Pago' : 
                 paymentStep === 'card' ? 'Pago con Tarjeta' : 'Procesando...'}
              </Text>
              <TouchableOpacity onPress={() => {
                setShowPaymentModal(false);
                setPaymentStep('methods');
              }}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Payment Methods Step */}
            {paymentStep === 'methods' && (
              <View style={styles.methodsContent}>
                <View style={styles.methodsHeader}>
                  <CreditCard size={40} color="#2D6A6F" />
                  <Text style={styles.methodsTitle}>Selecciona tu método de pago</Text>
                  <Text style={styles.methodsSubtitle}>
                    Total: {formatCurrency(getServicePrice())}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.paymentMethodCard}
                  onPress={() => handlePaymentMethodSelect('mercadopago')}
                  disabled={paymentLoading}
                >
                  <View style={styles.paymentMethodLogoCircle}>
                    <Image
                      source={require('../../../assets/images/mercadopago.png')}
                      style={styles.mercadoPagoLogo}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>Mercado Pago</Text>
                    <Text style={styles.paymentMethodDescription}>
                      Pago seguro con tarjetas, transferencias y más
                    </Text>
                  </View>
                  {paymentLoading && <ActivityIndicator size="small" color="#00A650" />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.paymentMethodCard, styles.disabledMethod]}
                  disabled
                >
                  <View style={[styles.paymentMethodIconCircle, { backgroundColor: '#F3F4F6' }]}>
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
            )}

            {/* Card Form Step */}
            {paymentStep === 'card' && (
              <ScrollView style={styles.cardFormContainer} showsVerticalScrollIndicator={false}>
                {/* Booking Summary */}
                <View style={styles.bookingSummary}>
                  <Text style={styles.summaryTitle}>Resumen de la Reserva</Text>
                  <Text style={styles.summaryService}>{service?.name}</Text>
                  <Text style={styles.summaryDateTime}>
                    {boardingCategory
                      ? `${selectedDate?.toLocaleDateString()} - ${boardingCategory}`
                      : `${selectedDate?.toLocaleDateString()} a las ${selectedTime}`
                    }
                  </Text>
                  <Text style={styles.summaryTotal}>
                    Total: {formatCurrency(getServicePrice())}
                  </Text>
                </View>

                {/* Personal Information */}
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Información Personal</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nombre completo *</Text>
                    <View style={styles.inputContainer}>
                      <User size={20} color="#6B7280" />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Juan Pérez"
                        value={fullName}
                        onChangeText={setFullName}
                        autoCapitalize="words"
                        autoComplete="name"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Tipo de documento *</Text>
                    <TouchableOpacity
                      style={styles.selectInput}
                      onPress={() => setShowDocumentTypes(true)}
                    >
                      <FileText size={20} color="#6B7280" />
                      <Text style={styles.selectText}>
                        {documentTypes.find(type => type.value === documentType)?.label || 'Seleccionar'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Número de documento *</Text>
                    <View style={styles.inputContainer}>
                      <FileText size={20} color="#6B7280" />
                      <TextInput
                        style={styles.textInput}
                        placeholder="12345678"
                        value={documentNumber}
                        onChangeText={setDocumentNumber}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>


                {/* Card Information */}
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Información de la Tarjeta</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Número de tarjeta *</Text>
                    <View style={[styles.inputContainer, styles.cardInputContainer]}>
                      <CreditCard size={20} color="#6B7280" />
                      <TextInput
                        style={styles.textInput}
                        placeholder="1234 5678 9012 3456"
                        value={cardNumber}
                        onChangeText={handleCardNumberChange}
                        keyboardType="numeric"
                        maxLength={19}
                        autoComplete="cc-number"
                      />
                      {detectedCardType && (
                        <View style={[styles.cardTypeBadge, { backgroundColor: detectedCardType.color }]}>
                          <Text style={styles.cardTypeText}>{detectedCardType.name}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.cardDetailsRow}>
                    <View style={styles.cardDetailInput}>
                      <Text style={styles.inputLabel}>Vencimiento *</Text>
                      <View style={styles.inputContainer}>
                        <Calendar size={20} color="#6B7280" />
                        <TextInput
                          style={styles.textInput}
                          placeholder="MM/AA"
                          value={expiryDate}
                          onChangeText={handleExpiryChange}
                          keyboardType="numeric"
                          maxLength={5}
                          autoComplete="cc-exp"
                        />
                      </View>
                    </View>

                    <View style={styles.cardDetailInput}>
                      <Text style={styles.inputLabel}>CVV *</Text>
                      <View style={styles.inputContainer}>
                        <Lock size={20} color="#6B7280" />
                        <TextInput
                          style={styles.textInput}
                          placeholder="123"
                          value={cvv}
                          onChangeText={handleCvvChange}
                          keyboardType="numeric"
                          maxLength={4}
                          secureTextEntry={true}
                          autoComplete="cc-csc"
                        />
                      </View>
                    </View>
                  </View>
                </View>


                {/* Security Notice */}
                <View style={styles.securityNotice}>
                  <Lock size={16} color="#10B981" />
                  <Text style={styles.securityText}>
                    Tu información está protegida con encriptación SSL de 256 bits
                  </Text>
                </View>
                
                {/* Actions */}
                <View style={styles.cardFormActions}>
                  <Button
                    title="Volver"
                    onPress={() => setPaymentStep('methods')}
                    variant="outline"
                    size="large"
                  />
                  <Button
                    title={processing ? 'Procesando...' : `Pagar ${formatCurrency(getServicePrice())}`}
                    onPress={handleCardPayment}
                    loading={processing}
                    disabled={!validateCardForm() || processing}
                    size="large"
                  />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Document Type Modal */}
      <Modal
        visible={showDocumentTypes}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDocumentTypes(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.documentModal}>
            <Text style={styles.documentModalTitle}>Tipo de Documento</Text>
            {documentTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.documentOption,
                  documentType === type.value && styles.selectedDocumentOption
                ]}
                onPress={() => {
                  setDocumentType(type.value);
                  setShowDocumentTypes(false);
                }}
              >
                <Text style={[
                  styles.documentOptionText,
                  documentType === type.value && styles.selectedDocumentOptionText
                ]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Payment Loading Overlay con Barra de Progreso */}
      {paymentLoading && (
        <Modal
          visible={paymentLoading}
          transparent
          animationType="fade"
          statusBarTranslucent
        >
          <View style={styles.paymentLoadingOverlay}>
            <View style={styles.paymentLoadingContent}>
              {/* Logo de Mercado Pago */}
              <View style={styles.mpLogoContainer}>
                <Image
                  source={require('../../../assets/images/mercadopago.png')}
                  style={styles.mpLoadingLogo}
                  resizeMode="contain"
                />
              </View>

              <ActivityIndicator size="large" color="#00A650" style={{ marginBottom: 20 }} />

              <Text style={styles.paymentLoadingTitle}>Procesando pago...</Text>
              <Text style={styles.paymentLoadingSubtitle}>
                {paymentMessage}
              </Text>

              {/* Barra de progreso animada */}
              <View style={styles.progressBarContainer}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>

              <Text style={styles.loadingHint}>🔒 Serás redirigido a Mercado Pago de forma segura</Text>
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
    paddingBottom: 120,
  },
  serviceCard: {
    marginBottom: 16,
    alignItems: 'center',
    paddingVertical: 20,
  },
  serviceName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  boardingCategory: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#3B82F6',
    marginBottom: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  partnerName: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  petName: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginBottom: 8,
  },
  servicePrice: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  dateCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  weekendInfo: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginBottom: 12,
    backgroundColor: '#EFF6FF',
    padding: 8,
    borderRadius: 8,
  },
  noScheduleContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noScheduleText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  noScheduleSubtext: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  datesScroll: {
    flexDirection: 'row',
  },
  dateOption: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  selectedDateOption: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  todayDateOption: {
    borderColor: '#3B82F6',
    borderWidth: 2,
    backgroundColor: '#EFF6FF',
  },
  todayBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  todayBadgeText: {
    fontSize: 10,
    color: '#3B82F6',
  },
  todayText: {
    color: '#3B82F6',
    fontFamily: 'Inter-SemiBold',
  },
  dayName: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 2,
  },
  monthName: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedDateText: {
    color: '#FFFFFF',
  },
  timeCard: {
    marginBottom: 16,
  },
  timesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    width: '31.5%',
  },
  selectedTimeOption: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  bookedTimeOption: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    opacity: 0.6,
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    marginLeft: 6,
  },
  selectedTimeText: {
    color: '#FFFFFF',
  },
  bookedTimeText: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  notesCard: {
    marginBottom: 16,
  },
  notesInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    minHeight: 100,
  },
  confirmContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 16,
    paddingBottom: 32,
  },
  confirmSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmDate: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#111827',
  },
  confirmPrice: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  confirmButton: {
    backgroundColor: '#2D6A6F',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
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
    maxHeight: '85%',
    minHeight: '60%',
  },
  paymentModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
  },
  cardModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  paymentMethods: {
    gap: 16,
  },
  paymentMethod: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodIcon: {
    fontSize: 32,
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
  methodsContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  methodsHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 8,
  },
  methodsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  methodsSubtitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
    textAlign: 'center',
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
  paymentMethodIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  paymentMethodLogoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    padding: 8,
  },
  mercadoPagoLogo: {
    width: 40,
    height: 40,
  },
  paymentNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
  documentModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    margin: 20,
  },
  documentModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  documentOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedDocumentOption: {
    backgroundColor: '#2D6A6F',
  },
  documentOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  selectedDocumentOptionText: {
    color: '#FFFFFF',
  },
  // Card form styles
  bookingSummary: {
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  summaryTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#0369A1',
    marginBottom: 8,
  },
  summaryService: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  summaryDateTime: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 8,
  },
  summaryTotal: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  formSection: {
    marginBottom: 24,
  },
  formSectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  cardInputContainer: {
    position: 'relative',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginLeft: 8,
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  selectText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginLeft: 8,
  },
  cardTypeBadge: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardTypeText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  cardDetailsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cardDetailInput: {
    flex: 1,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  securityText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#166534',
    marginLeft: 8,
  },
  cardFormActions: {
    flexDirection: 'column',
    gap: 16,
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  paymentLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  paymentLoadingContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 48,
    alignItems: 'center',
    width: '85%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  mpLogoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#009EE3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  mpLoadingLogo: {
    width: 65,
    height: 65,
  },
  paymentLoadingTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  paymentLoadingSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#00A650',
    marginBottom: 28,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00A650',
    borderRadius: 4,
  },
  loadingHint: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    textAlign: 'center',
  },
});