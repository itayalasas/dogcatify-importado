import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Heart, ExternalLink } from 'lucide-react-native';
import { Card } from './ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { supabaseClient } from '../lib/supabase';

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
  };
  onPress?: () => void;
  onLike?: (promotionId: string) => void;
}

export default function PromotionCard({ promotion, onPress, onLike }: PromotionCardProps) {
  const { currentUser } = useAuth();
  const [localLikes, setLocalLikes] = useState(promotion.likes || []);
  const [isLiking, setIsLiking] = useState(false);

  const isLiked = currentUser ? localLikes.includes(currentUser.id) : false;

  const handleLike = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'Debes iniciar sesión para dar me gusta');
      return;
    }

    if (isLiking) return;
    setIsLiking(true);

    try {
      const newLikes = isLiked
        ? localLikes.filter(id => id !== currentUser.id)
        : [...localLikes, currentUser.id];

      // Update local state immediately for better UX
      setLocalLikes(newLikes);

      // Update database
      const { error } = await supabaseClient
        .from('promotions')
        .update({ likes: newLikes })
        .eq('id', promotion.id);

      if (error) {
        // Revert local state if database update fails
        setLocalLikes(localLikes);
        throw error;
      }

      // Call parent onLike if provided
      if (onLike) {
        onLike(promotion.id);
      }
    } catch (error) {
      console.error('Error updating promotion like:', error);
      Alert.alert('Error', 'No se pudo actualizar el me gusta');
    } finally {
      setIsLiking(false);
    }
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  return (
    <Card style={styles.container}>
      {/* Promotion Badge */}
      <View style={styles.promotionBadge}>
        <Text style={styles.promotionBadgeText}>Promoción</Text>
      </View>

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

        {/* Separator */}
        <View style={styles.separator} />

        {/* Like Section */}
        <View style={styles.likeSection}>
          <TouchableOpacity 
            style={styles.likeButton}
            onPress={handleLike}
            disabled={isLiking}
          >
            <Heart 
              size={20} 
              color={isLiked ? "#DC2626" : "#6B7280"}
              fill={isLiked ? "#DC2626" : "transparent"}
            />
            <Text style={[
              styles.likeCount,
              { color: isLiked ? "#DC2626" : "#6B7280" }
            ]}>
              {localLikes.length}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
  },
  promotionBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
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
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
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
  },
  ctaText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  likeSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  likeCount: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
});