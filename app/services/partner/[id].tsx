import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MapPin, Clock, Phone, Star, Search } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { useAuth } from '../../../contexts/AuthContext';
import { supabaseClient } from '../../../lib/supabase';

export default function PartnerServices() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  const [partner, setPartner] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [filteredServices, setFilteredServices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPartnerDetails();
    fetchPartnerServices();
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

  const handleServicePress = (serviceId: string) => {
    router.push(`/services/${serviceId}`);
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
        <Text style={styles.title}>Servicios Disponibles</Text>
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
              
              {partner?.rating !== undefined && (
                <View style={styles.ratingContainer}>
                  <Star size={16} color="#F59E0B" fill="#F59E0B" />
                  <Text style={styles.ratingText}>{partner.rating}</Text>
                  <Text style={styles.reviewsText}>
                    ({partner.reviews_count || partner.reviewsCount || 0} reseñas)
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Card>

        {/* Search Bar */}
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

        {/* Services List */}
        <Text style={styles.sectionTitle}>Servicios Disponibles</Text>
        
        {filteredServices.length === 0 ? (
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
        )}
      </ScrollView>
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
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
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
});