import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, LogBox, TextInput, Image, Dimensions } from 'react-native';
import { Search, MapPin, Star, Phone } from 'lucide-react-native';
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
          .select('id, business_name, address, logo, business_type, rating, reviews_count')
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
    // Validate partner ID before navigation
    if (!partnerId || typeof partnerId !== 'string') {
      console.error('Invalid partner ID for navigation:', partnerId);
      Alert.alert('Error', 'ID de partner inválido');
      return;
    }
    
    // Check if ID is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(partnerId)) {
      console.error('Partner ID is not a valid UUID for navigation:', partnerId);
      Alert.alert('Error', 'ID de partner no válido');
      return;
    }
    
    console.log('Navigating to partner with valid UUID:', partnerId);
    router.push(`/services/partner/${partnerId}`);
  };

  const getFilteredPartners = () => {
    let filtered = displayedPartners;

    // Filter by category
    if (selectedCategory !== 'all') {
      const categoryToBusinessType: Record<string, string> = {
        'consulta': 'veterinary',
        'baño': 'grooming',
        'paseo': 'walking',
        'hospedaje': 'boarding'
      };

      const businessType = categoryToBusinessType[selectedCategory];
      filtered = filtered.filter(partner => partner.partnerType === businessType);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(partner =>
        partner.businessName?.toLowerCase().includes(query) ||
        partner.partnerType?.toLowerCase().includes(query)
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
    { id: 'all', name: t('all') },
    { id: 'consulta', name: t('consultation') },
    { id: 'baño', name: t('grooming') },
    { id: 'paseo', name: t('walking') },
    { id: 'hospedaje', name: t('boarding') }
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
                <TouchableOpacity
                  key={item.partnerId}
                  style={styles.gridCard}
                  onPress={() => handlePartnerPress(item.partnerId)}
                  activeOpacity={0.7}
                >
                  {/* Image */}
                  <View style={styles.cardImageContainer}>
                    {item.firstServiceImage ? (
                      <Image
                        source={{ uri: item.firstServiceImage }}
                        style={styles.cardImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.cardImagePlaceholder}>
                        <Text style={styles.placeholderEmoji}>🐾</Text>
                      </View>
                    )}
                    {/* Logo Badge */}
                    {item.partnerLogo && (
                      <View style={styles.logoBadge}>
                        <Image
                          source={{ uri: item.partnerLogo }}
                          style={styles.logoBadgeImage}
                          resizeMode="cover"
                        />
                      </View>
                    )}
                    {/* Price Badge */}
                    {item.firstServicePrice && (
                      <View style={styles.priceBadge}>
                        <Text style={styles.priceBadgeText}>
                          $ {item.firstServicePrice.toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Content */}
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.businessName}
                    </Text>

                    <View style={styles.cardTypeContainer}>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>
                          {item.partnerType === 'veterinary' ? 'Veterinaria' :
                           item.partnerType === 'grooming' ? 'Peluquería' :
                           item.partnerType === 'boarding' ? 'Pensión' :
                           item.partnerType === 'walking' ? 'Paseo' : 'Servicio'}
                        </Text>
                      </View>
                    </View>

                    {item.address && (
                      <View style={styles.cardInfoRow}>
                        <MapPin size={12} color="#6B7280" />
                        <Text style={styles.cardInfoText} numberOfLines={1}>
                          {item.address}
                        </Text>
                      </View>
                    )}

                    {(item.rating || item.reviewsCount > 0) && (
                      <View style={styles.cardInfoRow}>
                        <Star size={12} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.cardRatingText}>
                          {item.rating?.toFixed(1) || '5.0'}
                        </Text>
                        <Text style={styles.cardReviewsText}>
                          ({item.reviewsCount || 0})
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  cardImageContainer: {
    width: '100%',
    height: 140,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 48,
  },
  logoBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoBadgeImage: {
    width: '100%',
    height: '100%',
  },
  priceBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  priceBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 6,
  },
  cardTypeContainer: {
    marginBottom: 8,
  },
  typeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#3B82F6',
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  cardInfoText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
    flex: 1,
  },
  cardRatingText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginLeft: 4,
  },
  cardReviewsText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 2,
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