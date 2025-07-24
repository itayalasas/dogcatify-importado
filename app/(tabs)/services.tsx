import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, LogBox } from 'react-native';
import { Search } from 'lucide-react-native';
import { ServiceCard } from '../../components/ServiceCard'; 
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { router } from 'expo-router';

// Ignore specific Firebase warnings that appear on logout
LogBox.ignoreLogs([
  '[2025-07-11T02:50:13.958Z] @firebase/firestore:',
  'Warning: Text strings must be rendered within a <Text> component.'
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
          // Fetch one service to represent this partner
          const { data: servicesData, error: servicesError } = await supabaseClient
            .from('partner_services')
            .select('*')
            .eq('partner_id', partner.id)
            .eq('is_active', true)
            .limit(1);

          if (servicesData && servicesData.length > 0 && !servicesError) {
            const serviceData = servicesData[0];
            
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
              // Include one service data for compatibility
              name: serviceData.name,
              price: serviceData.price,
              duration: serviceData.duration,
              category: partner.business_type,
            });
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
    { id: 'consulta', name: 'Veterinario' },
    { id: 'baño', name: 'Peluquería' },
    { id: 'paseo', name: 'Paseo' },
    { id: 'hospedaje', name: 'Pensión' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Servicios</Text>
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
              <Text style={styles.emptyTitle}>Inicia sesión</Text>
              <Text style={styles.emptySubtitle}>Debes iniciar sesión para ver los servicios disponibles</Text>
            </View>
          )}
          
          {!loading && !error && currentUser && filteredPartners.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No hay servicios disponibles</Text>
              <Text style={styles.emptySubtitle}>No hay negocios disponibles en esta categoría</Text>
            </View>
          )}
          
          {!loading && !error && currentUser && filteredPartners.length > 0 && (
            <View>
              {filteredPartners.map((partner) => (
                <ServiceCard
                  key={partner.partnerId}
                  service={partner}
                  onPress={() => handlePartnerPress(partner.partnerId)}
                />
              ))}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
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