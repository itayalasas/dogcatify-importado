import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, LogBox } from 'react-native';
import { Search } from 'lucide-react-native';
import { FlatGrid } from 'react-native-super-grid';
import { ServiceCard } from '../../components/ServiceCard'; 
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { router } from 'expo-router';

// Ignore specific Firebase warnings that appear on logout
LogBox.ignoreLogs([
  '[2025-07-11T02:50:13.958Z] @firebase/firestore:',
  'Warning: Text strings must be rendered within a <Text> component.',
  'Warning: Each child in a list should have a unique "key" prop.'
]);

export default function Services() {
  const [partners, setPartners] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      setPartners([]);
      return;
    }
    
    fetchPartners();
    
  }, []);

  const fetchPartners = async () => {
    try {
      const { data: partnersData, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('is_verified', true)
        .eq('is_active', true);

      if (partnersData && !error) {
        const partnersWithServices = [];

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
              partnersWithServices.push({
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
              .limit(3);

            if (servicesData && servicesData.length > 0 && !servicesError) {
              const serviceData = servicesData[0];
              
              // Collect all service images
              const allServiceImages = servicesData
                .filter(s => s.images && s.images.length > 0)
                .flatMap(s => s.images);
              
              partnersWithServices.push({
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
                serviceImages: allServiceImages,
                images: serviceData.images || [],
              });
            }
          }
        }
        setPartners(partnersWithServices);
      }
    } catch (err) {
      console.error("Error fetching partners:", err);
      setError("Error al cargar los servicios");
    } finally {
      setLoading(false);
    }
  };

  // Clean up function to handle component unmount or user logout
  React.useEffect(() => {
    return () => {
      // Clean up any subscriptions or state when component unmounts
      setPartners([]);
      setError(null);
    };
  }, []);

  const handlePartnerPress = (partnerId: string) => {
    router.push(`/services/partner/${partnerId}`);
  };

  const getFilteredPartners = () => {
    if (selectedCategory === 'all') {
      return partners;
    }
    
    return partners.filter(partner => {
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
            <>
              {filteredPartners.map((partner) => (
                <ServiceCard
                  key={partner.partnerId}
                  service={partner}
                  onPress={() => handlePartnerPress(partner.partnerId)}
                />
              ))}
            </>
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
});