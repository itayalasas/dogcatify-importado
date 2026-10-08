import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { AppText } from '../ui/AppText';
import { HealthStatusBadge } from './HealthStatusBadge';
import { colors, radius, spacing } from '../../constants/theme';

export interface HealthRecordDetail {
  label: string;
  value?: string | null;
}

interface HealthRecordItemProps {
  title: string;
  /** Fecha principal ya formateada (aplicación, diagnóstico...), con su etiqueta. */
  dateLabel?: string;
  date?: string | null;
  details?: HealthRecordDetail[];
  notes?: string | null;
  /** Próxima dosis: muestra el badge al día / vence pronto / vencida. */
  dueDate?: string | null;
  isLast?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Registro de salud dentro de una sección: nombre, fecha destacada, estado y detalles. */
export const HealthRecordItem: React.FC<HealthRecordItemProps> = ({
  title,
  dateLabel,
  date,
  details = [],
  notes,
  dueDate,
  isLast,
  style,
}) => {
  const visible = details.filter((d) => d.value !== undefined && d.value !== null && d.value !== '');
  return (
    <View style={[styles.item, isLast && styles.last, style]}>
      <View style={styles.top}>
        <AppText variant="bodyStrong" style={styles.title}>
          {title}
        </AppText>
        <HealthStatusBadge dueDate={dueDate} />
      </View>
      {date ? (
        <AppText variant="label" color="primary" style={styles.date}>
          {dateLabel ? `${dateLabel} ` : ''}
          {date}
        </AppText>
      ) : null}
      {visible.map((d) => (
        <View key={d.label} style={styles.detailRow}>
          <AppText variant="bodySmall" color="textSecondary" style={styles.detailLabel}>
            {d.label}
          </AppText>
          <AppText variant="bodySmall" style={styles.detailValue}>
            {d.value}
          </AppText>
        </View>
      ))}
      {notes ? (
        <View style={styles.notes}>
          <AppText variant="bodySmall" color="textSecondary">
            {notes}
          </AppText>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  item: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  last: { borderBottomWidth: 0, paddingBottom: 0 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1 },
  date: { marginTop: spacing.xxs },
  detailRow: { flexDirection: 'row', marginTop: spacing.xs, gap: spacing.sm },
  detailLabel: { minWidth: 96 },
  detailValue: { flex: 1 },
  notes: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
  },
});
