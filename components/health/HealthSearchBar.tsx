import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { colors, radius, spacing, typography, hitSlop, maxFontScale } from '../../constants/theme';

interface HealthSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
}

/** Buscador de los selectores de salud: ícono, campo y botón para limpiar. */
export const HealthSearchBar: React.FC<HealthSearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Buscar...',
  style,
  autoFocus,
}) => (
  <View style={[styles.wrapper, style]}>
    <View style={styles.bar}>
      <Search size={20} color={colors.icon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        maxFontSizeMultiplier={maxFontScale.default}
        selectionColor={colors.primary}
      />
      {value.length > 0 ? (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Borrar búsqueda"
        >
          <X size={18} color={colors.icon} />
        </TouchableOpacity>
      ) : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    lineHeight: undefined,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
});
