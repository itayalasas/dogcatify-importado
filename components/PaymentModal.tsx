import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Alert, Image, ScrollView } from 'react-native';
import { X, CreditCard, User, FileText, Calendar, Lock, CircleCheck as CheckCircle } from 'lucide-react-native';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { colors, radius, spacing } from '../constants/theme';
import { formatPrice } from './shop/format';

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
      Alert.alert('Error', 'Ingresá tu nombre completo');
      return false;
    }
    if (!documentNumber.trim()) {
      Alert.alert('Error', 'Ingresá tu número de documento');
      return false;
    }
    if (cardNumber.replace(/\s/g, '').length < 13) {
      Alert.alert('Error', 'Ingresá un número de tarjeta válido');
      return false;
    }
    if (expiryDate.length !== 5) {
      Alert.alert('Error', 'Ingresá una fecha de vencimiento válida (MM/AA)');
      return false;
    }
    if (cvv.length < 3) {
      Alert.alert('Error', 'Ingresá un CVV válido');
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
          'Tu pago no pudo ser procesado. Verificá los datos de tu tarjeta e intentá nuevamente.',
          [{ text: 'Reintentar' }]
        );
      }
    } catch (error) {
      setStep('payment');
      Alert.alert('Error', 'Ocurrió un error procesando el pago. Intentá nuevamente.');
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

  const formatCurrency = (amount: number) => formatPrice(amount);

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
        <Lock size={24} color="#047857" />
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
        <Lock size={16} color="#047857" />
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
        Esperá mientras verificamos tu tarjeta
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
      <CheckCircle size={80} color="#047857" />
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
              <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Cerrar">
                <X size={24} color={colors.textSecondary} />
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
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    width: '100%',
    height: '80%',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    paddingTop: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 0,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  closeButton: {
    padding: spacing.xs,
  },
  
  // Summary Step
  summaryContent: {
    flex: 1,
   paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    flex: 1,
    paddingBottom: spacing.xl,
  },
  paymentContent: {
    flex: 1,
   paddingHorizontal: spacing.lg,
  },
  summaryHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.xxl,
  },
  summaryTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginTop: spacing.md,
  },
  serviceCard: {
    marginBottom: spacing.lg,
    backgroundColor: '#F8FAFC',
   marginHorizontal: -4,
   paddingHorizontal: spacing.xl,
   paddingVertical: spacing.lg,
  },
  serviceTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  serviceDetails: {
    gap: spacing.sm,
  },
  serviceName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: colors.primary,
  },
  providerName: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  petName: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.primary,
  },
  appointmentTime: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.text,
  },
  priceCard: {
    marginBottom: spacing.xxl,
   marginHorizontal: -4,
   paddingHorizontal: spacing.xl,
   paddingVertical: spacing.lg,
  },
  priceTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  priceLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  priceValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: colors.success,
  },
  summaryActions: {
    flexDirection: 'column',
    gap: spacing.md,
    padding: spacing.xl,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
  },

  // Payment Step
  paymentHeader: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  paymentTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginTop: spacing.sm,
  },
  paymentSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: colors.success,
    marginTop: spacing.xs,
  },
  formSection: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  cardInputContainer: {
    position: 'relative',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  selectText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  cardTypeBadge: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -12,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  cardTypeText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: colors.white,
  },
  cardDetailsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cardDetailInput: {
    flex: 1,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.xxl,
  },
  securityText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#166534',
    marginLeft: spacing.sm,
  },
  paymentActions: {
    flexDirection: 'column',
    gap: spacing.md,
    padding: spacing.xl,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
  },

  // Document Type Modal
  documentModal: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
    margin: spacing.xl,
  },
  documentModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  documentOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  selectedDocumentOption: {
    backgroundColor: colors.primary,
  },
  documentOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: colors.text,
  },
  selectedDocumentOptionText: {
    color: colors.white,
  },

  // Processing Step
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  processingAnimation: {
    marginBottom: spacing.xxl,
  },
  processingTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  processingSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  processingDetails: {
    alignItems: 'center',
  },
  processingAmount: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: colors.success,
    marginBottom: spacing.sm,
  },
  processingCard: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
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
    color: colors.success,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  successSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  successDetails: {
    alignItems: 'center',
  },
  successAmount: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: colors.success,
    marginBottom: spacing.sm,
  },
  successService: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: colors.text,
  },
});