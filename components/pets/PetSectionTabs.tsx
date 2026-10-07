import React, { ReactNode } from 'react';
import { ScrollView, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography, touchTarget } from '../../constants/theme';

export interface PetSectionTab<K extends string> {
  key: K;
  label: string;
  icon?: (color: string) => ReactNode;
}

interface PetSectionTabsProps<K extends string> {
  tabs: PetSectionTab<K>[];
  active: K;
  onChange: (key: K) => void;
}

/** Pestañas internas de la ficha, en forma de chips desplazables. */
export function PetSectionTabs<K extends string>({ tabs, active, onChange }: PetSectionTabsProps<K>) {
  return (
    <View style={styles.bar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="tablist"
      >
        {tabs.map((tab) => {
          const selected = tab.key === active;
          const tint = selected ? colors.onPrimary : colors.textSecondary;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, selected && styles.tabActive]}
              onPress={() => onChange(tab.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected }}
            >
              {tab.icon ? tab.icon(tint) : null}
              <Text style={[styles.label, { color: tint }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
  },
  row: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  tab: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    ...typography.label,
  },
});
