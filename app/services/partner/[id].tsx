import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, TextInput, Dimensions, Modal, Alert, Share, Platform, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MapPin, Clock, Phone, Star, Search, User, Heart, MessageCircle } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { supabaseClient } from '../../../lib/supabase';

const { width } = Dimensions.get('window');

export default function PartnerServices() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  const [partner, setPartner] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [filteredServices, setFilteredServices] = useState<any[]>([]);
  const [filteredServices, setFilteredServices] = useState<any[]>([]);
  const [adoptionPets, setAdoptionPets] = useState<any[]>([]);
  const [partnerReviews, setPartnerReviews] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [partnerReviews, setPartnerReviews] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [detailedReviews, setDetailedReviews] = useState<any[]>([]);
  const [loadingDetailedReviews, setLoadingDetailedReviews] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [detailedReviews, setDetailedReviews] = useState<any[]>([]);
  const [loadingDetailedReviews, setLoadingDetailedReviews] = useState(false);

  useEffect(() => {
    fetchPartnerDetails();
    if (partner?.business_type === 'shelter') {
      fetchAdoptionPets();
    } else {
      fetchPartnerServices();
    }
    fetchPartnerReviews();
  }, [id]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setFilteredServices(
        services.filter(service => 
          service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          service.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredServices(services);
    }
    fetchPartnerReviews();
  }, [id]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setFilteredServices(
        services.filter(service => 
          service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          service.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredServices(services);
    }
  }, [searchQuery, services]);

  const fetchPartnerDetails = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setPartner({
          id: data.id,
          businessName: data.business_name,
          businessType: data.business_type,
          address: data.address,
          phone: data.phone,
          logo: data.logo,
          rating: data.rating,
          reviewsCount: data.reviews_count,
          ...data
        });
      }
    } catch (error) {
      console.error('Error fetching partner details:', error);
    }
  };

  const fetchPartnerServices = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partner_services')
        .select('*')
        .eq('partner_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const servicesData = data?.map(service => ({
        id: service.id,
        name: service.name,
        description: service.description,
        price: service.price,
        duration: service.duration,
        category: service.category,
        images: service.images,
        isActive: service.is_active,
        partnerId: service.partner_id,
        createdAt: new Date(service.created_at)
      })) || [];
      
      setServices(servicesData);
      setFilteredServices(servicesData);
    } catch (error) {
      console.error('Error fetching partner services:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdoptionPets = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partner_services')
        .select('*')
        .eq('partner_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Parse adoption pets from services
      const adoptionData = data?.map(service => {
        // Extract adoption info from description
        const description = service.description || '';
        
        // Parse basic info
        const lines = description.split('\n');
        const basicInfo = lines[0] || '';
        const healthInfo = lines.find(line => line.includes('🩺')) || '';
        const temperamentInfo = lines.find(line => line.includes('🧠')) || '';
        const adoptionInfo = lines.find(line => line.includes('🏡')) || '';
        const contactInfo = lines.find(line => line.includes('📞')) || '';
        
        return {
          id: service.id,
          name: service.name,
          category: service.category,
          price: service.price,
          images: service.images || [],
          basicInfo,
          healthInfo,
          temperamentInfo,
          adoptionInfo,
          contactInfo,
          fullDescription: description,
          createdAt: new Date(service.created_at)
        };
      }) || [];
      
      setAdoptionPets(adoptionData);
    } catch (error) {
      console.error('Error fetching adoption pets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPartnerReviews = async () => {
    try {
      const { data: reviewsData, error } = await supabaseClient
        .from('service_reviews')
        .select(`
          *,
          profiles:customer_id(display_name, photo_url),
          pets:pet_id(name),
          partner_services:service_id(name)
        `)
        .eq('partner_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPartnerReviews(reviewsData || []);
      
      // Calculate average rating
      if (reviewsData && reviewsData.length > 0) {
        const avgRating = reviewsData.reduce((sum, review) => sum + review.rating, 0) / reviewsData.length;
        setAverageRating(avgRating);
        setTotalReviews(reviewsData.length);
      }
    } catch (error) {
      console.error('Error fetching partner reviews:', error);
    }
  };

  const handleServicePress = (serviceId: string) => {
    router.push(`/services/${serviceId}`);
  };

  const handleShowReviews = () => {
    setShowReviewsModal(true);
    fetchDetailedReviews();
  };

  const fetchDetailedReviews = async () => {
    if (detailedReviews.length > 0) return; // Already loaded
    
    setLoadingDetailedReviews(true);
    try {
      console.log('Fetching detailed reviews for partner:', partner?.id);
      const { data: reviewsData, error } = await supabaseClient
        .from('service_reviews')
        .select('*')
        .eq('partner_id', partner?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

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
      setDetailedReviews(enrichedReviews);
    } catch (error) {
      console.error('Error fetching detailed reviews:', error);
    } finally {
      setLoadingDetailedReviews(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(price);
  };

  const getBusinessTypeIcon = (type: string) => {
    switch (type) {
      case 'veterinary': return '🏥';
      case 'grooming': return '✂️';
      case 'walking': return '🚶';
      case 'boarding': return '🏠';
      case 'shop': return '🛍️';
      case 'shelter': return '🐾';
      default: return '🏢';
    }
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

  const calculateReviewPercentages = () => {
    if (detailedReviews.length === 0) return [];
    
    const counts = [0, 0, 0, 0, 0]; // For 1-5 stars
    detailedReviews.forEach(review => {
      if (review.rating >= 1 && review.rating <= 5) {
        counts[review.rating - 1]++;
      }
    });
    
    return counts.map((count, index) => ({
      stars: index + 1,
      count,
      percentage: detailedReviews.length > 0 ? (count / detailedReviews.length) * 100 : 0
    })).reverse(); // Show 5 stars first
  };

  const handleContactShelter = async (contactInfo: string) => {
    try {
      // Extract phone number from contact info
      const phoneMatch = contactInfo.match(/(\+?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,4})/);
      const emailMatch = contactInfo.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      
      if (phoneMatch) {
        const phoneNumber = phoneMatch[1].replace(/[\s-]/g, '');
        const phoneUrl = `tel:${phoneNumber}`;
        
        if (await Linking.canOpenURL(phoneUrl)) {
          await Linking.openURL(phoneUrl);
        } else {
          Alert.alert('Error', 'No se puede realizar la llamada');
        }
      } else if (emailMatch) {
        const email = emailMatch[1];
        const emailUrl = `mailto:${email}`;
        
        if (await Linking.canOpenURL(emailUrl)) {
          await Linking.openURL(emailUrl);
        } else {
          Alert.alert('Error', 'No se puede abrir el email');
        }
      } else {
        Alert.alert('Contacto', contactInfo);
      }
    } catch (error) {
      console.error('Error contacting shelter:', error);
      Alert.alert('Error', 'No se pudo contactar al refugio');
    }
  };

  const handleStartAdoptionChat = (petId: string, petName: string) => {
    // Navigate to chat screen
    router.push({
      pathname: '/chat/adoption',
      params: {
        petId,
        petName,
        partnerId: id,
        partnerName: partner?.business_name || 'Refugio'
      }
    });
  };

  const renderAdoptionPet = (pet: any) => (
    <Card key={pet.id} style={styles.adoptionPetCard}>
      {/* Pet Images */}
      {pet.images && pet.images.length > 0 && (
        <ScrollView 
          horizontal 
          pagingEnabled 
          showsHorizontalScrollIndicator={false}
          style={styles.petImagesContainer}
        >
          {pet.images.map((image: string, index: number) => (
            <Image 
              key={index} 
              source={{ uri: image }} 
              style={styles.petImage} 
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      )}
      
      {/* Pet Info */}
      <View style={styles.petInfo}>
        <View style={styles.petHeader}>
          <Text style={styles.petName}>🐶 {pet.name}</Text>
          {pet.price > 0 && (
            <Text style={styles.adoptionFee}>${pet.price.toLocaleString()}</Text>
          )}
        </View>
        
        <Text style={styles.petBasicInfo}>{pet.basicInfo}</Text>
        
        {pet.healthInfo && (
          <Text style={styles.petHealthInfo}>{pet.healthInfo}</Text>
        )}
        
        {pet.temperamentInfo && (
          <Text style={styles.petTemperament}>{pet.temperamentInfo}</Text>
        )}
        
        {pet.adoptionInfo && (
          <Text style={styles.petAdoptionInfo}>{pet.adoptionInfo}</Text>
        )}
        
        {pet.contactInfo && (
          <Text style={styles.petContactInfo}>{pet.contactInfo}</Text>
        )}
        
        {/* Action Buttons */}
        <View style={styles.petActions}>
          <TouchableOpacity 
            style={styles.contactButton}
            onPress={() => handleContactShelter(pet.contactInfo)}
          >
            <Phone size={16} color="#FFFFFF" />
            <Text style={styles.contactButtonText}>Contactar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.adoptionButton}
            onPress={() => handleStartAdoptionChat(pet.id, pet.name)}
          >
            <MessageCircle size={16} color="#FFFFFF" />
            <Text style={styles.adoptionButtonText}>Adopción</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
  
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando servicios...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Servicios Disponibles</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Partner Profile Card */}
        <Card style={styles.partnerCard}>
          <View style={styles.partnerHeader}>
            {(partner?.logo || partner?.business_logo) ? (
              <Image source={{ uri: partner.logo || partner.business_logo }} style={styles.partnerLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>
                  {getBusinessTypeIcon(partner?.business_type || partner?.businessType)}
                </Text>
              </View>
            )}
            
            <View style={styles.partnerInfo}>
              <Text style={styles.partnerName}>{partner?.business_name || partner?.businessName || 'Negocio'}</Text>
              
              <View style={styles.partnerDetails}>
                <View style={styles.partnerDetail}>
                  <MapPin size={14} color="#6B7280" />
                  <Text style={styles.partnerDetailText} numberOfLines={1}>
                    {partner?.address || 'Ubicación no disponible'}
                  </Text>
                </View>
                
                <View style={styles.partnerDetail}>
                  <Phone size={14} color="#6B7280" />
                  <Text style={styles.partnerDetailText}>
                    {partner?.phone || 'Teléfono no disponible'}
                  </Text>
                </View>
              </View>
              
              {averageRating > 0 && (
                <TouchableOpacity style={styles.ratingContainer} onPress={handleShowReviews}>
                  {renderStarRating(averageRating)}
                  <Text style={styles.ratingText}>{averageRating.toFixed(1)}</Text>
                  <Text style={styles.reviewsText}>
                    ({totalReviews} reseñas)
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Card>

        {/* Search Bar */}
        {partner?.business_type !== 'shelter' && (
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Search size={20} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar servicios..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>
        )}

        {/* Services or Adoption Pets List */}
        <Text style={styles.sectionTitle}>
          {partner?.business_type === 'shelter' ? 'Mascotas en Adopción' : 'Servicios Disponibles'}
        </Text>
        
        {partner?.business_type === 'shelter' ? (
          adoptionPets.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Heart size={48} color="#EF4444" />
              <Text style={styles.emptyTitle}>No hay mascotas en adopción</Text>
              <Text style={styles.emptySubtitle}>
                Este refugio aún no tiene mascotas disponibles para adopción
              </Text>
            </Card>
          ) : (
            <View style={styles.adoptionPetsList}>
              {adoptionPets.map(renderAdoptionPet)}
            </View>
          )
        ) : (
          filteredServices.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No hay servicios disponibles</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'No se encontraron servicios que coincidan con tu búsqueda' : 'Este negocio aún no tiene servicios registrados'}
              </Text>
            </Card>
          ) : (
            filteredServices.map((service) => (
              <Card key={service.id} style={styles.serviceCard}>
                <TouchableOpacity 
                  style={styles.serviceContent}
                  onPress={() => handleServicePress(service.id)}
                >
                  <View style={styles.serviceHeader}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.servicePrice}>{formatPrice(service.price)}</Text>
                  </View>
                  
                  {service.description && (
                    <Text style={styles.serviceDescription} numberOfLines={2}>
                      {service.description}
                    </Text>
                  )}
                  
                  <View style={styles.serviceDetails}>
                    <View style={styles.serviceDetail}>
                      <Clock size={14} color="#6B7280" />
                      <Text style={styles.serviceDetailText}>
                        {service.duration || 60} min
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </Card>
            ))
          )
        )}
      </ScrollView>

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
                Reseñas de {partner?.businessName || partner?.business_name}
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

            {/* Rating Breakdown */}
            {detailedReviews.length > 0 && (
              <View style={styles.ratingBreakdown}>
                <Text style={styles.breakdownTitle}>Distribución de calificaciones</Text>
                {calculateReviewPercentages().map((item) => (
                  <View key={item.stars} style={styles.breakdownRow}>
                    <Text style={styles.breakdownStars}>{item.stars} ⭐</Text>
                    <View style={styles.breakdownBar}>
                      <View 
                        style={[
                          styles.breakdownBarFill, 
                          { width: `${item.percentage}%` }
                        ]} 
                      />
                    </View>
                    <Text style={styles.breakdownPercentage}>
                      {item.percentage.toFixed(0)}%
                    </Text>
                  </View>
                ))}
              </View>
            )}
            
            <ScrollView style={styles.reviewsList} showsVerticalScrollIndicator={false}>
              {loadingDetailedReviews ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Cargando reseñas...</Text>
                </View>
              ) : detailedReviews.length === 0 ? (
                <View style={styles.noReviewsContainer}>
                  <Text style={styles.noReviewsText}>
                    Aún no hay reseñas para este negocio
                  </Text>
                </View>
              ) : (
                detailedReviews.map((review) => (
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  starRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
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
  ratingBreakdown: {
    marginBottom: 20,
  },
  breakdownTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownStars: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    width: 40,
  },
  breakdownBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    marginHorizontal: 12,
  },
  breakdownBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  breakdownPercentage: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    width: 35,
    textAlign: 'right',
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
  partnerCard: {
    marginBottom: 16,
  },
  partnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  logoPlaceholderText: {
    fontSize: 32,
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
  },
  partnerDetails: {
    marginBottom: 8,
  },
  partnerDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  partnerDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginLeft: 4,
  },
  reviewsText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  serviceCard: {
    marginBottom: 12,
  },
  serviceContent: {
    padding: 12,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  servicePrice: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  serviceDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  serviceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  serviceDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  // Adoption pets styles
  adoptionPetsList: {
    gap: 16,
  },
  adoptionPetCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  petImagesContainer: {
    height: 200,
  },
  petImage: {
    width: width - 64, // Account for card margins
    height: 200,
  },
  petInfo: {
    padding: 16,
  },
  petHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  petName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  adoptionFee: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
  },
  petBasicInfo: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginBottom: 8,
    lineHeight: 20,
  },
  petHealthInfo: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#059669',
    marginBottom: 6,
    lineHeight: 18,
  },
  petTemperament: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#7C3AED',
    marginBottom: 6,
    lineHeight: 18,
  },
  petAdoptionInfo: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#DC2626',
    marginBottom: 6,
    lineHeight: 18,
  },
  petContactInfo: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 18,
  },
  petActions: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  contactButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  adoptionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  adoptionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  starRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
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
  ratingBreakdown: {
    marginBottom: 20,
  },
  breakdownTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownStars: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    width: 40,
  },
  breakdownBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    marginHorizontal: 12,
  },
  breakdownBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  breakdownPercentage: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    width: 35,
    textAlign: 'right',
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
  partnerCard: {
    marginBottom: 16,
  },
  partnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  logoPlaceholderText: {
    fontSize: 32,
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
  },
  partnerDetails: {
    marginBottom: 8,
  },
  partnerDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  partnerDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginLeft: 4,
  },
  reviewsText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  serviceCard: {
    marginBottom: 12,
  },
  serviceContent: {
    padding: 12,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  servicePrice: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  serviceDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  serviceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  serviceDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  // Adoption pets styles
  adoptionPetsList: {
    gap: 16,
  },
  adoptionPetCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  petImagesContainer: {
    height: 200,
  },
  petImage: {
    width: width - 64, // Account for card margins
    height: 200,
  },
  petInfo: {
    padding: 16,
  },
  petHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  petName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  adoptionFee: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
  },
  petBasicInfo: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginBottom: 8,
    lineHeight: 20,
  },
  petHealthInfo: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#059669',
    marginBottom: 6,
    lineHeight: 18,
  },
  petTemperament: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#7C3AED',
    marginBottom: 6,
    lineHeight: 18,
  },
  petAdoptionInfo: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#DC2626',
    marginBottom: 6,
    lineHeight: 18,
  },
  petContactInfo: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 18,
  },
  petActions: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  contactButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  adoptionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  adoptionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});