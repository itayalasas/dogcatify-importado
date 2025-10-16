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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search, ShoppingCart, Store, MapPin, Phone, Tag } from 'lucide-react-native';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ProductCard } from '../../../components/ProductCard';
import { supabaseClient } from '../../../lib/supabase';
import { useCart } from '@/contexts/CartContext';

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
        setPartner(partnerRes.data);
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
        <View style={styles.loadingContainer}>
          <LoadingSpinner message="Cargando productos..." />
        </View>
      </SafeAreaView>
    );
  }

  if (!partner) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No se encontró la tienda</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {partner.businessName || 'Tienda'}
        </Text>
        <TouchableOpacity onPress={() => router.push('/cart')} style={styles.headerButton}>
          <ShoppingCart size={24} color="#111827" />
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
                <Store size={32} color="#FFFFFF" />
              </View>
            )}
            <View style={styles.storeDetails}>
              <Text style={styles.storeName}>{partner.businessName}</Text>
              {partner.businessAddress && (
                <View style={styles.storeInfoRow}>
                  <MapPin size={14} color="#6B7280" />
                  <Text style={styles.storeInfoText} numberOfLines={1}>
                    {partner.businessAddress}
                  </Text>
                </View>
              )}
              {partner.phone && (
                <View style={styles.storeInfoRow}>
                  <Phone size={14} color="#6B7280" />
                  <Text style={styles.storeInfoText}>{partner.phone}</Text>
                </View>
              )}
            </View>
          </View>

          {partner.description && (
            <Text style={styles.storeDescription}>{partner.description}</Text>
          )}

          {/* Active Promotions Banner */}
          {promotions.length > 0 && (
            <View style={styles.promotionsBanner}>
              <Tag size={16} color="#10B981" />
              <Text style={styles.promotionsBannerText}>
                {promotions.length} {promotions.length === 1 ? 'Promoción activa' : 'Promociones activas'}
              </Text>
            </View>
          )}
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar productos..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
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
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No se encontraron productos con ese criterio' : 'Esta tienda no tiene productos disponibles'}
            </Text>
          </View>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 16 : 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerButton: {
    padding: 8,
    position: 'relative',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter-Bold',
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
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#2D6A6F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  storeInfoCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  storeHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  storeLogo: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  storeLogoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#2D6A6F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  storeDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  storeName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
  },
  storeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  storeInfoText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    flex: 1,
  },
  storeDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  promotionsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  promotionsBannerText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#065F46',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginLeft: 12,
  },
  categoriesContainer: {
    marginBottom: 12,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#2D6A6F',
  },
  categoryChipText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  productsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  productsCount: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  productCardContainer: {
    width: '50%',
    padding: 8,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
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
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  productInfo: {
    padding: 12,
  },
  productCategory: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  productName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
    minHeight: 36,
  },
  priceContainer: {
    gap: 2,
  },
  originalPrice: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  discountedPrice: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  productPrice: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  lowStockText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#F59E0B',
    marginTop: 4,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
});
