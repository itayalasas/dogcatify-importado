import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, CreditCard, Landmark, Lock, ShieldCheck, Wallet, X } from 'lucide-react-native';
import { colors, radius, spacing, typography, shadows, touchTarget } from '../constants/theme';

interface PaymentMethodModalProps {
  visible: boolean;
  totalLabel: string;
  onClose: () => void;
  onMercadoPago: () => void;
  loadingMercadoPago?: boolean;
  secureNote?: string;
}

const MERCADO_PAGO_OPTIONS = [
  { key: 'credit', label: 'Crédito', Icon: CreditCard },
  { key: 'debit', label: 'Débito', Icon: Wallet },
  { key: 'transfer', label: 'Transferencia', Icon: Landmark },
];

export function PaymentMethodModal({
  visible,
  totalLabel,
  onClose,
  onMercadoPago,
  loadingMercadoPago = false,
  secureNote = 'Serás redirigido para completar el pago de forma segura',
}: PaymentMethodModalProps) {
  const insets = useSafeAreaInsets();
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      sheetAnim.setValue(0);
      Animated.timing(sheetAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, sheetAnim]);

  const handleClose = () => {
    if (!loadingMercadoPago) onClose();
  };

  const sheetStyle = {
    opacity: sheetAnim,
    transform: [
      {
        translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [48, 0] }),
      },
    ],
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar selección de pago"
        />

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg },
            sheetStyle,
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">Finalizar pago</Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={loadingMercadoPago}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.totalCard}>
            <View>
              <Text style={styles.totalLabel}>Total a pagar</Text>
              <Text
                style={styles.totalAmount}
                accessibilityLabel={`Total a pagar ${totalLabel}`}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {totalLabel}
              </Text>
            </View>
            <View style={styles.totalBadge}>
              <ShieldCheck size={16} color={colors.onPrimary} />
              <Text style={styles.totalBadgeText}>Pago seguro</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Elegí cómo pagar</Text>

          <TouchableOpacity
            style={[styles.methodCard, loadingMercadoPago && styles.methodCardBusy]}
            onPress={onMercadoPago}
            disabled={loadingMercadoPago}
            activeOpacity={0.9}
            accessibilityRole="radio"
            accessibilityLabel={`Mercado Pago, total ${totalLabel}`}
            accessibilityState={{ checked: true, disabled: loadingMercadoPago, busy: loadingMercadoPago }}
          >
            <View style={styles.methodTop}>
              <View style={styles.logoTile}>
                <Image
                  source={require('@/assets/images/mercadopago.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.methodInfo}>
                <View style={styles.methodTitleRow}>
                  <Text style={styles.methodTitle}>Mercado Pago</Text>
                  <View style={styles.recommendedPill}>
                    <Text style={styles.recommendedText}>Recomendado</Text>
                  </View>
                </View>
                <Text style={styles.methodDescription}>
                  Tarjetas, dinero en cuenta, transferencias y más
                </Text>
              </View>
              <View style={styles.radioOn}>
                <Check size={14} color={colors.onPrimary} strokeWidth={3} />
              </View>
            </View>

            <View style={styles.optionsRow}>
              {MERCADO_PAGO_OPTIONS.map(({ key, label, Icon }) => (
                <View key={key} style={styles.optionChip}>
                  <Icon size={14} color={colors.primary} />
                  <Text style={styles.optionText}>{label}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.payButton, loadingMercadoPago && styles.payButtonBusy]}
            onPress={onMercadoPago}
            disabled={loadingMercadoPago}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Pagar ${totalLabel} con Mercado Pago`}
            accessibilityState={{ disabled: loadingMercadoPago, busy: loadingMercadoPago }}
          >
            {loadingMercadoPago ? (
              <>
                <ActivityIndicator color={colors.onPrimary} />
                <Text style={styles.payButtonText}>Abriendo el pago seguro...</Text>
              </>
            ) : (
              <>
                <Lock size={18} color={colors.onPrimary} />
                <Text style={styles.payButtonText}>Pagar {totalLabel}</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.noteRow}>
            <ShieldCheck size={14} color={colors.textSecondary} />
            <Text style={styles.note}>
              {secureNote}. Tus datos de tarjeta los procesa Mercado Pago, no los guardamos.
            </Text>
          </View>
        </Animated.View>
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    ...shadows.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  closeButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    marginBottom: spacing.xxl,
    ...shadows.md,
  },
  totalLabel: {
    ...typography.label,
    color: colors.primaryMuted,
  },
  totalAmount: {
    ...typography.display,
    color: colors.onPrimary,
    marginTop: spacing.xxs,
  },
  totalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  totalBadgeText: {
    ...typography.captionStrong,
    color: colors.onPrimary,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  methodCard: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: colors.primarySoft,
  },
  methodCardBusy: {
    opacity: 0.7,
  },
  methodTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoTile: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  logo: {
    width: 40,
    height: 40,
  },
  methodInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xxs,
  },
  methodTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  recommendedPill: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  recommendedText: {
    ...typography.captionStrong,
    color: colors.onAccent,
  },
  methodDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  radioOn: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  optionText: {
    ...typography.caption,
    color: colors.text,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.xxl,
    ...shadows.md,
  },
  payButtonBusy: {
    backgroundColor: colors.primaryPressed,
  },
  payButtonText: {
    ...typography.bodyStrong,
    color: colors.onPrimary,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  note: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    flexShrink: 1,
  },
});
