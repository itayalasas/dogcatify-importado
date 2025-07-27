import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, ActivityIndicator } from 'react-native';
import { MapPin, Phone, Star, Search, Filter } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { supabaseClient } from '../../lib/supabase';

interface Place {
  id: string;
  name: string;
  category: string;
  address: string;
  phone?: string;
  rating: number;
  description: string;
  petAmenities: string[];
  imageUrl?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  isActive: boolean;
  createdAt: Date;
}

const CATEGORIES = [
  { id: 'all', name: 'Todos', icon: '🏢' },
  { id: 'park', name: 'Parques', icon: '🌳' },
  { id: 'restaurant', name: 'Restaurantes', icon: '🍽️' },
  { id: 'hotel', name: 'Hoteles', icon: '🏨' },
  { id: 'store', name: 'Tiendas', icon: '🏪' },
  { id: 'beach', name: 'Playas', icon: '🏖️' },
  { id: 'cafe', name: 'Cafeterías', icon: '☕' },
  { id: 'vet', name: 'Veterinarias', icon: '🐾' },
];

const AMENITY_ICONS: { [key: string]: string } = {
  'Área de juegos': '🎾',
  'Agua para mascotas': '💧',
  'Correas disponibles': '🦮',
  'Veterinario en sitio': '🩺',
  'Área de descanso': '🛏️',
  'Comida para mascotas': '🍖',
  'Baños para mascotas': '🚿',
  'Estacionamiento': '🚗',
  'Acceso para sillas de ruedas': '♿',
  'WiFi gratuito': '📶',
  'Aire acondicionado': '❄️',
  'Terraza pet-friendly': '🌿',
};

export default function Places() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaces();
  }, []);

  useEffect(() => {
    filterPlaces();
  }, [places, selectedCategory, searchQuery]);

  const fetchPlaces = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabaseClient
        .from('places')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const placesData: Place[] = data?.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        address: item.address,
        phone: item.phone,
        rating: Number(item.rating) || 5,
        description: item.description,
        petAmenities: item.pet_amenities || [],
        imageUrl: item.image_url,
        coordinates: item.coordinates ? {
          lat: item.coordinates.lat,
          lng: item.coordinates.lng,
        } : undefined,
        isActive: item.is_active,
        createdAt: new Date(item.created_at),
      })) || [];

      setPlaces(placesData);
    } catch (err) {
      console.error('Error fetching places:', err);
      setError('No se pudieron cargar los lugares');
    } finally {
      setLoading(false);
    }
  };

  const filterPlaces = () => {
    let filtered = places;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(place => place.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(place =>
        place.name.toLowerCase().includes(query) ||
        place.address.toLowerCase().includes(query) ||
        place.description.toLowerCase().includes(query)
      );
    }

    setFilteredPlaces(filtered);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        size={16}
        color={index < rating ? '#FCD34D' : '#E5E7EB'}
        fill={index < rating ? '#FCD34D' : 'transparent'}
      />
    ));
  };

  const getCategoryIcon = (categoryId: string) => {
    const category = CATEGORIES.find(cat => cat.id === categoryId);
    return category?.icon || '🏢';
  };

  const getCategoryName = (categoryId: string) => {
    const category = CATEGORIES.find(cat => cat.id === categoryId);
    return category?.name || categoryId;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>Cargando lugares...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error al cargar</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchPlaces}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lugares Pet-Friendly</Text>
        <Text style={styles.subtitle}>Descubre lugares que aman a las mascotas</Text>
      </View>

      <View style={styles.searchContainer}>
        <Input
          placeholder="Buscar lugares..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Search size={20} color="#9CA3AF" />}
        />
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryButton,
              selectedCategory === category.id && styles.selectedCategoryButton
            ]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <Text style={styles.categoryIcon}>{category.icon}</Text>
            <Text style={[
              styles.categoryText,
              selectedCategory === category.id && styles.selectedCategoryText
            ]}>
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {filteredPlaces.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🐾</Text>
            <Text style={styles.emptyTitle}>
              {searchQuery || selectedCategory !== 'all' 
                ? 'No se encontraron lugares' 
                : 'No hay lugares disponibles'
              }
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || selectedCategory !== 'all'
                ? 'Intenta con otros términos de búsqueda'
                : 'Pronto agregaremos más lugares pet-friendly'
              }
            </Text>
          </View>
        ) : (
          filteredPlaces.map((place) => (
            <Card key={place.id} style={styles.placeCard}>
              {place.imageUrl && (
                <Image source={{ uri: place.imageUrl }} style={styles.placeImage} />
              )}
              
              <View style={styles.placeContent}>
                <View style={styles.placeHeader}>
                  <View style={styles.placeInfo}>
                    <Text style={styles.placeName}>{place.name}</Text>
                    <View style={styles.categoryContainer}>
                      <Text style={styles.categoryIconSmall}>
                        {getCategoryIcon(place.category)}
                      </Text>
                      <Text style={styles.categoryName}>
                        {getCategoryName(place.category)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.ratingContainer}>
                    <View style={styles.starsContainer}>
                      {renderStars(place.rating)}
                    </View>
                    <Text style={styles.ratingText}>{place.rating.toFixed(1)}</Text>
                  </View>
                </View>

                <Text style={styles.placeDescription}>{place.description}</Text>

                <View style={styles.placeDetails}>
                  <View style={styles.placeDetail}>
                    <MapPin size={16} color="#6B7280" />
                    <Text style={styles.placeDetailText}>{place.address}</Text>
                  </View>
                  {place.phone && (
                    <View style={styles.placeDetail}>
                      <Phone size={16} color="#6B7280" />
                      <Text style={styles.placeDetailText}>{place.phone}</Text>
                    </View>
                  )}
                </View>

                {place.petAmenities.length > 0 && (
                  <View style={styles.amenitiesContainer}>
                    <Text style={styles.amenitiesTitle}>Servicios para mascotas:</Text>
                    <View style={styles.amenitiesList}>
                      {place.petAmenities.slice(0, 4).map((amenity, index) => (
                        <View key={index} style={styles.amenityTag}>
                          <Text style={styles.amenityIcon}>
                            {AMENITY_ICONS[amenity] || '✅'}
                          </Text>
                          <Text style={styles.amenityText}>{amenity}</Text>
                        </View>
                      ))}
                      {place.petAmenities.length > 4 && (
                        <View style={styles.amenityTag}>
                          <Text style={styles.amenityText}>
                            +{place.petAmenities.length - 4} más
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#EF4444',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  categoriesContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoriesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  selectedCategoryButton: {
    backgroundColor: '#DC2626',
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedCategoryText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  placeCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  placeImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  placeContent: {
    padding: 16,
  },
  placeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  placeInfo: {
    flex: 1,
    marginRight: 12,
  },
  placeName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIconSmall: {
    fontSize: 14,
    marginRight: 4,
  },
  categoryName: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#DC2626',
  },
  ratingContainer: {
    alignItems: 'flex-end',
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  placeDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  placeDetails: {
    marginBottom: 12,
  },
  placeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  placeDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
  amenitiesContainer: {
    marginTop: 8,
  },
  amenitiesTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  amenitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  amenityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  amenityIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  amenityText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#15803D',
  },
});