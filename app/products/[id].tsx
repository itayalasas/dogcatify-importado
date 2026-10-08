import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert, Share, Platform, Dimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ShoppingCart, Star, Plus, Minus, Heart, Share2, Truck, Package, Clock, MapPin, Phone } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ScreenHeader, Skeleton, EmptyState, toast } from '../../components/ui';
import { colors, radius, spacing, typography, shadows, touchTarget } from '../../constants/theme';
import { formatPrice, stockLabel } from '../../components/shop/format';
import { OneTimeTooltip } from '../../components/ui/OneTimeTooltip';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { useCart } from '@/contexts/CartContext';
import { getActivePromotionForItem, incrementPromotionClicks } from '@/utils/promotions';
import { hasSeenHint } from '../../utils/oneTimeHints';
import { normalizePartnerDisplayData } from '../../utils/partnerDisplay';

export default function ProductDetail() {
  const { id, discount } = useLocalSearchParams<{ id: string; discount?: string }>();
  const { currentUser } = useAuth();
  const { addToCart, getCartCount } = useCart();
  const [product, setProduct] = useState<any>(null);
  const [presentations, setPresentations] = useState<any[]>([]);
  const [partnerInfo, setPartnerInfo] = useState<any>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [activePromotion, setActivePromotion] = useState<any>(null);
  const [canShowCartHint, setCanShowCartHint] = useState(false);

  const cartCount = getCartCount();

  useEffect(() => {
    fetchProductDetails();
    checkIfFavorite();

    // Apply discount from promotion if provided (desde feed/inicio)
    if (discount) {
      const discountValue = parseFloat(discount);
      if (!isNaN(discountValue) && discountValue > 0 && discountValue <= 100) {
        setAppliedDiscount(discountValue);
      }
    } else {
      // Switching presentation reuses this screen: drop the previous one's
      // promotion before loading the new one's.
      setAppliedDiscount(0);
      setActivePromotion(null);
      // Si no viene discount, buscar promoción activa
      loadActivePromotion();
    }
    setQuantity(1);
  }, [id, discount]);

  useEffect(() => {
    const checkAddToCartHint = async () => {
      const seen = await hasSeenHint('product_add_to_cart', currentUser?.id);
      setCanShowCartHint(seen);
    };

    checkAddToCartHint();
  }, [currentUser?.id, id]);

  const loadActivePromotion = async () => {
    try {
      const promotion = await getActivePromotionForItem(id, 'product');
      if (promotion) {
        setActivePromotion(promotion);
        setAppliedDiscount(promotion.discount_percentage);
        console.log(`✨ Active promotion found for product: ${promotion.discount_percentage}% discount`);
      }
    } catch (error) {
      console.error('Error loading active promotion:', error);
    }
  };

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

        // Other presentations of this same product (1 kg, 2 kg, ...)
        if (productData.variant_group_id) {
          const { data: siblings } = await supabaseClient
            .from('partner_products')
            .select('id, weight, price, stock')
            .eq('variant_group_id', productData.variant_group_id)
            .eq('is_active', true)
            .order('price', { ascending: true });

          setPresentations(siblings && siblings.length > 1 ? siblings : []);
        } else {
          setPresentations([]);
        }

        // Fetch partner info
        if (productData.partner_id) {
          const { data: partnerData, error: partnerError } = await supabaseClient
            .from('partners')
            .select('*')
            .eq('id', productData.partner_id)
            .single();

          if (partnerData && !partnerError) {
            setPartnerInfo(normalizePartnerDisplayData(partnerData));
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
      Alert.alert('Iniciar sesión', 'Tenés que iniciar sesión para agregar productos al carrito');
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

    // Si tiene promoción activa, registrar click para facturación
    if (activePromotion) {
      incrementPromotionClicks(activePromotion.id);
      console.log(`📊 Incremented promotion click for product detail: ${product.name}`);
    }

    addToCart({
      id: product.id,
      name: presentations.length > 1 && product.weight
        ? `${product.name} (${product.weight})`
        : product.name,
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
      Alert.alert('Iniciar sesión', 'Tenés que iniciar sesión para guardar favoritos');
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
      toast.success(isFavorite ? 'Se eliminó de tus favoritos' : 'Se agregó a tus favoritos');
    } catch (error) {
      console.error('Error updating favorites:', error);
      toast.error('No se pudieron actualizar tus favoritos');
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      const shareContent = {
        message: `¡Mirá este producto en DogCatiFy! ${product?.name} por ${formatPrice(product?.price || 0)}`,
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
          toast.success('Copiamos el enlace del producto');
        }
      } else {
        // Para móvil, usar Share nativo
        await Share.share(shareContent);
      }
    } catch (error) {
      console.error('Error sharing product:', error);
      // No mostrar error si el usuario cancela
      const message = error instanceof Error ? error.message : String(error);
      if (message && !message.includes('cancelled')) {
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

  const availability = stockLabel(product?.stock);

  const hasShipping = Boolean(partnerInfo?.has_shipping);
  const shippingCost = Number(partnerInfo?.shipping_cost || 0);
  const freeShippingThreshold = Number(partnerInfo?.free_shipping_threshold || 0);
  const hasFreeShippingThreshold = hasShipping && freeShippingThreshold > 0;

  const quickShippingLabel = hasShipping
    ? hasFreeShippingThreshold
      ? 'Envío gratis'
      : 'Envío'
    : 'Entrega';

  const quickShippingValue = hasShipping
    ? hasFreeShippingThreshold
      ? `Comprando +${formatPrice(freeShippingThreshold)}`
      : shippingCost > 0
        ? `Desde ${formatPrice(shippingCost)}`
        : 'Disponible'
    : 'Retiro en tienda';

  const shippingTitle = hasShipping
    ? hasFreeShippingThreshold
      ? `Envío gratis comprando +${formatPrice(freeShippingThreshold)}`
      : shippingCost > 0
        ? `Costo de envío ${formatPrice(shippingCost)}`
        : 'Envío disponible'
    : 'Retiro en tienda';

  const shippingSubtitle = hasShipping
    ? 'Llega en 24-48 horas • Envío rápido'
    : 'Coordiná retiro directamente con la tienda';

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Detalle del producto" />
        <View accessibilityRole="progressbar" accessibilityLabel="Cargando producto">
          <Skeleton height={320} borderRadius={0} />
          <View style={styles.skeletonInfo}>
            <Skeleton width="80%" height={20} />
            <Skeleton width="40%" height={28} style={styles.skeletonGap} />
            <Skeleton width="60%" height={14} style={styles.skeletonGap} />
            <Skeleton height={52} borderRadius={radius.md} style={styles.skeletonGapLg} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Detalle del producto" />
        <EmptyState
          icon={<Package size={32} color={colors.primary} />}
          title="No encontramos el producto"
          description="Puede que ya no esté disponible."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Detalle del producto"
        right={
          <OneTimeTooltip
            hintKey="product_go_to_cart"
            userId={currentUser?.id}
            text="Tip: desde acá ves y finalizás tu compra"
            enabled={canShowCartHint}
            placement="bottom"
          >
            <TouchableOpacity
              onPress={() => router.push('/cart')}
              style={styles.cartButton}
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
          </OneTimeTooltip>
        }
      />

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
                  style={[styles.productImage, { width: Dimensions.get('window').width }]}
                  resizeMode="cover"
                />
              ))
            ) : (
              <Image 
                source={{ uri: 'https://images.pexels.com/photos/1459244/pexels-photo-1459244.jpeg?auto=compress&cs=tinysrgb&w=800' }} 
                style={[styles.productImage, { width: Dimensions.get('window').width }]}
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
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            accessibilityState={{ selected: isFavorite, busy: favoriteLoading }}
          >
            <Heart
              size={20}
              color={isFavorite ? colors.danger : colors.text}
              fill={isFavorite ? colors.danger : 'none'}
            />
          </TouchableOpacity>

          {/* Share Button */}
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Compartir producto"
          >
            <Share2 size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>

          {presentations.length > 1 && (
            <View style={styles.presentationsSection}>
              <Text style={styles.presentationsLabel}>Presentación</Text>
              <View style={styles.presentationsRow}>
                {presentations.map((option) => {
                  const selected = option.id === product.id;
                  const soldOut = !option.stock || option.stock <= 0;

                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.presentationChip,
                        selected && styles.presentationChipSelected,
                        soldOut && !selected && styles.presentationChipSoldOut,
                      ]}
                      onPress={() => {
                        if (!selected) router.setParams({ id: option.id });
                      }}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Presentación ${option.weight || 'Estándar'}${soldOut ? ', agotado' : ''}`}
                      accessibilityState={{ selected }}
                    >
                      <Text style={[
                        styles.presentationChipWeight,
                        selected && styles.presentationChipWeightSelected,
                        soldOut && !selected && styles.presentationChipTextSoldOut,
                      ]}>
                        {option.weight || 'Estándar'}
                      </Text>
                      <Text style={[
                        styles.presentationChipPrice,
                        selected && styles.presentationChipPriceSelected,
                        soldOut && !selected && styles.presentationChipTextSoldOut,
                      ]}>
                        {soldOut ? 'Agotado' : formatPrice(option.price)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {product.rating && (
            <View style={styles.ratingContainer}>
              <Star size={14} color={colors.accent} fill={colors.accent} />
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
              <Text style={styles.quickInfoLabel}>Disponibilidad</Text>
              <Text style={[
                styles.quickInfoValue,
                availability === 'Últimas unidades' && styles.quickInfoValueWarning,
                availability === 'Sin stock' && styles.quickInfoValueDanger,
              ]}>
                {availability ?? 'Disponible'}
              </Text>
            </View>
            <View style={styles.quickInfoDivider} />
            <View style={styles.quickInfoItem}>
              <Text style={styles.quickInfoLabel}>{quickShippingLabel}</Text>
              <Text style={styles.quickInfoValue}>{quickShippingValue}</Text>
            </View>
          </View>
          
          {/* Store Info */}
          <TouchableOpacity
            style={styles.storeContainer}
            onPress={() => router.push(`/partner/store-products/${partnerInfo?.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Ver todos los productos de ${partnerInfo?.businessName || 'la tienda'}`}
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
              <View style={styles.storeDetails}>
                <Text style={styles.storeName}>{partnerInfo?.businessName || 'Tienda'}</Text>
                {partnerInfo?.businessAddress ? (
                  <View style={styles.storeMetaRow}>
                    <MapPin size={12} color={colors.textSecondary} />
                    <Text style={styles.storeMetaText} numberOfLines={1}>
                      {partnerInfo.businessAddress}
                    </Text>
                  </View>
                ) : null}
                {partnerInfo?.phone ? (
                  <View style={styles.storeMetaRow}>
                    <Phone size={12} color={colors.textSecondary} />
                    <Text style={styles.storeMetaText} numberOfLines={1}>
                      {partnerInfo.phone}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.storeSubtitle}>Ver todos los productos</Text>
              </View>
            </View>
            <ArrowLeft size={16} color={colors.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        </View>

        {/* Shipping and Delivery */}
        <View style={styles.shippingSection}>
          <View style={styles.shippingCard}>
            <Truck size={24} color={colors.success} />
            <View style={styles.shippingInfo}>
              <Text style={styles.shippingTitle}>{shippingTitle}</Text>
              <Text style={styles.shippingSubtitle}>{shippingSubtitle}</Text>
            </View>
          </View>
        </View>

        {/* Quantity and Add to Cart */}
        <View style={styles.purchaseSection}>
          <View style={styles.quantityRow}>
            <Text style={styles.quantityLabel}>Cantidad</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.quantityBtn}
                onPress={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
                accessibilityRole="button"
                accessibilityLabel="Restar una unidad"
                accessibilityState={{ disabled: quantity <= 1 }}
              >
                <Minus size={18} color={quantity <= 1 ? colors.textDisabled : colors.primary} />
              </TouchableOpacity>

              <Text style={styles.quantityValue} accessibilityLabel={`Cantidad: ${quantity}`}>{quantity}</Text>

              <TouchableOpacity
                style={styles.quantityBtn}
                onPress={() => handleQuantityChange(1)}
                disabled={quantity >= (product.stock || 10)}
                accessibilityRole="button"
                accessibilityLabel="Sumar una unidad"
                accessibilityState={{ disabled: quantity >= (product.stock || 10) }}
              >
                <Plus size={18} color={quantity >= (product.stock || 10) ? colors.textDisabled : colors.primary} />
              </TouchableOpacity>
            </View>
            {availability === 'Últimas unidades' ? (
              <Text style={styles.stockIndicator}>Últimas unidades</Text>
            ) : null}
          </View>

          {product.stock > 0 ? (
            <OneTimeTooltip
              hintKey="product_add_to_cart"
              userId={currentUser?.id}
              text="Tip: agregá primero al carrito"
              onHidden={() => setCanShowCartHint(true)}
            >
              <Button
                title="Agregar al carrito"
                onPress={handleAddToCart}
                size="large"
                icon={<ShoppingCart size={20} color={colors.onPrimary} />}
              />
            </OneTimeTooltip>
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
            <Text style={styles.relatedTitle}>Productos relacionados</Text>
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
                  accessibilityRole="button"
                  accessibilityLabel={`${relatedProduct.name}, ${formatPrice(relatedProduct.price)}`}
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

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cartButton: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  skeletonInfo: {
    padding: spacing.lg,
  },
  skeletonGap: {
    marginTop: spacing.md,
  },
  skeletonGapLg: {
    marginTop: spacing.xxl,
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: colors.white,
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
    color: colors.textSecondary,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: colors.danger,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  productImage: {
    width: 400,
    height: 340,
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
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: spacing.xs,
  },
  paginationDotActive: {
    backgroundColor: colors.surface,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  favoriteButton: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  shareButton: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg + touchTarget + spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  presentationsSection: {
    marginBottom: 14,
  },
  presentationsLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  presentationsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  presentationChip: {
    minWidth: 92,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  presentationChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  presentationChipSoldOut: {
    backgroundColor: colors.surfaceAlt,
    borderStyle: 'dashed',
  },
  presentationChipWeight: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  presentationChipWeightSelected: {
    color: colors.primary,
  },
  presentationChipPrice: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  presentationChipPriceSelected: {
    color: colors.primary,
  },
  presentationChipTextSoldOut: {
    color: colors.textSecondary,
  },
  productInfo: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  productName: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
    marginBottom: spacing.md,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  ratingText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.text,
    marginLeft: spacing.xs,
  },
  reviewsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginLeft: spacing.xxs,
  },
  separator: {
    width: 1,
    height: 12,
    backgroundColor: colors.borderStrong,
    marginHorizontal: spacing.sm,
  },
  soldText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  priceSection: {
    marginBottom: spacing.lg,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  originalPriceSmall: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
    marginRight: spacing.sm,
  },
  discountBadgeSmall: {
    backgroundColor: colors.danger,
    paddingHorizontal: 6,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
  },
  discountBadgeSmallText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: colors.white,
  },
  currentPrice: {
    ...typography.display,
    color: colors.text,
  },
  ivaIncluded: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  quickInfo: {
    flexDirection: 'row',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickInfoItem: {
    flex: 1,
  },
  quickInfoLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  quickInfoValue: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: colors.success,
  },
  quickInfoValueWarning: {
    color: colors.warning,
  },
  quickInfoValueDanger: {
    color: colors.danger,
  },
  quickInfoDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  storeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeDetails: {
    flex: 1,
  },
  storeLogo: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    marginRight: spacing.md,
  },
  storeLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  storeLogoText: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: colors.white,
  },
  storeName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  storeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },
  storeMetaText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  storeSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  shippingSection: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  shippingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  shippingInfo: {
    flex: 1,
  },
  shippingTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  shippingSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  purchaseSection: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  quantityLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.text,
    marginRight: spacing.md,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
  },
  quantityBtn: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    paddingHorizontal: spacing.lg,
    minWidth: 40,
    textAlign: 'center',
  },
  stockIndicator: {
    ...typography.captionStrong,
    color: colors.warning,
    marginLeft: spacing.md,
  },
  buyButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.white,
  },
  outOfStockButton: {
    backgroundColor: colors.surfaceAlt,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.textSecondary,
  },
  infoSection: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.text,
  },
  descriptionSection: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  descriptionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 22,
  },
  relatedSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  relatedTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  relatedScroll: {
    paddingLeft: spacing.lg,
  },
  relatedProduct: {
    width: 160,
    marginRight: spacing.md,
  },
  relatedProductImage: {
    width: 160,
    height: 160,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  relatedProductName: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  relatedProductPrice: {
    ...typography.bodyStrong,
    color: colors.text,
  },
});
