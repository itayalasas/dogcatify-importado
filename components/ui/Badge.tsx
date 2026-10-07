import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography, maxFontScale } from '../../constants/theme';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const toneStyles: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceAlt, fg: colors.textSecondary },
  primary: { bg: colors.primarySoft, fg: colors.primary },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: colors.infoSoft, fg: colors.info },
  accent: { bg: colors.accent, fg: colors.onAccent },
};

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: ReactNode;
  size?: 'small' | 'medium';
  style?: StyleProp<ViewStyle>;
}

/** Etiqueta de estado (Activo, Pendiente, Agotado...). Colores con contraste AA. */
export const Badge: React.FC<BadgeProps> = ({ label, tone = 'neutral', icon, size = 'medium', style }) => {
  const t = toneStyles[tone];
  return (
    <View style={[styles.badge, size === 'small' && styles.small, { backgroundColor: t.bg }, style]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={[size === 'small' ? styles.textSmall : styles.text, { color: t.fg }]}
        numberOfLines={1}
        maxFontSizeMultiplier={maxFontScale.compact}
      >
        {label}
      </Text>
    </View>
  );
};

export const badgeColors = toneStyles;

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  small: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  icon: { marginRight: spacing.xs },
  text: { ...typography.captionStrong },
  textSmall: { ...typography.captionStrong, fontSize: 11, lineHeight: 14 },
});
