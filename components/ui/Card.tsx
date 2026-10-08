import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, ViewProps } from 'react-native';
import { colors, radius, shadows, spacing } from '../../constants/theme';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: boolean;
  /** elevated: sombra suave (por defecto). outlined: solo borde. filled: fondo gris claro. */
  variant?: 'elevated' | 'outlined' | 'filled';
}

const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = true,
  variant = 'elevated',
  ...rest
}) => {
  return (
    <View {...rest} style={[styles.card, styles[variant], padding && styles.padding, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  elevated: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.md,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  filled: {
    backgroundColor: colors.surfaceAlt,
  },
  padding: {
    padding: spacing.lg,
  },
});

export { Card };
