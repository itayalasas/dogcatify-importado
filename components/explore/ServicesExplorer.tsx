import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, LogBox, TextInput, Image, RefreshControl } from 'react-native';
import { Search, MapPin, Star, Phone, Stethoscope, Scissors, Home, Dog, AlertCircle } from 'lucide-react-native';

import { SkeletonCard, EmptyState, Badge, toast } from '../../components/ui';
import { CategoryChips } from '../../components/services/CategoryChips';
import { RatingStars } from '../../components/services/RatingStars';
import { getBusinessTypeLabel } from '../../components/services/labels';
import { colors, spacing, radius, typography, shadows, hitSlop } from '../../constants/theme';
import { OneTimeTooltip } from '../../components/ui/OneTimeTooltip';
import { hasSeenHint } from '../../utils/oneTimeHints';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '@/lib/supabase';
import { router } from 'expo-router';
import { getActivePromotionsForItems, calculateDiscountedPrice, incrementPromotionClicks, type ActivePromotion } from '@/utils/promotions';

// Ignore specific Firebase warnings that appear on logout
LogBox.ignoreLogs([
  '[2025-07-11T02:50:13.958Z] @firebase/firestore:',
  'Warning: Text strings must be rendered within a <Text> component.',
  'Warning: Each child in a list should have a unique "key" prop.'
]);

const CAROUSEL_INTERVAL_MS = 3500;

const getServiceTypeLabel = (partnerType: string) => getBusinessTypeLabel(partnerType);

