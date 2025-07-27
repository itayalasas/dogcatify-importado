import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Linking } from 'react-native';
import { Search, MapPin, Phone, Clock, Star, Filter } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

interface Place {
  id: string;
  name: string;
  category: string;
  rating: number;
  address: string;
  phone: string;
  distance: string;
  isOpen: boolean;
  hours: string;
  features: string[];
  description: string;
}

const CATEGORIES = [
  { id: 'all', name: 'Todos', icon: '🏢' },
  { id: 'restaurant', name: 'Restaurantes', icon: '🍽️' },
  { id: 'cafe', name: 'Cafeterías', icon: '☕' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️' },
  { id: 'hotel', name: 'Hoteles', icon: '🏨' },
  { id: 'park', name: 'Parques', icon: '🌳' },
  { id: 'beach', name: 'Playas', icon: '🏖️' },
];

const SAMPLE_PLACES: Place[] = [
  {
    id: '1',
    name: 'Café Pet Paradise',
    category: 'cafe',
    rating: 4.8,
    address: 'Av. Corrientes 1234, CABA',
    phone: '+54 11 1234-5678',
    distance: '0.5 km',
    isOpen: true,
    hours: '8:00 - 22:00',
    features: ['Agua para mascotas', 'Área exterior', 'Menú pet-friendly'],
    description: 'Cafetería acogedora que recibe mascotas con área especial al aire libre.'
  },
  {
    id: '2',
    name: 'Shopping Pet Mall',
    category: 'shopping',
    rating: 4.5,
    address: 'Av. Santa Fe 5678, CABA',
    phone: '+54 11 8765-4321',
    distance: '1.2 km',
    isOpen: true,
    hours: '10:00 - 22:00',
    features: ['Pet store', 'Veterinaria', 'Área de descanso'],
    description: 'Centro comercial con múltiples tiendas pet-friendly y servicios para mascotas.'
  },
  {
    id: '3',
    name: 'Restaurante La Mascota',
    category: 'restaurant',
    rating: 4.7,
    address: 'Palermo Soho, CABA',
    phone: '+54 11 2468-1357',
    distance: '2.1 km',
    isOpen: false,
    hours: '12:00 - 24:00',
    features: ['Terraza pet-friendly', 'Menú especial mascotas', 'Bowls disponibles'],
    description: 'Restaurante gourmet con terraza especialmente diseñada para disfrutar con tu mascota.'
  },
];

export default function Places() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [places] = useState<Place[]>(SAMPLE_PLACES);

  const filteredPlaces = places.filter(place => {
    const matchesSearch = place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         place.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || place.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleDirections = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    Linking.openURL(`https://maps.google.com/?q=${encodedAddress}`);
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find(c => c.id === category);
    return cat?.icon || '🏢';
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
        <Text style={styles.subtitle}>Descubre lugares que aman a las mascotas</Text>
      </View>

      <View style={styles.searchSection}>
        <Input
          placeholder="Buscar lugares..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Search size={20} color="#9CA3AF" />}
        />
      </View>

      <View style={styles.categoriesSection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
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
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {filteredPlaces.length} lugar{filteredPlaces.length !== 1 ? 'es' : ''} encontrado{filteredPlaces.length !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity style={styles.filterButton}>
            <Filter size={16} color="#6B7280" />
            <Text style={styles.filterText}>Filtros</Text>
          </TouchableOpacity>
        </View>

        {filteredPlaces.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>No se encontraron lugares</Text>
            <Text style={styles.emptySubtitle}>
              Intenta con otros términos de búsqueda o categorías
            </Text>
          </View>
        ) : (
          filteredPlaces.map((place) => (
            <Card key={place.id} style={styles.placeCard}>
              <View style={styles.placeHeader}>
                <View style={styles.placeInfo}>
                  <View style={styles.placeTitleRow}>
                    <Text style={styles.categoryEmoji}>{getCategoryIcon(place.category)}</Text>
                    <Text style={styles.placeName}>{place.name}</Text>
                  </View>
                  <View style={styles.ratingRow}>
                    <View style={styles.starsContainer}>
                      {renderStars(place.rating)}
                    </View>
                    <Text style={styles.ratingText}>{place.rating}</Text>
                  </View>
                </View>
                <View style={styles.statusContainer}>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: place.isOpen ? '#DCFCE7' : '#FEE2E2' }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: place.isOpen ? '#16A34A' : '#DC2626' }
                    ]}>
                      {place.isOpen ? 'Abierto' : 'Cerrado'}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.placeDescription}>{place.description}</Text>

              <View style={styles.placeDetails}>
                <View style={styles.detailRow}>
                  <MapPin size={16} color="#6B7280" />
                  <Text style={styles.detailText}>{place.address}</Text>
                  <Text style={styles.distanceText}>{place.distance}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Clock size={16} color="#6B7280" />
                  <Text style={styles.detailText}>{place.hours}</Text>
                </View>
              </View>

              <View style={styles.featuresContainer}>
                <Text style={styles.featuresTitle}>Características pet-friendly:</Text>
                <View style={styles.featuresGrid}>
                  {place.features.map((feature, index) => (
                    <View key={index} style={styles.featureTag}>
                      <Text style={styles.featureText}>✓ {feature}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.placeActions}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleCall(place.phone)}
                >
                  <Phone size={16} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Llamar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.directionsButton]}
                  onPress={() => handleDirections(place.address)}
                >
                  <MapPin size={16} color="#DC2626" />
                  <Text style={[styles.actionButtonText, styles.directionsButtonText]}>
                    Cómo llegar
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}

        <View style={styles.bottomPadding} />
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
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  categoriesSection: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedCategory: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
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
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  resultsCount: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#111827',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  filterText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginLeft: 4,
  },
  placeCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  placeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  placeInfo: {
    flex: 1,
  },
  placeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  placeName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  star: {
    fontSize: 12,
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  placeDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
    marginBottom: 16,
  },
  placeDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
  distanceText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#DC2626',
  },
  featuresContainer: {
    marginBottom: 16,
  },
  featuresTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    marginBottom: 8,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featureText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#16A34A',
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
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  directionsButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  directionsButtonText: {
    color: '#DC2626',
  },
  emptyState: {
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
    fontFamily: 'Inter-Bold',
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
  bottomPadding: {
    height: 20,
  },
});