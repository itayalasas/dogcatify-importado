import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, LogBox } from 'react-native';
import { Search } from 'lucide-react-native';
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
      
      const { data: partnersData, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('is_verified', true)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (partnersData && !error) {
        console.log(`📊 Found ${partnersData.length} verified partners`);
        const allPartnersWithServices = [];

        for (const partner of partnersData) {
          if (partner.business_type === 'shelter') {
            // For shelters, check if they have adoption pets
            const { data: adoptionPets, error: adoptionError } = await supabaseClient
              .from('adoption_pets')
              .select('*')
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
                // For shelters, show adoption info
                name: `Adopciones disponibles`,
                price: 0,
                duration: 0,
                category: partner.business_type,
                serviceImages: pet.images || [],
                images: pet.images || [],
              });
            }
          } else {
            // For other business types, fetch services
            const { data: servicesData, error: servicesError } = await supabaseClient
              .from('partner_services')
              .select('*')
              .eq('partner_id', partner.id)
              .eq('is_active', true)
              .order('created_at', { ascending: false })
              .limit(1); // Solo el primer servicio para carga inicial

            if (servicesData && servicesData.length > 0 && !servicesError) {
              const serviceData = servicesData[0];
              
              // Solo usar imágenes del primer servicio para carga inicial
              const serviceImages = serviceData.images || [];
              
              allPartnersWithServices.push({
                id: serviceData.id, // This should be the service ID
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
                category: partner.business_type, // This is the partner's business type
                serviceImages: serviceImages,
                images: serviceData.images || [],
                // Add debug info
                debug_service_id: serviceData.id,
                debug_partner_id: partner.id,
                debug_business_type: partner.business_type
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
    if (selectedCategory === 'all') {
      return displayedPartners;
    }
    
    return displayedPartners.filter(partner => {
      // Map category IDs to business types
      const categoryToBusinessType: Record<string, string> = {
        'consulta': 'veterinary',
        'baño': 'grooming',
        'paseo': 'walking',
        'hospedaje': 'boarding'
      };
      
      const businessType = categoryToBusinessType[selectedCategory];
      return partner.partnerType === businessType;
    });
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
              <Text style={styles.emptyTitle}>{t('noServicesAvailable')}</Text>
              <Text style={styles.emptySubtitle}>{t('noBusinessInCategory')}</Text>
            </View>
          )}
          
          {!loading && !error && currentUser && filteredPartners.length > 0 && (
            <View style={styles.servicesGrid}>
              {filteredPartners.map((item) => (
                <ServiceCard
                  key={item.partnerId}
                  service={item}
                  onPress={() => handlePartnerPress(item.partnerId)}
                />
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