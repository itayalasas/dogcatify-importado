import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  TextInput,
  FlatList,
  Platform,
  StatusBar,
  Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search, ShoppingCart, Store, MapPin, Phone, Tag } from 'lucide-react-native';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { ProductCard } from '../../../components/ProductCard';
import { supabaseClient } from '../../../lib/supabase';
import { useCart } from '@/contexts/CartContext';
import { normalizePartnerDisplayData } from '../../../utils/partnerDisplay';
import { colors, radius, shadows, spacing, typography } from '../../../constants/theme';

export default function StoreProducts() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCartCount } = useCart();
  const [partner, setPartner] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);

  const cartCount = getCartCount();

  useEffect(() => {
    fetchStoreData();
  }, [id]);

  useEffect(() => {
    filterProducts();
  }, [searchQuery, selectedCategory, products]);

  const fetchStoreData = async () => {
    try {
      const [partnerRes, productsRes, promotionsRes] = await Promise.all([
        supabaseClient
          .from('partners')
          .select('*')
          .eq('id', id)
          .single(),
        supabaseClient
          .from('partner_products')
          .select('*')
          .eq('partner_id', id)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabaseClient
          .from('promotions')
          .select('*')
          .eq('partner_id', id)
          .eq('is_active', true)
          .gte('end_date', new Date().toISOString())
      ]);

      if (partnerRes.data) {
        setPartner(normalizePartnerDisplayData(partnerRes.data));
      }

      if (productsRes.data) {
        setProducts(productsRes.data);
        setFilteredProducts(productsRes.data);

        const uniqueCategories = Array.from(
          new Set(productsRes.data.map((p: any) => p.category).filter(Boolean))
        ) as string[];
        setCategories(['all', ...uniqueCategories]);
      }

      if (promotionsRes.data) {
        setPromotions(promotionsRes.data);
      }
    } catch (error) {
      console.error('Error fetching store data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    if (searchQuery.trim()) {
      filtered = filtered.filter((product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((product) => product.category === selectedCategory);
    }

    setFilteredProducts(filtered);
  };

  const getProductDiscount = (productId: string) => {
    const promotion = promotions.find(p =>
      p.applicable_products?.includes(productId) ||
      p.applicable_to === 'all'
    );
    return promotion?.discount_percentage || 0;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(price);
  };

  const handleCallStore = async (phone: string) => {
    const normalizedPhone = String(phone || '').replace(/[^\d+]/g, '').trim();

    if (!normalizedPhone) {
      return;
    }

    try {
      await Linking.openURL(`tel:${normalizedPhone}`);
    } catch (error) {
      console.error('Error opening store phone:', error);
    }
  };

  const handleProductPress = (productId: string) => {
    const discount = getProductDiscount(productId);
    if (discount > 0) {
      router.push(`/products/${productId}?discount=${discount}`);
    } else {
      router.push(`/products/${productId}`);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Tienda" />
        <SkeletonList kind="grid" count={6} style={styles.skeleton} />
      </SafeAreaView>
    );
  }

  if (!partner) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Tienda" />
        <EmptyState
          icon={<Store size={32} color={colors.primary} />}
          title="No se encontró la tienda"
          description="Puede que ya no esté disponible."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {partner.businessName || 'Tienda'}
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/cart')}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel={cartCount > 0 ? `Ver carrito, ${cartCount} productos` : 'Ver carrito'}
        >
          <ShoppingCart size={24} color={colors.text} />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Store Info Card */}
        <View style={styles.storeInfoCard}>
          <View style={styles.storeHeader}>
            {partner.logo ? (
              <Image source={{ uri: partner.logo }} style={styles.storeLogo} />
            ) : (
              <View style={styles.storeLogoPlaceholder}>
                <Store size={32} color={colors.white} />
              </View>
            )}
            <View style={styles.storeDetails}>
              <Text style={styles.storeName}>{partner.businessName}</Text>
              {partner.businessAddress && (
                <View style={styles.storeInfoRow}>
                  <MapPin size={14} color={colors.textTertiary} />
                  <Text style={styles.storeInfoText} numberOfLines={1}>
                    {partner.businessAddress}
                  </Text>
                </View>
              )}
              {partner.phone && (
                <TouchableOpacity
                  style={styles.storeInfoRow}
                  onPress={() => handleCallStore(partner.phone)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Llamar a la tienda al ${partner.phone}`}
                >
                  <Phone size={14} color={colors.textTertiary} />
                  <Text style={styles.storeInfoText}>{partner.phone}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {partner.description && (
            <Text style={styles.storeDescription}>{partner.description}</Text>
          )}

          {/* Active Promotions Banner */}
          {promotions.length > 0 && (
            <View style={styles.promotionsBanner}>
              <Tag size={16} color={colors.success} />
              <Text style={styles.promotionsBannerText}>
                {promotions.length} {promotions.length === 1 ? 'Promoción activa' : 'Promociones activas'}
              </Text>
            </View>
          )}
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={20} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar productos..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Categories Filter */}
        {categories.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesContainer}
            contentContainerStyle={styles.categoriesContent}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  selectedCategory === category && styles.categoryChipActive
                ]}
                onPress={() => setSelectedCategory(category)}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedCategory === category }}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === category && styles.categoryChipTextActive
                  ]}
                >
                  {category === 'all' ? 'Todos' : category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Products Count */}
        <View style={styles.productsHeader}>
          <Text style={styles.productsCount}>
            {filteredProducts.length} {filteredProducts.length === 1 ? 'Producto' : 'Productos'}
          </Text>
        </View>

        {/* Products Grid */}
        {filteredProducts.length > 0 ? (
          <View style={styles.productsGrid}>
            {filteredProducts.map((product) => {
              const discount = getProductDiscount(product.id);
              return (
                <TouchableOpacity
                  key={product.id}
                  style={styles.productCardContainer}
                  onPress={() => handleProductPress(product.id)}
                >
                  <View style={styles.productCard}>
                    <Image
                      source={{
                        uri: product.images && product.images.length > 0
                          ? product.images[0]
                          : 'https://images.pexels.com/photos/1459244/pexels-photo-1459244.jpeg?auto=compress&cs=tinysrgb&w=400'
                      }}
                      style={styles.productImage}
                    />

                    {discount > 0 && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>-{discount}%</Text>
                      </View>
                    )}

                    {product.stock === 0 && (
                      <View style={styles.outOfStockBadge}>
                        <Text style={styles.outOfStockText}>Agotado</Text>
                      </View>
                    )}

                    <View style={styles.productInfo}>
                      <Text style={styles.productCategory}>{product.category}</Text>
                      <Text style={styles.productName} numberOfLines={2}>
                        {product.name}
                      </Text>

                      {discount > 0 ? (
                        <View style={styles.priceContainer}>
                          <Text style={styles.originalPrice}>
                            {formatPrice(product.price)}
                          </Text>
                          <Text style={styles.discountedPrice}>
                            {formatPrice(product.price * (1 - discount / 100))}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.productPrice}>
                          {formatPrice(product.price)}
                        </Text>
                      )}

                      {product.stock > 0 && product.stock <= 5 && (
                        <Text style={styles.lowStockText}>
                          ¡Solo {product.stock} disponibles!
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon={<Search size={32} color={colors.primary} />}
            title={searchQuery ? 'No encontramos productos' : 'Esta tienda no tiene productos disponibles'}
            description={searchQuery ? 'Probá con otra búsqueda o categoría.' : undefined}
            actionLabel={searchQuery || selectedCategory !== 'all' ? 'Ver todos los productos' : undefined}
            onAction={searchQuery || selectedCategory !== 'all' ? () => { setSearchQuery(''); setSelectedCategory('all'); } : undefined}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skeleton: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'android' ? 16 : 12,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    padding: spacing.sm,
    position: 'relative',
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
    marginHorizontal: spacing.lg,
  },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  cartBadgeText: {
    color: colors.white,
    ...typography.captionStrong,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    marginBottom: spacing.lg,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  backButtonText: {
    ...typography.label,
    color: colors.white,
  },
  storeInfoCard: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  storeHeader: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  storeLogo: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    marginRight: spacing.lg,
  },
  storeLogoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  storeDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  storeName: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  storeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  storeInfoText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    flex: 1,
  },
  storeDescription: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  promotionsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
  },
  promotionsBannerText: {
    ...typography.label,
    color: colors.success,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    marginLeft: spacing.md,
  },
  categoriesContainer: {
    marginBottom: spacing.md,
  },
  categoriesContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    marginRight: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
  },
  categoryChipText: {
    ...typography.label,
    color: colors.textTertiary,
  },
  categoryChipTextActive: {
    color: colors.white,
  },
  productsHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  productsCount: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xl,
  },
  productCardContainer: {
    width: '50%',
    padding: spacing.sm,
  },
  productCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  productImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  discountText: {
    ...typography.captionStrong,
    color: colors.white,
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockText: {
    ...typography.bodyStrong,
    color: colors.white,
  },
  productInfo: {
    padding: spacing.md,
  },
  productCategory: {
    ...typography.captionStrong,
    color: colors.primary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  productName: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm,
    minHeight: 36,
  },
  priceContainer: {
    gap: spacing.xxs,
  },
  originalPrice: {
    ...typography.caption,
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  discountedPrice: {
    ...typography.bodyStrong,
    color: colors.success,
  },
  productPrice: {
    ...typography.bodyStrong,
    color: colors.success,
  },
  lowStockText: {
    ...typography.captionStrong,
    color: colors.warning,
    marginTop: spacing.xs,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
