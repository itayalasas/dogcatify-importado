import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, StyleProp, ViewStyle, DimensionValue, AccessibilityInfo } from 'react-native';
import { colors, radius, spacing } from '../../constants/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Bloque gris que late suavemente mientras carga el contenido real. */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = radius.sm,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled || reduce) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
          ])
        );
        loop.start();
      });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: colors.border, opacity }, style]}
    />
  );
};

/** Fila de lista: avatar + dos líneas. */
export const SkeletonListItem: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => (
  <View style={[styles.row, style]}>
    <Skeleton width={48} height={48} borderRadius={24} />
    <View style={styles.rowText}>
      <Skeleton width="60%" height={14} />
      <Skeleton width="40%" height={12} style={styles.gap} />
    </View>
  </View>
);

/** Tarjeta con imagen arriba y dos líneas de texto. */
export const SkeletonCard: React.FC<{ imageHeight?: number; style?: StyleProp<ViewStyle> }> = ({
  imageHeight = 140,
  style,
}) => (
  <View style={[styles.card, style]}>
    <Skeleton height={imageHeight} borderRadius={radius.md} />
    <Skeleton width="70%" height={14} style={styles.gapLg} />
    <Skeleton width="40%" height={12} style={styles.gap} />
  </View>
);

/**
 * Pantalla de carga con la forma del contenido.
 * kind="list" para listas, "grid" para grillas de productos, "cards" para tarjetas a todo el ancho.
 */
export const SkeletonList: React.FC<{
  kind?: 'list' | 'grid' | 'cards';
  count?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ kind = 'list', count = 6, style }) => {
  const items = Array.from({ length: count });
  if (kind === 'grid') {
    return (
      <View
        style={[styles.grid, style]}
        accessibilityRole="progressbar"
        accessibilityLabel="Cargando"
      >
        {items.map((_, i) => (
          <SkeletonCard key={i} imageHeight={120} style={styles.gridItem} />
        ))}
      </View>
    );
  }
  return (
    <View style={[styles.list, style]} accessibilityRole="progressbar" accessibilityLabel="Cargando">
      {items.map((_, i) =>
        kind === 'cards' ? <SkeletonCard key={i} style={styles.cardSpacing} /> : <SkeletonListItem key={i} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  rowText: { flex: 1, marginLeft: spacing.md },
  gap: { marginTop: spacing.sm },
  gapLg: { marginTop: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardSpacing: { marginBottom: spacing.lg },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  gridItem: { width: '48%', marginBottom: spacing.lg },
});
