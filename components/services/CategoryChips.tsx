import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography, maxFontScale } from '../../constants/theme';

export interface CategoryChipOption {
  id: string;
  label: string;
}

interface CategoryChipsProps {
  options: CategoryChipOption[];
  selected: string;
  onSelect: (id: string) => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Fila horizontal de categorías en forma de píldora; la elegida usa el color de marca. */
export const CategoryChips: React.FC<CategoryChipsProps> = ({ options, selected, onSelect, style, contentStyle }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={style}
    contentContainerStyle={[styles.content, contentStyle]}
  >
    {options.map((option) => {
      const isSelected = option.id === selected;
      return (
        <TouchableOpacity
          key={option.id}
          style={[styles.chip, isSelected && styles.chipSelected]}
          onPress={() => onSelect(option.id)}
          activeOpacity={0.8}
          hitSlop={{ top: 4, bottom: 4 }}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          accessibilityLabel={`Categoría ${option.label}`}
        >
          <Text
            style={[styles.text, isSelected && styles.textSelected]}
            numberOfLines={1}
            maxFontSizeMultiplier={maxFontScale.compact}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { ...typography.label, color: colors.textSecondary },
  textSelected: { color: colors.onPrimary },
});

export default CategoryChips;
