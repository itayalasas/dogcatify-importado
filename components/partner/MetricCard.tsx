import React, { ReactNode } from 'react';
import { View, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { AppText } from '../ui';
import { colors, radius, shadows, spacing } from '../../constants/theme';

interface MetricCardProps {
  icon: ReactNode;
  /** Fondo del círculo del ícono (un token *Soft). */
  iconBackground?: string;
  value: string;
  label: string;
  onPress?: () => void;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/** Tarjeta de métrica del panel: ícono, valor grande y etiqueta. Opcionalmente tocable. */
export const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  iconBackground = colors.primarySoft,
  value,
  label,
  onPress,
  accessibilityHint,
  style,
}) => {
  const content = (
    <>
      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: iconBackground }]}>{icon}</View>
        {onPress ? <ChevronRight size={18} color={colors.textTertiary} /> : null}
      </View>
      <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </AppText>
      <AppText variant="caption" color="textSecondary" numberOfLines={1}>
        {label}
      </AppText>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.card, style]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityHint={accessibilityHint}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, style]} accessible accessibilityLabel={`${label}: ${value}`}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    minHeight: 116,
    ...shadows.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
