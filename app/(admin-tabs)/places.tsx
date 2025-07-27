import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert, Image } from 'react-native';
import { Plus, MapPin, Phone, Star, Search, CreditCard as Edit, Trash2, Eye } from 'lucide-react-native';
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
  phone: string;
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
  { id: 'parks', name: 'Parques', icon: '🌳' },
  { id: 'restaurants', name: 'Restaurantes', icon: '🍽️' },
  { id: 'hotels', name: 'Hoteles', icon: '🏨' },
  { id: 'stores', name: 'Tiendas', icon: '🏪' },
  { id: 'beaches', name: 'Playas', icon: '🏖️' },
  { id: 'cafes', name: 'Cafeterías', icon: '☕' },
  { id: 'veterinary', name: 'Veterinarias', icon: '🏥' },
];

export default function AdminPlaces() {
  const { currentUser } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPlaceModal, setShowPlaceModal] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [placeName, setPlaceName] = useState('');
  const [placeCategory, setPlaceCategory] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placePhone, setPlacePhone] = useState('');
  const [placeDescription, setPlaceDescription] = useState('');
  const [placeRating, setPlaceRating] = useState('4.0');
  const [placeLatitude, setPlaceLatitude] = useState('');
  const [placeLongitude, setPlaceLongitude] = useState('');
  const [placeImage, setPlaceImage] = useState<string | null>(null);
  const [petAmenities, setPetAmenities] = useState<string[]>([]);
  const [newAmenity, setNewAmenity] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    const isAdmin = currentUser.email?.toLowerCase() === 'admin@dogcatify.com';
    if (!isAdmin) return;
    fetchPlaces();
  }, [currentUser]);

  useEffect(() => {
    // Filter places based on search query
    if (searchQuery.trim()) {
      setFilteredPlaces(
        places.filter(place => 
          place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          place.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          place.address.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredPlaces(places);
    }
  }, [searchQuery, places]);

  const fetchPlaces = async () => {
    try {
      // For now, we'll use sample data since we don't have a places table yet
      // In a real implementation, you would fetch from Supabase
      const samplePlaces: Place[] = [
        {
          id: '1',
          name: 'Parque Central',
          category: 'parks',
          address: 'Av. Principal 123, Centro',
          phone: '+1234567890',
          rating: 4.5,
          description: 'Amplio parque con áreas especiales para mascotas',
          petAmenities: ['Área de juegos para perros', 'Bebederos', 'Bolsas para desechos'],
          coordinates: { latitude: -34.6037, longitude: -58.3816 },
          isActive: true,
          createdAt: new Date()
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
          coordinates: { latitude: -34.6118, longitude: -58.3960 },
          isActive: true,
          createdAt: new Date()
        }
      ];
      
      setPlaces(samplePlaces);
      setFilteredPlaces(samplePlaces);
    } catch (error) {
      console.error('Error fetching places:', error);
    }
  };

  const handleSelectImage = async () => {
    try {
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
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const uploadImage = async (imageUri: string): Promise<string> => {
    try {
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
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleAddAmenity = () => {
    if (newAmenity.trim() && !petAmenities.includes(newAmenity.trim())) {
      setPetAmenities([...petAmenities, newAmenity.trim()]);
      setNewAmenity('');
    }
  };

  const handleRemoveAmenity = (index: number) => {
    setPetAmenities(petAmenities.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setPlaceName('');
    setPlaceCategory('');
    setPlaceAddress('');
    setPlacePhone('');
    setPlaceDescription('');
    setPlaceRating('4.0');
    setPlaceLatitude('');
    setPlaceLongitude('');
    setPlaceImage(null);
    setPetAmenities([]);
    setNewAmenity('');
    setEditingPlace(null);
  };

  const handleCreatePlace = async () => {
    if (!placeName || !placeCategory || !placeAddress || !placeDescription) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      let imageUrl = null;
      if (placeImage) {
        imageUrl = await uploadImage(placeImage);
      }

      const placeData = {
        name: placeName.trim(),
        category: placeCategory,
        address: placeAddress.trim(),
        phone: placePhone.trim() || null,
        rating: parseFloat(placeRating),
        description: placeDescription.trim(),
        pet_amenities: petAmenities,
        image_url: imageUrl,
        coordinates: {
          latitude: placeLatitude ? parseFloat(placeLatitude) : null,
          longitude: placeLongitude ? parseFloat(placeLongitude) : null
        },
        is_active: true,
        created_at: new Date().toISOString(),
        created_by: currentUser?.id
      };

      // In a real implementation, you would save to Supabase
      // For now, we'll just add to local state
      const newPlace: Place = {
        id: Date.now().toString(),
        name: placeData.name,
        category: placeData.category,
        address: placeData.address,
        phone: placeData.phone || '',
        rating: placeData.rating,
        description: placeData.description,
        petAmenities: placeData.pet_amenities,
        imageUrl: placeData.image_url || undefined,
        coordinates: {
          latitude: placeData.coordinates.latitude || 0,
          longitude: placeData.coordinates.longitude || 0
        },
        isActive: true,
        createdAt: new Date()
      };

      setPlaces(prev => [newPlace, ...prev]);
      resetForm();
      setShowPlaceModal(false);
      Alert.alert('Éxito', 'Lugar agregado correctamente');
    } catch (error) {
      console.error('Error creating place:', error);
      Alert.alert('Error', 'No se pudo crear el lugar');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPlace = (place: Place) => {
    setEditingPlace(place);
    setPlaceName(place.name);
    setPlaceCategory(place.category);
    setPlaceAddress(place.address);
    setPlacePhone(place.phone);
    setPlaceDescription(place.description);
    setPlaceRating(place.rating.toString());
    setPlaceLatitude(place.coordinates.latitude.toString());
    setPlaceLongitude(place.coordinates.longitude.toString());
    setPetAmenities(place.petAmenities);
    setPlaceImage(place.imageUrl || null);
    setShowPlaceModal(true);
  };

  const handleTogglePlace = async (placeId: string, isActive: boolean) => {
    try {
      setPlaces(prev => prev.map(place => 
        place.id === placeId 
          ? { ...place, isActive: !isActive }
          : place
      ));
      // In real implementation, update in Supabase
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el lugar');
    }
  };

  const handleDeletePlace = (placeId: string) => {
    Alert.alert(
      'Eliminar Lugar',
      '¿Estás seguro de que quieres eliminar este lugar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setPlaces(prev => prev.filter(place => place.id !== placeId));
            Alert.alert('Éxito', 'Lugar eliminado correctamente');
          }
        }
      ]
    );
  };

  const getCategoryIcon = (category: string) => {
    const categoryData = CATEGORIES.find(cat => cat.id === category);
    return categoryData?.icon || '🏢';
  };

  const getCategoryName = (category: string) => {
    const categoryData = CATEGORIES.find(cat => cat.id === category);
    return categoryData?.name || category;
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Star 
          key={i} 
          size={14} 
          color={i < fullStars ? '#F59E0B' : '#E5E7EB'} 
          fill={i < fullStars ? '#F59E0B' : 'none'} 
        />
      );
    }
    
    return stars;
  };

  if (!currentUser || currentUser.email?.toLowerCase() !== 'admin@dogcatify.com') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedTitle}>Acceso Denegado</Text>
          <Text style={styles.accessDeniedText}>
            No tienes permisos para acceder a esta sección
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🗺️ Gestión de Lugares Pet-Friendly</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setShowPlaceModal(true);
          }}
        >
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Input
            placeholder="Buscar lugares por nombre, categoría o dirección..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Search size={20} color="#9CA3AF" />}
          />
        </View>

        {/* Stats Card */}
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>📊 Estadísticas de Lugares</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{places.length}</Text>
              <Text style={styles.statLabel}>Total Lugares</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {places.filter(p => p.isActive).length}
              </Text>
              <Text style={styles.statLabel}>Activos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {CATEGORIES.length}
              </Text>
              <Text style={styles.statLabel}>Categorías</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {(places.reduce((sum, p) => sum + p.rating, 0) / places.length || 0).toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>Rating Promedio</Text>
            </View>
          </View>
        </Card>

        {/* Places List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lugares Registrados ({filteredPlaces.length})</Text>
          
          {filteredPlaces.length === 0 ? (
            <Card style={styles.emptyCard}>
              <MapPin size={48} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No se encontraron lugares' : 'No hay lugares registrados'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery 
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Agrega el primer lugar pet-friendly'
                }
              </Text>
            </Card>
          ) : (
            filteredPlaces.map((place) => (
              <Card key={place.id} style={styles.placeCard}>
                <View style={styles.placeHeader}>
                  <View style={styles.placeInfo}>
                    <View style={styles.placeTitleRow}>
                      <Text style={styles.categoryEmoji}>{getCategoryIcon(place.category)}</Text>
                      <Text style={styles.placeName}>{place.name}</Text>
                    </View>
                    <Text style={styles.placeCategory}>{getCategoryName(place.category)}</Text>
                    <View style={styles.ratingContainer}>
                      <View style={styles.starsContainer}>
                        {renderStars(place.rating)}
                      </View>
                      <Text style={styles.ratingText}>{place.rating}</Text>
                    </View>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: place.isActive ? '#D1FAE5' : '#FEE2E2' }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: place.isActive ? '#065F46' : '#991B1B' }
                    ]}>
                      {place.isActive ? 'Activo' : 'Inactivo'}
                    </Text>
                  </View>
                </View>

                {place.imageUrl && (
                  <Image source={{ uri: place.imageUrl }} style={styles.placeImage} />
                )}

                <Text style={styles.placeDescription}>{place.description}</Text>

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

                <View style={styles.amenitiesContainer}>
                  <Text style={styles.amenitiesTitle}>Servicios para mascotas:</Text>
                  {place.petAmenities.map((amenity, index) => (
                    <Text key={index} style={styles.amenityItem}>• {amenity}</Text>
                  ))}
                </View>

                <View style={styles.placeActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEditPlace(place)}
                  >
                    <Edit size={16} color="#3B82F6" />
                    <Text style={styles.actionButtonText}>Editar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: place.isActive ? '#FEE2E2' : '#D1FAE5' }]}
                    onPress={() => handleTogglePlace(place.id, place.isActive)}
                  >
                    <Eye size={16} color={place.isActive ? '#991B1B' : '#065F46'} />
                    <Text style={[styles.actionButtonText, { color: place.isActive ? '#991B1B' : '#065F46' }]}>
                      {place.isActive ? 'Desactivar' : 'Activar'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#FEE2E2' }]}
                    onPress={() => handleDeletePlace(place.id)}
                  >
                    <Trash2 size={16} color="#991B1B" />
                    <Text style={[styles.actionButtonText, { color: '#991B1B' }]}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add/Edit Place Modal */}
      <Modal
        visible={showPlaceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPlaceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingPlace ? 'Editar Lugar' : 'Agregar Nuevo Lugar'}
              </Text>
              
              <Input
                label="Nombre del lugar *"
                placeholder="Ej: Parque Central, Café Pet Friendly..."
                value={placeName}
                onChangeText={setPlaceName}
              />

              <View style={styles.categorySection}>
                <Text style={styles.categoryLabel}>Categoría *</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryOption,
                        placeCategory === category.id && styles.selectedCategoryOption
                      ]}
                      onPress={() => setPlaceCategory(category.id)}
                    >
                      <Text style={styles.categoryOptionIcon}>{category.icon}</Text>
                      <Text style={[
                        styles.categoryOptionText,
                        placeCategory === category.id && styles.selectedCategoryOptionText
                      ]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <Input
                label="Descripción *"
                placeholder="Describe el lugar y por qué es pet-friendly..."
                value={placeDescription}
                onChangeText={setPlaceDescription}
                multiline
                numberOfLines={3}
              />

              <Input
                label="Dirección *"
                placeholder="Dirección completa del lugar"
                value={placeAddress}
                onChangeText={setPlaceAddress}
                leftIcon={<MapPin size={20} color="#6B7280" />}
              />

              <Input
                label="Teléfono"
                placeholder="Número de contacto"
                value={placePhone}
                onChangeText={setPlacePhone}
                keyboardType="phone-pad"
                leftIcon={<Phone size={20} color="#6B7280" />}
              />

              <Input
                label="Rating (1-5)"
                placeholder="4.5"
                value={placeRating}
                onChangeText={setPlaceRating}
                keyboardType="numeric"
                leftIcon={<Star size={20} color="#6B7280" />}
              />

              <View style={styles.coordinatesRow}>
                <View style={styles.coordinateInput}>
                  <Input
                    label="Latitud"
                    placeholder="-34.6037"
                    value={placeLatitude}
                    onChangeText={setPlaceLatitude}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.coordinateInput}>
                  <Input
                    label="Longitud"
                    placeholder="-58.3816"
                    value={placeLongitude}
                    onChangeText={setPlaceLongitude}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Image Section */}
              <View style={styles.imageSection}>
                <Text style={styles.imageLabel}>Imagen del lugar</Text>
                
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
                  <TouchableOpacity style={styles.imageSelector} onPress={handleSelectImage}>
                    <Text style={styles.imageSelectorText}>📷 Seleccionar imagen</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Pet Amenities Section */}
              <View style={styles.amenitiesSection}>
                <Text style={styles.amenitiesLabel}>Servicios para mascotas</Text>
                
                <View style={styles.addAmenityContainer}>
                  <Input
                    placeholder="Ej: Área de juegos, Bebederos, etc."
                    value={newAmenity}
                    onChangeText={setNewAmenity}
                    style={styles.amenityInput}
                  />
                  <TouchableOpacity 
                    style={styles.addAmenityButton}
                    onPress={handleAddAmenity}
                  >
                    <Plus size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <View style={styles.amenitiesList}>
                  {petAmenities.map((amenity, index) => (
                    <View key={index} style={styles.amenityTag}>
                      <Text style={styles.amenityTagText}>{amenity}</Text>
                      <TouchableOpacity 
                        style={styles.removeAmenityButton}
                        onPress={() => handleRemoveAmenity(index)}
                      >
                        <Text style={styles.removeAmenityText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.cancelModalButton}
                  onPress={() => {
                    setShowPlaceModal(false);
                    resetForm();
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
                    {loading ? 'Guardando...' : editingPlace ? 'Actualizar' : 'Crear Lugar'}
                  </Text>
                </TouchableOpacity>
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
    backgroundColor: '#2D6A6F',
    padding: 8,
    borderRadius: 20,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  statsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
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
    color: '#2D6A6F',
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
    marginRight: 12,
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
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
  },
  placeCategory: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginBottom: 4,
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
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
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
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginBottom: 12,
  },
  phoneText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 6,
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
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#EBF8FF',
  },
  actionButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginLeft: 4,
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
    maxWidth: 500,
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
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: '30%',
  },
  selectedCategoryOption: {
    backgroundColor: '#2D6A6F',
    borderColor: '#2D6A6F',
  },
  categoryOptionIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryOptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedCategoryOptionText: {
    color: '#FFFFFF',
  },
  coordinatesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  coordinateInput: {
    flex: 1,
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
    height: 150,
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
  imageSelector: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  imageSelectorText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  amenitiesSection: {
    marginBottom: 20,
  },
  amenitiesLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  addAmenityContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  amenityInput: {
    flex: 1,
  },
  addAmenityButton: {
    backgroundColor: '#2D6A6F',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amenitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  amenityTagText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginRight: 6,
  },
  removeAmenityButton: {
    marginLeft: 4,
  },
  removeAmenityText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelModalButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2D6A6F',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelModalButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#2D6A6F',
  },
  createModalButton: {
    flex: 1,
    backgroundColor: '#2D6A6F',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
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