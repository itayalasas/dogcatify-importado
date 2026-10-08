import React, { useState, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Heart, ExternalLink } from 'lucide-react-native';
import { Card } from './ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { colors, radius, shadows, spacing, typography } from '../constants/theme';

interface PromotionCardProps {
  promotion: {
    id: string;
    title: string;
    description: string;
    imageURL: string;
    ctaText?: string;
    ctaUrl?: string;
    partnerId?: string;
    likes?: string[];
    views?: number;
    clicks?: number;
    discount_percentage?: number;
  };
  onPress?: () => void;
  onLike?: (promotionId: string) => void;
}

const PromotionCard = memo(({ promotion, onPress, onLike }: PromotionCardProps) => {
  const { currentUser } = useAuth();
  const [isLiking, setIsLiking] = useState(false);

  const isLiked = currentUser ? (promotion.likes || []).includes(currentUser.id) : false;
  const likesCount = (promotion.likes || []).length;

  const handleLike = async () => {
    if (!currentUser || isLiking) return;
    
    setIsLiking(true);
    try {
      if (onLike) {
        onLike(promotion.id);
      }
    } finally {
      setIsLiking(false);
    }
  };

  const handlePress = () => {
    console.log('PromotionCard - handlePress called for promotion:', promotion.id);
    console.log('PromotionCard - Current clicks before press:', promotion.clicks);
    if (onPress) {
      console.log('PromotionCard - Calling onPress callback');
      onPress();
    } else {
      console.warn('PromotionCard - No onPress callback provided');
    }
  };

  return (
    <Card style={styles.container}>
      {/* Promotion Badge */}
      <View style={styles.promotionBadge}>
        <Text style={styles.promotionBadgeText}>Promoción</Text>
      </View>

      {/* Discount Badge */}
      {!!promotion.discount_percentage && promotion.discount_percentage > 0 && (
        <View style={styles.discountBadge}>
          <Text style={styles.discountBadgeText}>
            -{promotion.discount_percentage}%
          </Text>
        </View>
      )}

      {/* Promotion Image */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`Ver promoción: ${promotion.title}`}
      >
        <Image source={{ uri: promotion.imageURL }} style={styles.image} />
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>{promotion.title}</Text>
        <Text style={styles.description} numberOfLines={3}>
          {promotion.description}
        </Text>

        {/* CTA Button */}
        <TouchableOpacity style={styles.ctaButton} onPress={handlePress} accessibilityRole="button">
          <Text style={styles.ctaText}>
            {promotion.ctaText || 'Más información'}
          </Text>
          <ExternalLink size={16} color={colors.onPrimary} />
        </TouchableOpacity>

        {/* Actions - Like button similar to posts */}
        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleLike}
            disabled={isLiking}
            accessibilityRole="button"
            accessibilityLabel={`${isLiked ? 'Quitar me gusta' : 'Me gusta'}, ${likesCount} en total`}
            accessibilityState={{ selected: isLiked, disabled: isLiking }}
          >
            <Heart
              size={24}
              color={isLiked ? colors.danger : colors.textSecondary}
              fill={isLiked ? colors.danger : 'none'}
            />
            <Text style={[styles.actionText, isLiked && styles.likedText]}>
              {likesCount}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Comparar propiedades importantes incluyendo likes
  const prevLikes = prevProps.promotion.likes || [];
  const nextLikes = nextProps.promotion.likes || [];

  // Si los likes cambiaron, re-renderizar
  if (prevLikes.length !== nextLikes.length) {
    return false;
  }

  // Si el contenido de likes cambió, re-renderizar
  const prevLikesSorted = JSON.stringify([...prevLikes].sort());
  const nextLikesSorted = JSON.stringify([...nextLikes].sort());
  if (prevLikesSorted !== nextLikesSorted) {
    return false;
  }

  // Solo re-renderizar si cambian otras propiedades importantes
  return (
    prevProps.promotion.id === nextProps.promotion.id &&
    prevProps.promotion.title === nextProps.promotion.title &&
    prevProps.promotion.imageURL === nextProps.promotion.imageURL
  );
});
PromotionCard.displayName = 'PromotionCard';

export default PromotionCard;

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  promotionBadge: {
    position: 'absolute',
    top: spacing.xxl,
    left: spacing.xxl + spacing.xs,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    zIndex: 1,
  },
  promotionBadgeText: {
    ...typography.captionStrong,
    color: colors.onAccent,
  },
  discountBadge: {
    position: 'absolute',
    top: spacing.xxl,
    right: spacing.xxl + spacing.xs,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    zIndex: 1,
    ...shadows.sm,
  },
  discountBadgeText: {
    ...typography.label,
    fontFamily: typography.display.fontFamily,
    fontWeight: '700',
    color: colors.white,
  },
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.xs,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  ctaText: {
    ...typography.bodyStrong,
    color: colors.onPrimary,
  },
  actions: {
    flexDirection: 'row',
    paddingTop: spacing.xs,
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    minWidth: 44,
    marginRight: spacing.xxl,
  },
  actionText: {
    ...typography.label,
    marginLeft: spacing.xs + 2,
    color: colors.textSecondary,
  },
  likedText: {
    color: colors.danger,
  },
});
