import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, Package, DollarSign, CreditCard as Edit, Trash2, ShoppingBag } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

// Función para mostrar mensaje de depuración con timestamp
const logDebug = (message: string, data?: any) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[DEBUG Products ${timestamp}] ${message}`, data || '');
};

export default function PartnerProducts() {
  const params = useLocalSearchParams<{ businessId?: string }>();
  const businessId = params.businessId;
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);

  useEffect(() => {
    if (!currentUser || !businessId) return;

    logDebug('Loading products for partner ID:', businessId as string);
    setError(null);

    // Get partner profile using the specific partnerId
    const fetchPartnerProfile = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('partners')
          .select('*')
          .eq('id', businessId)
          .single();
        
        if (error) {
          console.error('Error fetching partner profile:', error);
          setLoading(false);
          return;
        }
        
        if (data) {
          const partnerData = { 
            id: data.id, 
            businessName: data.business_name,
            businessType: data.business_type,
            logo: data.logo,
            ...data 
          };
          logDebug('Partner profile loaded:', partnerData.businessName);
          setPartnerProfile(partnerData);
          
          // Asegurarse de que el perfil se cargó antes de buscar productos
          fetchProducts(businessId as string);
        }
      } catch (err) {
        console.error('Error fetching partner profile:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPartnerProfile();

    // Set up real-time subscription
    const subscription = supabaseClient
      .channel('partner-profile-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'partners',
          filter: `id=eq.${businessId}`
        }, 
        () => {
          fetchPartnerProfile();
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [currentUser, businessId]);

  const fetchProducts = (partnerId: string) => {
    logDebug('Fetching products for partnerId:', partnerId);
    setError(null);
    
    try {
      // Fetch products using Supabase
      const fetchProductsData = async () => {
        const { data, error } = await supabaseClient
          .from('partner_products')
          .select('*')
          .eq('partner_id', partnerId);
          
        if (error) {
          console.error('Error fetching products:', error);
          setError('Error al cargar los productos: ' + error.message);
          setLoading(false);
          return;
        }
        
        logDebug('Products data received, count:', data?.length || 0);
        
        if (!data || data.length === 0) {
          logDebug('No products found for this partner');
        }
        
        const productsData = data?.map(product => ({
          id: product.id,
          name: product.name,
          description: product.description,
          category: product.category,
          price: product.price,
          stock: product.stock,
          brand: product.brand,
          weight: product.weight,
          size: product.size,
          color: product.color,
          ageRange: product.age_range,
          petType: product.pet_type,
          images: product.images,
          isActive: product.is_active,
          partnerId: product.partner_id,
          partnerName: product.partner_name,
          createdAt: new Date(product.created_at)
        })) || [];
        
        setProducts(productsData);
        setLoading(false);
      };
      
      fetchProductsData();
      
      // Set up real-time subscription
      const subscription = supabaseClient
        .channel('products-changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'partner_products',
            filter: `partner_id=eq.${partnerId}`
          }, 
          () => {
            fetchProductsData();
          }
        )
        .subscribe();
      
      return () => {
        subscription.unsubscribe();
      };
    } catch (err: any) {
      console.error('Error setting up products listener:', err);
      setError('Error al configurar el listener de productos: ' + err.message);
      setLoading(false);
      return () => {};
    }
  };

  const handleAddProduct = () => {
    if (!partnerProfile) return;
    router.push({
      pathname: '/partner/add-service',
      params: {
        partnerId: businessId,
        businessType: 'shop'
      }
    });
  };

  const handleEditProduct = (productId: string) => {
    Alert.alert('Editar producto', 'Esta funcionalidad estará disponible próximamente');
    // router.push({
    //   pathname: '/partner/edit-product',
    //   params: {
    //     partnerId: businessId,
    //     productId: productId
    //   }
    // });
  };

  const handleToggleProduct = async (productId: string, isActive: boolean) => {
    try {
      const { error } = await supabaseClient
        .from('partner_products')
        .update({
          is_active: !isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error toggling product:', error);
      Alert.alert('Error', 'No se pudo actualizar el producto');
    }
  };

  const handleDeleteProduct = (productId: string) => {
    Alert.alert(
      'Eliminar Producto',
      '¿Estás seguro de que quieres eliminar este producto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabaseClient
                .from('partner_products')
                .delete()
                .eq('id', productId);
              
              if (error) throw error;
              
              Alert.alert('Éxito', 'Producto eliminado correctamente');
            } catch (error) {
              console.error('Error deleting product:', error);
              Alert.alert('Error', 'No se pudo eliminar el producto');
            }
          } 
        }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer} testID="loading-container">
          <Text style={styles.loadingText}>Cargando productos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color="#111827" />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>Error</Text>
            </View>
          </View>
        </View>
        <View style={styles.errorContainer} testID="error-container">
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Reintentar"
            onPress={() => {
              setLoading(true);
              setError(null);
              if (businessId) {
                fetchProducts(businessId);
              }
            }}
            size="medium"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!partnerProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color="#111827" />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>Gestionar Productos</Text>
              <Text style={styles.businessName}>Cargando información...</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleAddProduct}>
            <Plus size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando información del negocio...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <View style={styles.businessInfo}>
            {partnerProfile.logo ? (
              <Image source={{ uri: partnerProfile.logo }} style={styles.businessLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>🛍️</Text>
              </View>
            )}
            <View>
              <Text style={styles.title}>Gestionar Productos</Text>
              <Text style={styles.businessName}>{partnerProfile.businessName}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={handleAddProduct}
        >
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>📊 Resumen de Inventario</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{products.length}</Text>
              <Text style={styles.statLabel}>Total Productos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {products.filter(p => p.isActive).length}
              </Text>
              <Text style={styles.statLabel}>Activos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {products.reduce((sum, p) => sum + (p.stock || 0), 0)}
              </Text>
              <Text style={styles.statLabel}>Stock Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                ${products.reduce((sum, p) => sum + (p.price || 0), 0).toFixed(0)}
              </Text>
              <Text style={styles.statLabel}>Valor Inventario</Text>
            </View>
          </View>
        </Card>

        {products.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Package size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No hay productos</Text>
            <Text style={styles.emptySubtitle}>
              Agrega tu primer producto para comenzar a vender
            </Text>
            <Button
              title="Agregar Producto"
              onPress={handleAddProduct}
              size="medium"
            />
          </Card>
        ) : (
          <View style={styles.productsGrid}>
            {products.map((product) => (
              <Card key={product.id} style={styles.productCard}>
                {product.images && product.images.length > 0 && (
                  <Image source={{ uri: product.images[0] }} style={styles.productImage} />
                )}
                
                <View style={styles.productContent}>
                  <View style={styles.productHeader}>
                    <Text style={styles.productPrice}> 
                      ${product.price?.toLocaleString() || 0} 
                    </Text>
                    <View style={[
                      styles.productStatus,
                      { backgroundColor: product.isActive ? '#D1FAE5' : '#FEE2E2' }
                    ]}>
                      <Text style={[
                        styles.productStatusText,
                        { color: product.isActive ? '#065F46' : '#991B1B' }
                      ]}>
                        {product.isActive ? 'Activo' : 'Inactivo'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.productCategory}>{product.category}</Text>
                  
                  <View style={styles.productDetails}>
                    <View style={styles.productDetail}>
                      <DollarSign size={16} color="#10B981" />
                      <Text style={styles.productPrice}>
                        ${product.price?.toLocaleString() || 0}
                      </Text>
                    </View>
                    
                    <View style={styles.productDetail}>
                      <Package size={16} color="#6B7280" />
                      <Text style={styles.productStock}>
                        Stock: {product.stock || 0} 
                      </Text>
                    </View>
                  </View>

                  <View style={styles.productActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleEditProduct(product.id)}
                    >
                      <Edit size={16} color="#3B82F6" /> 
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: product.isActive ? '#FEE2E2' : '#D1FAE5' }]}
                      onPress={() => handleToggleProduct(product.id, product.isActive)}
                    > 
                      <Text style={[
                        styles.actionButtonText,
                        { color: product.isActive ? '#991B1B' : '#065F46' }
                      ]}>
                        {product.isActive ? 'Desactivar' : 'Activar'}
                      </Text>
                    </TouchableOpacity> 
                    
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#FEE2E2' }]}
                      onPress={() => handleDeleteProduct(product.id)}
                    >
                      <Trash2 size={16} color="#991B1B" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))}
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
    padding: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  businessLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoPlaceholderText: {
    fontSize: 20,
  },
  businessName: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#10B981',
    padding: 8,
    borderRadius: 20, 
  },
  content: {
    flex: 1,
    padding: 16,
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
  debugText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  debugTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  debugCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
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
  statsCard: {
    marginBottom: 16,
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
    color: '#10B981',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyCard: {
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
    marginBottom: 20,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48%',
    marginBottom: 16,
    padding: 0,
  },
  productImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 16, 
    borderTopRightRadius: 16,
  },
  productContent: {
    padding: 12,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  productName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827', 
    flex: 1,
    marginRight: 8,
  },
  productStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  productStatusText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
  },
  productCategory: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280', 
    marginBottom: 8,
  },
  productDetails: {
    marginBottom: 12,
  },
  productDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#10B981', 
    marginLeft: 4,
  },
  productStock: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  productActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', 
  },
  actionButton: {
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 32,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
  }, 
});