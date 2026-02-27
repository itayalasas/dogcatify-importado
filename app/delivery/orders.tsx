import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, FlatList } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Truck, CircleCheck as CheckCircle, Clock } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

const AVAILABLE_STATUS = 'ready_for_delivery';
const IN_DELIVERY_STATUS = 'shipped';
const DELIVERED_STATUS = 'delivered';

export default function DeliveryOrdersScreen() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const initialize = async () => {
      try {
        await loadStoreIds();
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id || storeIds.length === 0) {
      setOrders([]);
      return;
    }

    fetchOrders();

    const channel = supabaseClient
      .channel('delivery-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentUser?.id, storeIds.join(','), activeTab]);

  const loadStoreIds = async () => {
    try {
      const { data: profileData, error: profileError } = await supabaseClient
        .from('delivery_profiles')
        .select('id, is_active, approval_status')
        .eq('user_id', currentUser!.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profileData || !profileData.is_active || profileData.approval_status !== 'approved') {
        setStoreIds([]);
        return;
      }

      const { data: storesData, error: storesError } = await supabaseClient
        .from('delivery_profile_stores')
        .select('partner_id')
        .eq('delivery_profile_id', profileData.id);

      if (storesError) throw storesError;

      setStoreIds((storesData || []).map((row: { partner_id: string }) => row.partner_id));
    } catch (error) {
      console.error('Error loading delivery stores:', error);
      Alert.alert('Error', 'No se pudo cargar las tiendas asociadas del repartidor.');
      setStoreIds([]);
    }
  };

  const fetchOrders = async () => {
    if (storeIds.length === 0) {
      setOrders([]);
      return;
    }

    try {
      let query = supabaseClient
        .from('orders')
        .select('id, order_number, partner_id, customer_name, customer_phone, shipping_address, status, total_amount, order_type, created_at, updated_at, delivery_user_id')
        .in('partner_id', storeIds)
        .order('created_at', { ascending: false });

      if (activeTab === 'active') {
        query = query.or(
          `status.eq.${AVAILABLE_STATUS},and(status.eq.${IN_DELIVERY_STATUS},delivery_user_id.eq.${currentUser!.id})`
        );
      } else {
        query = query
          .eq('status', DELIVERED_STATUS)
          .eq('delivery_user_id', currentUser!.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading delivery orders:', error);
      Alert.alert('Error', 'No se pudieron cargar los pedidos de reparto.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Confirmado';
      case 'processing':
        return 'En proceso';
      case 'preparing':
        return 'Preparando';
      case 'ready_for_delivery':
        return 'Listo para entrega';
      case 'reserved':
        return 'Reservado';
      case 'shipped':
        return 'En reparto';
      case 'delivered':
        return 'Entregado';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount || 0);
  };

  const getNextStatus = (status: string): 'shipped' | 'delivered' | null => {
    if (status === AVAILABLE_STATUS) {
      return 'shipped';
    }

    if (status === IN_DELIVERY_STATUS) {
      return 'delivered';
    }

    return null;
  };

  const getNextStatusLabel = (nextStatus: 'shipped' | 'delivered' | null) => {
    if (nextStatus === 'shipped') return 'Marcar En reparto';
    if (nextStatus === 'delivered') return 'Marcar Entregado';
    return '';
  };

  const handleUpdateStatus = async (orderId: string, newStatus: 'shipped' | 'delivered') => {
    try {
      setUpdatingOrderId(orderId);

      const { error } = await supabaseClient
        .from('orders')
        .update({
          status: newStatus,
          delivery_user_id: currentUser!.id,
          delivery_started_at: newStatus === 'shipped' ? new Date().toISOString() : undefined,
          delivered_at: newStatus === 'delivered' ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .in('partner_id', storeIds);

      if (error) throw error;

      await fetchOrders();
    } catch (error) {
      console.error('Error updating order status from delivery:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado del pedido.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const emptyMessage = useMemo(() => {
    if (storeIds.length === 0) {
      return 'No tienes tiendas asociadas. Configura tu perfil de repartidor para ver pedidos.';
    }

    return activeTab === 'active'
      ? 'No hay pedidos listos para entrega o en reparto.'
      : 'No hay pedidos entregados por este repartidor.';
  }, [storeIds.length, activeTab]);

  if (loading) {
    return <LoadingScreen message="Cargando pedidos de reparto..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Pedidos de Reparto</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'active' && styles.tabButtonActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>Activos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'completed' && styles.tabButtonActive]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>Completados</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={orders.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        renderItem={({ item }) => {
          const nextStatus = getNextStatus(item.status);
          return (
            <Card style={styles.orderCard}>
              <View style={styles.orderTopRow}>
                <View>
                  <Text style={styles.orderNumber}>Pedido {item.order_number || `#${item.id.slice(-6)}`}</Text>
                  <Text style={styles.orderDate}>{new Date(item.created_at).toLocaleString('es-AR')}</Text>
                </View>
                <View style={styles.statusPill}>
                  <Clock size={12} color="#2D6A6F" />
                  <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Truck size={14} color="#6B7280" />
                <Text style={styles.detailText} numberOfLines={1}>{item.shipping_address || 'Sin dirección'}</Text>
              </View>

              <View style={styles.detailRow}>
                <CheckCircle size={14} color="#6B7280" />
                <Text style={styles.detailText}>
                  Cliente: {item.customer_name || 'Sin nombre'} · Total: {formatCurrency(item.total_amount || 0)}
                </Text>
              </View>

              {nextStatus && activeTab === 'active' && (
                <Button
                  title={updatingOrderId === item.id ? 'Actualizando...' : getNextStatusLabel(nextStatus)}
                  onPress={() => handleUpdateStatus(item.id, nextStatus)}
                  disabled={updatingOrderId === item.id}
                  size="large"
                  style={styles.actionButton}
                />
              )}
            </Card>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>{emptyMessage}</Text>}
      />
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
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  placeholder: {
    width: 28,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#2D6A6F',
    borderColor: '#2D6A6F',
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 10,
  },
  orderCard: {
    marginBottom: 10,
    padding: 14,
  },
  orderTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  orderNumber: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  orderDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#E0F2F1',
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#2D6A6F',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  detailText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  actionButton: {
    marginTop: 8,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
});
