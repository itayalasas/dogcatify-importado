import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, spacing, typography, maxFontScale } from '../../constants/theme';

interface BookingStepsProps {
  steps: string[];
  /** Índice del paso actual (0 = primero). Los anteriores se marcan como hechos. */
  current: number;
  style?: StyleProp<ViewStyle>;
}

/** Indicador de pasos del flujo de reserva (Fecha → Horario → Confirmar). */
export const BookingSteps: React.FC<BookingStepsProps> = ({ steps, current, style }) => (
  <View
    style={[styles.container, style]}
    accessible
    accessibilityRole="progressbar"
    accessibilityLabel={`Paso ${Math.min(current + 1, steps.length)} de ${steps.length}: ${steps[Math.min(current, steps.length - 1)]}`}
  >
    {steps.map((label, index) => {
      const done = index < current;
      const active = index === current;
      return (
        <React.Fragment key={label}>
          {index > 0 && <View style={[styles.line, (done || active) && styles.lineActive]} />}
          <View style={styles.step}>
            <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
              {done ? (
                <Check size={14} color={colors.onPrimary} strokeWidth={3} />
              ) : (
                <Text style={[styles.dotText, active && styles.dotTextActive]} maxFontSizeMultiplier={maxFontScale.compact}>
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              style={[styles.label, (done || active) && styles.labelActive]}
              numberOfLines={1}
              maxFontSizeMultiplier={maxFontScale.compact}
            >
              {label}
            </Text>
          </View>
        </React.Fragment>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  step: { alignItems: 'center', minWidth: 64 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  dotDone: { borderColor: colors.primary, backgroundColor: colors.primary },
  dotText: { ...typography.captionStrong, color: colors.textSecondary },
  dotTextActive: { color: colors.primary },
  label: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  labelActive: { ...typography.captionStrong, color: colors.text },
  line: { flex: 1, height: 2, backgroundColor: colors.border, marginTop: 13, marginHorizontal: -spacing.md },
  lineActive: { backgroundColor: colors.primary },
});

export default BookingSteps;
