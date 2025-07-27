import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert, Image } from 'react-native';
import { Plus, MapPin, Search, Star, Phone, Navigation, Camera } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';

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
  coordinates?: { lat: number; lng: number };
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
}

const CATEGORIES = [
  { value: 'park', label: 'Parque', icon: '🌳' },
  { value: 'restaurant', label: 'Restaurante', icon: '🍽️' },
  { value: 'hotel', label: 'Hotel', icon: '🏨' },
  { value: 'store', label: 'Tienda', icon: '🏪' },
  { value: 'beach', label: 'Playa', icon: '🏖️' },
  { value: 'cafe', label: 'Cafetería', icon: '☕' },
  { value: 'vet', label: 'Veterinaria', icon: '🐾' },
];

const PET_AMENITIES = [
  'Área de juegos para mascotas',
  'Bebederos para mascotas',
  'Menú especial para mascotas',
  'Área de descanso para mascotas',
  'Servicio de cuidado de mascotas',
  'Bolsas para desechos',
  'Correas disponibles',
  'Juguetes para mascotas',
];

export default function AdminPlaces() {
  const { currentUser } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);

  // Form state
  const [placeName, setPlaceName] = useState('');
  const [placeCategory, setPlaceCategory] = useState('park');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placePhone, setPlacePhone] = useState('');
  const [placeRating, setPlaceRating] = useState(5);
  const [placeDescription, setPlaceDescription] = useState('');
  const [placeImage, setPlaceImage] = useState<string | null>(null);
  const [placeCoordinates, setPlaceCoordinates] = useState('');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    const isAdmin = currentUser.email?.toLowerCase() === 'admin@dogcatify.com';
    if (!isAdmin) return;
    fetchPlaces();
  }, [currentUser]);

  const fetchPlaces = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('places')
        .select('*')
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
        createdBy: item.created_by,
        createdAt: new Date(item.created_at),
      })) || [];

      setPlaces(placesData);
    } catch (error) {
      console.error('Error fetching places:', error);
    }
  };

  const handleSelectImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permisos requeridos', 'Se necesitan permisos para acceder a la galería');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPlaceImage(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permisos requeridos', 'Se necesitan permisos para usar la cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPlaceImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (imageUri: string): Promise<string> => {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const filename = `places/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

    const { error } = await supabaseClient.storage
      .from('dogcatify')
      .upload(filename, blob);

    if (error) throw error;

    const { data: { publicUrl } } = supabaseClient.storage
      .from('dogcatify')
      .getPublicUrl(filename);

    return publicUrl;
  };

  const handleCreatePlace = async () => {
    if (!placeName || !placeAddress || !placeDescription) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      let imageUrl = null;
      if (placeImage) {
        imageUrl = await uploadImage(placeImage);
      }

      let coordinates = null;
      if (placeCoordinates) {
        try {
          const [lat, lng] = placeCoordinates.split(',').map(coord => parseFloat(coord.trim()));
          if (!isNaN(lat) && !isNaN(lng)) {
            coordinates = { lat, lng };
          }
        } catch (error) {
          console.warn('Invalid coordinates format');
        }
      }

      const placeData = {
        name: placeName.trim(),
        category: placeCategory,
        address: placeAddress.trim(),
        phone: placePhone.trim() || null,
        rating: placeRating,
        description: placeDescription.trim(),
        pet_amenities: selectedAmenities,
        image_url: imageUrl,
        coordinates: coordinates,
        is_active: true,
        created_by: currentUser?.id,
      };

      const { error } = await supabaseClient
        .from('places')
        .insert([placeData]);

      if (error) throw error;

      // Reset form
      setPlaceName('');
      setPlaceCategory('park');
      setPlaceAddress('');
      setPlacePhone('');
      setPlaceRating(5);
      setPlaceDescription('');
      setPlaceImage(null);
      setPlaceCoordinates('');
      setSelectedAmenities([]);
      setShowAddModal(false);

      Alert.alert('Éxito', 'Lugar agregado correctamente');
      fetchPlaces();
    } catch (error) {
      Alert.alert('Error', 'No se pudo agregar el lugar');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlace = async (placeId: string, isActive: boolean) => {
    try {
      const { error } = await supabaseClient
        .from('places')
        .update({ is_active: !isActive })
        .eq('id', placeId);

      if (error) throw error;
      fetchPlaces();
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el lugar');
    }
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenity)
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    );
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat?.icon || '📍';
  };

  const getCategoryLabel = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat?.label || category;
  };

  const filteredPlaces = places.filter(place => {
    const matchesSearch = place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         place.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         place.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || place.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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

  if (!currentUser || currentUser.email?.toLowerCase() !== 'admin@dogcatify.com') {
    return (
      <View style={styles.accessDenied}>
        <Text style={styles.accessDeniedTitle}>Acceso Denegado</Text>
        <Text style={styles.accessDeniedText}>
          Solo los administradores pueden gestionar lugares
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestión de Lugares</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchSection}>
        <Input
          placeholder="Buscar lugares..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Search size={20} color="#9CA3AF" />}
        />
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
        >
          <TouchableOpacity
            style={[
              styles.categoryChip,
              selectedCategory === 'all' && styles.selectedCategoryChip
            ]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text style={[
              styles.categoryChipText,
              selectedCategory === 'all' && styles.selectedCategoryChipText
            ]}>
              Todos
            </Text>
          </TouchableOpacity>
          
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.value}
              style={[
                styles.categoryChip,
                selectedCategory === category.value && styles.selectedCategoryChip
              ]}
              onPress={() => setSelectedCategory(category.value)}
            >
              <Text style={styles.categoryIcon}>{category.icon}</Text>
              <Text style={[
                styles.categoryChipText,
                selectedCategory === category.value && styles.selectedCategoryChipText
              ]}>
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>Estadísticas</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{places.length}</Text>
              <Text style={styles.statLabel}>Total{'\n'}Lugares</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {places.filter(p => p.isActive).length}
              </Text>
              <Text style={styles.statLabel}>Activos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {places.filter(p => !p.isActive).length}
              </Text>
              <Text style={styles.statLabel}>Inactivos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {(places.reduce((sum, p) => sum + p.rating, 0) / places.length || 0).toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>Rating{'\n'}Promedio</Text>
            </View>
          </View>
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Lugares ({filteredPlaces.length})
          </Text>
          
          {filteredPlaces.length === 0 ? (
            <View style={styles.emptyCard}>
              <MapPin size={32} color="#DC2626" />
              <Text style={styles.emptyTitle}>
                {searchQuery || selectedCategory !== 'all' ? 'No se encontraron lugares' : 'No hay lugares'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || selectedCategory !== 'all' 
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Agrega el primer lugar pet-friendly'
                }
              </Text>
            </View>
          ) : (
            filteredPlaces.map((place) => (
              <Card key={place.id} style={styles.placeCard}>
                <View style={styles.placeHeader}>
                  <View style={styles.placeInfo}>
                    <View style={styles.placeTitleRow}>
                      <Text style={styles.categoryIcon}>
                        {getCategoryIcon(place.category)}
                      </Text>
                      <Text style={styles.placeName}>{place.name}</Text>
                    </View>
                    <Text style={styles.placeCategory}>
                      {getCategoryLabel(place.category)}
                    </Text>
                    <View style={styles.ratingRow}>
                      <View style={styles.starsContainer}>
                        {renderStars(place.rating)}
                      </View>
                      <Text style={styles.ratingText}>({place.rating})</Text>
                    </View>
                  </View>
                  <View style={styles.placeStatus}>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: place.isActive ? '#DCFCE7' : '#F3F4F6' }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: place.isActive ? '#22C55E' : '#6B7280' }
                      ]}>
                        {place.isActive ? 'Activo' : 'Inactivo'}
                      </Text>
                    </View>
                  </View>
                </View>

                {place.imageUrl && (
                  <Image source={{ uri: place.imageUrl }} style={styles.placeImage} />
                )}

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

                <View style={styles.placeActions}>
                  <Button
                    title={place.isActive ? 'Desactivar' : 'Activar'}
                    onPress={() => handleTogglePlace(place.id, place.isActive)}
                    variant={place.isActive ? 'outline' : 'primary'}
                    size="medium"
                  />
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Place Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Agregar Nuevo Lugar</Text>
              
              <Input
                label="Nombre del lugar *"
                placeholder="Ej: Parque Central Pet-Friendly"
                value={placeName}
                onChangeText={setPlaceName}
              />

              <View style={styles.categorySection}>
                <Text style={styles.categoryLabel}>Categoría *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.categoryOptions}>
                    {CATEGORIES.map((category) => (
                      <TouchableOpacity
                        key={category.value}
                        style={[
                          styles.categoryOption,
                          placeCategory === category.value && styles.selectedCategoryOption
                        ]}
                        onPress={() => setPlaceCategory(category.value)}
                      >
                        <Text style={styles.categoryOptionIcon}>{category.icon}</Text>
                        <Text style={[
                          styles.categoryOptionText,
                          placeCategory === category.value && styles.selectedCategoryOptionText
                        ]}>
                          {category.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              
              <Input
                label="Dirección *"
                placeholder="Ej: Av. Principal 123, Ciudad"
                value={placeAddress}
                onChangeText={setPlaceAddress}
                leftIcon={<MapPin size={20} color="#6B7280" />}
              />
              
              <Input
                label="Teléfono"
                placeholder="Ej: +1234567890"
                value={placePhone}
                onChangeText={setPlacePhone}
                leftIcon={<Phone size={20} color="#6B7280" />}
              />

              <View style={styles.ratingSection}>
                <Text style={styles.ratingLabel}>Rating (qué tan pet-friendly es) *</Text>
                <View style={styles.ratingSelector}>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <TouchableOpacity
                      key={rating}
                      onPress={() => setPlaceRating(rating)}
                    >
                      <Star
                        size={32}
                        color={rating <= placeRating ? "#FCD34D" : "#E5E7EB"}
                        fill={rating <= placeRating ? "#FCD34D" : "transparent"}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <Input
                label="Descripción *"
                placeholder="Describe por qué este lugar es pet-friendly..."
                value={placeDescription}
                onChangeText={setPlaceDescription}
                multiline
                numberOfLines={4}
              />

              <Input
                label="Coordenadas GPS (opcional)"
                placeholder="Ej: -34.6037, -58.3816"
                value={placeCoordinates}
                onChangeText={setPlaceCoordinates}
                leftIcon={<Navigation size={20} color="#6B7280" />}
              />

              <View style={styles.imageSection}>
                <Text style={styles.imageLabel}>Foto del lugar</Text>
                
                {placeImage ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: placeImage }} style={styles.selectedImage} />
                    <TouchableOpacity 
                      style={styles.changeImageButton}
                      onPress={() => setPlaceImage(null)}
                    >
                      <Text style={styles.changeImageText}>Cambiar imagen</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.imageActions}>
                    <TouchableOpacity style={styles.imageActionButton} onPress={handleTakePhoto}>
                      <Camera size={24} color="#6B7280" />
                      <Text style={styles.imageActionText}>Tomar foto</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.imageActionButton} onPress={handleSelectImage}>
                      <Text style={styles.imageActionText}>📷 Galería</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.amenitiesSection}>
                <Text style={styles.amenitiesLabel}>Servicios para mascotas</Text>
                <Text style={styles.amenitiesDescription}>
                  Selecciona los servicios disponibles para mascotas
                </Text>
                <View style={styles.amenitiesGrid}>
                  {PET_AMENITIES.map((amenity) => (
                    <TouchableOpacity
                      key={amenity}
                      style={[
                        styles.amenityOption,
                        selectedAmenities.includes(amenity) && styles.selectedAmenityOption
                      ]}
                      onPress={() => toggleAmenity(amenity)}
                    >
                      <Text style={[
                        styles.amenityOptionText,
                        selectedAmenities.includes(amenity) && styles.selectedAmenityOptionText
                      ]}>
                        {amenity}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.modalActions}>
                <View style={styles.modalButtonsContainer}>
                  <TouchableOpacity 
                    style={styles.cancelModalButton}
                    onPress={() => {
                      setShowAddModal(false);
                      // Reset form
                      setPlaceName('');
                      setPlaceCategory('park');
                      setPlaceAddress('');
                      setPlacePhone('');
                      setPlaceRating(5);
                      setPlaceDescription('');
                      setPlaceImage(null);
                      setPlaceCoordinates('');
                      setSelectedAmenities([]);
                    }}
                  >
                    <Text style={styles.cancelModalButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.createModalButton, loading && styles.disabledButton]}
                    onPress={handleCreatePlace}
                    disabled={loading}
                  >
                    <Text style={styles.createModalButtonText}>
                      {loading ? 'Agregando...' : 'Agregar Lugar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
  addButton: {
    backgroundColor: '#DC2626',
    padding: 8,
    borderRadius: 20,
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
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedCategoryChip: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  categoryChipText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedCategoryChipText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  statsCard: {
    margin: 16,
    marginBottom: 8,
  },
  statsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#DC2626',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  placeCard: {
    marginHorizontal: 16,
    marginBottom: 12,
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
  placeName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  placeCategory: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  placeStatus: {
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
  placeImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
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
  placeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  placeDetailText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
  amenitiesSection: {
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
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  amenityText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
  },
  placeActions: {
    alignItems: 'flex-end',
  },
  emptyCard: {
    marginHorizontal: 16,
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  categoryOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryOption: {
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 80,
  },
  selectedCategoryOption: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  categoryOptionIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  categoryOptionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  selectedCategoryOptionText: {
    color: '#FFFFFF',
  },
  ratingSection: {
    marginBottom: 16,
  },
  ratingLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  ratingSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  imageSection: {
    marginBottom: 16,
  },
  imageLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  imagePreviewContainer: {
    marginBottom: 12,
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  changeImageButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'center',
  },
  changeImageText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  imageActionButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  imageActionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  amenitiesLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 4,
  },
  amenitiesDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 12,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityOption: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedAmenityOption: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  amenityOptionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedAmenityOptionText: {
    color: '#FFFFFF',
  },
  modalActions: {
    marginTop: 20,
  },
  modalButtonsContainer: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  cancelModalButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  cancelModalButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#DC2626',
  },
  createModalButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  createModalButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.6,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#EF4444',
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
});