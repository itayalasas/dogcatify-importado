import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, TextInput, RefreshControl } from 'react-native';
import { Filter, Search, ShoppingCart, Package } from 'lucide-react-native';
import { FlatGrid } from 'react-native-super-grid';
import { ProductCard } from '../../components/ProductCard';
import { groupProductsByVariant } from '../../utils/productVariants';
import { SkeletonList, EmptyState, toast } from '../../components/ui';
import { colors, radius, spacing, typography, touchTarget } from '../../constants/theme';
import { OneTimeTooltip } from '../../components/ui/OneTimeTooltip';
import { hasSeenHint } from '../../utils/oneTimeHints';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { supabaseClient } from '../../lib/supabase';
import { router, useFocusEffect } from 'expo-router';
import { getActivePromotionsForItems, calculateDiscountedPrice, incrementPromotionClicks, type ActivePromotion } from '../../utils/promotions';


export default function Shop() {
  const [products, setProducts] = useState<any[]>([]);
  const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [canShowCategoryHint, setCanShowCategoryHint] = useState(false);
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const { cart, addToCart } = useCart();

  React.useEffect(() => {
    fetchProducts();
    loadFavoriteProducts();
  }, []);

  React.useEffect(() => {
    const checkSearchHint = async () => {
      const seen = await hasSeenHint('shop_search', currentUser?.id);
      setCanShowCategoryHint(seen);
    };

    checkSearchHint();
  }, [currentUser?.id]);

  React.useEffect(() => {
    loadFavoriteProducts();
  }, [currentUser?.id]);

  // Recargar productos cada vez que la pantalla se enfoca (al volver desde Mercado Pago)
  useFocusEffect(
    React.useCallback(() => {
      fetchProducts();
      loadFavoriteProducts();
    }, [])
  );

  const loadFavoriteProducts = async () => {
    if (!currentUser?.id) {
      setFavoriteProductIds([]);
      return;
    }

    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('favorite_products')
        .eq('id', currentUser.id)
        .single();

      if (error) {
        console.error('Error loading favorite products:', error);
        return;
      }

      setFavoriteProductIds(data?.favorite_products || []);
    } catch (error) {
      console.error('Error loading favorite products:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data: productsData, error } = await supabaseClient
        .from('partner_products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (productsData && !error) {
        // Obtener IDs de todos los productos
        const productIds = productsData.map(p => p.id);

        // Buscar promociones activas para estos productos
        const promotionsMap = await getActivePromotionsForItems(productIds, 'product');

        // Aplicar promociones a los productos
        const processedProducts = productsData.map(product => {
          const promotion = promotionsMap.get(product.id);
          const originalPrice = product.price;
          const discountedPrice = promotion
            ? calculateDiscountedPrice(originalPrice, promotion)
            : originalPrice;

          return {
            ...product,
            createdAt: new Date(product.created_at),
            // Agregar información de promoción
            activePromotion: promotion || null,
            originalPrice: promotion ? originalPrice : null,
            discountedPrice: promotion ? discountedPrice : null,
            hasDiscount: !!promotion,
          };
        });

        setProducts(groupProductsByVariant(processedProducts));

        if (promotionsMap.size > 0) {
          console.log(`✨ Applied ${promotionsMap.size} active promotions to products`);
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchProducts(), loadFavoriteProducts()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleProductPress = async (productId: string) => {
    const product = products.find(p => p.id === productId);

    // Si tiene promoción activa, incrementar clicks para facturación
    if (product?.activePromotion) {
      await incrementPromotionClicks(product.activePromotion.id);
      console.log(`📊 Incremented promotion click for product: ${product.name}`);
    }

    router.push({
      pathname: '/products/[id]',
      params: { id: productId },
    });
  };

  const handleAddToCart = (productId: string) => {
    if (!currentUser) {
      Alert.alert('Iniciar sesión', 'Tenés que iniciar sesión para agregar productos al carrito');
      return;
    }

    const product = products.find(p => p.id === productId);
    if (!product) return;

    // With several presentations (1 kg, 2 kg, ...) the customer must pick
    // one first, so send them to the product page instead of guessing.
    if ((product.variantCount || 1) > 1) {
      handleProductPress(productId);
      return;
    }

    // Verificar stock disponible
    if (!product.stock || product.stock <= 0) {
      Alert.alert('Sin stock', 'Este producto no tiene stock disponible');
      return;
    }

    // Verificar cuántas unidades ya hay en el carrito
    const existingItem = cart.find(item => item.id === productId);
    const currentQuantityInCart = existingItem ? existingItem.quantity : 0;
    const newTotalQuantity = currentQuantityInCart + 1;

    // Validar que no exceda el stock disponible
    if (newTotalQuantity > product.stock) {
      Alert.alert(
        'Stock insuficiente',
        `No hay más unidades disponibles de este producto. Ya tenés ${currentQuantityInCart} en el carrito.`
      );
      return;
    }

    // Si tiene promoción activa, incrementar clicks para facturación
    if (product.activePromotion) {
      incrementPromotionClicks(product.activePromotion.id);
      console.log(`📊 Incremented promotion click for cart addition: ${product.name}`);
    }

    // Usar precio con descuento si existe
    const finalPrice = product.discountedPrice || product.price;
    const discountPercentage = product.activePromotion?.discount_percentage || 0;

    addToCart({
      id: product.id,
      name: product.name,
      price: finalPrice,
      quantity: 1,
      image: product.images && product.images.length > 0 ? product.images[0] : null,
      partnerId: product.partner_id,
      partnerName: product.partner_name || 'Tienda',
      iva_rate: product.iva_rate,
      discount_percentage: discountPercentage,
      original_price: product.originalPrice || product.price,
      currency: product.currency,
      currency_code_dgi: product.currency_code_dgi
    }, product.stock);
  };

  const handleToggleFavorite = async (productId: string) => {
    if (!currentUser?.id) {
      Alert.alert('Iniciar sesión', 'Tenés que iniciar sesión para guardar favoritos');
      return;
    }

    const previousFavorites = favoriteProductIds;
    const isCurrentlyFavorite = previousFavorites.includes(productId);
    const updatedFavorites = isCurrentlyFavorite
      ? previousFavorites.filter(id => id !== productId)
      : [...previousFavorites, productId];

    setFavoriteProductIds(updatedFavorites);

    try {
      const { error } = await supabaseClient
        .from('profiles')
        .update({ favorite_products: updatedFavorites })
        .eq('id', currentUser.id);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error updating favorite products:', error);
      setFavoriteProductIds(previousFavorites);
      toast.error('No se pudieron actualizar tus favoritos');
    }
  };

  // Filter products by category and search query
  const filteredProducts = products.filter(product => {
    const matchesFavorites = selectedCategory !== 'favorites' || favoriteProductIds.includes(product.id);
    const matchesCategory = selectedCategory === 'all' ||
                           selectedCategory === 'favorites' ||
                           product.category.toLowerCase() === selectedCategory;
    
    const matchesSearch = !searchQuery || 
                         product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesCategory && matchesFavorites && matchesSearch;
  });

  const categories = [
    { id: 'all', name: t('all') },
    { id: 'favorites', name: 'Favoritos' },
    { id: 'comida', name: 'Comida' },
    { id: 'juguetes', name: 'Juguetes' },
    { id: 'accesorios', name: 'Accesorios' },
    { id: 'salud', name: 'Salud' },
    { id: 'higiene', name: 'Higiene' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>{t('shop')}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.cartButton}
            onPress={() => router.push('/cart')}
            accessibilityRole="button"
            accessibilityLabel={cart.length > 0
              ? `Ver carrito, ${cart.reduce((count, item) => count + item.quantity, 0)} productos`
              : 'Ver carrito'}
          >
            <ShoppingCart size={24} color={colors.text} />
            {cart.length > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cart.reduce((count, item) => count + item.quantity, 0)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.searchContainer}>
        <OneTimeTooltip
          hintKey="shop_search"
          userId={currentUser?.id}
          text="Tip: buscá rápido por nombre de producto"
          placement="bottom"
          onHidden={() => setCanShowCategoryHint(true)}
        >
          <View style={styles.searchBar}>
            <Search size={20} color={colors.icon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar productos..."
              placeholderTextColor={colors.placeholder}
              accessibilityLabel="Buscar productos"
              returnKeyType="search"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </OneTimeTooltip>
      </View>

      <View style={styles.content}>
        <View style={styles.categories}>
          <OneTimeTooltip
            hintKey="shop_categories"
            userId={currentUser?.id}
            text="Tip: usá categorías para filtrar más rápido"
            containerStyle={styles.categoriesTooltipAnchor}
            enabled={canShowCategoryHint}
          >
            <View style={styles.categoriesTooltipTarget} />
          </OneTimeTooltip>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContent}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryButton,
                  selectedCategory === category.id && styles.selectedCategoryButton
                ]}
                onPress={() => setSelectedCategory(category.id)}
                hitSlop={{ top: 6, bottom: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`Categoría ${category.name}`}
                accessibilityState={{ selected: selectedCategory === category.id }}
              >
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

        {loading ? (
          <ScrollView contentContainerStyle={styles.skeletonContainer}>
            <SkeletonList kind="grid" count={6} />
          </ScrollView>
        ) : filteredProducts.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          >
            <EmptyState
              icon={<Package size={32} color={colors.primary} />}
              title={selectedCategory === 'favorites' && !searchQuery ? 'Todavía no tenés favoritos' : t('noProductsAvailable')}
              description={selectedCategory === 'favorites' && !searchQuery
                ? 'Tocá el corazón de un producto para guardarlo acá.'
                : searchQuery ? 'Probá con otra palabra o revisá la ortografía.' : t('noProductsInCategory')}
              actionLabel={searchQuery || selectedCategory !== 'all' ? 'Ver todos los productos' : undefined}
              onAction={searchQuery || selectedCategory !== 'all' ? () => { setSearchQuery(''); setSelectedCategory('all'); } : undefined}
            />
          </ScrollView>
        ) : (
          <FlatGrid
            itemDimension={160}
            data={filteredProducts}
            spacing={spacing.sm}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            renderItem={({ item }) => {
              const cartItem = cart.find(c => c.id === item.id);
              const currentCartQuantity = cartItem ? cartItem.quantity : 0;

              return (
                <ProductCard
                  product={item}
                  onPress={() => handleProductPress(item.id)}
                  onAddToCart={() => handleAddToCart(item.id)}
                  currentCartQuantity={currentCartQuantity}
                  isFavorite={favoriteProductIds.includes(item.id)}
                  onToggleFavorite={() => handleToggleFavorite(item.id)}
                />
              );
            }}
            staticDimension={undefined}
            maxItemsPerRow={2}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography.title,
    color: colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartButton: {
    position: 'relative',
    minWidth: touchTarget,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xxs,
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    minWidth: 18,
    height: 18,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  cartBadgeText: {
    ...typography.captionStrong,
    fontSize: 10,
    lineHeight: 12,
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  categories: {
    paddingLeft: spacing.lg,
    paddingVertical: spacing.md,
    zIndex: 20,
  },
  categoriesTooltipAnchor: {
    position: 'absolute',
    right: spacing.lg,
    top: 0,
    zIndex: 30,
  },
  categoriesTooltipTarget: {
    width: 1,
    height: 1,
  },
  categoriesContent: {
    paddingRight: spacing.lg,
  },
  categoryButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    minHeight: 34,
    justifyContent: 'center',
  },
  selectedCategoryButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  selectedCategoryText: {
    color: colors.onPrimary,
  },
  skeletonContainer: {
    paddingHorizontal: spacing.xs,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
