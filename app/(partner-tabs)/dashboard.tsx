import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Image, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, DollarSign, Users, Package, TrendingUp, Clock } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext'; 
import { supabaseClient } from '../../lib/supabase';

interface DashboardStats {
  todayBookings: number;
  todayRevenue: number;
  totalCustomers: number;
  activeProducts: number;
  pendingBookings: number;
  pendingOrders: number;
  processingOrders: number;
  completedBookings: number;
  completedOrders: number;
  monthlyRevenue: number;
  averageRating: number;
}

export default function PartnerDashboard() {
  const { businessId } = useLocalSearchParams<{ businessId?: string }>();
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    todayBookings: 0,
    todayRevenue: 0,
    totalCustomers: 0,
    activeProducts: 0,
    pendingBookings: 0,
    pendingOrders: 0,
    processingOrders: 0,
    completedBookings: 0,
    completedOrders: 0,
    monthlyRevenue: 0,
    averageRating: 0,
  });
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.id || !businessId) {
      setLoading(false);
      console.log('Dashboard - Missing currentUser or businessId:', businessId);
      return;
    }

    // Use specific business ID from params
    console.log('Loading dashboard for specific business ID:', businessId as string);
    
    const fetchPartnerProfile = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('partners')
          .select('*')
          .eq('id', businessId)
          .single();
        
        if (error) throw error;
        
        if (data) {
          const partnerData = {
            id: data.id,
            businessName: data.business_name,
            businessType: data.business_type,
            logo: data.logo,
            isVerified: data.is_verified,
            isActive: data.is_active,
            ...data
          };
          
          setPartnerProfile(partnerData);
          fetchDashboardData(partnerData.id);
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

  const fetchDashboardData = async (partnerId: string) => {
    try {
      console.log('Fetching dashboard data for partner ID:', partnerId);
      
      // Get today's date range for filtering
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      // Fetch bookings
      const { data: bookingsData, error: bookingsError } = await supabaseClient
        .from('bookings')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      
      if (bookingsError) throw bookingsError;
      
      const bookings = bookingsData || [];
      console.log(`Found ${bookings.length} total bookings for partner`);
      
      // Calculate stats
      const todayBookings = bookings.filter(booking => {
        const bookingDate = new Date(booking.date);
        return bookingDate >= startOfDay && bookingDate < endOfDay;
      });
      
      const pendingBookings = bookings.filter(booking => booking.status === 'pending');
      const completedBookings = bookings.filter(booking => booking.status === 'completed');
      
      const todayRevenue = todayBookings.reduce((sum, booking) => sum + (booking.total_amount || 0), 0);
      console.log(`Today's stats: ${todayBookings.length} bookings, $${todayRevenue} revenue`);
      
      // Get recent bookings
      const recent = bookings
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
      
      setRecentBookings(recent);
      
      // Fetch orders data
      const { data: ordersData, error: ordersError } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      
      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
      }
      
      const orders = ordersData || [];
      console.log(`Found ${orders.length} total orders for partner`);
      
      // Calculate order stats
      const todayOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= startOfDay && orderDate < endOfDay;
      });
      
      const pendingOrders = orders.filter(order => order.status === 'pending');
      const completedOrders = orders.filter(order => order.status === 'delivered');
      const processingOrders = orders.filter(order => ['confirmed', 'processing', 'shipped'].includes(order.status));
      
      const todayOrdersRevenue = todayOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      const totalOrdersRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      
      console.log(`Orders stats: ${pendingOrders.length} pending, ${completedOrders.length} completed`);
      
      setStats(prev => ({
        ...prev,
        todayBookings: todayBookings.length,
        todayRevenue: todayRevenue + todayOrdersRevenue,
        pendingBookings: pendingBookings.length,
        completedBookings: completedBookings.length,
        pendingOrders: pendingOrders.length,
        completedOrders: completedOrders.length,
        processingOrders: processingOrders.length,
        monthlyRevenue: calculateMonthlyRevenue(bookings) + calculateMonthlyOrdersRevenue(orders),
      }));
      
      // Get customer count
      const uniqueCustomers = new Set();
      bookings.forEach(booking => {
        if (booking.customer_id) {
          uniqueCustomers.add(booking.customer_id);
        }
      });
      
      // Add customers from orders
      orders.forEach(order => {
        if (order.customer_id) {
          uniqueCustomers.add(order.customer_id);
        }
      });
      
      setStats(prev => ({
        ...prev,
        totalCustomers: uniqueCustomers.size,
      }));
      
      // Fetch products count
      try {
        const { data: productsData, error: productsError } = await supabaseClient
          .from('partner_products')
          .select('id', { count: 'exact', head: true })
          .eq('partner_id', partnerId)
          .eq('is_active', true);
        
        if (productsError) {
          console.error('Error fetching products count:', productsError);
        } else {
          const productsCount = productsData?.length || 0;
          console.log(`Found ${productsCount} active products for partner`);
          
          setStats(prev => ({
            ...prev,
            activeProducts: productsCount,
          }));
        }
      } catch (error) {
        console.error('Error in products fetch:', error);
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const calculateMonthlyOrdersRevenue = (orders: any[]) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const monthlyOrders = orders.filter((order: any) => {
      const orderDate = new Date(order.created_at);
      return orderDate >= startOfMonth && orderDate <= endOfMonth;
    });
    
    return monthlyOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  };

  const calculateMonthlyRevenue = (bookings: any[]) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const monthlyBookings = bookings.filter((booking: any) => {
      const bookingDate = new Date(booking.date);
      return bookingDate >= startOfMonth && bookingDate <= endOfMonth;
    });
    
    return monthlyBookings.reduce((sum, booking) => sum + (booking.total_amount || 0), 0);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const handleViewAgenda = () => { 
    if (partnerProfile?.id) {
      router.push({
        pathname: '/partner/agenda',
        params: { partnerId: partnerProfile.id }
      });
    }
  };

  const handleManageServices = () => {
    if (partnerProfile && partnerProfile.id) {
      router.push({
        pathname: '/partner/configure-activities',
        params: { 
          partnerId: partnerProfile.id,
          businessType: partnerProfile.businessType
        }
      });
    } else {
      Alert.alert('Error', 'No se pudo obtener la información del negocio');
    }
  };

  const handleViewClients = () => { 
    if (partnerProfile?.id) {
      router.push({
        pathname: '/partner/clients',
        params: { partnerId: partnerProfile.id }
      });
    }
  };

  const handleAddService = () => {
    if (partnerProfile?.id) {
      router.push({
        pathname: '/partner/add-service',
        params: { 
          partnerId: partnerProfile.id,
          businessType: partnerProfile.businessType
        }
      });
    }
  };

  const handleViewOrders = () => {
    if (partnerProfile?.id) {
      router.push({
        pathname: '/partner/orders',
        params: { partnerId: partnerProfile.id }
      });
    } else {
      Alert.alert('Error', 'No se pudo obtener la información del negocio');
    }
  };

  const getBusinessTypeIcon = (type: string) => { 
    switch (type) {
      case 'veterinary': return '🏥';
      case 'grooming': return '✂️';
      case 'walking': return '🚶';
      case 'boarding': return '🏠';
      case 'shop': return '🛍️';
      case 'shelter': return '🐾';
      default: return '🏢';
    }
  };

  const formatCurrency = (amount: number) => { 
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  if (loading) {
    return ( 
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!partnerProfile) { 
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No se encontró el perfil de aliado</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}> 
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {partnerProfile.logo ? (
            <Image source={{ uri: partnerProfile.logo }} style={styles.businessLogo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoPlaceholderText}>
                {getBusinessTypeIcon(partnerProfile.businessType)}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.businessName}>
              {partnerProfile.businessName}
            </Text>
          </View>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {partnerProfile.isVerified ? '✅ Verificado' : '⏳ Pendiente'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Today's Overview */ }
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen de Hoy</Text>
          <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
              <View style={styles.statHeader}>
                <Calendar size={20} color="#3B82F6" />
                <Text style={styles.statValue}>{stats.todayBookings}</Text>
              </View>
              <Text style={styles.statLabel}>Citas de Hoy</Text>
            </Card>

            <Card style={styles.statCard}>
              <View style={styles.statHeader}>
                <DollarSign size={20} color="#10B981" />
                <Text style={styles.statValue}>{formatCurrency(stats.todayRevenue)}</Text>
              </View>
              <Text style={styles.statLabel}>Ingresos de Hoy</Text>
            </Card>

            <Card style={styles.statCard}>
              <View style={styles.statHeader}>
                <Clock size={20} color="#F59E0B" />
                <Text style={styles.statValue}>{stats.pendingBookings + stats.pendingOrders}</Text>
              </View>
              <Text style={styles.statLabel}>Pendientes</Text>
            </Card>

            <Card style={styles.statCard}>
              <View style={styles.statHeader}>
                <TrendingUp size={20} color="#8B5CF6" />
                <Text style={styles.statValue}>{stats.completedBookings + stats.completedOrders}</Text>
              </View>
              <Text style={styles.statLabel}>Completados</Text>
            </Card>
          </View>
        </View>

        {/* Quick Actions */ }
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.quickAction} 
              onPress={handleViewAgenda}
            >
              <Calendar size={24} color="#3B82F6" />
              <Text style={styles.quickActionText}>Ver Agenda</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickAction} 
              onPress={handleManageServices}
            >
              <Package size={24} color="#10B981" />
              <Text style={styles.quickActionText}>Gestionar Servicios</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickAction} 
              onPress={handleViewClients}
            >
              <Users size={24} color="#F59E0B" />
              <Text style={styles.quickActionText}>Ver Clientes</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={handleViewOrders}
            >
              <Package size={24} color="#8B5CF6" />
              <Text style={styles.quickActionText}>
                Ver Pedidos
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Bookings */ }
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reservas Recientes</Text>
          <Card style={styles.bookingsCard}>
            {recentBookings.length === 0 ? (
              <Text style={styles.emptyText}>No hay reservas recientes</Text>
            ) : (
              recentBookings.map((booking) => (
                <View key={booking.id} style={styles.bookingItem}>
                  <View style={styles.bookingInfo}>
                    <Text style={styles.bookingService}>{booking.serviceName || 'Servicio'}</Text>
                    <Text style={styles.bookingDate}>
                      {booking.date ? new Date(booking.date).toLocaleDateString() : 'Fecha no disponible'}
                    </Text>
                  </View>
                  <View style={[
                    styles.bookingStatus,
                    { backgroundColor: getStatusColor(booking.status) }
                  ]}>
                    <Text style={styles.bookingStatusText}>{getStatusText(booking.status)}</Text>
                  </View>
                </View>
              ))
            )}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return '#FEF3C7';
    case 'confirmed': return '#D1FAE5';
    case 'completed': return '#DBEAFE';
    case 'cancelled': return '#FEE2E2';
    default: return '#F3F4F6';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'pending': return 'Pendiente';
    case 'confirmed': return 'Confirmada';
    case 'completed': return 'Completada';
    case 'cancelled': return 'Cancelada';
    default: return 'Desconocido';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  businessLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  logoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoPlaceholderText: {
    fontSize: 24,
  },
  greeting: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  businessName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  quickAction: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
  },
  disabledQuickAction: {
    opacity: 0.5,
    backgroundColor: '#F9FAFB',
  },
  bookingsCard: {
    marginHorizontal: 16,
  },
  bookingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  bookingInfo: {
    flex: 1,
  },
  bookingService: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  bookingDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  bookingStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bookingStatusText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#374151',
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
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
  },
});