import React from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronRight, CreditCard, Lock, X } from 'lucide-react-native';
import { colors, radius, spacing, typography, shadows, touchTarget } from '../constants/theme';

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
  secureNote = 'Serás redirigido para completar el pago de forma segura',
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
            <Text style={styles.title} accessibilityRole="header">Método de pago</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.methodsHeader}>
              <View style={styles.headerIcon}>
                <CreditCard size={28} color={colors.primary} />
              </View>
              <Text style={styles.methodsTitle}>Seleccioná tu método de pago</Text>
              <Text style={styles.methodsSubtitle}>Total a pagar: {totalLabel}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.methodCard,
                loadingMercadoPago && styles.methodCardDisabled,
              ]}
              onPress={onMercadoPago}
              disabled={loadingMercadoPago}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Pagar con Mercado Pago, total ${totalLabel}`}
              accessibilityState={{ disabled: loadingMercadoPago, busy: loadingMercadoPago }}
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
                    ? 'Abriendo el pago seguro...'
                    : 'Tarjetas de crédito, débito, transferencias y más'}
                </Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </TouchableOpacity>

            <View style={styles.noteRow}>
              <Lock size={14} color={colors.textSecondary} />
              <Text style={styles.note}>{secureNote}</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xxxl,
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconSpacer: {
    width: touchTarget,
  },
  iconButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    ...typography.heading,
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  methodsHeader: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodsTitle: {
    marginTop: spacing.md,
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
  },
  methodsSubtitle: {
    marginTop: spacing.xs,
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  methodCardDisabled: {
    opacity: 0.6,
  },
  logoWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  mercadoPagoLogo: {
    width: 44,
    height: 44,
  },
  methodInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  methodTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  methodDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
  },
  note: {
    textAlign: 'center',
    ...typography.bodySmall,
    color: colors.textSecondary,
    flexShrink: 1,
  },
});
