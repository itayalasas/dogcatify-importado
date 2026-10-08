import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Badge, BadgeTone } from '../ui/Badge';

export type DueStatus = 'ok' | 'soon' | 'overdue';

/** Días de anticipación para avisar "vence pronto". */
export const DUE_SOON_DAYS = 30;

/**
 * Estado de una próxima dosis/fecha a partir de una fecha (ISO, Date o dd/mm/aaaa).
 * Devuelve null si no hay fecha válida.
 */
export function getDueStatus(date?: string | Date | null): DueStatus | null {
  if (!date) return null;
  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else {
    const t = date.trim();
    const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (dmy) d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    else if (ymd) d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    else d = new Date(t);
  }
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= DUE_SOON_DAYS) return 'soon';
  return 'ok';
}

const META: Record<DueStatus, { label: string; tone: BadgeTone }> = {
  ok: { label: 'Al día', tone: 'success' },
  soon: { label: 'Vence pronto', tone: 'warning' },
  overdue: { label: 'Vencida', tone: 'danger' },
};

interface HealthStatusBadgeProps {
  /** Fecha de la próxima dosis o vencimiento. */
  dueDate?: string | Date | null;
  /** Para forzar un estado ya calculado. */
  status?: DueStatus | null;
  size?: 'small' | 'medium';
  style?: StyleProp<ViewStyle>;
}

/** Badge de estado de salud: al día / vence pronto / vencida. No muestra nada sin fecha. */
export const HealthStatusBadge: React.FC<HealthStatusBadgeProps> = ({ dueDate, status, size = 'small', style }) => {
  const s = status ?? getDueStatus(dueDate);
  if (!s) return null;
  return <Badge label={META[s].label} tone={META[s].tone} size={size} style={style} />;
};
