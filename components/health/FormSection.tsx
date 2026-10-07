import React, { ReactNode } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../../constants/theme';
import { AppText } from '../ui/AppText';

interface FormSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Bloque de formulario con título de sección, usado en los formularios de salud. */
export const FormSection: React.FC<FormSectionProps> = ({ title, description, children, style }) => (
  <View style={[styles.section, style]}>
    {title ? (
      <AppText variant="captionStrong" color="textSecondary" style={styles.title} accessibilityRole="header">
        {title.toUpperCase()}
      </AppText>
    ) : null}
    {description ? (
      <AppText variant="bodySmall" color="textSecondary" style={styles.description}>
        {description}
      </AppText>
    ) : null}
    {children}
  </View>
);

/** Fila tocable que abre un selector (vacuna, veterinario, tratamiento...). */
export const selectorFieldStyles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  value: { ...typography.body, color: colors.text, flex: 1 },
  placeholder: { ...typography.body, color: colors.placeholder, flex: 1 },
});

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xxl },
  title: { letterSpacing: 0.6, marginBottom: spacing.sm },
  description: { marginBottom: spacing.md },
});
