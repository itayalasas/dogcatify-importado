import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, LogBox, TextInput, Image, Dimensions } from 'react-native';
import { Search, MapPin, Star, Phone, Stethoscope, Scissors, Home, Dog } from 'lucide-react-native';
import { FlatList } from 'react-native';
import { ServiceCard } from '../../components/ServiceCard'; 
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '@/lib/supabase';
import { router } from 'expo-router';

// Ignore specific Firebase warnings that appear on logout
LogBox.ignoreLogs([
  '[2025-07-11T02:50:13.958Z] @firebase/firestore:',
  'Warning: Text strings must be rendered within a <Text> component.',
  'Warning: Each child in a list should have a unique "key" prop.'
]);

export default function Services() {
  const [partners, setPartners] = useState<any[]>([]);
  const [displayedPartners, setDisplayedPartners] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreData, setHasMoreData] = useState(true);
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Configuración de paginación
  const ITEMS_PER_PAGE = 6;
  const INITIAL_LOAD = 4;
  React.useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      setDisplayedPartners([]);
      return;
    }
    
    fetchPartners();
    
  }, []);

  const fetchPartners = async () => {
    try {
      console.log('🔄 Fetching partners...');
      setLoading(true);

      // Optimized: Fetch partners and their first service in parallel
      const [partnersResult, servicesResult] = await Promise.all([
        supabaseClient
          .from('partners')
          .select('id, business_name, address, phone, logo, business_type, rating, reviews_count')
          .eq('is_verified', true)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabaseClient
          .from('partner_services')
          .select('id, partner_id, name, price, duration, images')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
      ]);

      const partnersData = partnersResult.data;
      const servicesData = servicesResult.data;

      if (partnersData && servicesData && !partnersResult.error && !servicesResult.error) {
        console.log(`📊 Found ${partnersData.length} verified partners and ${servicesData.length} services`);

        // Create a map of partner_id to first service for quick lookup
        const partnerServicesMap = new Map();
        servicesData.forEach(service => {
          if (!partnerServicesMap.has(service.partner_id)) {
            partnerServicesMap.set(service.partner_id, service);
          }
        });

        const allPartnersWithServices = [];

        for (const partner of partnersData) {
          if (partner.business_type === 'shelter') {
            // For shelters, fetch adoption pets (still need individual query)
            const { data: adoptionPets, error: adoptionError } = await supabaseClient
              .from('adoption_pets')
              .select('id, images')
              .eq('partner_id', partner.id)
              .eq('is_available', true)
              .limit(1);

            if (adoptionPets && adoptionPets.length > 0 && !adoptionError) {
              const pet = adoptionPets[0];
              allPartnersWithServices.push({
                id: `adoption-${pet.id}`,
                partnerId: partner.id,
                partnerName: partner.business_name,
                partnerAddress: partner.address,
                partnerPhone: partner.phone,
                partnerLogo: partner.logo,
                partnerType: partner.business_type,
                rating: partner.rating || 0,
                reviews: partner.reviews_count || 0,
                location: partner.address,
                name: `Adopciones disponibles`,
                price: 0,
                duration: 0,
                category: partner.business_type,
                serviceImages: pet.images || [],
                images: pet.images || [],
              });
            }
          } else {
            // Use the pre-fetched service from map
            const serviceData = partnerServicesMap.get(partner.id);

            if (serviceData) {
              allPartnersWithServices.push({
                id: serviceData.id,
                partnerId: partner.id,
                partnerName: partner.business_name,
                partnerAddress: partner.address,
                partnerPhone: partner.phone,
                partnerLogo: partner.logo,
                partnerType: partner.business_type,
                rating: partner.rating || 0,
                reviews: partner.reviews_count || 0,
                location: partner.address,
                name: serviceData.name,
                price: serviceData.price,
                duration: serviceData.duration,
                category: partner.business_type,
                serviceImages: serviceData.images || [],
                images: serviceData.images || [],
              });
            }
          }
        }

        console.log(`✅ Processed ${allPartnersWithServices.length} partners with services`);
        setPartners(allPartnersWithServices);

        // Carga inicial paginada
        const initialPartners = allPartnersWithServices.slice(0, INITIAL_LOAD);
        setDisplayedPartners(initialPartners);
        setCurrentPage(1);
        setHasMoreData(allPartnersWithServices.length > INITIAL_LOAD);
      }
    } catch (err) {
      console.error("Error fetching partners:", err);
      setError("Error al cargar los servicios");
    } finally {
      setLoading(false);
    }
  };

  const loadMorePartners = () => {
    if (loadingMore || !hasMoreData) return;
    
    console.log(`🔄 Loading more partners - Page ${currentPage + 1}...`);
    setLoadingMore(true);
    
    const startIndex = currentPage * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const newPartners = partners.slice(startIndex, endIndex);
    
    if (newPartners.length === 0) {
      setHasMoreData(false);
      setLoadingMore(false);
      return;
    }
    
    setTimeout(() => {
      setDisplayedPartners(prev => [...prev, ...newPartners]);
      setCurrentPage(prev => prev + 1);
      setHasMoreData(endIndex < partners.length);
      setLoadingMore(false);
      console.log(`✅ Loaded ${newPartners.length} more partners. Total displayed: ${displayedPartners.length + newPartners.length}`);
    }, 300); // Small delay to prevent overwhelming
  };

  // Clean up function to handle component unmount or user logout
  React.useEffect(() => {
    return () => {
      // Clean up any subscriptions or state when component unmounts
      setDisplayedPartners([]);
      setError(null);
    };
  }, []);

  const handlePartnerPress = (partnerId: string) => {
    if (!partnerId || typeof partnerId !== 'string') {
      console.error('Invalid partner ID for navigation:', partnerId);
      Alert.alert('Error', 'ID de partner inválido');
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(partnerId)) {
      console.error('Partner ID is not a valid UUID for navigation:', partnerId);
      Alert.alert('Error', 'ID de partner no válido');
      return;
    }

    console.log('Navigating to partner with valid UUID:', partnerId);
    router.push(`/services/partner/${partnerId}`);
  };

  const handleRatingPress = (item: any) => {
    const reviewCount = item.reviews || item.reviewsCount || 0;
    if (reviewCount > 0) {
      router.push(`/services/partner/${item.partnerId}?tab=reviews`);
    } else {
      Alert.alert('Sin reseñas', 'Este negocio aún no tiene reseñas.');
    }
  };

  const getDefaultIcon = (businessType: string) => {
    switch(businessType) {
      case 'veterinary':
        return <Stethoscope size={28} color="#FFFFFF" strokeWidth={2.5} />;
      case 'grooming':
        return <Scissors size={28} color="#FFFFFF" strokeWidth={2.5} />;
      case 'boarding':
        return <Home size={28} color="#FFFFFF" strokeWidth={2.5} />;
      case 'walking':
        return <Dog size={28} color="#FFFFFF" strokeWidth={2.5} />;
      default:
        return <Star size={28} color="#FFFFFF" strokeWidth={2.5} />;
    }
  };

  const getServiceImage = (item: any) => {
    // Primero intentar cargar imagen del servicio
    if (item.serviceImages && item.serviceImages.length > 0) {
      return item.serviceImages[0];
    }
    if (item.images && item.images.length > 0) {
      return item.images[0];
    }

    // Fallback: imágenes de Pexels relacionadas con mascotas según tipo de negocio
    const fallbackImages = {
      veterinary: 'https://images.pexels.com/photos/6235231/pexels-photo-6235231.jpeg?auto=compress&cs=tinysrgb&w=800',
      grooming: 'https://images.pexels.com/photos/7788009/pexels-photo-7788009.jpeg?auto=compress&cs=tinysrgb&w=800',
      boarding: 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=800',
      walking: 'https://images.pexels.com/photos/406014/pexels-photo-406014.jpeg?auto=compress&cs=tinysrgb&w=800',
      shelter: 'https://images.pexels.com/photos/2253275/pexels-photo-2253275.jpeg?auto=compress&cs=tinysrgb&w=800',
    };

    return fallbackImages[item.partnerType as keyof typeof fallbackImages] || fallbackImages.veterinary;
  };

  const getFilteredPartners = () => {
    let filtered = displayedPartners;

    // Filter by category
    if (selectedCategory !== 'all') {
      const categoryToBusinessType: Record<string, string> = {
        'veterinaria': 'veterinary',
        'peluquería': 'grooming',
        'paseo': 'walking',
        'pensión': 'boarding'
      };

      const businessType = categoryToBusinessType[selectedCategory];
      filtered = filtered.filter(partner => partner.partnerType === businessType);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(partner =>
        partner.partnerName?.toLowerCase().includes(query) ||
        partner.businessName?.toLowerCase().includes(query) ||
        partner.partnerType?.toLowerCase().includes(query) ||
        partner.partnerAddress?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const filteredPartners = getFilteredPartners();

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <Text style={styles.footerLoaderText}>Cargando más servicios...</Text>
      </View>
    );
  };
  const categories = [
    { id: 'all', name: 'Todo' },
    { id: 'veterinaria', name: 'Veterinaria' },
    { id: 'peluquería', name: 'Peluquería' },
    { id: 'pensión', name: 'Pensión' },
    { id: 'paseo', name: 'Paseo' }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>{t('services')}</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar negocios..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.categories}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryButton,
                  selectedCategory === category.id && styles.selectedCategoryButton
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <Text style={[
                  styles.categoryText,
                  selectedCategory === category.id && styles.selectedCategoryText
                ]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.servicesContainer}>
          {loading && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Cargando servicios...</Text>
            </View>
          )}

          {!loading && error && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Error</Text>
              <Text style={styles.emptySubtitle}>{error}</Text>
            </View>
          )}

          {!loading && !error && !currentUser && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>{t('signIn')}</Text>
              <Text style={styles.emptySubtitle}>{t('signInToViewServices')}</Text>
            </View>
          )}

          {!loading && !error && currentUser && filteredPartners.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No se encontraron negocios' : t('noServicesAvailable')}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Intenta con otro término de búsqueda' : t('noBusinessInCategory')}
              </Text>
            </View>
          )}

          {!loading && !error && currentUser && filteredPartners.length > 0 && (
            <View style={styles.gridContainer}>
              {filteredPartners.map((item) => (
                <View key={item.partnerId} style={styles.gridCard}>
                  <TouchableOpacity
                    onPress={() => handlePartnerPress(item.partnerId)}
                    activeOpacity={0.9}
                  >
                    {/* Image Background */}
                    <View style={styles.cardImageContainer}>
                      <Image
                        source={{ uri: getServiceImage(item) }}
                        style={styles.cardImage}
                        resizeMode="cover"
                      />

                      {/* Dark overlay for better text readability */}
                      <View style={styles.darkOverlay} />

                      {/* Logo Badge */}
                      <View style={styles.logoContainer}>
                        {item.partnerLogo ? (
                          <View style={styles.logoBadge}>
                            <Image
                              source={{ uri: item.partnerLogo }}
                              style={styles.logoBadgeImage}
                              resizeMode="cover"
                            />
                          </View>
                        ) : (
                          <View style={styles.logoBadge}>
                            <View style={styles.logoPlaceholder}>
                              {getDefaultIcon(item.partnerType)}
                            </View>
                          </View>
                        )}
                      </View>

                      {/* Business Name on Image */}
                      <View style={styles.businessNameContainer}>
                        <Text style={styles.businessNameText} numberOfLines={2}>
                          {item.partnerName}
                        </Text>
                        <View style={styles.typeTagInline}>
                          <Text style={styles.typeTagText}>
                            {item.partnerType === 'veterinary' ? 'Veterinaria' :
                             item.partnerType === 'grooming' ? 'Peluquería' :
                             item.partnerType === 'boarding' ? 'Pensión' :
                             item.partnerType === 'walking' ? 'Paseo' : 'Servicio'}
                          </Text>
                        </View>
                      </View>

                      {/* Price Badge */}
                      {item.price && (
                        <View style={styles.priceBadge}>
                          <Text style={styles.priceBadgeText}>
                            ${item.price.toLocaleString()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Bottom Content */}
                  <View style={styles.cardBottomContent}>
                    {item.partnerPhone && (
                      <View style={styles.infoRow}>
                        <Phone size={13} color="#6B7280" strokeWidth={2} />
                        <Text style={styles.infoText} numberOfLines={1}>
                          {item.partnerPhone}
                        </Text>
                      </View>
                    )}

                    {item.partnerAddress && (
                      <View style={styles.infoRow}>
                        <MapPin size={13} color="#6B7280" strokeWidth={2} />
                        <Text style={styles.infoText} numberOfLines={1}>
                          {item.partnerAddress}
                        </Text>
                      </View>
                    )}

                    {(item.rating || item.reviews >= 0) && (
                      <TouchableOpacity
                        style={styles.ratingRow}
                        onPress={() => handleRatingPress(item)}
                        activeOpacity={0.7}
                      >
                        <Star size={14} color="#F59E0B" fill="#F59E0B" strokeWidth={2} />
                        <Text style={styles.ratingValue}>
                          {item.rating?.toFixed(1) || '5.0'}
                        </Text>
                        <Text style={styles.ratingCount}>
                          ({item.reviews || 0})
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              {renderFooter()}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 30, // Add padding at the top to show status bar
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    paddingVertical: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 10,
  },
  categories: {
    paddingHorizontal: 6,
    paddingVertical: 12,
    marginBottom: 8,
  },
  categoryButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    minHeight: 32,
    justifyContent: 'center',
  },
  selectedCategoryButton: {
    backgroundColor: '#2D6A6F',
    borderColor: '#2D6A6F',
  },
  categoryText: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
  },
  selectedCategoryText: {
    color: '#FFFFFF',
  },
  servicesContainer: {
    flex: 1,
    paddingVertical: 12,
  },
  servicesGrid: {
    flex: 1,
    paddingBottom: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
  },
  cardImageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
  },
  darkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  logoContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  logoBadgeImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2D6A6F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessNameContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    zIndex: 5,
  },
  businessNameText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  typeTagInline: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  typeTagText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: '#2D6A6F',
  },
  priceBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  priceBadgeText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  cardBottomContent: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 6,
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  ratingValue: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#92400E',
    marginLeft: 4,
  },
  ratingCount: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280', 
    textAlign: 'center',
    lineHeight: 24,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerLoaderText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
});