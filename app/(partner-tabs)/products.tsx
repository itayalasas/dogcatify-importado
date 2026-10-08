import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, Package, ShoppingBag } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { Card, AppText, IconButton, EmptyState, ScreenHeader, SkeletonList, toast } from '../../components/ui';
import { PartnerProductCard } from '../../components/partner/PartnerProductCard';
import { formatMoney, formatNumber } from '../../components/partner/format';
import { colors, spacing } from '../../constants/theme';
import { OneTimeTooltip } from '../../components/ui/OneTimeTooltip';

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
    router.push({
      pathname: '/partner/edit-product',
      params: {
        partnerId: businessId,
        productId: productId
      }
    });
  };

  const handleToggleProduct = async (productId: string, isActive: boolean) => {
    try {
      // Update local state immediately for instant UI feedback
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === productId ? { ...p, isActive: !isActive } : p
        )
      );

      const { error } = await supabaseClient
        .from('partner_products')
        .update({
          is_active: !isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (error) {
        // Revert local state if database update failed
        setProducts(prevProducts =>
          prevProducts.map(p =>
            p.id === productId ? { ...p, isActive: isActive } : p
          )
        );
        throw error;
      }
    } catch (error) {
      console.error('Error toggling product:', error);
      Alert.alert('Error', 'No se pudo actualizar el producto');
    }
  };

  const handleDeleteProduct = (productId: string) => {
    Alert.alert(
      'Eliminar producto',
      '¿Seguro que querés eliminar este producto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove from local state immediately
              const productToDelete = products.find(p => p.id === productId);
              setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));

              const { error } = await supabaseClient
                .from('partner_products')
                .delete()
                .eq('id', productId);

              if (error) {
                // Restore product if deletion failed
                if (productToDelete) {
                  setProducts(prevProducts => [...prevProducts, productToDelete]);
                }
                throw error;
              }

              toast.success('Producto eliminado');
            } catch (error) {
              console.error('Error deleting product:', error);
              Alert.alert('Error', 'No se pudo eliminar el producto');
            }
          }
        }
      ]
    );
  };

  const headerAddButton = (
    <IconButton
      icon={<Plus size={22} color={colors.onPrimary} />}
      onPress={handleAddProduct}
      variant="filled"
      accessibilityLabel="Agregar producto"
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Gestionar productos" subtitle="Cargando..." />
        <View style={styles.content} testID="loading-container">
          <SkeletonList kind="grid" count={4} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Gestionar productos" />
        <View style={styles.errorContainer} testID="error-container">
          <EmptyState
            icon={<Package size={32} color={colors.danger} />}
            title="No pudimos cargar los productos"
            description={error}
            actionLabel="Reintentar"
            onAction={() => {
              setLoading(true);
              setError(null);
              if (businessId) {
                fetchProducts(businessId);
              }
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!partnerProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader
          title="Gestionar productos"
          subtitle="Cargando información..."
          right={headerAddButton}
        />
        <View style={styles.content}>
          <SkeletonList kind="grid" count={4} />
        </View>
      </SafeAreaView>
    );
  }

  const activeCount = products.filter(p => p.isActive).length;
  const totalStock = products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
  const inventoryValue = products.reduce(
    (sum, p) => sum + ((Number(p.price) || 0) * (Number(p.stock) || 0)),
    0
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <IconButton
            icon={<ArrowLeft size={24} color={colors.text} />}
            onPress={() => router.back()}
            accessibilityLabel="Volver"
          />
          <View style={styles.businessInfo}>
            {partnerProfile.logo ? (
              <Image source={{ uri: partnerProfile.logo }} style={styles.businessLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <ShoppingBag size={20} color={colors.primary} />
              </View>
            )}
            <View style={styles.headerTitles}>
              <AppText variant="heading" numberOfLines={1} accessibilityRole="header">
                Gestionar productos
              </AppText>
              <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                {partnerProfile.businessName}
              </AppText>
            </View>
          </View>
        </View>
        <OneTimeTooltip
          hintKey="partner_products_add_button"
          userId={currentUser?.id}
          text="Tip: cargá tu primer producto acá para empezar a vender"
          placement="bottom"
        >
          {headerAddButton}
        </OneTimeTooltip>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.statsCard}>
          <AppText variant="bodyStrong" style={styles.statsTitle}>
            Resumen de inventario
          </AppText>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <AppText variant="title" color="primary" numberOfLines={1} adjustsFontSizeToFit>
                {formatNumber(products.length)}
              </AppText>
              <AppText variant="caption" color="textSecondary" align="center">
                Productos
              </AppText>
            </View>
            <View style={styles.statItem}>
              <AppText variant="title" color="primary" numberOfLines={1} adjustsFontSizeToFit>
                {formatNumber(activeCount)}
              </AppText>
              <AppText variant="caption" color="textSecondary" align="center">
                Activos
              </AppText>
            </View>
            <View style={styles.statItem}>
              <AppText variant="title" color="primary" numberOfLines={1} adjustsFontSizeToFit>
                {formatNumber(totalStock)}
              </AppText>
              <AppText variant="caption" color="textSecondary" align="center">
                Stock total
              </AppText>
            </View>
          </View>
          <View style={styles.inventoryValue}>
            <AppText variant="caption" color="textSecondary">
              Valor del inventario
            </AppText>
            <AppText variant="heading" color="primary" numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(inventoryValue)}
            </AppText>
          </View>
        </Card>

        {products.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Package size={32} color={colors.primary} />}
              title="Todavía no tenés productos"
              description="Agregá tu primer producto para empezar a vender"
              actionLabel="Agregar producto"
              onAction={handleAddProduct}
            />
          </Card>
        ) : (
          <View style={styles.productsGrid}>
            {products.map((product) => (
              <PartnerProductCard
                key={product.id}
                style={styles.productCard}
                name={product.name}
                category={product.category}
                weight={product.weight}
                price={product.price}
                stock={product.stock}
                imageUrl={product.images && product.images.length > 0 ? product.images[0] : undefined}
                isActive={!!product.isActive}
                onEdit={() => handleEditProduct(product.id)}
                onToggle={() => handleToggleProduct(product.id, product.isActive)}
                onDelete={() => handleDeleteProduct(product.id)}
              />
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
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.xs,
    flex: 1,
  },
  headerTitles: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  businessLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.md,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  contentInner: {
    paddingBottom: spacing.xxxl,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  statsCard: {
    marginBottom: spacing.lg,
  },
  statsTitle: {
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  inventoryValue: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48%',
    marginBottom: spacing.lg,
  },
});
