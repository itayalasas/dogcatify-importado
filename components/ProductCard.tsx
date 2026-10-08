import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, ShoppingCart, Heart } from 'lucide-react-native';
import { Card } from './ui/Card';
import { Product } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { colors, radius, spacing, typography, hitSlop } from '../constants/theme';
import { formatPrice, stockLabel } from './shop/format';

type ProductCardProduct = Product & {
  stock?: number;
  weight?: string | null;
  variantCount?: number;
  images?: string[];
  hasDiscount?: boolean;
  originalPrice?: number;
  discountedPrice?: number;
  activePromotion?: {
    discount_percentage?: number;
  };
};

interface ProductCardProps {
  product: ProductCardProduct;
  onPress: () => void;
  onAddToCart: () => void;
  currentCartQuantity?: number;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onPress,
  onAddToCart,
  currentCartQuantity = 0,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const { t } = useLanguage();

  const availableStock = typeof product.stock === 'number'
    ? product.stock - currentCartQuantity
    : 0;
  const canAddMore = typeof product.stock === 'number'
    ? availableStock > 0
    : product.inStock;
  const discountPercentage = product.activePromotion?.discount_percentage ?? 0;
  const variantCount = product.variantCount ?? 1;
  const hasVariants = variantCount > 1;

  const handleToggleFavorite = (e: any) => {
    e.stopPropagation();
    onToggleFavorite?.();
  };

  const availabilityText = !hasVariants ? stockLabel(product.stock) : null;
  const isLowStock = availabilityText === 'Últimas unidades';

  return (
    <Card style={styles.card} padding={false}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.cardContent}
        accessibilityRole="button"
        accessibilityLabel={product.name}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri: product.images && product.images.length > 0
                ? product.images[0]
                : product.imageURL || 'https://images.pexels.com/photos/1459244/pexels-photo-1459244.jpeg?auto=compress&cs=tinysrgb&w=400'
            }}
            style={styles.productImage}
          />
          {discountPercentage > 0 && product.hasDiscount ? (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>-{discountPercentage}%</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={handleToggleFavorite}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            accessibilityState={{ selected: isFavorite }}
          >
            <Heart
              size={18}
              color={isFavorite ? colors.danger : colors.textSecondary}
              fill={isFavorite ? colors.danger : 'none'}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
          {hasVariants ? (
            <Text style={styles.variantText}>{variantCount} presentaciones</Text>
          ) : product.weight ? (
            <Text style={styles.variantText}>{product.weight}</Text>
          ) : null}

          <View style={styles.priceSection}>
            {product.hasDiscount && product.originalPrice && product.discountedPrice ? (
              <>
                <Text style={styles.originalPrice}>{formatPrice(product.originalPrice)}</Text>
                <Text style={styles.discountedPrice}>{hasVariants ? 'Desde ' : ''}{formatPrice(product.discountedPrice)}</Text>
              </>
            ) : (
              <Text style={styles.productPrice}>{hasVariants ? 'Desde ' : ''}{formatPrice(product.price)}</Text>
            )}
          </View>

          {product.rating ? (
            <View style={styles.rating}>
              <Star size={14} color={colors.accent} fill={colors.accent} />
              <Text style={styles.ratingText}>{product.rating}</Text>
              <Text style={styles.reviewsText}>({product.reviews || 0} {t('reviews')})</Text>
            </View>
          ) : null}

          {availabilityText ? (
            <Text style={[styles.stockText, isLowStock ? styles.stockTextLow : styles.stockTextEmpty]}>
              {availabilityText}
            </Text>
          ) : null}
          {!hasVariants && currentCartQuantity > 0 ? (
            <Text style={styles.inCartText}>{currentCartQuantity} en tu carrito</Text>
          ) : null}

          {hasVariants ? (
            <TouchableOpacity
              onPress={onPress}
              style={styles.addToCartButton}
              accessibilityRole="button"
              accessibilityLabel={`Elegir presentación de ${product.name}`}
            >
              <Text style={styles.addToCartText}>Elegir presentación</Text>
            </TouchableOpacity>
          ) : canAddMore ? (
            <TouchableOpacity
              onPress={onAddToCart}
              style={styles.addToCartButton}
              accessibilityRole="button"
              accessibilityLabel={`Agregar ${product.name} al carrito`}
            >
              <ShoppingCart size={16} color={colors.onPrimary} />
              <Text style={[styles.addToCartText, styles.addToCartTextWithIcon]}>Agregar</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.outOfStockButton}>
              <Text style={styles.outOfStockText}>
                {product.stock === 0 ? 'Sin stock' : 'Máximo en carrito'}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Card>
  );
};

const styles = StyleSheet.create({
  variantText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  card: {
    flex: 1,
    margin: spacing.xs,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: colors.surfaceAlt,
  },
  productImage: {
    width: '100%',
    aspectRatio: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    resizeMode: 'cover',
  },
  favoriteButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  content: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    flex: 1,
  },
  productName: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  priceSection: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  productPrice: {
    ...typography.heading,
    color: colors.text,
  },
  discountedPrice: {
    ...typography.heading,
    color: colors.danger,
  },
  originalPrice: {
    ...typography.caption,
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
  },
  discountBadgeText: {
    ...typography.captionStrong,
    color: colors.white,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  ratingText: {
    ...typography.captionStrong,
    color: colors.text,
    marginLeft: spacing.xs,
  },
  reviewsText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  stockText: {
    ...typography.captionStrong,
    marginBottom: spacing.xs,
  },
  stockTextLow: {
    color: colors.warning,
  },
  stockTextEmpty: {
    color: colors.danger,
  },
  inCartText: {
    ...typography.caption,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginTop: 'auto',
  },
  addToCartText: {
    ...typography.label,
    color: colors.onPrimary,
  },
  addToCartTextWithIcon: {
    marginLeft: spacing.xs,
  },
  outOfStockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginTop: 'auto',
  },
  outOfStockText: {
    ...typography.label,
    color: colors.textSecondary,
  },
});
