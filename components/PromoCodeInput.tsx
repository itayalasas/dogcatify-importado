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
          <CheckCircle size={20} color="#10B981" />
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
        <TouchableOpacity onPress={onRemove} style={styles.removeButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={18} color="#6B7280" />
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
          placeholderTextColor="#9CA3AF"
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
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  inputRowError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5',
  },
  iconWrap: {
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    paddingRight: 8,
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    letterSpacing: 1,
  },
  applyBtn: {
    backgroundColor: '#2D6A6F',
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
    color: '#FFFFFF',
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
    color: '#EF4444',
    flex: 1,
  },
  hint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 8,
    lineHeight: 17,
  },
  hintBold: {
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  // Estado: promo aplicada
  appliedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    borderRadius: 12,
    padding: 14,
    marginVertical: 8,
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
    marginBottom: 2,
  },
  appliedCode: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#059669',
    letterSpacing: 0.5,
  },
  appliedDesc: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6EE7B7',
    marginTop: 2,
  },
  removeButton: {
    padding: 4,
  },
});
