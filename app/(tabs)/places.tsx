import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Linking } from 'react-native';
import { router } from 'expo-router';
import { MapPin, Star, Phone, Navigation, Plus } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
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
  coordinates?: { latitude: number; longitude: number };
  isActive: boolean;
  createdAt: Date;
}

const CATEGORIES = [
  { id: 'all', name: 'Todos' },
  { id: 'park', name: 'Parques' },
  { id: 'restaurant', name: 'Restaurantes' },
  { id: 'hotel', name: 'Hoteles' },
  { id: 'store', name: 'Tiendas' },
  { id: 'beach', name: 'Playas' },
  { id: 'cafe', name: 'Cafeterías' },
  { id: 'vet', name: 'Veterinarias' },
];

export default function Places() {
  const { currentUser } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaces();
  }, []);

  useEffect(() => {
    filterPlaces();
  }, [places, searchQuery, selectedCategory]);

  const fetchPlaces = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabaseClient
        .from('places')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const placesData = data?.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        address: item.address,
        phone: item.phone,
        rating: parseFloat(item.rating) || 5,
        description: item.description,
        petAmenities: item.pet_amenities || [],
        imageUrl: item.image_url,
        coordinates: item.coordinates,
        isActive: item.is_active,
        createdAt: new Date(item.created_at),
      })) || [];

      setPlaces(placesData);
    } catch (error) {
      console.error('Error fetching places:', error);
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
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(place =>
        place.name.toLowerCase().includes(query) ||
        place.address.toLowerCase().includes(query) ||
        place.description.toLowerCase().includes(query)
      );
    }

    setFilteredPlaces(filtered);
  };

  const handleContact = async (phone: string) => {
    try {
      const phoneUrl = `tel:${phone}`;
      const canOpen = await Linking.canOpenURL(phoneUrl);
      
      if (canOpen) {
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert('Error', 'No se puede abrir la aplicación de llamadas');
      }
    } catch (error) {
      console.error('Error opening phone app:', error);
      Alert.alert('Error', 'No se pudo realizar la llamada');
    }
  };

  const handleViewLocation = async (place: Place) => {
    try {
      let mapUrl = '';
      
      // Use coordinates if available, otherwise use address
      if (place.coordinates && place.coordinates.latitude && place.coordinates.longitude) {
        mapUrl = `https://www.google.com/maps/search/?api=1&query=${place.coordinates.latitude},${place.coordinates.longitude}`;
      } else if (place.address) {
        const encodedAddress = encodeURIComponent(place.address);
        mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
      } else {
        Alert.alert('Error', 'No hay información de ubicación disponible');
        return;
      }

      const canOpen = await Linking.canOpenURL(mapUrl);
      
      if (canOpen) {
        await Linking.openURL(mapUrl);
      } else {
        Alert.alert('Error', 'No se puede abrir la aplicación de mapas');
      }
    } catch (error) {
      console.error('Error opening maps app:', error);
      Alert.alert('Error', 'No se pudo abrir la ubicación');
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={16}
        color={i < rating ? "#FCD34D" : "#E5E7EB"}
        fill={i < rating ? "#FCD34D" : "transparent"}
      />
    ));
  };

  const getCategoryName = (categoryId: string) => {
    const category = CATEGORIES.find(cat => cat.id === categoryId);
    return category?.name || categoryId;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lugares Pet-Friendly</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => router.push('/places/add')}
        >
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchSection}>
        <Input
          placeholder="Buscar lugares..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
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
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button title="Reintentar" onPress={fetchPlaces} size="medium" />
          </View>
        ) : filteredPlaces.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MapPin size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>
              {searchQuery || selectedCategory !== 'all' 
                ? 'No se encontraron lugares' 
                : 'No hay lugares disponibles'
              }
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || selectedCategory !== 'all'
                ? 'Intenta con otros términos de búsqueda'
                : 'Los lugares pet-friendly aparecerán aquí'
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
                  <Text style={styles.placeName}>{place.name}</Text>
                  <View style={styles.ratingContainer}>
                    <View style={styles.starsContainer}>
                      {renderStars(place.rating)}
                    </View>
                    <Text style={styles.ratingText}>{place.rating.toFixed(1)}</Text>
                  </View>
                </View>

                <Text style={styles.placeCategory}>{getCategoryName(place.category)}</Text>
                <Text style={styles.placeDescription} numberOfLines={2}>
                  {place.description}
                </Text>

                <View style={styles.placeDetails}>
                  <View style={styles.placeDetail}>
                    <MapPin size={16} color="#6B7280" />
                    <Text style={styles.placeDetailText} numberOfLines={1}>
                      {place.address}
                    </Text>
                  </View>
                  {place.phone && (
                    <View style={styles.placeDetail}>
                      <Phone size={16} color="#6B7280" />
                      <Text style={styles.placeDetailText}>{place.phone}</Text>
                    </View>
                  )}
                </View>

                {place.petAmenities.length > 0 && (
                  <View style={styles.amenitiesSection}>
                    <Text style={styles.amenitiesTitle}>Servicios para mascotas:</Text>
                    <View style={styles.amenitiesList}>
                      {place.petAmenities.slice(0, 3).map((amenity, index) => (
                        <View key={index} style={styles.amenityTag}>
                          <Text style={styles.amenityText}>{amenity}</Text>
                        </View>
                      ))}
                      {place.petAmenities.length > 3 && (
                        <View style={styles.amenityTag}>
                          <Text style={styles.amenityText}>
                            +{place.petAmenities.length - 3} más
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.separator} />

                <View style={styles.actionButtons}>
                  {place.phone && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.contactButton]}
                      onPress={() => handleContact(place.phone!)}
                    >
                      <Phone size={16} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Contactar</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.locationButton]}
                    onPress={() => handleViewLocation(place)}
                  >
                    <Navigation size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Ver Ubicación</Text>
                  </TouchableOpacity>
                </View>
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
    backgroundColor: '#FFFFFF',
    paddingTop: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },
  addButton: {
    backgroundColor: '#2D6A6F',
    padding: 8,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoriesScroll: {
    marginTop: 12,
  },
  categoriesContent: {
    paddingRight: 16,
  },
  categoryButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
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
  content: {
    flex: 1,
    padding: 16,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyContainer: {
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
    marginTop: 16,
    marginBottom: 8,
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
    overflow: 'hidden',
  },
  placeImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  placeContent: {
    padding: 16,
  },
  placeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  placeName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 6,
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  placeCategory: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginBottom: 8,
  },
  placeDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
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
  amenitiesSection: {
    marginBottom: 16,
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
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  amenityText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  contactButton: {
    backgroundColor: '#2D6A6F',
  },
  locationButton: {
    backgroundColor: '#3B82F6',
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});