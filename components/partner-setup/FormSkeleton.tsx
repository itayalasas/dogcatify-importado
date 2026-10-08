import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { radius, spacing } from '../../constants/theme';

/** Esqueleto de carga para formularios de configuración (en lugar de "Cargando..."). */
export const FormSkeleton: React.FC<{ sections?: number }> = ({ sections = 3 }) => (
  <View style={styles.wrap} accessibilityLabel="Cargando" accessibilityRole="progressbar">
    {Array.from({ length: sections }).map((_, i) => (
      <Card key={i} style={styles.card}>
        <Skeleton width="45%" height={20} borderRadius={radius.sm} />
        <View style={styles.gap} />
        <Skeleton width="30%" height={14} borderRadius={radius.sm} />
        <Skeleton width="100%" height={50} borderRadius={radius.md} style={styles.field} />
        <Skeleton width="30%" height={14} borderRadius={radius.sm} />
        <Skeleton width="100%" height={50} borderRadius={radius.md} style={styles.field} />
      </Card>
    ))}
  </View>
);

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.lg },
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  gap: { height: spacing.lg },
  field: { marginTop: spacing.sm, marginBottom: spacing.lg },
});
