import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { supabaseClient } from '../lib/supabase';
import { colors, radius, shadows, spacing, typography } from '../constants/theme';

const LOGO = require('../assets/images/patitas-game-logo.png');
const DEFAULT_MAX_DISCOUNT = 20;

interface Props {
  userName?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Tarjeta del juego Patitas al Rescate dentro del inicio (reemplaza a la burbuja flotante).
 * Lee el % máximo de descuento configurado por el admin, igual que FloatingGameWidget.
 */
export function DogCatiFyGameBanner({ style }: Props) {
  const router = useRouter();
  const [maxDiscount, setMaxDiscount] = useState(DEFAULT_MAX_DISCOUNT);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabaseClient
          .from('admin_settings')
          .select('value')
          .eq('key', 'game_promotions_config')
          .maybeSingle();
        const cfg = data?.value;
        if (cfg && mounted) {
          const percents = ['level3', 'level5', 'level10']
            .filter(k => cfg[k]?.active !== false && typeof cfg[k]?.percent === 'number')
            .map(k => cfg[k].percent as number);
          if (percents.length > 0) setMaxDiscount(Math.max(...percents));
        }
      } catch {
        // Se mantiene el valor por defecto
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push('/game' as any)}
      style={[styles.card, style]}
      accessibilityRole="button"
      accessibilityLabel={`Jugar Patitas al Rescate. Ganá hasta ${maxDiscount}% de descuento`}
    >
      <View style={styles.logoWrap}>
        <Image source={LOGO} style={styles.logo} />
        <View style={styles.discountBadge}>
          <Text style={styles.discountText} maxFontSizeMultiplier={1.2}>-{maxDiscount}%</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.kicker} maxFontSizeMultiplier={1.2}>Patitas al Rescate 🐾</Text>
        <Text style={styles.title} numberOfLines={2}>
          Jugá y ganá hasta {maxDiscount}% OFF
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          Superá niveles y desbloqueá descuentos en alimentos y servicios.
        </Text>
      </View>

      <View style={styles.cta}>
        <Text style={styles.ctaText}>Jugar</Text>
        <ChevronRight size={16} color={colors.onAccent} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  logoWrap: {
    width: 56,
    height: 56,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
  },
  discountBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.xxs,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  discountText: {
    ...typography.captionStrong,
    fontSize: 11,
    lineHeight: 14,
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  kicker: {
    ...typography.captionStrong,
    color: colors.warning,
  },
  title: {
    ...typography.bodyStrong,
    color: colors.text,
    marginTop: spacing.xxs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  ctaText: {
    ...typography.captionStrong,
    fontSize: 13,
    color: colors.onAccent,
  },
});
