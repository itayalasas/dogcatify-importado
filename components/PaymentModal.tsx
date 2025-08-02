import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Alert, Image, ScrollView } from 'react-native';
import { X, CreditCard, User, FileText, Calendar, Lock, CircleCheck as CheckCircle } from 'lucide-react-native';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onPaymentSuccess: (paymentData: any) => void;
  paymentData: {
    serviceName: string;
    providerName: string;
    price: number;
    hasShipping?: boolean;
    shippingCost?: number;
    petName?: string;
    date?: string;
    time?: string;
  };
}

interface CardType {
  name: string;
  pattern: RegExp;
  logo: string;
  color: string;
}

const cardTypes: CardType[] = [
  {
    name: 'Visa',
    pattern: /^4/,
    logo: '💳',
    color: '#1A1F71'
  },
  {
    name: 'Mastercard',
    pattern: /^5[1-5]/,
    logo: '💳',
    color: '#EB001B'
  },
  {
    name: 'American Express',
    pattern: /^3[47]/,
    logo: '💳',
    color: '#006FCF'
  },
  {
    name: 'Diners Club',
    pattern: /^3[0689]/,
    logo: '💳',
    color: '#0079BE'
  },
  {
    name: 'Discover',
    pattern: /^6(?:011|5)/,
    logo: '💳',
    color: '#FF6000'
  }
];

