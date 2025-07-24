import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MapPin, Phone, Star, Building, Clock, DollarSign } from 'lucide-react-native';
import { Card } from './ui/Card';
import { useLanguage } from '../contexts/LanguageContext';

interface ServiceCardProps {
  service: any;
  onPress: () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, onPress }) => {
  const { t } = useLanguage();
  
  return (
    <Card style={styles.card} padding={false}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.touchable}>
        {/* Cover Image or Background */}
        <View style={styles.coverContainer}>
          <View style={styles.coverOverlay} />
          {service.partnerLogo ? (
            <Image 
              source={{ uri: service.partnerLogo }} 
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.coverPlaceholder} />
          )}
          
          {/* Business Logo */}
          <View style={styles.logoContainer}>
            {service.partnerLogo ? (
              <Image source={{ uri: service.partnerLogo }} style={styles.businessLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Building size={28} color="#FFFFFF" />
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.content}>
          <Text style={styles.businessName}>{service.partnerName || 'Negocio'}</Text>
          
          {service.rating && (
            <View style={styles.rating}>
              <Star size={16} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.ratingText}>{service.rating}</Text>
              <Text style={styles.reviewsText}>
                ({service.reviews || 0} reseñas)
              </Text>
            </View>
          )}
          
          <View style={styles.serviceInfo}>
            <View style={styles.serviceType}>
              <Text style={styles.serviceTypeText}>
                {service.category || service.partnerType || 'Servicio'}
              </Text>
            </View>
            
            {service.price && (
              <View style={styles.priceContainer}>
                <DollarSign size={14} color="#10B981" />
                <Text style={styles.priceText}>
                  ${service.price.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.detailsContainer}>
            <View style={styles.detailItem}>
              <MapPin size={16} color="#6B7280" />
              <Text style={styles.detailText} numberOfLines={1}>
                {service.partnerAddress || service.location || 'Ubicación no disponible'}
              </Text>
            </View>
            
            {service.duration && (
              <View style={styles.detailItem}>
                <Clock size={16} color="#6B7280" />
                <Text style={styles.detailText}>
                  {service.duration} min
                </Text>
              </View>
            )}
            
            <View style={styles.detailItem}>
              <Phone size={16} color="#6B7280" />
              <Text style={styles.detailText}>
                {service.phone || '25364598'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    marginHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  touchable: {
    width: '100%',
  },
  coverContainer: {
    height: 120,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    zIndex: 1,
  },
  logoContainer: {
    position: 'absolute',
    bottom: -30,
    left: 20,
    zIndex: 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 16,
    paddingTop: 36,
  },
  businessLogo: {
    width: 60,
    height: 60,
    borderRadius: 35,
  },
  logoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 35,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessName: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingText: {
    fontSize: 16,
    color: '#111827',
    marginLeft: 4,
    fontFamily: 'Inter-Medium',
  },
  reviewsText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
    fontFamily: 'Inter-Regular',
  },
  serviceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceType: {
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  serviceTypeText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  detailsContainer: {
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 15,
    color: '#6B7280',
    marginLeft: 6,
    fontFamily: 'Inter-Regular',
    flex: 1,
  },
});