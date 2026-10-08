import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { colors, spacing } from '../../constants/theme';

/** Forma de una publicación mientras carga el feed (autor, foto y acciones). */
function PostSkeleton() {
  return (
    <View style={styles.post}>
      <View style={styles.header}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={styles.headerText}>
          <Skeleton width="45%" height={14} />
          <Skeleton width="30%" height={12} style={styles.gap} />
        </View>
      </View>
      <Skeleton height={280} borderRadius={0} />
      <View style={styles.actions}>
        <Skeleton width={56} height={20} />
        <Skeleton width={56} height={20} />
        <Skeleton width={28} height={20} />
      </View>
    </View>
  );
}

export function FeedSkeleton({ count = 2 }: { count?: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Cargando publicaciones">
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  post: {
    backgroundColor: colors.surface,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  gap: {
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
