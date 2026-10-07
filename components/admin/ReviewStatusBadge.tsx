import React from 'react';
import { Clock, CircleCheck, CircleX } from 'lucide-react-native';
import { Badge } from '../ui/Badge';
import { badgeColors } from '../ui/Badge';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

const config: Record<ReviewStatus, { label: string; tone: 'warning' | 'success' | 'danger'; Icon: typeof Clock }> = {
  pending: { label: 'Pendiente', tone: 'warning', Icon: Clock },
  approved: { label: 'Aprobado', tone: 'success', Icon: CircleCheck },
  rejected: { label: 'Rechazado', tone: 'danger', Icon: CircleX },
};

/** Estado de revisión del panel admin: pendiente (ámbar), aprobado (verde), rechazado (rojo). */
export const ReviewStatusBadge: React.FC<{ status: ReviewStatus; label?: string }> = ({ status, label }) => {
  const c = config[status] ?? config.pending;
  return (
    <Badge
      tone={c.tone}
      label={label ?? c.label}
      icon={<c.Icon size={14} color={badgeColors[c.tone].fg} />}
    />
  );
};
