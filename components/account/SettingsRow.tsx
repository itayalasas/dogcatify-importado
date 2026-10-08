import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Card } from '../ui/Card';
import { colors, typography, spacing, radius, touchTarget, maxFontScale } from '../../constants/theme';

interface SettingsRowProps {
  /** Ícono de lucide ya instanciado, por ejemplo <Bell size={20} color={colors.primary} />. */
  icon?: ReactNode;
  label: string;
  /** Texto chico bajo el título. */
  description?: string;
  /** Valor a la derecha (por ejemplo "Activado"). */
  value?: string;
  onPress?: () => void;
  /** Contenido a la derecha en lugar del chevron (por ejemplo un Switch). */
  right?: ReactNode;
  tone?: 'default' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  /** Oculta la línea divisoria inferior (último elemento del grupo). */
  isLast?: boolean;
  accessibilityHint?: string;
}

/** Fila de ajustes: ícono, título, valor opcional y chevron. Área táctil de 56. */
export const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  label,
  description,
  value,
  onPress,
  right,
  tone = 'default',
  loading = false,
  disabled = false,
  isLast = false,
  accessibilityHint,
}) => {
  const isDanger = tone === 'danger';
  const content = (
    <>
      {icon ? (
        <View style={[styles.iconBox, isDanger ? styles.iconBoxDanger : null]}>{icon}</View>
      ) : null}
      <View style={styles.textBox}>
        <Text
          style={[styles.label, isDanger ? styles.labelDanger : null]}
          numberOfLines={2}
          maxFontSizeMultiplier={maxFontScale.default}
        >
          {label}
        </Text>
        {description ? (
          <Text style={styles.description} maxFontSizeMultiplier={maxFontScale.default}>
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={styles.value} numberOfLines={1} maxFontSizeMultiplier={maxFontScale.compact}>
          {value}
        </Text>
      ) : null}
      {loading ? (
        <ActivityIndicator size="small" color={isDanger ? colors.danger : colors.icon} />
      ) : right !== undefined ? (
        right
      ) : onPress ? (
        <ChevronRight size={20} color={isDanger ? colors.danger : colors.icon} />
      ) : null}
    </>
  );

  const rowStyle: StyleProp<ViewStyle> = [
    styles.row,
    !isLast && styles.divider,
    (disabled || loading) && styles.disabled,
  ];

  if (!onPress) {
    return <View style={rowStyle}>{content}</View>;
  }

  return (
    <TouchableOpacity
      style={rowStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={accessibilityHint ?? description}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {content}
    </TouchableOpacity>
  );
};

interface SettingsGroupProps {
  title?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Grupo de filas de ajustes dentro de una tarjeta, con título opcional. */
export const SettingsGroup: React.FC<SettingsGroupProps> = ({ title, children, style }) => (
  <View style={[styles.group, style]}>
    {title ? (
      <Text style={styles.groupTitle} accessibilityRole="header" maxFontSizeMultiplier={maxFontScale.compact}>
        {title}
      </Text>
    ) : null}
    <Card padding={false} style={styles.groupCard}>
      {children}
    </Card>
  </View>
);

const styles = StyleSheet.create({
  group: {
    marginBottom: spacing.xl,
  },
  groupTitle: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  groupCard: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  disabled: {
    opacity: 0.6,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxDanger: {
    backgroundColor: colors.dangerSoft,
  },
  textBox: {
    flex: 1,
    minHeight: touchTarget - spacing.md,
    justifyContent: 'center',
  },
  label: {
    ...typography.body,
    color: colors.text,
  },
  labelDanger: {
    color: colors.danger,
    fontFamily: typography.label.fontFamily,
    fontWeight: '500',
  },
  description: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
  value: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    maxWidth: 120,
  },
});