const documentTypes = [
  { value: 'CI', label: 'Cédula de Identidad' },
  { value: 'RUT', label: 'RUT' },
  { value: 'PASSPORT', label: 'Pasaporte' },
  { value: 'OTHER', label: 'Otro' }
];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  onClose,
  onPaymentSuccess,
  paymentData
}) => {
  // Form state
  const [step, setStep] = useState<'summary' | 'payment' | 'processing' | 'success'>('summary');
  const [fullName, setFullName] = useState('');
  const [documentType, setDocumentType] = useState('CI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [detectedCardType, setDetectedCardType] = useState<CardType | null>(null);
  const [showDocumentTypes, setShowDocumentTypes] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setStep('summary');
      setFullName('');
      setDocumentType('CI');
      setDocumentNumber('');
      setCardNumber('');
      setExpiryDate('');
      setCvv('');
      setDetectedCardType(null);
      setProcessing(false);
    }
  }, [visible]);

  // Detect card type based on number
  useEffect(() => {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    const detected = cardTypes.find(type => type.pattern.test(cleanNumber));
    setDetectedCardType(detected || null);
  }, [cardNumber]);

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

  const validateForm = () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu nombre completo');
      return false;
    }
    if (!documentNumber.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu número de documento');
      return false;
    }
    if (cardNumber.replace(/\s/g, '').length < 13) {
      Alert.alert('Error', 'Por favor ingresa un número de tarjeta válido');
      return false;
    }
    if (expiryDate.length !== 5) {
      Alert.alert('Error', 'Por favor ingresa una fecha de vencimiento válida (MM/AA)');
      return false;
    }
    if (cvv.length < 3) {
      Alert.alert('Error', 'Por favor ingresa un CVV válido');
      return false;
    }
    return true;
  };

  const handlePayment = async () => {
    if (!validateForm()) return;

    setProcessing(true);
    setStep('processing');

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Simulate random success/failure (90% success rate)
      const isSuccess = Math.random() > 0.1;

      if (isSuccess) {
        setStep('success');
        
        // Prepare payment result data
        const paymentResult = {
          transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          amount: calculateTotal(),
          cardType: detectedCardType?.name || 'Desconocida',
          cardLast4: cardNumber.replace(/\s/g, '').slice(-4),
          customerName: fullName,
          documentType,
          documentNumber,
          timestamp: new Date().toISOString(),
          status: 'approved'
        };

        // Wait a moment to show success, then call callback
        setTimeout(() => {
          onPaymentSuccess(paymentResult);
          onClose();
        }, 2000);
      } else {
        setStep('payment');
        Alert.alert(
          'Pago Rechazado',
          'Tu pago no pudo ser procesado. Por favor verifica los datos de tu tarjeta e intenta nuevamente.',
          [{ text: 'Reintentar' }]
        );
      }
    } catch (error) {
      setStep('payment');
      Alert.alert('Error', 'Ocurrió un error procesando el pago. Intenta nuevamente.');
    } finally {
      setProcessing(false);
    }
  };

  const calculateSubtotal = () => {
    return paymentData.price || 0;
  };

  const calculateShipping = () => {
    return paymentData.hasShipping ? (paymentData.shippingCost || 0) : 0;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateShipping();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
    }).format(amount);
  };

  const renderSummaryStep = () => (
    <>
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryContent}>
        <View style={styles.summaryHeader}>
          <CreditCard size={32} color="#2D6A6F" />
          <Text style={styles.summaryTitle}>Resumen del Pago</Text>
        </View>

        <Card style={styles.serviceCard}>
          <Text style={styles.serviceTitle}>Servicio a Contratar</Text>
          <View style={styles.serviceDetails}>
            <Text style={styles.serviceName}>{paymentData.serviceName}</Text>
            <Text style={styles.providerName}>{paymentData.providerName}</Text>
            {paymentData.petName && (
              <Text style={styles.petName}>Para: {paymentData.petName}</Text>
            )}
            {paymentData.date && paymentData.time && (
              <Text style={styles.appointmentTime}>
                📅 {paymentData.date} a las {paymentData.time}
              </Text>
            )}
          </View>
        </Card>

        <Card style={styles.priceCard}>
          <Text style={styles.priceTitle}>Detalle de Precios</Text>
          
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Servicio</Text>
            <Text style={styles.priceValue}>{formatCurrency(calculateSubtotal())}</Text>
          </View>
          
          {paymentData.hasShipping && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Envío</Text>
              <Text style={styles.priceValue}>{formatCurrency(calculateShipping())}</Text>
            </View>
          )}
          
          <View style={styles.divider} />
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total a Pagar</Text>
            <Text style={styles.totalValue}>{formatCurrency(calculateTotal())}</Text>
          </View>
        </Card>
        </View>
      </ScrollView>

      <View style={styles.summaryActions}>
        <Button
          title="Cancelar"
          onPress={onClose}
          variant="outline"
          size="large"
        />
        <Button
          title="Continuar al Pago"
          onPress={() => setStep('payment')}
          size="large"
        />
      </View>
    </>
  );

  const renderPaymentStep = () => (
    <>
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.paymentContent}>
      <View style={styles.paymentHeader}>
        <Lock size={24} color="#10B981" />
        <Text style={styles.paymentTitle}>Pago Seguro</Text>
        <Text style={styles.paymentSubtitle}>
          Total: {formatCurrency(calculateTotal())}
        </Text>
      </View>

      {/* Personal Information */}
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Información Personal</Text>
        
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
        <Text style={styles.sectionTitle}>Información de la Tarjeta</Text>
        
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
                secureTextEntry
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
        </View>
      </ScrollView>

      <View style={styles.paymentActions}>
        <Button
          title="Volver"
          onPress={() => setStep('summary')}
          variant="outline"
          size="large"
        />
        <Button
          title={`Pagar ${formatCurrency(calculateTotal())}`}
          onPress={handlePayment}
          loading={processing}
          size="large"
        />
      </View>

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
    </>
  );

  const renderProcessingStep = () => (
    <View style={styles.processingContainer}>
      <View style={styles.processingAnimation}>
        <CreditCard size={64} color="#2D6A6F" />
      </View>
      <Text style={styles.processingTitle}>Procesando Pago...</Text>
      <Text style={styles.processingSubtitle}>
        Por favor espera mientras verificamos tu tarjeta
      </Text>
      <View style={styles.processingDetails}>
        <Text style={styles.processingAmount}>{formatCurrency(calculateTotal())}</Text>
        <Text style={styles.processingCard}>
          {detectedCardType?.name || 'Tarjeta'} •••• {cardNumber.slice(-4)}
        </Text>
      </View>
    </View>
  );

  const renderSuccessStep = () => (
    <View style={styles.successContainer}>
      <CheckCircle size={80} color="#10B981" />
      <Text style={styles.successTitle}>¡Pago Exitoso!</Text>
      <Text style={styles.successSubtitle}>
        Tu reserva ha sido confirmada y el pago procesado correctamente
      </Text>
      <View style={styles.successDetails}>
        <Text style={styles.successAmount}>{formatCurrency(calculateTotal())}</Text>
        <Text style={styles.successService}>{paymentData.serviceName}</Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {step === 'summary' && 'Resumen del Pago'}
              {step === 'payment' && 'Datos de Pago'}
              {step === 'processing' && 'Procesando...'}
              {step === 'success' && '¡Éxito!'}
            </Text>
            {step !== 'processing' && step !== 'success' && (
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          {step === 'summary' && renderSummaryStep()}
          {step === 'payment' && renderPaymentStep()}
          {step === 'processing' && renderProcessingStep()}
          {step === 'success' && renderSuccessStep()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    height: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 0,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  
  // Summary Step
  summaryContent: {
    flex: 1,
   paddingHorizontal: 16,
  },
  scrollContent: {
    flex: 1,
    paddingBottom: 20,
  },
  paymentContent: {
    flex: 1,
   paddingHorizontal: 16,
  },
  summaryHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginTop: 12,
  },
  serviceCard: {
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
   marginHorizontal: -4,
   paddingHorizontal: 20,
   paddingVertical: 16,
  },
  serviceTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  serviceDetails: {
    gap: 8,
  },
  serviceName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
  },
  providerName: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  petName: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
  appointmentTime: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  priceCard: {
    marginBottom: 24,
   marginHorizontal: -4,
   paddingHorizontal: 20,
   paddingVertical: 16,
  },
  priceTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  totalValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  summaryActions: {
    flexDirection: 'column',
    gap: 12,
    padding: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },

  // Payment Step
  paymentHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  paymentTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginTop: 8,
  },
  paymentSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#10B981',
    marginTop: 4,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
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
    marginBottom: 24,
  },
  securityText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#166534',
    marginLeft: 8,
  },
  paymentActions: {
    flexDirection: 'column',
    gap: 12,
    padding: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },

  // Document Type Modal
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

  // Processing Step
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  processingAnimation: {
    marginBottom: 24,
  },
  processingTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
  },
  processingSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  processingDetails: {
    alignItems: 'center',
  },
  processingAmount: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
    marginBottom: 8,
  },
  processingCard: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },

  // Success Step
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
    marginTop: 16,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  successDetails: {
    alignItems: 'center',
  },
  successAmount: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
    marginBottom: 8,
  },
  successService: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#111827',
  },
});

export { PaymentModal };