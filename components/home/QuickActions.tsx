import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { CalendarCheck, ShoppingBag, Stethoscope } from 'lucide-react-native';
import { AppText } from '../ui/AppText';
import { colors, radius, shadows, spacing } from '../../constants/theme';

const ACTIONS = [
  {
    key: 'book',
    label: 'Reservar servicio',
    Icon: CalendarCheck,
    href: '/(tabs)/explore',
  },
  {
    key: 'shop',
    label: 'Tienda',
    Icon: ShoppingBag,
    href: '/(tabs)/shop',
  },
  {
    key: 'vet',
    label: 'Veterinaria cerca',
    Icon: Stethoscope,
    href: '/(tabs)/explore?section=services',
  },
] as const;

/** Accesos rápidos del inicio. */
export function QuickActions() {
  return (
    <View style={styles.row}>
      {ACTIONS.map(({ key, label, Icon, href }) => (
        <TouchableOpacity
          key={key}
          style={styles.item}
          activeOpacity={0.8}
          onPress={() => router.push(href as any)}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <View style={styles.iconCircle}>
            <Icon size={22} color={colors.primary} />
          </View>
          <AppText variant="captionStrong" align="center" numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {label}
          </AppText>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 96,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
