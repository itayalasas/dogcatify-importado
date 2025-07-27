import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert, Image } from 'react-native';
import { Plus, MapPin, Search, Star, Phone, Calendar, Eye, CreditCard as Edit, Trash2 } from 'lucide-react-native';
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
  coordinates: {
    latitude: number;
    longitude: number;
  };
  isActive: boolean;
  createdAt: Date;
}

const CATEGORIES = [
  { id: 'parques', name: 'Parques', icon: '🌳' },
  { id: 'restaurantes', name: 'Restaurantes', icon: '🍽️' },
  { id: 'hoteles', name: 'Hoteles', icon: '🏨' },
  { id: 'tiendas', name: 'Tiendas', icon: '🏪' },
  { id: 'playas', name: 'Playas', icon: '🏖️' },
  { id: 'cafeterias', name: 'Cafeterías', icon: '☕' },
  { id: 'veterinarias', name: 'Veterinarias', icon: '🏥' },
];

const DEFAULT_AMENITIES = [
  'Área para perros',
  'Agua para mascotas',
  'Correas disponibles',
  'Menú pet-friendly',
  'Camas para mascotas',
  'Juguetes disponibles',
  'Servicio de baño',
  'Área de juegos',
  'Veterinario en sitio',
  'Guardería de mascotas',
];

