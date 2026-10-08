import React, { ReactNode } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Card } from '../ui/Card';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { colors, radius, spacing } from '../../constants/theme';

interface HealthSectionCardProps {
  /** Emoji o ícono que identifica la sección (💉, 🏥...). */
  emoji?: string;
  title: string;
  count?: number;
  /** Si se pasa, muestra el botón "Agregar". */
  onAdd?: () => void;
  addLabel?: string;
  /** Texto accesible del botón, por ejemplo "Agregar vacuna". */
  addAccessibilityLabel?: string;
  emptyText?: string;
  isEmpty?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Tarjeta de sección de la historia clínica: título, contador, acción y registros. */
export const HealthSectionCard: React.FC<HealthSectionCardProps> = ({
  emoji,
  title,
  count,
  onAdd,
  addLabel = 'Agregar',
  addAccessibilityLabel,
  emptyText,
  isEmpty,
  children,
  style,
}) => (
  <Card style={[styles.card, style]}>
    <View style={styles.header}>
      <View style={styles.titleRow}>
        {emoji ? (
          <View style={styles.emojiCircle} importantForAccessibility="no-hide-descendants">
            <AppText variant="bodyStrong">{emoji}</AppText>
          </View>
        ) : null}
        <AppText variant="heading" accessibilityRole="header" style={styles.title} numberOfLines={1}>
          {title}
        </AppText>
        {typeof count === 'number' ? (
          <View style={styles.countPill}>
            <AppText variant="captionStrong" color="textSecondary">
              {count}
            </AppText>
          </View>
        ) : null}
      </View>
      {onAdd ? (
        <Button
          title={addLabel}
          onPress={onAdd}
          variant="secondary"
          size="small"
          fullWidth={false}
          icon={<Plus size={16} color={colors.primary} />}
          accessibilityLabel={addAccessibilityLabel ?? addLabel}
        />
      ) : null}
    </View>
    {isEmpty ? (
      <View style={styles.empty}>
        <AppText variant="bodySmall" color="textSecondary" align="center">
          {emptyText ?? 'Sin registros todavía'}
        </AppText>
      </View>
    ) : (
      children
    )}
  </Card>
);

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.sm },
  emojiCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flexShrink: 1 },
  countPill: {
    minWidth: 24,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  empty: {
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
});
