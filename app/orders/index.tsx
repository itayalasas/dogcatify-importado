import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Package, Clock, Truck, CircleCheck as CheckCircle, Circle as XCircle, MapPin, Phone, Star } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

export default function MyOrders() {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      router.replace('/auth/login');
      return;
    }
    
    fetchOrders();
  }, [currentUser]);

  const fetchOrders = async () => {
    if (!currentUser) return;
    
    try {
      const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('customer_id', currentUser.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const ordersData = data?.map(order => ({
        id: order.id,
        partnerId: order.partner_id,
        customerId: order.customer_id,
        items: order.items || [],
        status: order.status || 'pending',
        totalAmount: order.total_amount || 0,
        shippingAddress: order.shipping_address || '',
        createdAt: new Date(order.created_at),
        updatedAt: order.updated_at ? new Date(order.updated_at) : null
      })) || [];
      
      setOrders(ordersData);
    } catch (error) {
      console.error('Error fetching orders:', error);
      Alert.alert('Error', 'No se pudieron cargar los pedidos');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FEF3C7';
      case 'confirmed': return '#DBEAFE';
      case 'processing': return '#DBEAFE';
      case 'shipped': return '#D1FAE5';
      case 'delivered': return '#D1FAE5';
      case 'cancelled': return '#FEE2E2';
      default: return '#F3F4F6';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'pending': return '#92400E';
      case 'confirmed': return '#1E40AF';
      case 'processing': return '#1E40AF';
      case 'shipped': return '#065F46';
      case 'delivered': return '#065F46';
      case 'cancelled': return '#991B1B';
      default: return '#374151';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'confirmed': return 'Confirmado';
      case 'processing': return 'En proceso';
      case 'shipped': return 'Enviado';
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      default: return 'Desconocido';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={16} color="#92400E" />;
      case 'confirmed': return <CheckCircle size={16} color="#1E40AF" />;
      case 'processing': return <Package size={16} color="#1E40AF" />;
      case 'shipped': return <Truck size={16} color="#065F46" />;
      case 'delivered': return <CheckCircle size={16} color="#065F46" />;
      case 'cancelled': return <XCircle size={16} color="#991B1B" />;
      default: return <Clock size={16} color="#374151" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'active') {
      return ['pending', 'confirmed', 'processing', 'shipped'].includes(order.status);
    } else {
      return ['delivered', 'cancelled'].includes(order.status);
    }
  });

  const handleReorder = (order: any) => {
    // Add items back to cart
    Alert.alert(
      'Reordenar',
      '¿Quieres agregar estos productos al carrito nuevamente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, agregar',
          onPress: () => {
            // Here you would add the items back to cart
            Alert.alert('Productos agregados', 'Los productos se han agregado al carrito');
          }
        }
      ]
    );
  };

  const handleTrackOrder = (order: any) => {
    Alert.alert(
      'Seguimiento de Pedido',
      `Pedido #${order.id.slice(-6)}\nEstado: ${getStatusText(order.status)}\nFecha: ${order.createdAt.toLocaleDateString()}`
    );
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contactar Soporte',
      'Puedes contactarnos por:\n\n📧 Email: soporte@dogcatify.com\n📱 WhatsApp: +54 11 1234-5678',
      [{ text: 'Entendido' }]
    );
  };

  const renderOrder = (order: any) => (
    <Card key={order.id} style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>Pedido #{order.id.slice(-6)}</Text>
          <Text style={styles.orderDate}>
            {order.createdAt.toLocaleDateString()}
          </Text>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(order.status) }
        ]}>
          {getStatusIcon(order.status)}
          <Text style={[
            styles.statusText,
            { color: getStatusTextColor(order.status) }
          ]}>
            {getStatusText(order.status)}
          </Text>
        </View>
      </View>

      <View style={styles.orderItems}>
        <Text style={styles.itemsTitle}>Productos ({order.items.length}):</Text>
        {order.items.slice(0, 2).map((item: any, index: number) => (
          <View key={index} style={styles.orderItem}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name || 'Producto'}</Text>
              <Text style={styles.itemQuantity}>x{item.quantity || 1}</Text>
            </View>
            <Text style={styles.itemPrice}>
              {formatCurrency((item.price || 0) * (item.quantity || 1))}
            </Text>
          </View>
        ))}
        {order.items.length > 2 && (
          <Text style={styles.moreItems}>
            +{order.items.length - 2} producto{order.items.length - 2 !== 1 ? 's' : ''} más
          </Text>
        )}
      </View>

      {order.shippingAddress && (
        <View style={styles.shippingInfo}>
          <MapPin size={16} color="#6B7280" />
          <Text style={styles.shippingAddress}>{order.shippingAddress}</Text>
        </View>
      )}

      <View style={styles.orderTotal}>
        <Text style={styles.totalLabel}>Total:</Text>
        <Text style={styles.totalAmount}>{formatCurrency(order.totalAmount)}</Text>
      </View>

      <View style={styles.orderActions}>
        {order.status === 'delivered' && (
          <Button
            title="Reordenar"
            onPress={() => handleReorder(order)}
            variant="outline"
            size="small"
          />
        )}
        {['pending', 'confirmed', 'processing', 'shipped'].includes(order.status) && (
          <Button
            title="Rastrear"
            onPress={() => handleTrackOrder(order)}
            variant="outline"
            size="small"
          />
        )}
        <Button
          title="Ver Detalles"
          onPress={() => router.push(`/orders/${order.id}`)}
          size="small"
        />
      </View>
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Mis Pedidos</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando pedidos...</Text>
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
        <Text style={styles.title}>Mis Pedidos</Text>
        <TouchableOpacity onPress={handleContactSupport} style={styles.supportButton}>
          <Phone size={20} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Activos ({orders.filter(o => ['pending', 'confirmed', 'processing', 'shipped'].includes(o.status)).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completados ({orders.filter(o => ['delivered', 'cancelled'].includes(o.status)).length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {orders.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Package size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No tienes pedidos</Text>
            <Text style={styles.emptySubtitle}>
              Cuando realices compras en la tienda, aparecerán aquí
            </Text>
            <Button
              title="Ir a la Tienda"
              onPress={() => router.push('/(tabs)/shop')}
              size="large"
            />
          </Card>
        ) : filteredOrders.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Package size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>
              No hay pedidos {activeTab === 'active' ? 'activos' : 'completados'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'active' 
                ? 'Tus pedidos en proceso aparecerán aquí'
                : 'Tus pedidos entregados y cancelados aparecerán aquí'
              }
            </Text>
          </Card>
        ) : (
          <View style={styles.ordersList}>
            {filteredOrders.map(renderOrder)}
          </View>
        )}

        {/* Quick Actions */}
        <Card style={styles.quickActionsCard}>
          <Text style={styles.quickActionsTitle}>Acciones Rápidas</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => router.push('/(tabs)/shop')}
            >
              <Package size={24} color="#3B82F6" />
              <Text style={styles.quickActionText}>Ir a Tienda</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={handleContactSupport}
            >
              <Phone size={24} color="#10B981" />
              <Text style={styles.quickActionText}>Soporte</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => router.push('/cart')}
            >
              <Package size={24} color="#F59E0B" />
              <Text style={styles.quickActionText}>Mi Carrito</Text>
            </TouchableOpacity>
          </View>
        </Card>
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
  supportButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3B82F6',
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
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  ordersList: {
    marginBottom: 16,
  },
  orderCard: {
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  orderDate: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    marginLeft: 4,
  },
  orderItems: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  itemsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    flex: 1,
  },
  itemQuantity: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginLeft: 8,
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  moreItems: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  shippingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  shippingAddress: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 6,
    flex: 1,
  },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  totalAmount: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  orderActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  quickActionsCard: {
    marginTop: 8,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickAction: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  quickActionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
  },
});