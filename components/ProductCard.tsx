import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, ShoppingCart, Heart } from 'lucide-react-native';
import { Card } from './ui/Card';
import { Product } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface ProductCardProps {
  product: Product;
  onPress: () => void;
  onAddToCart: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onPress, onAddToCart }) => {
  const { t } = useLanguage();

  const [isFavorite, setIsFavorite] = React.useState(false);

  const handleToggleFavorite = (e: any) => {
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
    }).format(price);
  };

  return (
    <Card style={styles.card} padding={false}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.cardContent}>
        <View style={styles.imageContainer}>
          <Image 
            source={{ 
              uri: product.images && product.images.length > 0 
                ? product.images[0] 
                : product.imageURL || 'https://images.pexels.com/photos/1459244/pexels-photo-1459244.jpeg?auto=compress&cs=tinysrgb&w=400'
            }} 
            style={styles.productImage} 
          />
          <TouchableOpacity 
            style={styles.favoriteButton}
            onPress={handleToggleFavorite}
          >
            <Heart 
              size={16} 
              color={isFavorite ? '#EF4444' : '#FFFFFF'} 
              fill={isFavorite ? '#EF4444' : 'none'}
            />
          </TouchableOpacity>
        </View>
        
        <View style={styles.content}>
          <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
          <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
          
          {product.rating && (
            <View style={styles.rating}>
              <Star size={16} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.ratingText}>{product.rating}</Text>
              <Text style={styles.reviewsText}>({product.reviews || 0} {t('reviews')})</Text>
            </View>
          )}
          
          {product.stock !== undefined && (
            <Text style={styles.stockText}>
              Stock: {product.stock} {product.stock === 0 ? '(Agotado)' : ''}
            </Text>
          )}
          
          <TouchableOpacity onPress={onAddToCart} style={styles.addToCartButton}>
            <ShoppingCart size={16} color="#FFFFFF" />
            <Text style={styles.addToCartText}>Agregar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    flex: 1,
    margin: 6,
  },
  cardContent: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: 150,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    resizeMode: 'cover',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 12,
  },
  productName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4, 
    height: 40,
  },
  productPrice: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
    marginBottom: 8,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingText: {
    fontSize: 14,
    color: '#111827',
    marginLeft: 4,
    fontFamily: 'Inter-Medium',
  },
  reviewsText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
    fontFamily: 'Inter-Regular',
  },
  stockText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    fontFamily: 'Inter-Regular',
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D6A6F',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addToCartText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginLeft: 4,
  },
});