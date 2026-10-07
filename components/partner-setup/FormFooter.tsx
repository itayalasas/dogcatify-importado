import React, { ReactNode } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, shadows } from '../../constants/theme';

/** Barra fija al pie de un formulario para la acción principal (Guardar). */
export const FormFooter: React.FC<{ children: ReactNode; style?: StyleProp<ViewStyle> }> = ({
  children,
  style,
}) => <View style={[styles.footer, style]}>{children}</View>;

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
    ...shadows.sm,
  },
});
