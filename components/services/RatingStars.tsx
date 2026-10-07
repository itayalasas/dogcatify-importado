import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Star } from 'lucide-react-native';
import { colors, spacing, typography, maxFontScale } from '../../constants/theme';

const STAR_COLOR = '#F59E0B';

interface RatingStarsProps {
  rating: number;
  /** Cantidad de reseñas; si se pasa, se muestra entre paréntesis. */
  count?: number;
  size?: number;
  /** compact: una estrella + número. full: cinco estrellas con medias estrellas. */
  mode?: 'compact' | 'full';
  showValue?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Redondea al 0,5 más cercano: 4,5 muestra cuatro estrellas y media, no cinco. */
const toHalfSteps = (value: number) => Math.round(Math.max(0, Math.min(5, value || 0)) * 2) / 2;

const StarIcon = ({ fill, size }: { fill: 0 | 0.5 | 1; size: number }) => (
  <View style={{ width: size, height: size }}>
    <Star size={size} color={STAR_COLOR} fill="transparent" strokeWidth={2} />
    {fill > 0 && (
      <View style={[StyleSheet.absoluteFill, { width: fill === 1 ? size : size / 2, overflow: 'hidden' }]}>
        <Star size={size} color={STAR_COLOR} fill={STAR_COLOR} strokeWidth={2} />
      </View>
    )}
  </View>
);

/** Calificación con estrellas, con medias estrellas correctas y etiqueta accesible. */
export const RatingStars: React.FC<RatingStarsProps> = ({
  rating,
  count,
  size = 14,
  mode = 'full',
  showValue = true,
  style,
}) => {
  const value = toHalfSteps(rating);
  const label = `Calificación ${(rating || 0).toFixed(1)} de 5${count !== undefined ? `, ${count} reseñas` : ''}`;

  return (
    <View style={[styles.row, style]} accessible accessibilityLabel={label}>
      {mode === 'compact' ? (
        <StarIcon fill={rating > 0 ? 1 : 0} size={size} />
      ) : (
        [1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={i > 1 ? styles.gap : undefined}>
            <StarIcon fill={value >= i ? 1 : value >= i - 0.5 ? 0.5 : 0} size={size} />
          </View>
        ))
      )}
      {showValue && (
        <Text style={styles.value} maxFontSizeMultiplier={maxFontScale.compact}>
          {(rating || 0).toFixed(1)}
        </Text>
      )}
      {count !== undefined && (
        <Text style={styles.count} maxFontSizeMultiplier={maxFontScale.compact}>
          ({count})
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  gap: { marginLeft: spacing.xxs },
  value: { ...typography.captionStrong, color: colors.text, marginLeft: spacing.xs },
  count: { ...typography.caption, color: colors.textSecondary, marginLeft: spacing.xxs },
});

export default RatingStars;
