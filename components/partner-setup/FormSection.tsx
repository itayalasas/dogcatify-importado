import React, { ReactNode } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { Card } from '../ui/Card';
import { AppText } from '../ui/AppText';
import { colors, spacing } from '../../constants/theme';

interface FormSectionProps {
  /** Título de la sección (Datos básicos, Precio, Fotos, Horarios...). */
  title: string;
  /** Texto de ayuda breve bajo el título. */
  subtitle?: string;
  /** Acción opcional a la derecha del título. */
  right?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Bloque de formulario: tarjeta con título de sección, para que los formularios largos se lean por partes. */
export const FormSection: React.FC<FormSectionProps> = ({ title, subtitle, right, children, style }) => (
  <Card style={[styles.card, style]}>
    <View style={styles.header}>
      <View style={styles.titleBox}>
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySmall" color="textSecondary" style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ? <View>{right}</View> : null}
    </View>
    {children}
  </Card>
);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  titleBox: {
    flex: 1,
  },
  subtitle: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
});
