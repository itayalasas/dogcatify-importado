import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ShoppingCart, Star, Plus, Minus, Heart, Share2, Truck, Package, Clock } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { useCart } from '@/contexts/CartContext';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<any>(null);
  const [partnerInfo, setPartnerInfo] = useState<any>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    fetchProductDetails();
  }, [id]);

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
          const { data: userData, error: userError } = await supabaseClient
            .from('profiles')
            .select('favorite_products')
            .eq('id', currentUser.id)
            .single();
            
          if (userData && !userError) {
            setIsFavorite(userData.favorite_products?.includes(productData.id) || false);
          }
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
    
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: quantity,
      image: product.images && product.images.length > 0 ? product.images[0] : null,
      partnerId: product.partnerId,
      partnerName: partnerInfo?.businessName || 'Tienda'
    });
    
    Alert.alert('Producto agregado', 'El producto se agregó al carrito correctamente');
  };

  const handleToggleFavorite = async () => {
    if (!currentUser) {
      Alert.alert('Iniciar sesión', 'Debes iniciar sesión para guardar favoritos');
      return;
    }
    
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
    } catch (error) {
      console.error('Error updating favorites:', error);
      Alert.alert('Error', 'No se pudo actualizar los favoritos');
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
          <Text style={styles.loadingText}>Cargando detalles del producto...</Text>
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
          >
            <Heart 
              size={20} 
              color={isFavorite ? '#EF4444' : '#6B7280'} 
              fill={isFavorite ? '#EF4444' : 'none'}
            />
          </TouchableOpacity>
          
          {/* Share Button */}
          <TouchableOpacity style={styles.shareButton}>
            <Share2 size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <Text style={styles.category}>{product.category}</Text>
          <Text style={styles.productName}>{product.name}</Text>
          
          {product.rating && (
            <View style={styles.ratingContainer}>
              <Star size={16} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.ratingText}>{product.rating}</Text>
              <Text style={styles.reviewsText}>
                ({product.reviews || 0} reseñas)
              </Text>
            </View>
          )}
          
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
          
          {/* Store Info */}
          <TouchableOpacity 
            style={styles.storeContainer}
            onPress={() => router.push(`/services/partner/${partnerInfo?.id}`)}
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

        {/* Product Details */}
        <Card style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Detalles del Producto</Text>
          
          <Text style={styles.description}>
            {product.description || 'No hay descripción disponible para este producto.'}
          </Text>
          
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Package size={16} color="#6B7280" />
              <Text style={styles.detailLabel}>Stock:</Text>
              <Text style={styles.detailValue}>{product.stock || 'No disponible'}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Truck size={16} color="#6B7280" />
              <Text style={styles.detailLabel}>Envío:</Text>
              <Text style={styles.detailValue}>Disponible</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Clock size={16} color="#6B7280" />
              <Text style={styles.detailLabel}>Entrega:</Text>
              <Text style={styles.detailValue}>24-48 horas</Text>
            </View>
          </View>
        </Card>

        {/* Quantity Selector */}
        <Card style={styles.quantityCard}>
          <Text style={styles.quantityTitle}>Cantidad</Text>
          <View style={styles.quantitySelector}>
            <TouchableOpacity 
              style={styles.quantityButton}
              onPress={() => handleQuantityChange(-1)}
              disabled={quantity <= 1}
            >
              <Minus size={20} color={quantity <= 1 ? '#D1D5DB' : '#111827'} />
            </TouchableOpacity>
            
            <Text style={styles.quantityText}>{quantity}</Text>
            
            <TouchableOpacity 
              style={styles.quantityButton}
              onPress={() => handleQuantityChange(1)}
              disabled={quantity >= (product.stock || 10)}
            >
              <Plus size={20} color={quantity >= (product.stock || 10) ? '#D1D5DB' : '#111827'} />
            </TouchableOpacity>
          </View>
        </Card>

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

        {/* Add to Cart Button */}
        <View style={styles.addToCartContainer}>
          <Button
            title="Agregar al Carrito"
            onPress={handleAddToCart}
            size="large"
          />
        </View>
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
  },
  productImage: {
    width: 400,
    height: 400,
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
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
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
    borderBottomColor: '#F3F4F6',
  },
  category: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginBottom: 4,
  },
  productName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginLeft: 4,
  },
  reviewsText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  price: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
    marginBottom: 16,
  },
  storeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
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
  detailsCard: {
    margin: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
    marginBottom: 16,
  },
  detailsGrid: {
    marginTop: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginLeft: 8,
    width: 80,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    flex: 1,
  },
  quantityCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  quantityTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginHorizontal: 16,
    minWidth: 30,
    textAlign: 'center',
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
  addToCartContainer: {
    padding: 16,
    paddingBottom: 32,
  },
});