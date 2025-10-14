import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal, TextInput, ActivityIndicator, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Clock, CreditCard, X, Lock, User, FileText, CircleCheck as CheckCircle } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useAuth } from '../../../contexts/AuthContext';
import { supabaseClient } from '@/lib/supabase';
import { createServiceBookingOrder } from '../../../utils/mercadoPago';

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
  const { serviceId, partnerId, petId } = useLocalSearchParams<{
    serviceId: string;
    partnerId: string;
    petId: string;
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
  
  // Payment flow
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'methods' | 'card' | 'processing'>('methods');
  
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

  useEffect(() => {
    if (serviceId && partnerId && petId) {
      fetchBookingData();
    }
  }, [serviceId, partnerId, petId]);

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
    if (!partnerId) return;
    
    try {
      console.log('Fetching booked times for date:', date.toDateString());
      
      // Get bookings for the selected date and partner
      const { data: bookings, error } = await supabaseClient
        .from('bookings')
        .select('time, status')
        .eq('partner_id', partnerId)
        .eq('date', date.toISOString().split('T')[0])
        .in('status', ['pending', 'confirmed', 'pending_payment']);
      
      if (error) {
        console.error('Error fetching booked times:', error);
        return;
      }
      
      const bookedTimeSlots = bookings?.map(booking => booking.time) || [];
      console.log('Booked times for date:', bookedTimeSlots);
      setBookedTimes(bookedTimeSlots);
    } catch (error) {
      console.error('Error fetching booked times:', error);
    }
  };

  // Fetch booked times when date changes
  useEffect(() => {
    if (selectedDate && partnerId) {
      fetchBookedTimes(selectedDate);
    }
  }, [selectedDate, partnerId]);

  const generateAvailableDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
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
    }).format(amount);
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
    if (!selectedDate || !selectedTime) {
      Alert.alert('Error', 'Por favor selecciona fecha y hora');
      return;
    }
    setShowPaymentModal(true);
  };

  const handlePaymentMethodSelect = (method: string) => {
    if (method === 'mercadopago') {
      handleMercadoPagoPayment();
    } else if (method === 'card') {
      setPaymentStep('card');
    }
  };

  const handleMercadoPagoPayment = async () => {
    if (!selectedDate || !selectedTime || !service || !partner || !pet) {
      Alert.alert('Error', 'Información de reserva incompleta');
      return;
    }

    setPaymentLoading(true);
    try {
      const bookingData = {
        serviceId: service.id,
        partnerId: partner.id,
        customerId: currentUser!.id,
        petId: pet.id,
        date: selectedDate,
        time: selectedTime,
        notes: notes.trim() || null,
        serviceName: service.name,
        partnerName: partner.business_name,
        petName: pet.name,
        totalAmount: service.price,
        customerInfo: currentUser!
      };

      const result = await createServiceBookingOrder(bookingData);

      if (result.success && result.paymentUrl) {
        setShowPaymentModal(false);
        await Linking.openURL(result.paymentUrl);
      } else {
        throw new Error(result.error || 'Error creando la orden');
      }
    } catch (error) {
      console.error('Error with Mercado Pago payment:', error);
      Alert.alert('Error', 'No se pudo procesar el pago con Mercado Pago');
    } finally {
      setPaymentLoading(false);
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
        
        Alert.alert(
          '¡Pago Exitoso! 🎉',
          `Tu reserva ha sido confirmada:\n\n📅 ${selectedDate?.toLocaleDateString()}\n🕐 ${selectedTime}\n💰 ${formatCurrency(service?.price || 0)}\n\nRecibirás una confirmación por email.`,
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
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando información de la reserva...</Text>
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
        {/* Service Info */}
        <Card style={styles.serviceCard}>
          <Text style={styles.serviceName}>{service?.name}</Text>
          <Text style={styles.partnerName}>{partner?.business_name}</Text>
          <Text style={styles.petName}>Para: {pet?.name}</Text>
          <Text style={styles.servicePrice}>{formatCurrency(service?.price || 0)}</Text>
        </Card>

        {/* Date Selection */}
        <Card style={styles.dateCard}>
          <Text style={styles.sectionTitle}>Selecciona una fecha</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datesScroll}>
            {generateAvailableDates().map((date, index) => {
              const dateInfo = formatDate(date);
              const isSelected = selectedDate?.toDateString() === date.toDateString();
              const isToday = index === 0;
              
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
                    styles.dayName,
                    isSelected && styles.selectedDateText
                  ]}>
                    {isToday ? 'Hoy' : dateInfo.dayName}
                  </Text>
                  <Text style={[
                    styles.dayNumber,
                    isSelected && styles.selectedDateText
                  ]}>
                    {dateInfo.day}
                  </Text>
                  <Text style={[
                    styles.monthName,
                    isSelected && styles.selectedDateText
                  ]}>
                    {dateInfo.month}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Card>

        {/* Time Selection */}
        {selectedDate && (
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
                    {isBooked ? `${time} (Ocupado)` : time}
                  </Text>
                </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        )}

        {/* Notes */}
        <Card style={styles.notesCard}>
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
        </Card>
      </ScrollView>

      {/* Fixed Confirm Button */}
      {selectedDate && selectedTime && (
        <View style={styles.confirmContainer}>
          <View style={styles.confirmSummary}>
            <Text style={styles.confirmDate}>
              {selectedDate.toLocaleDateString()} a las {selectedTime}
            </Text>
            <Text style={styles.confirmPrice}>
              {formatCurrency(service?.price || 0)}
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
              <View style={styles.paymentMethods}>
                <TouchableOpacity
                  style={styles.paymentMethod}
                  onPress={() => handlePaymentMethodSelect('mercadopago')}
                  disabled={paymentLoading}
                >
                  <View style={styles.paymentMethodContent}>
                    <Text style={styles.paymentMethodIcon}>💳</Text>
                    <View style={styles.paymentMethodInfo}>
                      <Text style={styles.paymentMethodTitle}>Mercado Pago</Text>
                      <Text style={styles.paymentMethodDescription}>
                        Pago seguro con tarjetas, transferencias y más
                      </Text>
                    </View>
                  </View>
                  {paymentLoading && <ActivityIndicator size="small" color="#00A650" />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.paymentMethod}
                  onPress={() => handlePaymentMethodSelect('card')}
                >
                  <View style={styles.paymentMethodContent}>
                    <Text style={styles.paymentMethodIcon}>💳</Text>
                    <View style={styles.paymentMethodInfo}>
                      <Text style={styles.paymentMethodTitle}>Tarjeta de Crédito/Débito</Text>
                      <Text style={styles.paymentMethodDescription}>
                        Visa, Mastercard, American Express
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
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
                    {selectedDate?.toLocaleDateString()} a las {selectedTime}
                  </Text>
                  <Text style={styles.summaryTotal}>
                    Total: {formatCurrency(service?.price || 0)}
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
                    title={processing ? 'Procesando...' : `Pagar ${formatCurrency(service?.price || 0)}`}
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
    paddingBottom: 120, // Space for fixed button
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
  },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
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
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    marginLeft: 8,
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
});