function ServiceImageCarousel({ images }: { images: string[] }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  React.useEffect(() => {
    if (images.length <= 1) {
      setCurrentImageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, CAROUSEL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [images]);

  const safeIndex = Math.min(currentImageIndex, Math.max(images.length - 1, 0));

  return (
    <View style={styles.carouselContainer}>
      <Image
        source={{ uri: images[safeIndex] }}
        style={styles.cardImage}
        resizeMode="cover"
      />

      {images.length > 1 && (
        <View style={styles.carouselDotsContainer}>
          {images.map((_, index) => (
            <View
              key={`${index}`}
              style={[
                styles.carouselDot,
                index === safeIndex && styles.carouselDotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** Lista de servicios. Con `embedded` se muestra dentro de la pestaña Explorar, sin su propio título. */
export default function ServicesExplorer({ embedded = false }: { embedded?: boolean }) {
  const [partners, setPartners] = useState<any[]>([]);
  const [displayedPartners, setDisplayedPartners] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreData, setHasMoreData] = useState(true);
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [canShowCategoryHint, setCanShowCategoryHint] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Configuración de paginación
  const ITEMS_PER_PAGE = 10;
  const INITIAL_LOAD = 10;
  React.useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      setDisplayedPartners([]);
      return;
    }
    
    fetchPartners();
    
  }, []);

  React.useEffect(() => {
    const checkSearchHint = async () => {
      const seen = await hasSeenHint('services_search', currentUser?.id);
      setCanShowCategoryHint(seen);
    };

    checkSearchHint();
  }, [currentUser?.id]);

  const fetchPartners = async (isRefresh = false) => {
    try {
      console.log('🔄 Fetching partners...');
      if (!isRefresh) setLoading(true);
      setError(null);

      // Optimized: Fetch partners and their first service in parallel
      const [partnersResult, servicesResult] = await Promise.all([
        supabaseClient
          .from('partners')
          .select('id, business_name, address, phone, logo, business_type, rating, reviews_count')
          .eq('is_verified', true)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabaseClient
          .from('partner_services')
          .select('id, partner_id, name, price, duration, images')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
      ]);

      const partnersData = partnersResult.data;
      const servicesData = servicesResult.data;

      if (partnersData && servicesData && !partnersResult.error && !servicesResult.error) {
        console.log(`📊 Found ${partnersData.length} verified partners and ${servicesData.length} services`);

        // Create a map of partner_id to first service for quick lookup
        const partnerServicesMap = new Map();
        servicesData.forEach(service => {
          if (!partnerServicesMap.has(service.partner_id)) {
            partnerServicesMap.set(service.partner_id, service);
          }
        });

        const allPartnersWithServices = [];

        for (const partner of partnersData) {
          if (partner.business_type === 'shelter') {
            // For shelters, fetch adoption pets (still need individual query)
            const { data: adoptionPets, error: adoptionError } = await supabaseClient
              .from('adoption_pets')
              .select('id, images')
              .eq('partner_id', partner.id)
              .eq('is_available', true)
              .limit(1);

            if (adoptionPets && adoptionPets.length > 0 && !adoptionError) {
              const pet = adoptionPets[0];
              allPartnersWithServices.push({
                id: `adoption-${pet.id}`,
                partnerId: partner.id,
                partnerName: partner.business_name,
                partnerAddress: partner.address,
                partnerPhone: partner.phone,
                partnerLogo: partner.logo,
                partnerType: partner.business_type,
                rating: partner.rating || 0,
                reviews: partner.reviews_count || 0,
                location: partner.address,
                name: `Adopciones disponibles`,
                price: 0,
                duration: 0,
                category: partner.business_type,
                serviceImages: pet.images || [],
                images: pet.images || [],
              });
            }
          } else {
            // Use the pre-fetched service from map
            const serviceData = partnerServicesMap.get(partner.id);

            if (serviceData) {
              allPartnersWithServices.push({
                id: serviceData.id,
                partnerId: partner.id,
                partnerName: partner.business_name,
                partnerAddress: partner.address,
                partnerPhone: partner.phone,
                partnerLogo: partner.logo,
                partnerType: partner.business_type,
                rating: partner.rating || 0,
                reviews: partner.reviews_count || 0,
                location: partner.address,
                name: serviceData.name,
                price: serviceData.price,
                duration: serviceData.duration,
                category: partner.business_type,
                serviceImages: serviceData.images || [],
                images: serviceData.images || [],
              });
            }
          }
        }

        console.log(`✅ Processed ${allPartnersWithServices.length} partners with services`);

        // Obtener IDs de servicios (excluir adopciones)
        const serviceIds = allPartnersWithServices
          .filter(s => !s.id.startsWith('adoption-'))
          .map(s => s.id);

        // Buscar promociones activas para estos servicios
        const promotionsMap = await getActivePromotionsForItems(serviceIds, 'service');

        // Aplicar promociones a los servicios
        const servicesWithPromotions = allPartnersWithServices.map(service => {
          if (service.id.startsWith('adoption-')) {
            return service; // Las adopciones no tienen promociones
          }

          const promotion = promotionsMap.get(service.id);
          const originalPrice = service.price;
          const discountedPrice = promotion
            ? calculateDiscountedPrice(originalPrice, promotion)
            : originalPrice;

          return {
            ...service,
            activePromotion: promotion || null,
            originalPrice: promotion ? originalPrice : null,
            discountedPrice: promotion ? discountedPrice : null,
            hasDiscount: !!promotion,
          };
        });

        if (promotionsMap.size > 0) {
          console.log(`✨ Applied ${promotionsMap.size} active promotions to services`);
        }

        setPartners(servicesWithPromotions);

        // Cargar todos los servicios de una vez
        setDisplayedPartners(servicesWithPromotions);
        setCurrentPage(1);
        setHasMoreData(false);
      }
    } catch (err) {
      console.error("Error fetching partners:", err);
      setError("Error al cargar los servicios");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPartners(true);
    setRefreshing(false);
  };

  const loadMorePartners = () => {
    if (loadingMore || !hasMoreData) return;
    
    console.log(`🔄 Loading more partners - Page ${currentPage + 1}...`);
    setLoadingMore(true);
    
    const startIndex = currentPage * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const newPartners = partners.slice(startIndex, endIndex);
    
    if (newPartners.length === 0) {
      setHasMoreData(false);
      setLoadingMore(false);
      return;
    }
    
    setTimeout(() => {
      setDisplayedPartners(prev => [...prev, ...newPartners]);
      setCurrentPage(prev => prev + 1);
      setHasMoreData(endIndex < partners.length);
      setLoadingMore(false);
      console.log(`✅ Loaded ${newPartners.length} more partners. Total displayed: ${displayedPartners.length + newPartners.length}`);
    }, 300); // Small delay to prevent overwhelming
  };

  // Clean up function to handle component unmount or user logout
  React.useEffect(() => {
    return () => {
      // Clean up any subscriptions or state when component unmounts
      setDisplayedPartners([]);
      setError(null);
    };
  }, []);

  const handlePartnerPress = async (partnerId: string) => {
    if (!partnerId || typeof partnerId !== 'string') {
      console.error('Invalid partner ID for navigation:', partnerId);
      Alert.alert('Error', 'No pudimos abrir este negocio.');
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(partnerId)) {
      console.error('Partner ID is not a valid UUID for navigation:', partnerId);
      Alert.alert('Error', 'No pudimos abrir este negocio.');
      return;
    }

    // Buscar si algún servicio de este partner tiene promoción activa
    const partnerService = displayedPartners.find(p => p.partnerId === partnerId);
    if (partnerService?.activePromotion) {
      await incrementPromotionClicks(partnerService.activePromotion.id);
      console.log(`📊 Incremented promotion click for service: ${partnerService.name}`);
    }

    console.log('Navigating to partner with valid UUID:', partnerId);
    router.push(`/services/partner/${partnerId}`);
  };

  const handleRatingPress = (item: any) => {
    const reviewCount = item.reviews || item.reviewsCount || 0;
    if (reviewCount > 0) {
      router.push(`/services/partner/${item.partnerId}?tab=reviews`);
    } else {
      toast.info('Este negocio todavía no tiene reseñas.');
    }
  };

  const getDefaultIcon = (businessType: string) => {
    switch(businessType) {
      case 'veterinary':
        return <Stethoscope size={24} color={colors.white} strokeWidth={2.5} />;
      case 'grooming':
        return <Scissors size={24} color={colors.white} strokeWidth={2.5} />;
      case 'boarding':
        return <Home size={24} color={colors.white} strokeWidth={2.5} />;
      case 'walking':
        return <Dog size={24} color={colors.white} strokeWidth={2.5} />;
      default:
        return <Star size={24} color={colors.white} strokeWidth={2.5} />;
    }
  };

  const getServiceImage = (item: any) => {
    const serviceImages = Array.isArray(item.serviceImages)
      ? item.serviceImages.filter((img: unknown) => typeof img === 'string' && img)
      : [];

    if (serviceImages.length > 0) {
      return serviceImages;
    }

    const images = Array.isArray(item.images)
      ? item.images.filter((img: unknown) => typeof img === 'string' && img)
      : [];

    if (images.length > 0) {
      return images;
    }

    // Fallback: imágenes de Pexels relacionadas con mascotas según tipo de negocio
    const fallbackImages = {
      veterinary: 'https://images.pexels.com/photos/6235231/pexels-photo-6235231.jpeg?auto=compress&cs=tinysrgb&w=800',
      grooming: 'https://images.pexels.com/photos/7788009/pexels-photo-7788009.jpeg?auto=compress&cs=tinysrgb&w=800',
      boarding: 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=800',
      walking: 'https://images.pexels.com/photos/406014/pexels-photo-406014.jpeg?auto=compress&cs=tinysrgb&w=800',
      shelter: 'https://images.pexels.com/photos/2253275/pexels-photo-2253275.jpeg?auto=compress&cs=tinysrgb&w=800',
    };

    return [fallbackImages[item.partnerType as keyof typeof fallbackImages] || fallbackImages.veterinary];
  };

  const getFilteredPartners = () => {
    let filtered = displayedPartners;

    // Filter by category
    if (selectedCategory !== 'all') {
      const categoryToBusinessType: Record<string, string> = {
        'veterinaria': 'veterinary',
        'peluquería': 'grooming',
        'paseo': 'walking',
        'pensión': 'boarding'
      };

      const businessType = categoryToBusinessType[selectedCategory];
      filtered = filtered.filter(partner => partner.partnerType === businessType);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(partner =>
        partner.partnerName?.toLowerCase().includes(query) ||
        partner.businessName?.toLowerCase().includes(query) ||
        partner.partnerType?.toLowerCase().includes(query) ||
        partner.partnerAddress?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const filteredPartners = getFilteredPartners();

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <Text style={styles.footerLoaderText}>Cargando más servicios...</Text>
      </View>
    );
  };
  const categories = [
    { id: 'all', name: 'Todo' },
    { id: 'veterinaria', name: 'Veterinaria' },
    { id: 'peluquería', name: 'Peluquería' },
    { id: 'pensión', name: 'Pensión' },
    { id: 'paseo', name: 'Paseo' }
  ];

  return (
    <SafeAreaView style={[styles.container, embedded && styles.embeddedContainer]}>
      {!embedded && (
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle} accessibilityRole="header">{t('services')}</Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <OneTimeTooltip
          hintKey="services_search"
          userId={currentUser?.id}
          text="Tip: buscá negocios por nombre o zona"
          placement="bottom"
          onHidden={() => setCanShowCategoryHint(true)}
        >
          <View style={styles.searchInputWrapper}>
            <Search size={20} color={colors.icon} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar negocios o zonas..."
              placeholderTextColor={colors.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              accessibilityLabel="Buscar negocios"
              returnKeyType="search"
            />
          </View>
        </OneTimeTooltip>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          currentUser ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
      >
        <View style={styles.categories}>
          <OneTimeTooltip
            hintKey="services_categories"
            userId={currentUser?.id}
            text="Tip: elegí categoría para encontrar más rápido"
            containerStyle={styles.categoriesTooltipAnchor}
            enabled={canShowCategoryHint}
          >
            <View style={styles.categoriesTooltipTarget} />
          </OneTimeTooltip>

          <CategoryChips
            options={categories.map((category) => ({ id: category.id, label: category.name }))}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </View>

        <View style={styles.servicesContainer}>
          {loading && (
            <View accessibilityLabel="Cargando servicios">
              {[0, 1, 2].map((i) => (
                <SkeletonCard key={i} imageHeight={200} style={styles.skeletonCard} />
              ))}
            </View>
          )}

          {!loading && error && (
            <EmptyState
              icon={<AlertCircle size={32} color={colors.primary} />}
              title="No pudimos cargar los servicios"
              description={error}
              actionLabel="Reintentar"
              onAction={() => fetchPartners()}
            />
          )}

          {!loading && !error && !currentUser && (
            <EmptyState
              icon={<Stethoscope size={32} color={colors.primary} />}
              title={t('signIn')}
              description={t('signInToViewServices')}
            />
          )}

          {!loading && !error && currentUser && filteredPartners.length === 0 && (
            <EmptyState
              icon={<Search size={32} color={colors.primary} />}
              title={searchQuery ? 'No encontramos negocios' : t('noServicesAvailable')}
              description={searchQuery ? 'Probá con otro nombre o zona.' : t('noBusinessInCategory')}
              actionLabel={searchQuery || selectedCategory !== 'all' ? 'Limpiar filtros' : undefined}
              onAction={
                searchQuery || selectedCategory !== 'all'
                  ? () => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                    }
                  : undefined
              }
            />
          )}

          {!loading && !error && currentUser && filteredPartners.length > 0 && (
            <>
              {filteredPartners.map((item) => {
                const typeLabel = getServiceTypeLabel(item.partnerType);
                const hasRating = (item.rating || 0) > 0;
                return (
                  <View key={item.partnerId} style={styles.card}>
                    <TouchableOpacity
                      onPress={() => handlePartnerPress(item.partnerId)}
                      activeOpacity={0.9}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.partnerName}, ${typeLabel}`}
                      accessibilityHint="Abre el detalle del negocio"
                    >
                      <View style={styles.cardImageContainer}>
                        <ServiceImageCarousel images={getServiceImage(item)} />

                        <View style={styles.logoContainer}>
                          <View style={styles.logoBadge}>
                            {item.partnerLogo ? (
                              <Image
                                source={{ uri: item.partnerLogo }}
                                style={styles.logoBadgeImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={styles.logoPlaceholder}>
                                {getDefaultIcon(item.partnerType)}
                              </View>
                            )}
                          </View>
                        </View>

                        {(item.price !== undefined && item.price !== null && item.price > 0) && (
                          <View style={styles.priceBadge}>
                            <Text style={styles.priceBadgeLabel}>Desde</Text>
                            <Text style={styles.priceBadgeText}>
                              ${item.price.toLocaleString()}
                            </Text>
                          </View>
                        )}

                        {item.hasDiscount && (
                          <Badge label="Promo" tone="accent" style={styles.promoBadge} />
                        )}
                      </View>

                      <View style={styles.cardBody}>
                        <View style={styles.titleRow}>
                          <Text style={styles.businessNameText} numberOfLines={1}>
                            {item.partnerName}
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleRatingPress(item)}
                            hitSlop={hitSlop}
                            accessibilityRole="button"
                            accessibilityLabel={
                              hasRating
                                ? `Calificación ${Number(item.rating).toFixed(1)}, ${item.reviews || 0} reseñas. Ver reseñas`
                                : 'Sin calificaciones todavía'
                            }
                          >
                            {hasRating ? (
                              <RatingStars rating={item.rating} count={item.reviews || 0} mode="compact" />
                            ) : (
                              <Badge label="Nuevo" tone="primary" size="small" />
                            )}
                          </TouchableOpacity>
                        </View>

                        <Badge label={typeLabel} tone="primary" size="small" style={styles.typeChip} />

                        {!!item.partnerAddress && (
                          <View style={styles.infoRow}>
                            <MapPin size={14} color={colors.textTertiary} strokeWidth={2} />
                            <Text style={styles.infoText} numberOfLines={1}>
                              {item.partnerAddress}
                            </Text>
                          </View>
                        )}

                        {!!item.partnerPhone && (
                          <View style={styles.infoRow}>
                            <Phone size={14} color={colors.textTertiary} strokeWidth={2} />
                            <Text style={styles.infoText} numberOfLines={1}>
                              {item.partnerPhone}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
              {renderFooter()}
            </>
          )}
        </View>
      </ScrollView>
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
    paddingTop: 30, // Add padding at the top to show status bar
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.title,
    color: colors.text,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 48,
    ...shadows.sm,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: 0,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingBottom: spacing.xxxl,
  },
  categories: {
    paddingVertical: spacing.md,
    zIndex: 20,
  },
  categoriesTooltipAnchor: {
    position: 'absolute',
    right: 0,
    top: -6,
    zIndex: 30,
  },
  categoriesTooltipTarget: {
    width: 1,
    height: 1,
  },
  servicesContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  skeletonCard: {
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.md,
  },
  cardImageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
    backgroundColor: colors.surfaceAlt,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  carouselContainer: {
    width: '100%',
    height: '100%',
  },
  carouselDotsContainer: {
    position: 'absolute',
    bottom: spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    zIndex: 3,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  carouselDotActive: {
    backgroundColor: colors.white,
  },
  logoContainer: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    zIndex: 10,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.white,
    overflow: 'hidden',
    ...shadows.md,
  },
  logoBadgeImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'baseline',
    ...shadows.md,
  },
  priceBadgeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  priceBadgeText: {
    ...typography.captionStrong,
    fontSize: 14,
    color: colors.text,
  },
  promoBadge: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
  },
  cardBody: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  businessNameText: {
    ...typography.heading,
    color: colors.text,
    flex: 1,
  },
  typeChip: {
    marginTop: -spacing.xxs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  footerLoader: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  footerLoaderText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
