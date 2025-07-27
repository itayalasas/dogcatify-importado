import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Linking } from 'react-native';
import { MapPin, Phone, Star, Clock, Car } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface Place {
  id: string;
  name: string;
  category: string;
  address: string;
  phone?: string;
  rating: number;
  distance: string;
  hours: string;
  description: string;
  petFriendlyFeatures: string[];
}

export default function Places() {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // Mock data for pet-friendly places
  const mockPlaces: Place[] = [
    {
      id: '1',
      name: 'Parque de los Niños',
      category: 'parque',
      address: 'Av. Libertador 1234, Buenos Aires',
      phone: '+54 11 1234-5678',
      rating: 4.5,
      distance: '0.8 km',
      hours: '6:00 - 22:00',
      description: 'Amplio parque con área especial para mascotas',
      petFriendlyFeatures: ['Área para perros', 'Bebederos', 'Bolsas para desechos']
    },
    {
      id: '2',
      name: 'Café Pet Friendly',
      category: 'restaurante',
      address: 'Calle Corrientes 567, Buenos Aires',
      phone: '+54 11 2345-6789',
      rating: 4.2,
      distance: '1.2 km',
      hours: '8:00 - 20:00',
      description: 'Café acogedor que acepta mascotas en su terraza',
      petFriendlyFeatures: ['Terraza pet-friendly', 'Agua para mascotas', 'Menú especial']
    },
    {
      id: '3',
      name: 'Hotel Pet Paradise',
      category: 'hotel',
      address: 'Av. Santa Fe 890, Buenos Aires',
      phone: '+54 11 3456-7890',
      rating: 4.8,
      distance: '2.1 km',
      hours: '24 horas',
      description: 'Hotel de lujo que acepta mascotas con servicios especiales',
      petFriendlyFeatures: ['Habitaciones pet-friendly', 'Servicio de cuidado', 'Área de juegos']
    }
  ];

  useEffect(() => {
    setPlaces(mockPlaces);
  }, []);

  const categories = [
    { id: 'all', name: 'Todos', icon: '📍' },
    { id: 'parque', name: 'Parques', icon: '🌳' },
    { id: 'restaurante', name: 'Restaurantes', icon: '🍽️' },
    { id: 'hotel', name: 'Hoteles', icon: '🏨' },
    { id: 'tienda', name: 'Tiendas', icon: '🛍️' },
  ];

  const filteredPlaces = places.filter(place => 
    selectedCategory === 'all' || place.category === selectedCategory
  );

  const handleCall = (phone: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleDirections = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    Linking.openURL(`https://maps.google.com/?q=${encodedAddress}`);
  };

  const renderStarRating = (rating: number) => {
    return (
      <View style={styles.starRating}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            color={star <= rating ? '#F59E0B' : '#E5E7EB'}
            fill={star <= rating ? '#F59E0B' : 'none'}
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Categories */}
        <View style={styles.categoriesContainer}>
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

        {/* Places List */}
        <View style={styles.placesContainer}>
          {filteredPlaces.length === 0 ? (
            <Card style={styles.emptyCard}>
              <MapPin size={48} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No hay lugares disponibles</Text>
              <Text style={styles.emptySubtitle}>
                No se encontraron lugares en esta categoría
              </Text>
            </Card>
          ) : (
            filteredPlaces.map((place) => (
              <Card key={place.id} style={styles.placeCard}>
                <View style={styles.placeHeader}>
                  <View style={styles.placeInfo}>
                    <Text style={styles.placeName}>{place.name}</Text>
                    <View style={styles.ratingContainer}>
                      {renderStarRating(place.rating)}
                      <Text style={styles.ratingText}>{place.rating}</Text>
                      <Text style={styles.distanceText}>{place.distance}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.placeDescription}>{place.description}</Text>

                <View style={styles.placeDetails}>
                  <View style={styles.placeDetail}>
                    <MapPin size={16} color="#6B7280" />
                    <Text style={styles.placeDetailText}>{place.address}</Text>
                  </View>
                  
                  <View style={styles.placeDetail}>
                    <Clock size={16} color="#6B7280" />
                    <Text style={styles.placeDetailText}>{place.hours}</Text>
                  </View>
                </View>

                {/* Pet-friendly features */}
                <View style={styles.featuresContainer}>
                  <Text style={styles.featuresTitle}>Características pet-friendly:</Text>
                  <View style={styles.featuresList}>
                    {place.petFriendlyFeatures.map((feature, index) => (
                      <View key={index} style={styles.featureItem}>
                        <Text style={styles.featureBullet}>•</Text>
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Action buttons */}
                <View style={styles.placeActions}>
                  {place.phone && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleCall(place.phone!)}
                    >
                      <Phone size={16} color="#2D6A6F" />
                      <Text style={styles.actionButtonText}>Llamar</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDirections(place.address)}
                  >
                    <Car size={16} color="#2D6A6F" />
                    <Text style={styles.actionButtonText}>Cómo llegar</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}
        </View>
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
  content: {
    flex: 1,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
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
  placesContainer: {
    paddingHorizontal: 16,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
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
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starRating: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    marginRight: 8,
  },
  distanceText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#2D6A6F',
  },
  placeDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
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
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  featuresContainer: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  featuresTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  featuresList: {
    gap: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureBullet: {
    fontSize: 14,
    color: '#2D6A6F',
    marginRight: 8,
  },
  featureText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    flex: 1,
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
    backgroundColor: '#EBF8FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D6A6F',
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#2D6A6F',
    marginLeft: 6,
  },
});