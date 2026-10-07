import React, { ReactNode } from 'react';
import { TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, radius, touchTarget } from '../../constants/theme';

interface IconButtonProps {
  icon: ReactNode;
  onPress: () => void;
  /** Obligatorio: es lo que lee VoiceOver/TalkBack, por ejemplo "Volver" o "Agregar al carrito". */
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** plain: sin fondo. tonal: fondo suave de marca. filled: fondo de marca. surface: círculo blanco (sobre fotos). */
  variant?: 'plain' | 'tonal' | 'filled' | 'surface';
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Botón de solo ícono con área táctil mínima de 44 y etiqueta accesible. */
export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  variant = 'plain',
  size = touchTarget,
  disabled = false,
  style,
  testID,
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityHint={accessibilityHint}
    accessibilityState={{ disabled }}
    hitSlop={size < touchTarget ? (touchTarget - size) / 2 : undefined}
    testID={testID}
    style={[
      styles.base,
      { width: size, height: size, borderRadius: size / 2 },
      styles[variant],
      disabled && styles.disabled,
      style,
    ]}
  >
    {icon}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  plain: {},
  tonal: { backgroundColor: colors.primarySoft },
  filled: { backgroundColor: colors.primary },
  surface: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: radius.pill,
  },
  disabled: { opacity: 0.4 },
});
