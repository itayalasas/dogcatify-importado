import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Tag, CheckCircle, XCircle, X } from 'lucide-react-native';

export interface GamePromotion {
  id: string;
  userId: string;
  title: string;
  description: string;
  discountCode: string;
  discountPercent: number;
  discountAmount: number;
  isClaimed: boolean;
  expiresAt: string | null;
}

interface GamePromoInputProps {
  promoCode: string;
  onChangeCode: (code: string) => void;
  isApplying: boolean;
  errorMessage: string;
  appliedPromo: any | null; // using any to avoid import cycles, or we can use the GamePromotion interface
  onApply: () => void;
  onRemove: () => void;
  formatCurrency: (val: number) => string;
}

export const GamePromoInput: React.FC<GamePromoInputProps> = ({
  promoCode,
  onChangeCode,
  isApplying,
  errorMessage,
  appliedPromo,
  onApply,
  onRemove,
  formatCurrency
}) => {
  const isError = !!errorMessage;

  if (appliedPromo) {
    const isPercent = !!appliedPromo.discountPercent;
    
    return (
      <View style={styles.appliedContainer}>
        <View style={styles.appliedLeft}>
          <CheckCircle size={20} color="#10B981" />
          <View style={styles.appliedInfo}>
            <Text style={styles.appliedTitle}>
              {isPercent ? `${appliedPromo.discountPercent}% OFF total` : `-${formatCurrency(appliedPromo.discountAmount)} total`}
            </Text>
            <Text style={styles.appliedCode}>Código: {appliedPromo.discountCode}</Text>
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
      <Text style={styles.label}>¿Tienes un código de descuento?</Text>
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
          editable={!isApplying}
          returnKeyType="done"
          onSubmitEditing={onApply}
        />
        <TouchableOpacity
          style={[styles.applyBtn, isApplying && styles.applyBtnDisabled]}
          onPress={onApply}
          disabled={isApplying || !promoCode.trim()}
          activeOpacity={0.7}
        >
          {isApplying ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.applyBtnText}>Aplicar</Text>
          )}
        </TouchableOpacity>
      </View>

      {isError ? (
        <View style={styles.errorRow}>
          <XCircle size={14} color="#EF4444" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <Text style={styles.hint}>
        🐕 Gana códigos jugando <Text style={styles.hintBold}>Patitas al Rescate</Text> desde DogCatiFy
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
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
    paddingVertical: 12,
    paddingRight: 8,
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    letterSpacing: 1,
  },
  applyBtn: {
    backgroundColor: '#2D6A6F',
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    fontWeight: '600',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    flex: 1,
    marginLeft: 4,
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    lineHeight: 17,
  },
  hintBold: {
    fontWeight: '600',
    color: '#6B7280',
  },
  appliedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    borderRadius: 12,
    padding: 14,
    marginVertical: 4,
  },
  appliedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  appliedInfo: {
    flex: 1,
    marginLeft: 10,
  },
  appliedTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 2,
  },
  appliedCode: {
    fontSize: 12,
    fontWeight: '500',
    color: '#059669',
    letterSpacing: 0.5,
  },
  removeButton: {
    padding: 4,
  },
});
