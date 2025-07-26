import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { ExternalLink } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface PromotionCardProps {
  promotion: {
    id: string;
    title: string;
    description?: string;
    imageURL?: string;
    ctaText: string;
    ctaUrl?: string;
    partnerId?: string;
  };
  onPress: () => void;
}

export const PromotionCard: React.FC<PromotionCardProps> = ({ promotion, onPress }) => {
  return (
    <View style={styles.container}>
      {/* Sponsored Label */}
      <View style={styles.sponsoredHeader}>
        <Text style={styles.sponsoredText}>Publicidad</Text>
      </View>
      
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        {/* Promotion Image */}
        {promotion.imageURL && (
          <Image 
            source={{ uri: promotion.imageURL }} 
            style={styles.promotionImage}
            resizeMode="cover"
          />
        )}
        
        {/* Promotion Content */}
        <View style={styles.content}>
          <Text style={styles.title}>{promotion.title}</Text>
          
          {promotion.description && (
            <Text style={styles.description} numberOfLines={2}>
              {promotion.description}
            </Text>
          )}
          
          {/* Call to Action Button */}
          <View style={styles.ctaContainer}>
            <View style={styles.ctaButton}>
              <ExternalLink size={16} color="#FFFFFF" />
              <Text style={styles.ctaText}>{promotion.ctaText}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sponsoredHeader: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sponsoredText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promotionImage: {
    width: width,
    height: 250,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 24,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  ctaContainer: {
    alignItems: 'flex-start',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ctaText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginLeft: 6,
  },
});

export default PromotionCard;