import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, Package, DollarSign, CreditCard as Edit, Trash2 } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

export default function ManageProducts() {
  const { partnerId } = useLocalSearchParams<{ partnerId: string }>();
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partnerId) return;

    const productsQuery = query(
      collection(db, 'partnerProducts'),
      where('partnerId', '==', partnerId)
    );

    const unsubscribe = onSnapshot(productsQuery, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));
      setProducts(productsData);
      setLoading(false);
    });

    return unsubscribe;
  }, [partnerId]);

  const handleAddProduct = () => {
    router.push(`/partner/add-service?partnerId=${partnerId}&businessType=shop`);
  };

  const handleEditProduct = (productId: string) => {
    router.push(`/partner/edit-product?partnerId=${partnerId}&productId=${productId}`);
  };

  const handleToggleProduct = async (productId: string, isActive: boolean) => {
    try {
      const productRef = doc(db, 'partnerProducts', productId);
      await updateDoc(productRef, {
        isActive: !isActive,
        updatedAt: new Date(),
      });
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
              await deleteDoc(doc(db, 'partnerProducts', productId));
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
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando productos...</Text>
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
        <Text style={styles.title}>Gestionar Productos</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddProduct}>
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
                    <Text style={styles.productName} numberOfLines={2}>
                      {product.name}
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
                        ${product.price?.toLocaleString()}
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
  statsCard: {
    margin: 16,
    marginBottom: 8,
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
    marginHorizontal: 16,
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
    paddingHorizontal: 8,
  },
  productCard: {
    width: '48%',
    margin: 8,
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