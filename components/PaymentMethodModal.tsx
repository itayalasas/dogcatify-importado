import React from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CreditCard, X } from 'lucide-react-native';

interface PaymentMethodModalProps {
  visible: boolean;
  totalLabel: string;
  onClose: () => void;
  onMercadoPago: () => void;
  loadingMercadoPago?: boolean;
  secureNote?: string;
}

export function PaymentMethodModal({
  visible,
  totalLabel,
  onClose,
  onMercadoPago,
  loadingMercadoPago = false,
  secureNote = 'Seras redirigido para completar el pago de forma segura',
}: PaymentMethodModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.iconSpacer} />
            <Text style={styles.title}>Metodo de Pago</Text>
            <TouchableOpacity onPress={onClose} style={styles.iconButton}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.methodsHeader}>
              <CreditCard size={38} color="#2D6A6F" />
              <Text style={styles.methodsTitle}>Selecciona tu metodo de pago</Text>
              <Text style={styles.methodsSubtitle}>Total: {totalLabel}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.methodCard,
                loadingMercadoPago && styles.methodCardDisabled,
              ]}
              onPress={onMercadoPago}
              disabled={loadingMercadoPago}
              activeOpacity={0.85}
            >
              <View style={styles.logoWrap}>
                <Image
                  source={require('@/assets/images/mercadopago.png')}
                  style={styles.mercadoPagoLogo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>Mercado Pago</Text>
                <Text style={styles.methodDescription}>
                  {loadingMercadoPago
                    ? 'Abriendo checkout seguro...'
                    : 'Pago seguro con tarjetas, transferencias y mas'}
                </Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.note}>{secureNote}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 34,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  iconSpacer: {
    width: 40,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 24,
  },
  methodsHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  methodsTitle: {
    marginTop: 12,
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  methodsSubtitle: {
    marginTop: 6,
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  methodCardDisabled: {
    opacity: 0.72,
  },
  logoWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  mercadoPagoLogo: {
    width: 50,
    height: 50,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  methodDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  note: {
    textAlign: 'center',
    marginTop: 22,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
});
