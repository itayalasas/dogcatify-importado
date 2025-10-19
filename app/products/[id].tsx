import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert, Share, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ShoppingCart, Star, Plus, Minus, Heart, Share2, Truck, Package, Clock } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { useCart } from '@/contexts/CartContext';

export default function ProductDetail() {
  const { id, discount } = useLocalSearchParams<{ id: string; discount?: string }>();
  const { currentUser } = useAuth();
  const { addToCart, getCartCount } = useCart();
  const [product, setProduct] = useState<any>(null);
  const [partnerInfo, setPartnerInfo] = useState<any>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);

  const cartCount = getCartCount();

  useEffect(() => {
    fetchProductDetails();
    checkIfFavorite();

    // Apply discount from promotion if provided
    if (discount) {
      const discountValue = parseFloat(discount);
      if (!isNaN(discountValue) && discountValue > 0 && discountValue <= 100) {
        setAppliedDiscount(discountValue);
      }
    }
  }, [id, discount]);

  const checkIfFavorite = async () => {
    if (!currentUser) return;
    
    try {
      const { data: userData, error } = await supabaseClient
        .from('profiles')
        .select('favorite_products')
        .eq('id', currentUser.id)
        .single();
      
      if (error) {
        console.error('Error checking favorites:', error);
        return;
      }
      
      if (userData && userData.favorite_products) {
        setIsFavorite(userData.favorite_products.includes(id));
      }
    } catch (error) {
      console.error('Error checking if product is favorite:', error);
    }
  };

  const fetchProductDetails = async () => {
    try {
      const { data: productData, error } = await supabaseClient
        .from('partner_products')
        .select('*')
        .eq('id', id)
        .single();

      if (productData && !error) {
        setProduct({
          id: productData.id,
          ...productData,
          createdAt: new Date(productData.created_at),
        });

        // Fetch partner info
        if (productData.partner_id) {
          const { data: partnerData, error: partnerError } = await supabaseClient
            .from('partners')
            .select('*')
            .eq('id', productData.partner_id)
            .single();

          if (partnerData && !partnerError) {
            setPartnerInfo({
              id: partnerData.id,
              ...partnerData
            });
          }

          // Check for active promotions if no discount was passed
          if (!discount) {
            const { data: promotions } = await supabaseClient
              .from('promotions')
              .select('*')
              .eq('partner_id', productData.partner_id)
              .eq('is_active', true)
              .gte('end_date', new Date().toISOString());

            if (promotions && promotions.length > 0) {
              const applicablePromotion = promotions.find(p =>
                p.applicable_products?.includes(id) ||
                p.applicable_to === 'all'
              );
              if (applicablePromotion) {
                setAppliedDiscount(applicablePromotion.discount_percentage || 0);
              }
            }
          }
        }
        
        // Fetch related products (same category)
        if (productData.category) {
          const { data: relatedData, error: relatedError } = await supabaseClient
            .from('partner_products')
            .select('*')
            .eq('category', productData.category)
            .eq('is_active', true)
            .neq('id', productData.id)
            .limit(4);
          
          if (relatedData && !relatedError) {
            setRelatedProducts(relatedData);
          }
        }
        
        // Check if product is in user's favorites
        if (currentUser) {
          checkIfFavorite();
        }
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!currentUser) {
      Alert.alert('Iniciar sesión', 'Debes iniciar sesión para agregar productos al carrito');
      return;
    }

    if (!product) return;

    // Validar que hay stock disponible
    if (!product.stock || product.stock < quantity) {
      Alert.alert('Sin stock', 'No hay suficiente stock disponible para este producto');
      return;
    }

    // Calculate final price with discount
    const finalPrice = appliedDiscount > 0
      ? product.price * (1 - appliedDiscount / 100)
      : product.price;

    addToCart({
      id: product.id,
      name: product.name,
      price: finalPrice,
      quantity: quantity,
      image: product.images && product.images.length > 0 ? product.images[0] : null,
      partnerId: product.partner_id,
      partnerName: partnerInfo?.businessName || 'Tienda',
      iva_rate: product.iva_rate,
      discount_percentage: appliedDiscount || 0,
      original_price: product.price,
      currency: product.currency || 'UYU',
      currency_code_dgi: product.currency_code_dgi || '858'
    });
  };

  const handleToggleFavorite = async () => {
    if (!currentUser) {
      Alert.alert('Iniciar sesión', 'Debes iniciar sesión para guardar favoritos');
      return;
    }
    
    setFavoriteLoading(true);
    try {
      const { data: userData, error: fetchError } = await supabaseClient
        .from('profiles')
        .select('favorite_products')
        .eq('id', currentUser.id)
        .single();

      if (fetchError) throw fetchError;

      let updatedFavorites = userData.favorite_products || [];
      
      if (isFavorite) {
        updatedFavorites = updatedFavorites.filter((id: string) => id !== product.id);
      } else {
        updatedFavorites.push(product.id);
      }

      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({ favorite_products: updatedFavorites })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;
      
      setIsFavorite(!isFavorite);
      
      // Show feedback to user
      Alert.alert(
        isFavorite ? 'Eliminado de favoritos' : 'Agregado a favoritos',
        isFavorite ? 'El producto se eliminó de tus favoritos' : 'El producto se agregó a tus favoritos'
      );
    } catch (error) {
      console.error('Error updating favorites:', error);
      Alert.alert('Error', 'No se pudo actualizar los favoritos');
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      const shareContent = {
        message: `¡Mira este producto en DogCatiFy! ${product?.name} por ${formatPrice(product?.price || 0)}`,
        url: `https://dogcatify.com/products/${id}`, // URL del producto
        title: product?.name || 'Producto en DogCatiFy'
      };

      if (Platform.OS === 'web') {
        // Para web, usar Web Share API si está disponible
        if (navigator.share) {
          await navigator.share(shareContent);
        } else {
          // Fallback: copiar al portapapeles
          await navigator.clipboard.writeText(`${shareContent.message} - ${shareContent.url}`);
          Alert.alert('Enlace copiado', 'El enlace del producto se copió al portapapeles');
        }
      } else {
        // Para móvil, usar Share nativo
        await Share.share(shareContent);
      }
    } catch (error) {
      console.error('Error sharing product:', error);
      // No mostrar error si el usuario cancela
      if (error.message && !error.message.includes('cancelled')) {
        Alert.alert('Error', 'No se pudo compartir el producto');
      }
    }
  };
  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= (product?.stock || 10)) {
      setQuantity(newQuantity);
    }
  };

  const handleRelatedProductPress = (productId: string) => {
    router.push(`/products/${productId}`);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(price);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner message="Cargando detalles del producto..." />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No se encontró el producto</Text>
          <Button title="Volver" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Detalle del Producto</Text>
        <TouchableOpacity onPress={() => router.push('/cart')} style={styles.cartButton}>
          <ShoppingCart size={24} color="#111827" />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Product Images */}
        <View style={styles.imageContainer}>
          <ScrollView 
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const contentOffset = e.nativeEvent.contentOffset;
              const viewSize = e.nativeEvent.layoutMeasurement;
              const pageNum = Math.floor(contentOffset.x / viewSize.width);
              setCurrentImageIndex(pageNum);
            }}
          >
            {product.images && product.images.length > 0 ? (
              product.images.map((image: string, index: number) => (
                <Image 
                  key={index} 
                  source={{ uri: image }} 
                  style={styles.productImage} 
                  resizeMode="cover"
                />
              ))
            ) : (
              <Image 
                source={{ uri: 'https://images.pexels.com/photos/1459244/pexels-photo-1459244.jpeg?auto=compress&cs=tinysrgb&w=800' }} 
                style={styles.productImage} 
                resizeMode="cover"
              />
            )}
          </ScrollView>
          
          {/* Image Pagination Dots */}
          {product.images && product.images.length > 1 && (
            <View style={styles.paginationContainer}>
              {product.images.map((_: any, index: number) => (
                <View 
                  key={index} 
                  style={[
                    styles.paginationDot,
                    index === currentImageIndex && styles.paginationDotActive
                  ]} 
                />
              ))}
            </View>
          )}
          
          {/* Favorite Button */}
          <TouchableOpacity 
            style={styles.favoriteButton}
            onPress={handleToggleFavorite}
            disabled={favoriteLoading}
          >
            <Heart 
              size={20} 
              color={isFavorite ? '#EF4444' : '#FFFFFF'} 
              fill={isFavorite ? '#EF4444' : 'none'}
            />
          </TouchableOpacity>
          
          {/* Share Button */}
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Share2 size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>

          {product.rating && (
            <View style={styles.ratingContainer}>
              <Star size={14} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.ratingText}>{product.rating}</Text>
              <Text style={styles.reviewsText}>({product.reviews || 0})</Text>
              <View style={styles.separator} />
              <Text style={styles.soldText}>Vendidos: {product.sold || 0}</Text>
            </View>
          )}

          {/* Price with Discount Badge */}
          {appliedDiscount > 0 ? (
            <View style={styles.priceSection}>
              <View style={styles.priceRow}>
                <Text style={styles.originalPriceSmall}>{formatPrice(product.price)}</Text>
                <View style={styles.discountBadgeSmall}>
                  <Text style={styles.discountBadgeSmallText}>{appliedDiscount}% OFF</Text>
                </View>
              </View>
              <Text style={styles.currentPrice}>
                {formatPrice(product.price * (1 - appliedDiscount / 100))}
              </Text>
              <Text style={styles.ivaIncluded}>IVA incluido</Text>
            </View>
          ) : (
            <View style={styles.priceSection}>
              <Text style={styles.currentPrice}>{formatPrice(product.price)}</Text>
              <Text style={styles.ivaIncluded}>IVA incluido</Text>
            </View>
          )}

          {/* Stock and Shipping Info */}
          <View style={styles.quickInfo}>
            <View style={styles.quickInfoItem}>
              <Text style={styles.quickInfoLabel}>Stock disponible</Text>
              <Text style={[
                styles.quickInfoValue,
                product.stock <= 5 && styles.quickInfoValueWarning
              ]}>
                {product.stock === 0 ? 'Sin stock' : product.stock <= 5 ? `Últimas ${product.stock} unidades` : `${product.stock} unidades`}
              </Text>
            </View>
            <View style={styles.quickInfoDivider} />
            <View style={styles.quickInfoItem}>
              <Text style={styles.quickInfoLabel}>Envío gratis</Text>
              <Text style={styles.quickInfoValue}>Comprando +$5.000</Text>
            </View>
          </View>
          
          {/* Store Info */}
          <TouchableOpacity
            style={styles.storeContainer}
            onPress={() => router.push(`/partner/store-products/${partnerInfo?.id}`)}
          >
            <View style={styles.storeInfo}>
              {partnerInfo?.logo ? (
                <Image source={{ uri: partnerInfo.logo }} style={styles.storeLogo} />
              ) : (
                <View style={styles.storeLogoPlaceholder}>
                  <Text style={styles.storeLogoText}>
                    {partnerInfo?.businessName?.charAt(0) || 'T'}
                  </Text>
                </View>
              )}
              <View>
                <Text style={styles.storeName}>{partnerInfo?.businessName || 'Tienda'}</Text>
                <Text style={styles.storeSubtitle}>Ver todos los productos</Text>
              </View>
            </View>
            <ArrowLeft size={16} color="#6B7280" style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        </View>

        {/* Shipping and Delivery */}
        <View style={styles.shippingSection}>
          <View style={styles.shippingCard}>
            <Truck size={24} color="#00A650" />
            <View style={styles.shippingInfo}>
              <Text style={styles.shippingTitle}>Envío gratis comprando +$5.000</Text>
              <Text style={styles.shippingSubtitle}>Llega en 24-48 horas • Envío rápido</Text>
            </View>
          </View>
        </View>

        {/* Quantity and Add to Cart */}
        <View style={styles.purchaseSection}>
          <View style={styles.quantityRow}>
            <Text style={styles.quantityLabel}>Cantidad:</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.quantityBtn}
                onPress={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
              >
                <Minus size={18} color={quantity <= 1 ? '#D1D5DB' : '#3B82F6'} />
              </TouchableOpacity>

              <Text style={styles.quantityValue}>{quantity}</Text>

              <TouchableOpacity
                style={styles.quantityBtn}
                onPress={() => handleQuantityChange(1)}
                disabled={quantity >= (product.stock || 10)}
              >
                <Plus size={18} color={quantity >= (product.stock || 10) ? '#D1D5DB' : '#3B82F6'} />
              </TouchableOpacity>
            </View>
            <Text style={styles.stockIndicator}>({product.stock} disponibles)</Text>
          </View>

          {product.stock > 0 ? (
            <TouchableOpacity style={styles.buyButton} onPress={handleAddToCart}>
              <Text style={styles.buyButtonText}>Agregar al carrito</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.outOfStockButton}>
              <Text style={styles.outOfStockButtonText}>Sin stock disponible</Text>
            </View>
          )}
        </View>

        {/* Product Details */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Información del producto</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Categoría</Text>
            <Text style={styles.infoValue}>{product.category || 'General'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Marca</Text>
            <Text style={styles.infoValue}>{product.brand || 'Sin especificar'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Condición</Text>
            <Text style={styles.infoValue}>Nuevo</Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.descriptionSection}>
          <Text style={styles.descriptionTitle}>Descripción</Text>
          <Text style={styles.descriptionText}>
            {product.description || 'No hay descripción disponible para este producto.'}
          </Text>
        </View>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>Productos Relacionados</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.relatedScroll}
            >
              {relatedProducts.map((relatedProduct) => (
                <TouchableOpacity 
                  key={relatedProduct.id} 
                  style={styles.relatedProduct}
                  onPress={() => handleRelatedProductPress(relatedProduct.id)}
                >
                  <Image 
                    source={{ 
                      uri: relatedProduct.images && relatedProduct.images.length > 0 
                        ? relatedProduct.images[0] 
                        : 'https://images.pexels.com/photos/1459244/pexels-photo-1459244.jpeg?auto=compress&cs=tinysrgb&w=400'
                    }} 
                    style={styles.relatedProductImage} 
                  />
                  <Text style={styles.relatedProductName} numberOfLines={2}>
                    {relatedProduct.name}
                  </Text>
                  <Text style={styles.relatedProductPrice}>
                    {formatPrice(relatedProduct.price)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  cartButton: {
    padding: 8,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
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
    textAlign: 'center',
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  productImage: {
    width: 400,
    height: 380,
    resizeMode: 'cover',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#FFFFFF',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  favoriteButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    position: 'absolute',
    top: 16,
    right: 64,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  productName: {
    fontSize: 20,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginBottom: 12,
    lineHeight: 26,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginLeft: 4,
  },
  reviewsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 2,
  },
  separator: {
    width: 1,
    height: 12,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 8,
  },
  soldText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  priceSection: {
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  originalPriceSmall: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  discountBadgeSmall: {
    backgroundColor: '#00A650',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountBadgeSmallText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  currentPrice: {
    fontSize: 32,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  ivaIncluded: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
  },
  quickInfo: {
    flexDirection: 'row',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  quickInfoItem: {
    flex: 1,
  },
  quickInfoLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  quickInfoValue: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#00A650',
  },
  quickInfoValueWarning: {
    color: '#F59E0B',
  },
  quickInfoDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  storeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  storeLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  storeLogoText: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  storeName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  storeSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  shippingSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 8,
  },
  shippingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shippingInfo: {
    flex: 1,
  },
  shippingTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  shippingSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  purchaseSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  quantityLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    marginRight: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
  },
  quantityBtn: {
    padding: 10,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    paddingHorizontal: 16,
    minWidth: 40,
    textAlign: 'center',
  },
  stockIndicator: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 12,
  },
  buyButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  outOfStockButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#9CA3AF',
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
  },
  descriptionSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 8,
  },
  descriptionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    lineHeight: 22,
  },
  relatedSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  relatedTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  relatedScroll: {
    paddingLeft: 16,
  },
  relatedProduct: {
    width: 160,
    marginRight: 12,
  },
  relatedProductImage: {
    width: 160,
    height: 160,
    borderRadius: 8,
    marginBottom: 8,
  },
  relatedProductName: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    marginBottom: 4,
  },
  relatedProductPrice: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
});
