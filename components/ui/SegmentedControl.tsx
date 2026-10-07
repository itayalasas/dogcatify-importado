import React from 'react';
import { View, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, radius, spacing, shadows, touchTarget } from '../../constants/theme';
import { AppText } from './AppText';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: (color: string) => React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

/** Selector de 2 a 4 opciones excluyentes, como "Servicios / Lugares". */
export function SegmentedControl<T extends string>({ options, value, onChange, style }: SegmentedControlProps<T>) {
  return (
    <View style={[styles.track, style]} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        const tint = selected ? colors.primary : colors.textSecondary;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={() => onChange(option.value)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
          >
            {option.icon?.(tint)}
            <AppText variant={selected ? 'bodyStrong' : 'label'} color={tint} numberOfLines={1}>
              {option.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: touchTarget - spacing.xs,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
  segmentSelected: {
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
});
