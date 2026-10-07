import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors, spacing, hitSlop } from '../../constants/theme';

interface Props {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Título de sección del inicio, con un enlace opcional a la derecha ("Ver todas"). */
export function SectionTitle({ title, actionLabel, onAction }: Props) {
  return (
    <View style={styles.row}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={hitSlop} accessibilityRole="button">
          <AppText variant="label" color={colors.primary}>
            {actionLabel}
          </AppText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
});
