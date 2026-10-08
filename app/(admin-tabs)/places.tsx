import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert, Image, RefreshControl } from 'react-native';
import { Plus, MapPin, Search, Star, Phone, Navigation, Camera, Image as ImageIcon, X } from 'lucide-react-native';
import { Badge, EmptyState, SkeletonList, toast } from '../../components/ui';
import { BusinessTypeIcon } from '../../components/admin/BusinessTypeIcon';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage as uploadImageUtil } from '../../utils/imageUpload';
import { colors, radius, spacing, typography } from '../../constants/theme';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
};

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
  images?: string[];
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [placeName, setPlaceName] = useState('');
  const [placeCategory, setPlaceCategory] = useState('park');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placePhone, setPlacePhone] = useState('');
  const [placeRating, setPlaceRating] = useState(5);
  const [placeDescription, setPlaceDescription] = useState('');
  const [placeImages, setPlaceImages] = useState<string[]>([]);
  const [placeCoordinates, setPlaceCoordinates] = useState('');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [customAmenity, setCustomAmenity] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    const isAdmin = currentUser?.isAdmin === true;
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
        images: item.images || (item.image_url ? [item.image_url] : []),
        coordinates: item.coordinates,
        isActive: item.is_active,
        createdBy: item.created_by,
        createdAt: new Date(item.created_at),
      })) || [];

      setPlaces(placesData);
    } catch (error) {
      console.error('Error fetching places:', error);
    } finally {
      setInitialLoading(false);
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
      setPlaceImages(prev => [...prev, result.assets[0].uri]);
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
      setPlaceImages(prev => [...prev, result.assets[0].uri]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setPlaceImages(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImage = async (imageUri: string): Promise<string> => {
    try {
      const filename = `places/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const publicUrl = await uploadImageUtil(imageUri, filename);
      return publicUrl;
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      throw error;
    }
  };

  const handleCreatePlace = async () => {
    if (!placeName || !placeAddress || !placeDescription) {
      Alert.alert('Error', 'Completá todos los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      // Subir todas las imágenes
      let imageUrls: string[] = [];
      if (placeImages.length > 0) {
        const uploadPromises = placeImages.map(imageUri => uploadImage(imageUri));
        imageUrls = await Promise.all(uploadPromises);
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
        image_url: imageUrls.length > 0 ? imageUrls[0] : null, // Primera imagen como principal
        images: imageUrls, // Array con todas las imágenes
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
      setPlaceImages([]);
      setPlaceCoordinates('');
      setSelectedAmenities([]);
      setCustomAmenity('');
      setShowAddModal(false);

      toast.success('Lugar agregado correctamente');
      fetchPlaces();
    } catch (error) {
      Alert.alert('Error', `No se pudo agregar el lugar: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPlaces();
    } finally {
      setRefreshing(false);
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

  const handleAddCustomAmenity = () => {
    if (customAmenity.trim() && !selectedAmenities.includes(customAmenity.trim())) {
      setSelectedAmenities(prev => [...prev, customAmenity.trim()]);
      setCustomAmenity('');
    }
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
        color={i < rating ? colors.accent : colors.border}
        fill={i < rating ? colors.accent : "transparent"}
      />
    ));
  };

  if (!currentUser?.isAdmin) {
    return (
      <View style={styles.accessDenied}>
        <Text style={styles.accessDeniedTitle}>Acceso denegado</Text>
        <Text style={styles.accessDeniedText}>
          Solo los administradores pueden gestionar lugares
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">Gestión de lugares</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Agregar lugar"
        >
          <Plus size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchSection}>
        <Input
          placeholder="Buscar lugares..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Search size={20} color={colors.textTertiary} />}
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
            accessibilityRole="button"
            accessibilityState={{ selected: selectedCategory === 'all' }}
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
              accessibilityRole="button"
              accessibilityState={{ selected: selectedCategory === category.value }}
            >
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

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>Estadísticas</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{places.length}</Text>
              <Text style={styles.statLabel}>Total{'\n'}lugares</Text>
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
              <Text style={styles.statLabel}>Puntaje{'\n'}promedio</Text>
            </View>
          </View>
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Lugares ({filteredPlaces.length})
          </Text>
          
          {initialLoading ? (
            <SkeletonList kind="cards" count={3} style={styles.skeleton} />
          ) : filteredPlaces.length === 0 ? (
            <EmptyState
              icon={<MapPin size={32} color={colors.primary} />}
              title={searchQuery || selectedCategory !== 'all' ? 'No se encontraron lugares' : 'No hay lugares'}
              description={searchQuery || selectedCategory !== 'all'
                ? 'Probá con otros términos de búsqueda u otra categoría'
                : 'Agregá el primer lugar pet-friendly'}
              actionLabel={searchQuery || selectedCategory !== 'all' ? 'Limpiar filtros' : 'Agregar lugar'}
              onAction={searchQuery || selectedCategory !== 'all'
                ? () => { setSearchQuery(''); setSelectedCategory('all'); }
                : () => setShowAddModal(true)}
            />
          ) : (
            filteredPlaces.map((place) => (
              <Card key={place.id} style={styles.placeCard}>
                <View style={styles.placeHeader}>
                  <View style={styles.placeInfo}>
                    <View style={styles.placeTitleRow}>
                      <View style={styles.placeIcon}>
                        <BusinessTypeIcon type="place" size={32} />
                      </View>
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
                    <Badge
                      tone={place.isActive ? 'success' : 'neutral'}
                      label={place.isActive ? 'Activo' : 'Inactivo'}
                    />
                  </View>
                </View>

                {place.imageUrl && (
                  <Image source={{ uri: place.imageUrl }} style={styles.placeImage} />
                )}

                <Text style={styles.placeDescription}>{place.description}</Text>

                <View style={styles.placeDetails}>
                  <View style={styles.placeDetail}>
                    <MapPin size={16} color={colors.textTertiary} />
                    <Text style={styles.placeDetailText}>{place.address}</Text>
                  </View>
                  {place.phone && (
                    <View style={styles.placeDetail}>
                      <Phone size={16} color={colors.textTertiary} />
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
                    accessibilityLabel={`${place.isActive ? 'Desactivar' : 'Activar'} ${place.name}`}
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
              <Text style={styles.modalTitle} accessibilityRole="header">Agregar nuevo lugar</Text>
              
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
                        accessibilityRole="radio"
                        accessibilityState={{ selected: placeCategory === category.value }}
                      >
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
                leftIcon={<MapPin size={20} color={colors.textTertiary} />}
              />
              
              <Input
                label="Teléfono"
                placeholder="Ej: +1234567890"
                value={placePhone}
                onChangeText={setPlacePhone}
                leftIcon={<Phone size={20} color={colors.textTertiary} />}
              />

              <View style={styles.ratingSection}>
                <Text style={styles.ratingLabel}>Rating (qué tan pet-friendly es) *</Text>
                <View style={styles.ratingSelector}>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <TouchableOpacity
                      key={rating}
                      onPress={() => setPlaceRating(rating)}
                      accessibilityRole="button"
                      accessibilityLabel={`${rating} de 5 estrellas`}
                      accessibilityState={{ selected: rating === placeRating }}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    >
                      <Star
                        size={32}
                        color={rating <= placeRating ? colors.accent : colors.border}
                        fill={rating <= placeRating ? colors.accent : "transparent"}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <Input
                label="Descripción *"
                placeholder="Describí por qué este lugar es pet-friendly..."
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
                leftIcon={<Navigation size={20} color={colors.textTertiary} />}
              />

              <View style={styles.imageSection}>
                <Text style={styles.imageLabel}>Fotos del lugar ({placeImages.length})</Text>
                
                {placeImages.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesPreviewScroll}>
                    {placeImages.map((imageUri, index) => (
                      <View key={index} style={styles.imagePreviewContainer}>
                        <Image source={{ uri: imageUri }} style={styles.selectedImage} />
                        <TouchableOpacity 
                          style={styles.removeImageButton}
                          onPress={() => handleRemoveImage(index)}
                          accessibilityRole="button"
                          accessibilityLabel={`Quitar foto ${index + 1}`}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <X size={14} color={colors.white} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}
                
                <View style={styles.imageActions}>
                  <TouchableOpacity style={styles.imageActionButton} onPress={handleTakePhoto}>
                    <Camera size={24} color={colors.textTertiary} />
                    <Text style={styles.imageActionText}>Tomar foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.imageActionButton} onPress={handleSelectImage}>
                    <ImageIcon size={24} color={colors.textTertiary} />
                    <Text style={styles.imageActionText}>Galería</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.amenitiesSection}>
                <Text style={styles.amenitiesLabel}>Servicios para mascotas</Text>
                <Text style={styles.amenitiesDescription}>
                  Seleccioná los servicios disponibles para mascotas
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
                
                {/* Campo para agregar servicio personalizado */}
                <View style={styles.customAmenityContainer}>
                  <Input
                    label="¿No encontrás el servicio? Agregalo acá"
                    placeholder="Ej: Peluquería canina"
                    value={customAmenity}
                    onChangeText={setCustomAmenity}
                  />
                  <TouchableOpacity 
                    style={styles.addAmenityButton}
                    onPress={handleAddCustomAmenity}
                  >
                    <Text style={styles.addAmenityButtonText}>Agregar</Text>
                  </TouchableOpacity>
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
                      setPlaceImages([]);
                      setPlaceCoordinates('');
                      setSelectedAmenities([]);
                      setCustomAmenity('');
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
                      {loading ? 'Agregando...' : 'Agregar lugar'}
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
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 50,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 27,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.primary,
    padding: spacing.sm,
    borderRadius: radius.pill,
  },
  searchSection: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoriesScroll: {
    marginTop: spacing.md,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedCategoryChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryIcon: {
    ...typography.body,
    marginRight: spacing.xs,
  },
  categoryChipText: {
    ...typography.label,
    color: colors.textTertiary,
  },
  selectedCategoryChipText: {
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  statsCard: {
    margin: spacing.lg,
    marginBottom: spacing.sm,
  },
  statsTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 27,
    color: colors.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  placeCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  placeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  placeInfo: {
    flex: 1,
  },
  placeIcon: {
    marginRight: spacing.xs,
  },
  skeleton: {
    paddingTop: 0,
  },
  placeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  placeName: {
    ...typography.bodyStrong,
    color: colors.text,
    marginLeft: spacing.sm,
    flex: 1,
  },
  placeCategory: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: spacing.sm,
  },
  ratingText: {
    ...typography.label,
    color: colors.textTertiary,
  },
  placeStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  statusText: {
    ...typography.caption,
  },
  placeImage: {
    width: '100%',
    height: 120,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    resizeMode: 'cover',
  },
  placeDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  placeDetails: {
    marginBottom: spacing.md,
  },
  placeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  placeDetailText: {
    ...typography.bodySmall,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textTertiary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  amenitiesSection: {
    marginBottom: spacing.md,
  },
  amenitiesTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  amenitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  amenityTag: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  amenityText: {
    ...typography.caption,
    color: colors.primaryStrong,
  },
  placeActions: {
    alignItems: 'flex-end',
  },
  emptyCard: {
    marginHorizontal: spacing.lg,
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: 40,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  modalTitle: {
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  categorySection: {
    marginBottom: spacing.lg,
  },
  categoryLabel: {
    ...typography.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  categoryOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  categoryOption: {
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 80,
  },
  selectedCategoryOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryOptionIcon: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 27,
    marginBottom: spacing.xs,
  },
  categoryOptionText: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  selectedCategoryOptionText: {
    color: colors.white,
  },
  ratingSection: {
    marginBottom: spacing.lg,
  },
  ratingLabel: {
    ...typography.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  ratingSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  imageSection: {
    marginBottom: spacing.lg,
  },
  imageLabel: {
    ...typography.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  imagesPreviewScroll: {
    marginBottom: spacing.md,
  },
  imagePreviewContainer: {
    marginRight: spacing.md,
    position: 'relative',
  },
  selectedImage: {
    width: 150,
    height: 150,
    borderRadius: radius.sm,
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    ...typography.bodyStrong,
    color: colors.white,
  },
  changeImageButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    alignSelf: 'center',
  },
  changeImageText: {
    ...typography.label,
    color: colors.white,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  imageActionButton: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  imageActionText: {
    ...typography.label,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  amenitiesLabel: {
    ...typography.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  amenitiesDescription: {
    ...typography.bodySmall,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  amenityOption: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedAmenityOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  amenityOptionText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  selectedAmenityOptionText: {
    color: colors.white,
  },
  customAmenityContainer: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  addAmenityButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  addAmenityButtonText: {
    ...typography.label,
    color: colors.white,
  },
  modalActions: {
    marginTop: spacing.xl,
  },
  modalButtonsContainer: {
    flexDirection: 'column',
    gap: spacing.md,
    width: '100%',
  },
  cancelModalButton: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    width: '100%',
  },
  cancelModalButtonText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  createModalButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    width: '100%',
  },
  createModalButtonText: {
    ...typography.body,
    color: colors.white,
  },
  disabledButton: {
    opacity: 0.6,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  accessDeniedTitle: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 32,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  accessDeniedText: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
