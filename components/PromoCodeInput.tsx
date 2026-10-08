import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Tag, CheckCircle, XCircle, X } from 'lucide-react-native';
import type { PromoValidationStatus, AppliedPromo } from '../hooks/usePromoCode';
import { colors, radius, spacing } from '../constants/theme';

interface PromoCodeInputProps {
  promoCode: string;
  onChangeCode: (code: string) => void;
  status: PromoValidationStatus;
  errorMessage: string;
  appliedPromo: AppliedPromo | null;
  onApply: () => void;
  onRemove: () => void;
}

export const PromoCodeInput: React.FC<PromoCodeInputProps> = ({
  promoCode,
  onChangeCode,
  status,
  errorMessage,
  appliedPromo,
  onApply,
  onRemove,
}) => {
  const isLoading = status === 'loading';
  const isValid = status === 'valid' && appliedPromo;
  const isError = ['invalid', 'used', 'expired'].includes(status);

  if (isValid && appliedPromo) {
    return (
      <View style={styles.appliedContainer}>
        <View style={styles.appliedLeft}>
          <CheckCircle size={20} color="#047857" />
          <View style={styles.appliedInfo}>
            <Text style={styles.appliedTitle}>
              🎟️ {appliedPromo.discountPercent}% OFF aplicado
            </Text>
            <Text style={styles.appliedCode}>Código: {appliedPromo.code}</Text>
            {appliedPromo.description ? (
              <Text style={styles.appliedDesc}>{appliedPromo.description}</Text>
            ) : null}
          </View>
        </View>
        <TouchableOpacity
          onPress={onRemove}
          style={styles.removeButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Quitar código promocional"
        >
          <X size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>¿Tenés un código de descuento?</Text>
      <View style={[styles.inputRow, isError && styles.inputRowError]}>
        <View style={styles.iconWrap}>
          <Tag size={18} color={isError ? '#EF4444' : '#6B7280'} />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Ej: RESCATE15"
          placeholderTextColor="#6B7280"
          value={promoCode}
          onChangeText={(text) => onChangeCode(text.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!isLoading}
          returnKeyType="done"
          onSubmitEditing={onApply}
        />
        <TouchableOpacity
          style={[styles.applyBtn, isLoading && styles.applyBtnDisabled]}
          onPress={onApply}
          disabled={isLoading || !promoCode.trim()}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.applyBtnText}>Aplicar</Text>
          )}
        </TouchableOpacity>
      </View>

      {isError && errorMessage ? (
        <View style={styles.errorRow}>
          <XCircle size={14} color="#EF4444" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <Text style={styles.hint}>
        🎮 Ganás códigos jugando <Text style={styles.hintBold}>Patitas al Rescate</Text> desde DogCatiFy
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: spacing.sm,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  inputRowError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5',
  },
  iconWrap: {
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    paddingRight: spacing.sm,
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: colors.text,
    letterSpacing: 1,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  applyBtnDisabled: {
    opacity: 0.5,
  },
  applyBtnText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.danger,
    flex: 1,
  },
  hint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 17,
  },
  hintBold: {
    fontFamily: 'Inter-SemiBold',
    color: colors.textSecondary,
  },
  // Estado: promo aplicada
  appliedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.successSoft,
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    borderRadius: radius.md,
    padding: 14,
    marginVertical: spacing.sm,
  },
  appliedLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  appliedInfo: {
    flex: 1,
  },
  appliedTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#065F46',
    marginBottom: spacing.xxs,
  },
  appliedCode: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: colors.success,
    letterSpacing: 0.5,
  },
  appliedDesc: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6EE7B7',
    marginTop: spacing.xxs,
  },
  removeButton: {
    padding: spacing.xs,
  },
});
