import React, { useState, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Heart, ExternalLink } from 'lucide-react-native';
import { Card } from './ui/Card';
import { useAuth } from '../contexts/AuthContext';

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
      {promotion.discount_percentage && promotion.discount_percentage > 0 && (
        <View style={styles.discountBadge}>
          <Text style={styles.discountBadgeText}>
            -{promotion.discount_percentage}%
          </Text>
        </View>
      )}

      {/* Promotion Image */}
      <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
        <Image source={{ uri: promotion.imageURL }} style={styles.image} />
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>{promotion.title}</Text>
        <Text style={styles.description} numberOfLines={3}>
          {promotion.description}
        </Text>

        {/* CTA Button */}
        <TouchableOpacity style={styles.ctaButton} onPress={handlePress}>
          <Text style={styles.ctaText}>
            {promotion.ctaText || 'Más información'}
          </Text>
          <ExternalLink size={16} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Actions - Like button similar to posts */}
        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleLike}
            disabled={isLiking}
          >
            <Heart 
              size={24} 
              color={isLiked ? "#ff3040" : "#666"} 
              fill={isLiked ? "#ff3040" : "none"}
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
  // Solo re-renderizar si cambian propiedades importantes
  return (
    prevProps.promotion.id === nextProps.promotion.id &&
    prevProps.promotion.likes?.length === nextProps.promotion.likes?.length &&
    prevProps.promotion.title === nextProps.promotion.title &&
    prevProps.promotion.imageURL === nextProps.promotion.imageURL
  );
});

export default PromotionCard;

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: 'white',
  },
  promotionBadge: {
    position: 'absolute',
    top: 24,
    left: 28,
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  promotionBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  discountBadge: {
    position: 'absolute',
    top: 24,
    right: 28,
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  discountBadgeText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    color: '#000',
    marginBottom: 12,
  },
  ctaButton: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    marginBottom: 8,
  },
  ctaText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  actions: {
    flexDirection: 'row',
    paddingTop: 12,
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  actionText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  likedText: {
    color: '#ff3040',
  },
});