import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Modal } from 'react-native';
import { MapPin, Phone, Star, Building, Clock, DollarSign, User } from 'lucide-react-native';
import { Card } from './ui/Card';
import { useLanguage } from '../contexts/LanguageContext';
import { supabaseClient } from '../lib/supabase';

interface ServiceCardProps {
  service: any;
  onPress: () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, onPress }) => {
  const { t } = useLanguage();
  
  // Debug service data
  React.useEffect(() => {
    console.log('ServiceCard - Service data:', {
      id: service?.id,
      partnerId: service?.partnerId,
      name: service?.name,
      partnerType: service?.partnerType
    });
  }, [service]);
  
  const [reviews, setReviews] = React.useState<any[]>([]);
  const [averageRating, setAverageRating] = React.useState(0);
  const [totalReviews, setTotalReviews] = React.useState(0);
  const [showReviewsModal, setShowReviewsModal] = React.useState(false);
  const [loadingReviews, setLoadingReviews] = React.useState(false);
  const [partnerLogo, setPartnerLogo] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (service.partnerId) {
      fetchServiceReviews();
      fetchPartnerLogo();
    }
  }, [service.partnerId]);

  const fetchPartnerLogo = async () => {
    try {
      const { data: partnerData, error } = await supabaseClient
        .from('partners')
        .select('logo')
        .eq('id', service.partnerId)
        .single();
      
      if (error) {
        console.error('Error fetching partner logo:', error);
        return;
      }
      
      if (partnerData?.logo) {
        setPartnerLogo(partnerData.logo);
      }
    } catch (error) {
      console.error('Error fetching partner logo:', error);
    }
  };

  const fetchServiceReviews = async () => {
    try {
      // First get the partner's overall rating and review count
      setAverageRating(service.rating || 0);
      setTotalReviews(service.reviews || 0);
      
      console.log('Service reviews set from partner data:', {
        rating: service.rating || 0,
        reviews: service.reviews || 0
      });
    } catch (error) {
      console.error('Error setting service reviews:', error);
    }
  };

  const fetchDetailedReviews = async () => {
    if (reviews.length > 0) return; // Already loaded
    
    setLoadingReviews(true);
    try {
      console.log('Fetching detailed reviews for partner:', service.partnerId);
      
      // Validate partner ID is a valid UUID
      if (!service.partnerId || typeof service.partnerId !== 'string') {
        console.error('Invalid partner ID:', service.partnerId);
        setLoadingReviews(false);
        return;
      }
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(service.partnerId)) {
        console.error('Partner ID is not a valid UUID:', service.partnerId);
        setLoadingReviews(false);
        return;
      }
      
      const { data: reviewsData, error } = await supabaseClient
        .from('service_reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          customer_id,
          service_id,
          partner_id
        `)
        .eq('partner_id', service.partnerId)
        .order('created_at', { ascending: false })
        .limit(50); // Load more reviews for the modal

      if (error) {
        console.error('Error fetching reviews:', error);
        setLoadingReviews(false);
        return; // Don't throw, just return
      }

      console.log('Reviews data received:', reviewsData?.length || 0);
      
      // Fetch user profiles and service names for each review
      const enrichedReviews = await Promise.all(
        (reviewsData || []).map(async (review) => {
          try {
            // Fetch user profile
            const { data: userProfile } = await supabaseClient
              .from('profiles')
              .select('display_name, photo_url')
              .eq('id', review.customer_id)
              .single();
            
            // Fetch service name
            const { data: serviceData } = await supabaseClient
              .from('partner_services')
              .select('name')
              .eq('id', review.service_id)
              .single();
            
            return {
              ...review,
              user_profile: userProfile,
              service_name: serviceData?.name
            };
          } catch (error) {
            console.error('Error enriching review:', error);
            return {
              ...review,
              user_profile: null,
              service_name: null
            };
          }
        })
      );
      
      console.log('Enriched reviews:', enrichedReviews);
      setReviews(enrichedReviews);
    } catch (error) {
      console.error('Error fetching detailed reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  const openReviewsModal = () => {
    setShowReviewsModal(true);
    fetchDetailedReviews();
  };
  
  // Get the first image from service images or partner services
  const getServiceImage = () => {
    // First try to get from service images
    if (service.images && service.images.length > 0) {
      return service.images[0];
    }
    
    // If this is a partner with services, try to get from the first service
    if (service.serviceImages && service.serviceImages.length > 0) {
      return service.serviceImages[0];
    }
    
    // Fallback to partner logo
    return service.partnerLogo || null;
  };

  const getBusinessTypeName = (type: string) => {
    const types: Record<string, string> = {
      veterinary: 'Veterinaria',
      grooming: 'Peluquería',
      walking: 'Paseador',
      boarding: 'Pensión',
      shop: 'Tienda',
      shelter: 'Refugio'
    };
    return types[type] || 'Servicio';
  };

  const getBusinessTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      veterinary: '🏥',
      grooming: '✂️',
      walking: '🚶',
      boarding: '🏠',
      shop: '🛍️',
      shelter: '🐾'
    };
    return icons[type] || '🏢';
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(price);
  };

  const formatRating = (rating: number, reviews: number) => {
    return `${rating} estrellas • ${reviews} reseñas`;
  };

  const renderStarRating = (rating: number, size: number = 16) => {
    return (
      <View style={styles.starRating}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            color={star <= rating ? '#F59E0B' : '#E5E7EB'}
            fill={star <= rating ? '#F59E0B' : 'none'}
          />
        ))}
      </View>
    );
  };

  return (
    <Card style={styles.card} padding={false}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.touchable}>
        {/* Cover Image or Background */}
        <View style={styles.coverContainer}>
          {getServiceImage() ? (
            <Image 
              source={{ uri: getServiceImage() }} 
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text style={styles.placeholderIcon}>
                {getBusinessTypeIcon(service.partnerType || '')}
              </Text>
            </View>
          )}
          
          <View style={styles.coverOverlay} />
          
          {/* Price Badge */}
          {service.price && (
            <View style={styles.priceBadge}>
              <DollarSign size={12} color="#FFFFFF" />
              <Text style={styles.priceText}>
                {formatPrice(service.price)}
              </Text>
            </View>
          )}
          
          {/* Business Logo */}
          <View style={styles.logoContainer}>
            {partnerLogo ? (
              <Image source={{ uri: partnerLogo }} style={styles.businessLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderIcon}>
                  {getBusinessTypeIcon(service.partnerType || '')}
                </Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.content}>
          <Text style={styles.businessName}>
            {service.partnerName || 'Negocio'}
          </Text>
          
          <View style={styles.serviceInfo}>
            <View style={styles.serviceType}>
              <Text style={styles.serviceTypeText}>
                {getBusinessTypeName(service.partnerType || '')}
              </Text>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.detailsContainer}>
            <View style={styles.detailItem}>
              <MapPin size={16} color="#6B7280" />
              <Text style={styles.detailText} numberOfLines={1}>
                {service.partnerAddress || service.location || 'Ubicación no disponible'}
              </Text>
            </View>
            
            {averageRating > 0 && (
              <TouchableOpacity style={styles.detailItem} onPress={openReviewsModal}>
                {renderStarRating(averageRating)}
                <Text style={styles.detailText}>
                  {averageRating.toFixed(1)} ({totalReviews} reseñas)
                </Text>
              </TouchableOpacity>
            )}
            
            <View style={styles.detailItem}>
              <Phone size={16} color="#6B7280" />
              <Text style={styles.detailText}>
                Contactar negocio
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
      
      {/* Reviews Modal */}
      <Modal
        visible={showReviewsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReviewsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Reseñas de {service.partnerName}
              </Text>
              <TouchableOpacity onPress={() => setShowReviewsModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {averageRating > 0 && (
              <View style={styles.overallRating}>
                <View style={styles.ratingDisplay}>
                  <Text style={styles.averageRatingNumber}>
                    {averageRating.toFixed(1)}
                  </Text>
                  {renderStarRating(Math.round(averageRating), 24)}
                </View>
                <Text style={styles.totalReviewsText}>
                  Basado en {totalReviews} reseñas
                </Text>
              </View>
            )}
            
            <ScrollView style={styles.reviewsList} showsVerticalScrollIndicator={false}>
              {loadingReviews ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Cargando reseñas...</Text>
                </View>
              ) : reviews.length === 0 ? (
                <View style={styles.noReviewsContainer}>
                  <Text style={styles.noReviewsText}>
                    Aún no hay reseñas para este negocio
                  </Text>
                </View>
              ) : (
                reviews.map((review) => (
                  <View key={review.id} style={styles.reviewItem}>
                    <View style={styles.reviewItemHeader}>
                      <View style={styles.reviewerInfo}>
                        <View style={styles.reviewerAvatar}>
                          {review.user_profile?.photo_url ? (
                            <Image 
                              source={{ uri: review.user_profile.photo_url }} 
                              style={styles.reviewerAvatarImage} 
                            />
                          ) : (
                            <User size={16} color="#9CA3AF" />
                          )}
                        </View>
                        <View style={styles.reviewerDetails}>
                          <Text style={styles.reviewerName}>
                            {review.user_profile?.display_name || 'Usuario'}
                          </Text>
                          <Text style={styles.reviewServiceInfo}>
                            {review.service_name || 'Servicio'} • {new Date(review.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.reviewRatingContainer}>
                        {renderStarRating(review.rating, 16)}
                      </View>
                    </View>
                    
                    {review.comment && (
                      <Text style={styles.reviewComment}>
                        {review.comment}
                      </Text>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 32,
    color: '#9CA3AF',
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 2,
  },
  priceBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 3,
  },
  priceText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginLeft: 2,
  },
  logoContainer: {
    position: 'absolute',
    bottom: -30,
    left: 20,
    zIndex: 3,
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
    backgroundColor: '#2D6A6F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderIcon: {
    fontSize: 28,
    color: '#FFFFFF',
  },
  businessName: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  serviceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  starRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginRight: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    flex: 1,
    maxHeight: '80%',
    marginTop: 60,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    flex: 1,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#6B7280',
    padding: 4,
  },
  overallRating: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  averageRatingNumber: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#F59E0B',
  },
  totalReviewsText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  reviewsList: {
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  reviewItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  reviewItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  reviewerAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  reviewerDetails: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  reviewServiceInfo: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  reviewRatingContainer: {
    alignItems: 'flex-end',
  },
  reviewComment: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  noReviewsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noReviewsText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
});