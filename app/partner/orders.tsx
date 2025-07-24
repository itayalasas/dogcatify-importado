import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Package, DollarSign, Truck, Clock, MapPin, User, Phone } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

export default function PartnerOrders() {
  const { partnerId } = useLocalSearchParams<{ partnerId: string }>();
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'processing' | 'completed'>('pending');
  const [loading, setLoading] = useState(true);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);

  useEffect(() => {
    if (!currentUser || !partnerId) return;

    console.log('Loading orders for partner ID:', partnerId as string);

    // Get partner profile using Supabase
    const fetchPartnerProfile = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('partners')
          .select('*')
          .eq('id', partnerId)
          .single();
        
        if (error) throw error;
        
        if (data) {
          setPartnerProfile({
            id: data.id,
            businessName: data.business_name,
            businessType: data.business_type,
            ...data
          });
          fetchOrders(partnerId as string);
        }
      } catch (error) {
        console.error('Error fetching partner profile:', error);
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
          filter: `id=eq.${partnerId}`
        }, 
        () => {
          fetchPartnerProfile();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUser, partnerId]);

  const fetchOrders = (partnerId: string) => {
    const fetchOrdersData = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('orders')
          .select('*')
          .eq('partner_id', partnerId)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const ordersData = data.map(order => ({
          id: order.id,
          ...order,
          partnerId: order.partner_id,
          customerId: order.customer_id,
          totalAmount: order.total_amount,
          shippingAddress: order.shipping_address,
          createdAt: new Date(order.created_at),
          updatedAt: order.updated_at ? new Date(order.updated_at) : null
        }));
        
        setOrders(ordersData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching orders:', error);
        setLoading(false);
      }
    };
    
    fetchOrdersData();
    
    // Set up real-time subscription
    const subscription = supabaseClient
      .channel('orders-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `partner_id=eq.${partnerId}`
        }, 
        () => {
          fetchOrdersData();
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabaseClient
        .from('orders')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      
      if (error) throw error;
      
      const statusMessages = {
        processing: 'Pedido en procesamiento',
        shipped: 'Pedido enviado',
        delivered: 'Pedido entregado',
        cancelled: 'Pedido cancelado'
      };
      
      Alert.alert('Éxito', statusMessages[newStatus as keyof typeof statusMessages]);
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'No se pudo actualizar el pedido');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FEF3C7';
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
      case 'processing': return 'En proceso';
      case 'shipped': return 'Enviado';
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      default: return 'Desconocido';
    }
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'pending') return order.status === 'pending';
    if (activeTab === 'processing') return order.status === 'processing' || order.status === 'shipped';
    return order.status === 'delivered' || order.status === 'cancelled';
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  const renderOrder = (order: any) => (
    <Card key={order.id} style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>Pedido #{order.id.slice(-6)}</Text>
          <Text style={styles.customerName}>
            {order.customerName || 'Cliente'}
          </Text>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(order.status) }
        ]}>
          <Text style={[
            styles.statusText,
            { color: getStatusTextColor(order.status) }
          ]}>
            {getStatusText(order.status)}
          </Text>
        </View>
      </View>

      <View style={styles.orderItems}>
        <Text style={styles.itemsTitle}>Productos:</Text>
        {order.items && order.items.map((item: any, index: number) => (
          <View key={index} style={styles.orderItem}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemQuantity}>x{item.quantity}</Text>
            </View>
            <Text style={styles.itemPrice}>{formatCurrency(item.price * item.quantity)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.orderDetail}>
          <Clock size={16} color="#6B7280" />
          <Text style={styles.orderDetailText}>
            {order.createdAt.toLocaleDateString()} {order.createdAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </Text>
        </View>
        
        {order.shippingAddress && (
          <View style={styles.orderDetail}>
            <MapPin size={16} color="#6B7280" />
            <Text style={styles.orderDetailText}>
              {order.shippingAddress}
            </Text>
          </View>
        )}
        
        {order.customerPhone && (
          <View style={styles.orderDetail}>
            <Phone size={16} color="#6B7280" />
            <Text style={styles.orderDetailText}>
              {order.customerPhone}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.orderTotal}>
        <Text style={styles.totalLabel}>Total:</Text>
        <Text style={styles.totalAmount}>{formatCurrency(order.totalAmount)}</Text>
      </View>

      <View style={styles.orderActions}>
        {order.status === 'pending' && (
          <>
            <Button
              title="Cancelar"
              onPress={() => handleUpdateOrderStatus(order.id, 'cancelled')}
              variant="outline"
              size="small"
            />
            <Button
              title="Procesar"
              onPress={() => handleUpdateOrderStatus(order.id, 'processing')}
              size="small"
            />
          </>
        )}
        
        {order.status === 'processing' && (
          <Button
            title="Marcar como Enviado"
            onPress={() => handleUpdateOrderStatus(order.id, 'shipped')}
            size="small"
          />
        )}
        
        {order.status === 'shipped' && (
          <Button
            title="Marcar como Entregado"
            onPress={() => handleUpdateOrderStatus(order.id, 'delivered')}
            size="small"
          />
        )}
      </View>
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando pedidos...</Text>
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
              <Text style={styles.title}>Gestionar Pedidos</Text>
              <Text style={styles.businessName}>Cargando información...</Text>
            </View>
          </View>
          <View style={styles.placeholder} />
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
              <Text style={styles.title}>Gestionar Pedidos</Text>
              <Text style={styles.businessName}>{partnerProfile.businessName}</Text>
            </View>
          </View>
        </View>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pendientes ({orders.filter(o => o.status === 'pending').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'processing' && styles.activeTab]}
          onPress={() => setActiveTab('processing')}
        >
          <Text style={[styles.tabText, activeTab === 'processing' && styles.activeTabText]}>
            En Proceso ({orders.filter(o => o.status === 'processing' || o.status === 'shipped').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completados ({orders.filter(o => o.status === 'delivered' || o.status === 'cancelled').length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>📊 Resumen de Pedidos</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{orders.length}</Text>
              <Text style={styles.statLabel}>Total Pedidos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {orders.filter(o => o.status === 'pending').length}
              </Text>
              <Text style={styles.statLabel}>Pendientes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {orders.filter(o => o.status === 'delivered').length}
              </Text>
              <Text style={styles.statLabel}>Entregados</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {formatCurrency(orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0))}
              </Text>
              <Text style={styles.statLabel}>Ingresos</Text>
            </View>
          </View>
        </Card>

        {filteredOrders.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Package size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No hay pedidos {activeTab === 'pending' ? 'pendientes' : activeTab === 'processing' ? 'en proceso' : 'completados'}</Text>
            <Text style={styles.emptySubtitle}>
              Los pedidos aparecerán aquí cuando los clientes realicen compras
            </Text>
          </Card>
        ) : (
          filteredOrders.map(renderOrder)
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
  placeholder: {
    width: 32,
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
    fontSize: 12,
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
    color: '#3B82F6',
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
  customerName: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
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
    marginBottom: 8,
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
  orderDetails: {
    marginBottom: 12,
  },
  orderDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginLeft: 6,
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
    gap: 12,
  },
});