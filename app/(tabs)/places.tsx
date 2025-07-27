import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Linking, Alert } from 'react-native';
import { MapPin, Phone, Star, Search, Filter } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

interface Place {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  rating: number;
  description: string;
  petAmenities: string[];
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

const CATEGORIES = [
  { id: 'all', name: 'Todos', icon: '🏢' },
  { id: 'parks', name: 'Parques', icon: '🌳' },
  { id: 'restaurants', name: 'Restaurantes', icon: '🍽️' },
  { id: 'hotels', name: 'Hoteles', icon: '🏨' },
  { id: 'stores', name: 'Tiendas', icon: '🏪' },
  { id: 'beaches', name: 'Playas', icon: '🏖️' },
];

const SAMPLE_PLACES: Place[] = [
  {
    id: '1',
    name: 'Parque Central',
    category: 'parks',
    address: 'Av. Principal 123, Centro',
    phone: '+1234567890',
    rating: 4.5,
    description: 'Amplio parque con áreas especiales para mascotas',
    petAmenities: ['Área de juegos para perros', 'Bebederos', 'Bolsas para desechos'],
    coordinates: { latitude: -34.6037, longitude: -58.3816 }
  },
  {
    id: '2',
    name: 'Café Pet Friendly',
    category: 'restaurants',
    address: 'Calle de los Perros 456',
    phone: '+1234567891',
    rating: 4.2,
    description: 'Café acogedor que da la bienvenida a mascotas',
    petAmenities: ['Menú para mascotas', 'Agua fresca', 'Área exterior'],
    coordinates: { latitude: -34.6118, longitude: -58.3960 }
  },
  {
    id: '3',
    name: 'Hotel Mascota Feliz',
    category: 'hotels',
    address: 'Boulevard de las Mascotas 789',
    phone: '+1234567892',
    rating: 4.8,
    description: 'Hotel de lujo que acepta mascotas con servicios especiales',
    petAmenities: ['Camas para mascotas', 'Servicio de paseo', 'Guardería'],
    coordinates: { latitude: -34.5875, longitude: -58.3974 }
  },
  {
    id: '4',
    name: 'PetStore Premium',
    category: 'stores',
    address: 'Av. de los Animales 321',
    phone: '+1234567893',
    rating: 4.3,
    description: 'Tienda especializada en productos premium para mascotas',
    petAmenities: ['Prueba de productos', 'Consulta veterinaria', 'Grooming'],
    coordinates: { latitude: -34.6092, longitude: -58.3732 }
  },
  {
    id: '5',
    name: 'Playa Canina',
    category: 'beaches',
    address: 'Costa del Sol s/n',
    phone: '+1234567894',
    rating: 4.6,
    description: 'Playa especialmente habilitada para mascotas',
    petAmenities: ['Área de baño para perros', 'Duchas', 'Sombra'],
    coordinates: { latitude: -34.5555, longitude: -58.4444 }
  },
  {
    id: '6',
    name: 'Parque de los Cachorros',
    category: 'parks',
    address: 'Barrio Norte 654',
    phone: '+1234567895',
    rating: 4.4,
    description: 'Parque diseñado especialmente para cachorros y perros pequeños',
    petAmenities: ['Área para cachorros', 'Obstáculos de entrenamiento', 'Veterinario de guardia'],
    coordinates: { latitude: -34.5889, longitude: -58.3930 }
  }
];

export default function Places() {
  const [places, setPlaces] = useState<Place[]>(SAMPLE_PLACES);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const getFilteredPlaces = () => {
    let filtered = places;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(place => place.category === selectedCategory);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(place =>
        place.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleGetDirections = (place: Place) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.coordinates.latitude},${place.coordinates.longitude}`;
    Linking.openURL(url);
  };

  const getCategoryIcon = (category: string) => {
    const categoryData = CATEGORIES.find(cat => cat.id === category);
    return categoryData?.icon || '🏢';
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Text key={i} style={styles.star}>⭐</Text>);
    }

    if (hasHalfStar) {
      stars.push(<Text key="half" style={styles.star}>⭐</Text>);
    }

    return stars;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lugares Pet-Friendly</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Buscar lugares por nombre..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Search size={20} color="#9CA3AF" />}
        />
      </View>

      {/* Category Filter */}
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
              selectedCategory === category.id && styles.selectedCategory
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

      {/* Places List */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {getFilteredPlaces().length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>No se encontraron lugares</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Intenta con otro término de búsqueda' : 'No hay lugares en esta categoría'}
            </Text>
          </View>
        ) : (
          getFilteredPlaces().map((place) => (
            <Card key={place.id} style={styles.placeCard}>
              <View style={styles.placeHeader}>
                <View style={styles.placeInfo}>
                  <View style={styles.placeTitleRow}>
                    <Text style={styles.categoryEmoji}>{getCategoryIcon(place.category)}</Text>
                    <Text style={styles.placeName}>{place.name}</Text>
                  </View>
                  <View style={styles.ratingContainer}>
                    <View style={styles.starsContainer}>
                      {renderStars(place.rating)}
                    </View>
                    <Text style={styles.ratingText}>{place.rating}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.placeDescription}>{place.description}</Text>

              <View style={styles.addressContainer}>
                <MapPin size={16} color="#6B7280" />
                <Text style={styles.addressText}>{place.address}</Text>
              </View>

              <View style={styles.amenitiesContainer}>
                <Text style={styles.amenitiesTitle}>Servicios para mascotas:</Text>
                {place.petAmenities.map((amenity, index) => (
                  <Text key={index} style={styles.amenityItem}>• {amenity}</Text>
                ))}
              </View>

              <View style={styles.placeActions}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleCall(place.phone)}
                >
                  <Phone size={16} color="#2D6A6F" />
                  <Text style={styles.actionButtonText}>Llamar</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionButton, styles.primaryAction]}
                  onPress={() => handleGetDirections(place)}
                >
                  <MapPin size={16} color="#FFFFFF" />
                  <Text style={[styles.actionButtonText, styles.primaryActionText]}>
                    Cómo llegar
                  </Text>
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
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  categoriesContainer: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 16,
  },
  categoriesContent: {
    paddingHorizontal: 16,
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
  selectedCategory: {
    backgroundColor: '#2D6A6F',
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
    paddingTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
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
  },
  placeHeader: {
    marginBottom: 12,
  },
  placeInfo: {
    flex: 1,
  },
  placeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryEmoji: {
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
  starsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  star: {
    fontSize: 14,
  },
  ratingText: {
    fontSize: 14,
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
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  addressText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 6,
    flex: 1,
  },
  amenitiesContainer: {
    marginBottom: 16,
  },
  amenitiesTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  amenityItem: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
  placeActions: {
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
    borderWidth: 1,
    borderColor: '#2D6A6F',
    backgroundColor: '#FFFFFF',
  },
  primaryAction: {
    backgroundColor: '#2D6A6F',
    borderColor: '#2D6A6F',
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#2D6A6F',
    marginLeft: 6,
  },
  primaryActionText: {
    color: '#FFFFFF',
  },
});