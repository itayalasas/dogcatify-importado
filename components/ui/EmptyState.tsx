import React, { ReactNode } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing } from '../../constants/theme';
import { AppText } from './AppText';
import { Button } from './Button';

interface EmptyStateProps {
  /** Ícono de lucide, por ejemplo <PawPrint size={32} color={colors.primary} />. */
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Estado vacío con ícono, explicación y una acción para salir de él. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  style,
}) => (
  <View style={[styles.container, style]} accessibilityRole="summary">
    {icon ? <View style={styles.iconCircle}>{icon}</View> : null}
    <AppText variant="heading" align="center">
      {title}
    </AppText>
    {description ? (
      <AppText variant="bodySmall" color="textSecondary" align="center" style={styles.description}>
        {description}
      </AppText>
    ) : null}
    {actionLabel && onAction ? (
      <Button title={actionLabel} onPress={onAction} fullWidth={false} style={styles.action} />
    ) : null}
    {secondaryActionLabel && onSecondaryAction ? (
      <Button
        title={secondaryActionLabel}
        onPress={onSecondaryAction}
        variant="ghost"
        fullWidth={false}
        style={styles.secondary}
      />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.huge,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  description: {
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  action: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xxl,
  },
  secondary: {
    marginTop: spacing.xs,
  },
});