export default function AdminPlaces() {
  const { currentUser } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlaceModal, setShowPlaceModal] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [placeName, setPlaceName] = useState('');
  const [placeCategory, setPlaceCategory] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placePhone, setPlacePhone] = useState('');
  const [placeRating, setPlaceRating] = useState(5);
  const [placeDescription, setPlaceDescription] = useState('');
  const [placeImage, setPlaceImage] = useState<string | null>(null);
  const [placeAmenities, setPlaceAmenities] = useState<string[]>([]);
  const [placeLatitude, setPlaceLatitude] = useState('');
  const [placeLongitude, setPlaceLongitude] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const isAdmin = currentUser.email?.toLowerCase() === 'admin@dogcatify.com';
    if (!isAdmin) return;
    fetchPlaces();
  }, [currentUser]);

  useEffect(() => {
    filterPlaces();
  }, [places, searchQuery]);

  const fetchPlaces = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from('places')
        .select('*')
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
      setFilteredPlaces(placesData);
    } catch (error) {
      console.error('Error fetching places:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPlaces = () => {
    if (!searchQuery.trim()) {
      setFilteredPlaces(places);
      return;
    }

    const filtered = places.filter(place =>
      place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      place.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      place.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredPlaces(filtered);
  };

  const resetForm = () => {
    setPlaceName('');
    setPlaceCategory('');
    setPlaceAddress('');
    setPlacePhone('');
    setPlaceRating(5);
    setPlaceDescription('');
    setPlaceImage(null);
    setPlaceAmenities([]);
    setPlaceLatitude('');
    setPlaceLongitude('');
    setEditingPlace(null);
  };

  const openEditModal = (place: Place) => {
    setEditingPlace(place);
    setPlaceName(place.name);
    setPlaceCategory(place.category);
    setPlaceAddress(place.address);
    setPlacePhone(place.phone || '');
    setPlaceRating(place.rating);
    setPlaceDescription(place.description);
    setPlaceImage(place.imageUrl || null);
    setPlaceAmenities(place.petAmenities);
    setPlaceLatitude(place.coordinates.latitude.toString());
    setPlaceLongitude(place.coordinates.longitude.toString());
    setShowPlaceModal(true);
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

  const handleSubmitPlace = async () => {
    if (!placeName || !placeCategory || !placeAddress || !placeDescription) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl = placeImage;
      if (placeImage && placeImage.startsWith('file://')) {
        imageUrl = await uploadImage(placeImage);
      }

      const placeData = {
        name: placeName.trim(),
        category: placeCategory,
        address: placeAddress.trim(),
        phone: placePhone.trim() || null,
        rating: placeRating,
        description: placeDescription.trim(),
        pet_amenities: placeAmenities,
        image_url: imageUrl,
        coordinates: {
          latitude: parseFloat(placeLatitude) || 0,
          longitude: parseFloat(placeLongitude) || 0,
        },
        is_active: true,
        created_by: currentUser?.id,
      };

      if (editingPlace) {
        const { error } = await supabaseClient
          .from('places')
          .update(placeData)
          .eq('id', editingPlace.id);
        
        if (error) throw error;
        Alert.alert('Éxito', 'Lugar actualizado correctamente');
      } else {
        const { error } = await supabaseClient
          .from('places')
          .insert([placeData]);
        
        if (error) throw error;
        Alert.alert('Éxito', 'Lugar creado correctamente');
      }

      resetForm();
      setShowPlaceModal(false);
      fetchPlaces();
    } catch (error) {
      console.error('Error saving place:', error);
      Alert.alert('Error', 'No se pudo guardar el lugar');
    } finally {
      setSubmitting(false);
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
      console.error('Error toggling place:', error);
      Alert.alert('Error', 'No se pudo actualizar el lugar');
    }
  };

  const handleDeletePlace = async (placeId: string) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que quieres eliminar este lugar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabaseClient
                .from('places')
                .delete()
                .eq('id', placeId);
              
              if (error) throw error;
              fetchPlaces();
              Alert.alert('Éxito', 'Lugar eliminado correctamente');
            } catch (error) {
              console.error('Error deleting place:', error);
              Alert.alert('Error', 'No se pudo eliminar el lugar');
            }
          },
        },
      ]
    );
  };

  const toggleAmenity = (amenity: string) => {
    setPlaceAmenities(prev =>
      prev.includes(amenity)
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    );
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find(c => c.id === category);
    return cat?.icon || '📍';
  };

  const getCategoryName = (category: string) => {
    const cat = CATEGORIES.find(c => c.id === category);
    return cat?.name || category;
  };

  if (!currentUser || currentUser.email?.toLowerCase() !== 'admin@dogcatify.com') {
    return (
      <SafeAreaView style={styles.accessDenied}>
        <Text style={styles.accessDeniedTitle}>Acceso Denegado</Text>
        <Text style={styles.accessDeniedText}>
          Solo los administradores pueden acceder a esta sección
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestión de Lugares</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats Card */}
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
                {new Set(places.map(p => p.category)).size}
              </Text>
              <Text style={styles.statLabel}>Categorías</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {places.length > 0 ? (places.reduce((sum, p) => sum + p.rating, 0) / places.length).toFixed(1) : '0'}
              </Text>
              <Text style={styles.statLabel}>Rating{'\n'}Promedio</Text>
            </View>
          </View>
        </Card>

        {/* Search and Add Button */}
        <View style={styles.searchSection}>
          <Input
            placeholder="Buscar por nombre, categoría o dirección..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Search size={20} color="#9CA3AF" />}
          />
          
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => {
              resetForm();
              setShowPlaceModal(true);
            }}
          >
            <Plus size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Agregar Lugar</Text>
          </TouchableOpacity>
        </View>

        {/* Places List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lugares Pet-Friendly</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Cargando lugares...</Text>
            </View>
          ) : filteredPlaces.length === 0 ? (
            <View style={styles.emptyCard}>
              <MapPin size={32} color="#DC2626" />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No se encontraron lugares' : 'No hay lugares registrados'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Intenta con otros términos de búsqueda' : 'Agrega el primer lugar pet-friendly'}
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
                      {getCategoryName(place.category)}
                    </Text>
                    <Text style={styles.placeAddress}>{place.address}</Text>
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
                  <View style={styles.ratingContainer}>
                    <Star size={16} color="#FCD34D" fill="#FCD34D" />
                    <Text style={styles.ratingText}>{place.rating}</Text>
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
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => openEditModal(place)}
                  >
                    <Edit size={16} color="#3B82F6" />
                    <Text style={styles.actionButtonText}>Editar</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleTogglePlace(place.id, place.isActive)}
                  >
                    <Eye size={16} color={place.isActive ? "#EF4444" : "#22C55E"} />
                    <Text style={[styles.actionButtonText, { 
                      color: place.isActive ? "#EF4444" : "#22C55E" 
                    }]}>
                      {place.isActive ? 'Desactivar' : 'Activar'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeletePlace(place.id)}
                  >
                    <Trash2 size={16} color="#EF4444" />
                    <Text style={[styles.actionButtonText, { color: "#EF4444" }]}>
                      Eliminar
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* Place Modal */}
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
                placeholder="Ej: Parque Central para Mascotas"
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
                        placeCategory === category.id && styles.selectedCategory
                      ]}
                      onPress={() => setPlaceCategory(category.id)}
                    >
                      <Text style={styles.categoryOptionIcon}>{category.icon}</Text>
                      <Text style={[
                        styles.categoryOptionText,
                        placeCategory === category.id && styles.selectedCategoryText
                      ]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <Input
                label="Dirección *"
                placeholder="Ej: Calle 123 #45-67, Bogotá"
                value={placeAddress}
                onChangeText={setPlaceAddress}
              />
              
              <Input
                label="Teléfono"
                placeholder="Ej: +57 300 123 4567"
                value={placePhone}
                onChangeText={setPlacePhone}
              />

              <View style={styles.coordinatesSection}>
                <Text style={styles.coordinatesLabel}>Coordenadas GPS</Text>
                <View style={styles.coordinatesRow}>
                  <Input
                    label="Latitud"
                    placeholder="4.6097"
                    value={placeLatitude}
                    onChangeText={setPlaceLatitude}
                    keyboardType="numeric"
                    style={styles.coordinateInput}
                  />
                  <Input
                    label="Longitud"
                    placeholder="-74.0817"
                    value={placeLongitude}
                    onChangeText={setPlaceLongitude}
                    keyboardType="numeric"
                    style={styles.coordinateInput}
                  />
                </View>
              </View>

              <View style={styles.ratingSection}>
                <Text style={styles.ratingLabel}>Calificación</Text>
                <View style={styles.ratingStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setPlaceRating(star)}
                    >
                      <Star
                        size={32}
                        color={star <= placeRating ? "#FCD34D" : "#E5E7EB"}
                        fill={star <= placeRating ? "#FCD34D" : "transparent"}
                      />
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
                numberOfLines={4}
              />

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
                  <TouchableOpacity style={styles.imageActionButton} onPress={handleSelectImage}>
                    <Text style={styles.imageActionText}>📷 Seleccionar imagen</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.amenitiesSection}>
                <Text style={styles.amenitiesLabel}>Servicios para mascotas</Text>
                <Text style={styles.amenitiesDescription}>
                  Selecciona los servicios disponibles para mascotas
                </Text>
                <View style={styles.amenitiesGrid}>
                  {DEFAULT_AMENITIES.map((amenity) => (
                    <TouchableOpacity
                      key={amenity}
                      style={[
                        styles.amenityOption,
                        placeAmenities.includes(amenity) && styles.selectedAmenity
                      ]}
                      onPress={() => toggleAmenity(amenity)}
                    >
                      <Text style={[
                        styles.amenityOptionText,
                        placeAmenities.includes(amenity) && styles.selectedAmenityText
                      ]}>
                        {amenity}
                      </Text>
                    </TouchableOpacity>
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
                  style={[styles.saveModalButton, submitting && styles.disabledButton]}
                  onPress={handleSubmitPlace}
                  disabled={submitting}
                >
                  <Text style={styles.saveModalButtonText}>
                    {submitting ? 'Guardando...' : editingPlace ? 'Actualizar' : 'Crear Lugar'}
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
    textAlign: 'center',
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
  searchSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D6A6F',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginLeft: 8,
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
  },
  placeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryIcon: {
    fontSize: 18,
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
    marginBottom: 2,
  },
  placeAddress: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginLeft: 4,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
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
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    fontSize: 14,
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
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    minWidth: 80,
  },
  selectedCategory: {
    backgroundColor: '#2D6A6F',
    borderColor: '#2D6A6F',
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
  selectedCategoryText: {
    color: '#FFFFFF',
  },
  coordinatesSection: {
    marginBottom: 16,
  },
  coordinatesLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  coordinatesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  coordinateInput: {
    flex: 1,
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
  ratingStars: {
    flexDirection: 'row',
    gap: 4,
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
  imageActionButton: {
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
  },
  amenitiesSection: {
    marginBottom: 20,
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
  selectedAmenity: {
    backgroundColor: '#2D6A6F',
    borderColor: '#2D6A6F',
  },
  amenityOptionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedAmenityText: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelModalButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelModalButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  saveModalButton: {
    flex: 1,
    backgroundColor: '#2D6A6F',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveModalButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
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