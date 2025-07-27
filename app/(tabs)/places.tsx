import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, TextInput } from 'react-native';
import { MapPin, Star, Phone, Search, Navigation } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
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
  coordinates: {
    latitude: number;
    longitude: number;
  };
  isActive: boolean;
  createdAt: Date;
}

const CATEGORIES = [
  { id: 'all', name: 'Todos', icon: '🏢' },
  { id: 'parques', name: 'Parques', icon: '🌳' },
  { id: 'restaurantes', name: 'Restaurantes', icon: '🍽️' },
  { id: 'hoteles', name: 'Hoteles', icon: '🏨' },
  { id: 'tiendas', name: 'Tiendas', icon: '🏪' },
  { id: 'playas', name: 'Playas', icon: '🏖️' },
  { id: 'cafeterias', name: 'Cafeterías', icon: '☕' },
  { id: 'veterinarias', name: 'Veterinarias', icon: '🏥' },
];

export default function Places() {
  const { currentUser } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchPlaces();
  }, []);

  useEffect(() => {
    filterPlaces();
  }, [places, searchQuery, selectedCategory]);

  const fetchPlaces = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from('places')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const placesData = data?.map(place => ({
        id: place.id,
        name: place.name,
        category: place.category,
        address: place.address,
        phone: place.phone,
        rating: place.rating,
        description: place.description,
        petAmenities: place.pet_amenities || [],
        imageUrl: place.image_url,
        coordinates: {
          latitude: place.coordinates?.latitude || 0,
          longitude: place.coordinates?.longitude || 0,
        },
        isActive: place.is_active,
        createdAt: new Date(place.created_at),
      })) || [];
      
      setPlaces(placesData);
    } catch (error) {
      console.error('Error fetching places:', error);
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
      filtered = filtered.filter(place =>
        place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        place.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        place.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredPlaces(filtered);
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find(c => c.id === category);
    return cat?.icon || '📍';
  };

  const getCategoryName = (category: string) => {
    const cat = CATEGORIES.find(c => c.id === category);
    return cat?.name || category;
  };

  const renderStarRating = (rating: number) => {
    return (
      <View style={styles.starRating}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            color={star <= rating ? '#FCD34D' : '#E5E7EB'}
            fill={star <= rating ? '#FCD34D' : 'transparent'}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lugares Pet-Friendly</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar lugares..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContent}>
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
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando lugares...</Text>
          </View>
        ) : filteredPlaces.length === 0 ? (
          <Card style={styles.emptyCard}>
            <MapPin size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>
              {searchQuery || selectedCategory !== 'all' 
                ? 'No se encontraron lugares' 
                : 'No hay lugares disponibles'
              }
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || selectedCategory !== 'all'
                ? 'Intenta con otros términos de búsqueda o categoría'
                : 'Los lugares pet-friendly aparecerán aquí'
              }
            </Text>
          </Card>
        ) : (
          filteredPlaces.map((place) => (
            <Card key={place.id} style={styles.placeCard}>
              <View style={styles.placeHeader}>
                <View style={styles.placeTitleRow}>
                  <Text style={styles.categoryIcon}>
                    {getCategoryIcon(place.category)}
                  </Text>
                  <Text style={styles.placeName}>{place.name}</Text>
                </View>
                <View style={styles.ratingContainer}>
                  {renderStarRating(place.rating)}
                  <Text style={styles.ratingText}>{place.rating}</Text>
                </View>
              </View>

              <Text style={styles.placeCategory}>
                {getCategoryName(place.category)}
              </Text>

              {place.imageUrl && (
                <Image source={{ uri: place.imageUrl }} style={styles.placeImage} />
              )}

              <Text style={styles.placeDescription}>{place.description}</Text>

              <View style={styles.placeDetails}>
                <View style={styles.addressContainer}>
                  <MapPin size={16} color="#6B7280" />
                  <Text style={styles.addressText}>{place.address}</Text>
                </View>
                
                {place.phone && (
                  <View style={styles.phoneContainer}>
                    <Phone size={16} color="#6B7280" />
                    <Text style={styles.phoneText}>{place.phone}</Text>
                  </View>
                )}
              </View>

              {place.petAmenities.length > 0 && (
                <View style={styles.amenitiesContainer}>
                  <Text style={styles.amenitiesTitle}>Servicios para mascotas:</Text>
                  <View style={styles.amenitiesList}>
                    {place.petAmenities.slice(0, 3).map((amenity, index) => (
                      <View key={index} style={styles.amenityTag}>
                        <Text style={styles.amenityText}>{amenity}</Text>
                      </View>
                    ))}
                    {place.petAmenities.length > 3 && (
                      <Text style={styles.moreAmenities}>
                        +{place.petAmenities.length - 3} más
                      </Text>
                    )}
                  </View>
                </View>
              )}

              <View style={styles.placeActions}>
                <TouchableOpacity style={styles.actionButton}>
                  <Navigation size={16} color="#3B82F6" />
                  <Text style={styles.actionButtonText}>Cómo llegar</Text>
                </TouchableOpacity>
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
    paddingTop: 30,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
    textAlign: 'center',
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  categoriesContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoriesContent: {
    paddingHorizontal: 16,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedCategoryButton: {
    backgroundColor: '#2D6A6F',
    borderColor: '#2D6A6F',
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
    padding: 16,
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
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  placeCard: {
    marginBottom: 16,
  },
  placeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  placeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  placeName: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starRating: {
    flexDirection: 'row',
    marginRight: 6,
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  placeCategory: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginBottom: 12,
  },
  placeImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
    resizeMode: 'cover',
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
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 6,
    flex: 1,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 6,
  },
  amenitiesContainer: {
    marginBottom: 12,
  },
  amenitiesTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  amenitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  amenityTag: {
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  amenityText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
  moreAmenities: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    alignSelf: 'center',
  },
  placeActions: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF8FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginLeft: 6,
  },
});