import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Linking, Modal, Dimensions, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { MapPin, Phone, Navigation, X, Plus, AlertCircle } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SkeletonCard, EmptyState, Badge, IconButton } from '../../components/ui';
import { CategoryChips } from '../../components/services/CategoryChips';
import { RatingStars } from '../../components/services/RatingStars';
import { getPlaceCategoryLabel } from '../../components/services/labels';
import { colors, spacing, typography, hitSlop } from '../../constants/theme';
import { Input } from '../../components/ui/Input';
import { OneTimeTooltip } from '../../components/ui/OneTimeTooltip';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** Ancho de la foto dentro de la tarjeta (pantalla menos el margen de 16 a cada lado). */
const IMAGE_WIDTH = SCREEN_WIDTH - spacing.lg * 2;

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

/** Lugares pet-friendly. Con `embedded` se muestra dentro de la pestaña Explorar, que pone su propio título y el botón de agregar. */
export default function PlacesExplorer({ embedded = false }: { embedded?: boolean }) {
  const { currentUser } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Estados para funcionalidades nuevas
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [currentImageIndex, setCurrentImageIndex] = useState<{ [placeId: string]: number }>({});

  useEffect(() => {
    fetchPlaces();
  }, []);

  useEffect(() => {
    filterPlaces();
  }, [places, searchQuery, selectedCategory]);

  const fetchPlaces = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
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
        images: item.images || (item.image_url ? [item.image_url] : []),
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPlaces(true);
    setRefreshing(false);
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

  const getCategoryName = (categoryId: string) => {
    return getPlaceCategoryLabel(categoryId);
  };

  const toggleDescription = (placeId: string) => {
    setExpandedDescriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(placeId)) {
        newSet.delete(placeId);
      } else {
        newSet.add(placeId);
      }
      return newSet;
    });
  };

  const isDescriptionExpanded = (placeId: string) => {
    return expandedDescriptions.has(placeId);
  };

  const shouldTruncateDescription = (description: string) => {
    return description.length > 100;
  };

  return (
    <SafeAreaView style={[styles.container, embedded && styles.embeddedContainer]}>
      {!embedded && (
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">Lugares pet-friendly</Text>
          <OneTimeTooltip
            hintKey="places_register_button"
            userId={currentUser?.id}
            text="Tip: ¿conocés un lugar pet-friendly? Registralo acá y ayudá a la comunidad"
            placement="bottom"
          >
            <IconButton
              icon={<Plus size={22} color={colors.onPrimary} />}
              variant="filled"
              onPress={() => router.push('/places/register')}
              accessibilityLabel="Registrar un lugar"
            />
          </OneTimeTooltip>
        </View>
      )}

      <View style={styles.searchSection}>
        <Input
          placeholder="Buscar lugares..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          accessibilityLabel="Buscar lugares"
        />
      </View>

      <CategoryChips
        options={CATEGORIES.map((category) => ({ id: category.id, label: category.name }))}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
        style={styles.categoriesScroll}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {loading ? (
          <View accessibilityLabel="Cargando lugares">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} imageHeight={200} style={styles.skeletonCard} />
            ))}
          </View>
        ) : error ? (
          <EmptyState
            icon={<AlertCircle size={32} color={colors.primary} />}
            title="No pudimos cargar los lugares"
            description={error}
            actionLabel="Reintentar"
            onAction={() => fetchPlaces()}
          />
        ) : filteredPlaces.length === 0 ? (
          <EmptyState
            icon={<MapPin size={32} color={colors.primary} />}
            title={
              searchQuery || selectedCategory !== 'all'
                ? 'No encontramos lugares'
                : 'Todavía no hay lugares'
            }
            description={
              searchQuery || selectedCategory !== 'all'
                ? 'Probá con otra búsqueda o categoría.'
                : 'Los lugares pet-friendly van a aparecer acá.'
            }
            actionLabel={searchQuery || selectedCategory !== 'all' ? 'Limpiar filtros' : 'Registrar un lugar'}
            onAction={
              searchQuery || selectedCategory !== 'all'
                ? () => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }
                : () => router.push('/places/register')
            }
          />
        ) : (
          filteredPlaces.map((place) => (
            <Card key={place.id} style={styles.placeCard} padding={false}>
              {place.images && place.images.length > 0 && (
                <View style={styles.carouselContainer}>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={(event) => {
                      const offsetX = event.nativeEvent.contentOffset.x;
                      const index = Math.round(offsetX / IMAGE_WIDTH);
                      setCurrentImageIndex(prev => ({ ...prev, [place.id]: index }));
                    }}
                    scrollEventThrottle={16}
                  >
                    {place.images.map((imageUrl, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => setSelectedImage(imageUrl)}
                        activeOpacity={0.9}
                        accessibilityRole="imagebutton"
                        accessibilityLabel={`Ampliar foto ${index + 1} de ${place.name}`}
                      >
                        <Image source={{ uri: imageUrl }} style={styles.placeImage} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Badge
                    label={getCategoryName(place.category)}
                    tone="neutral"
                    style={styles.imageCategoryBadge}
                  />

                  {place.images.length > 1 && (
                    <View style={styles.carouselIndicators}>
                      {place.images.map((_, index) => (
                        <View
                          key={index}
                          style={[
                            styles.indicator,
                            (currentImageIndex[place.id] || 0) === index && styles.activeIndicator
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )}

              <View style={styles.placeContent}>
                <View style={styles.placeHeader}>
                  <Text style={styles.placeName} numberOfLines={2}>{place.name}</Text>
                </View>

                {!(place.images && place.images.length > 0) && (
                  <Badge label={getCategoryName(place.category)} tone="primary" size="small" style={styles.inlineCategoryBadge} />
                )}

                <View style={styles.starsRow}>
                  <RatingStars rating={place.rating} size={14} />
                </View>

                {!!place.description && (
                  <View>
                    <Text style={styles.placeDescription} numberOfLines={isDescriptionExpanded(place.id) ? undefined : 2}>
                      {place.description}
                    </Text>
                    {shouldTruncateDescription(place.description) && (
                      <TouchableOpacity
                        onPress={() => toggleDescription(place.id)}
                        hitSlop={hitSlop}
                        accessibilityRole="button"
                        style={styles.seeMoreButton}
                      >
                        <Text style={styles.seeMoreText}>
                          {isDescriptionExpanded(place.id) ? 'Ver menos' : 'Ver más'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <View style={styles.placeDetails}>
                  <View style={styles.placeDetail}>
                    <MapPin size={16} color={colors.textTertiary} />
                    <Text style={styles.placeDetailText} numberOfLines={1}>
                      {place.address}
                    </Text>
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
                    <Text style={styles.amenitiesTitle}>Para mascotas</Text>
                    <View style={styles.amenitiesList}>
                      {place.petAmenities.slice(0, 3).map((amenity, index) => (
                        <Badge key={index} label={amenity} tone="primary" size="small" />
                      ))}
                      {place.petAmenities.length > 3 && (
                        <Badge label={`+${place.petAmenities.length - 3} más`} tone="neutral" size="small" />
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.actionButtons}>
                  {place.phone && (
                    <Button
                      title="Contactar"
                      variant="primary"
                      fullWidth={false}
                      style={styles.actionButton}
                      icon={<Phone size={16} color={colors.onPrimary} />}
                      onPress={() => handleContact(place.phone!)}
                      accessibilityLabel={`Llamar a ${place.name}`}
                    />
                  )}

                  <Button
                    title="Ver ubicación"
                    variant={place.phone ? 'outline' : 'primary'}
                    fullWidth={false}
                    style={styles.actionButton}
                    icon={<Navigation size={16} color={place.phone ? colors.primary : colors.onPrimary} />}
                    onPress={() => handleViewLocation(place)}
                    accessibilityLabel={`Ver ubicación de ${place.name} en el mapa`}
                  />
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Modal para zoom de imagen */}
      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalCloseArea}
            activeOpacity={1}
            onPress={() => setSelectedImage(null)}
            accessibilityLabel="Cerrar imagen"
          >
            <View style={styles.modalContent}>
              <IconButton
                icon={<X size={24} color={colors.white} />}
                onPress={() => setSelectedImage(null)}
                accessibilityLabel="Cerrar imagen"
                style={styles.closeButton}
              />

              {selectedImage && (
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.zoomedImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  embeddedContainer: {
    paddingTop: 0,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  searchSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  categoriesScroll: {
    flexGrow: 0,
    paddingBottom: spacing.md,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  skeletonCard: {
    marginBottom: spacing.lg,
  },
  placeCard: {
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  carouselContainer: {
    position: 'relative',
    backgroundColor: colors.surfaceAlt,
  },
  placeImage: {
    width: IMAGE_WIDTH,
    height: 200,
    resizeMode: 'cover',
  },
  imageCategoryBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.surface,
  },
  carouselIndicators: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  activeIndicator: {
    backgroundColor: colors.white,
    width: 24,
  },
  placeContent: {
    padding: spacing.lg,
  },
  placeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  placeName: {
    ...typography.heading,
    color: colors.text,
    flex: 1,
  },
  inlineCategoryBadge: {
    marginTop: spacing.sm,
  },
  starsRow: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  placeDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  seeMoreButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  seeMoreText: {
    ...typography.label,
    color: colors.primary,
  },
  placeDetails: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  placeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeDetailText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  amenitiesSection: {
    marginTop: spacing.md,
  },
  amenitiesTitle: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  amenitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: spacing.xl,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  zoomedImage: {
    width: SCREEN_WIDTH,
    height: '80%',
  },
});
