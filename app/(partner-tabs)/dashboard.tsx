import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, DollarSign, Users, Package, TrendingUp, Clock, MessageCircle, ChartBar as BarChart3, Settings, Filter, CreditCard } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import {
  getPartnerLockedActionLabel,
  getPartnerPlan,
  PARTNER_PLAN_ORDER,
  resolvePartnerPlanTier,
  resolvePartnerAccountSubscription,
} from '../../utils/partnerPlans';

type DateFilter = 'today' | 'week' | 'month' | 'all';

interface DashboardStats {
  bookings: number;
  revenue: number;
  totalCustomers: number;
  activeProducts: number;
  pendingBookings: number;
  pendingOrders: number;
  processingOrders: number;
  completedBookings: number;
  completedOrders: number;
  averageRating: number;
}

export default function PartnerDashboard() {
  const { businessId } = useLocalSearchParams<{ businessId?: string }>();
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    bookings: 0,
    revenue: 0,
    totalCustomers: 0,
    activeProducts: 0,
    pendingBookings: 0,
    pendingOrders: 0,
    processingOrders: 0,
    completedBookings: 0,
    completedOrders: 0,
    averageRating: 0,
  });
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [partnerRows, setPartnerRows] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [processingOrdersPreview, setProcessingOrdersPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [showFilterModal, setShowFilterModal] = useState(false);

  useEffect(() => {
    if (!currentUser?.id || !businessId) {
      setLoading(false);
      setPartnerRows([]);
      return;
    }

    // Use specific business ID from params
    
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
          const { data: accountPartnerRows, error: accountPartnersError } = await supabaseClient
            .from('partners')
            .select('subscription_plan_tier, subscription_plan_status, subscription_plan_expires_at')
            .eq('user_id', currentUser.id)
            .eq('is_verified', true);

          if (accountPartnersError) throw accountPartnersError;
          setPartnerRows((accountPartnerRows || []) as any[]);
          fetchDashboardData(partnerData.id);
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };
    
    fetchPartnerProfile();

    // Set up real-time subscriptions for partners, bookings, and orders
    const partnerSubscription = supabaseClient
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

    const bookingsSubscription = supabaseClient
      .channel('bookings-changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `partner_id=eq.${businessId}`
        },
        (payload) => {
          fetchDashboardData(businessId as string);
        }
      )
      .subscribe();

    const ordersSubscription = supabaseClient
      .channel('orders-changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `partner_id=eq.${businessId}`
        },
        (payload) => {
          fetchDashboardData(businessId as string);
        }
      )
      .subscribe();

    return () => {
      partnerSubscription.unsubscribe();
      bookingsSubscription.unsubscribe();
      ordersSubscription.unsubscribe();
    };
  }, [currentUser, businessId]);

  // Refetch data when date filter changes
  useEffect(() => {
    if (partnerProfile?.id) {
      fetchDashboardData(partnerProfile.id);
    }
  }, [dateFilter]);

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (dateFilter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        break;
      case 'all':
      default:
        startDate = new Date(2020, 0, 1); // Fecha muy antigua para incluir todo
        endDate = new Date(now.getFullYear() + 1, 11, 31); // Fecha muy futura
        break;
    }

    return { startDate, endDate };
  };

  const fetchDashboardData = async (partnerId: string) => {
    try {

      const { startDate, endDate } = getDateRange();
      
      // Fetch bookings with date filter
      const { data: bookingsData, error: bookingsError } = await supabaseClient
        .from('bookings')
        .select('*')
        .eq('partner_id', partnerId)
        .gte('date', startDate.toISOString())
        .lte('date', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (bookingsError) throw bookingsError;

      const bookings = bookingsData || [];

      // Calculate stats
      const pendingBookings = bookings.filter(booking => booking.status === 'pending');
      const completedBookings = bookings.filter(booking => booking.status === 'completed');

      const bookingsRevenue = bookings.reduce((sum, booking) => sum + (booking.total_amount || 0), 0);
      
      // Get recent bookings
      const recent = bookings
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
      
      setRecentBookings(recent);
      
      // Fetch orders data with date filter
      const breakdownFilter = JSON.stringify({ partners: { [partnerId]: {} } });
      const { data: ordersData, error: ordersError } = await supabaseClient
        .from('orders')
        .select('*')
        .or(`partner_id.eq.${partnerId},partner_breakdown.cs.${breakdownFilter}`)
        .eq('is_split_master', false)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (ordersError) {
      }

      const orders = (ordersData || []).filter(order => {
        if (order?.is_split_master) return false;
        if (order?.partner_id === partnerId) return true;
        if (order?.partner_breakdown?.partners && Object.prototype.hasOwnProperty.call(order.partner_breakdown.partners, partnerId)) return true;
        if (Array.isArray(order?.items)) {
          return order.items.some((item: any) => item?.partnerId === partnerId || item?.partner_id === partnerId);
        }
        return false;
      });

      const isServiceOrder = (order: any) => order.order_type === 'service_booking';

      // Calculate order stats
      const pendingOrders = orders.filter(order => {
        if (isServiceOrder(order)) {
          return ['pending', 'reserved', 'payment_failed'].includes(order.status);
        }
        return ['pending', 'insufficient_stock'].includes(order.status);
      });

      const completedOrders = orders.filter(order => {
        if (isServiceOrder(order)) {
          return ['completed', 'cancelled', 'refunded'].includes(order.status);
        }
        return ['delivered', 'cancelled', 'refunded'].includes(order.status);
      });

      const processingOrders = orders.filter(order => {
        if (isServiceOrder(order)) {
          return order.status === 'confirmed';
        }
        return ['confirmed', 'processing', 'preparing', 'shipped'].includes(order.status);
      });

      const processingPreview = processingOrders
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map(order => ({
          id: order.id,
          orderNumber: order.order_number,
          status: order.status,
          createdAt: order.created_at,
          totalAmount: order.total_amount || 0,
          orderType: order.order_type,
        }));

      setProcessingOrdersPreview(processingPreview);

      const ordersRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);


      setStats(prev => ({
        ...prev,
        bookings: bookings.length,
        revenue: bookingsRevenue + ordersRevenue,
        pendingBookings: pendingBookings.length,
        completedBookings: completedBookings.length,
        pendingOrders: pendingOrders.length,
        completedOrders: completedOrders.length,
        processingOrders: processingOrders.length,
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
        } else {
          const productsCount = productsData?.length || 0;
          
          setStats(prev => ({
            ...prev,
            activeProducts: productsCount,
          }));
        }
      } catch (error) {
      }
      
    } catch (error) {
    }
  };

  const getFilterLabel = () => {
    switch (dateFilter) {
      case 'today':
        return 'Hoy';
      case 'week':
        return 'Última Semana';
      case 'month':
        return 'Este Mes';
      case 'all':
        return 'Todo el Tiempo';
      default:
        return 'Hoy';
    }
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
      if (partnerProfile.businessType === 'shelter') {
        router.push({
          pathname: '/partner/manage-adoptions',
          params: { partnerId: partnerProfile.id }
        });
        return;
      }

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
      // Si es un refugio, redirigir al formulario de adopción
      if (partnerProfile.businessType === 'shelter') {
        router.push({
          pathname: '/partner/add-adoption-pet',
          params: {
            partnerId: partnerProfile.id
          }
        });
      } else {
        router.push({
          pathname: '/partner/add-service',
          params: { 
            partnerId: partnerProfile.id,
            businessType: partnerProfile.businessType
          }
        });
      }
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

  const handleViewProcessingOrderDetail = (orderId: string) => {
    if (partnerProfile?.id) {
      router.push({
        pathname: '/partner/orders',
        params: {
          partnerId: partnerProfile.id,
          activeTab: 'processing',
          openOrderId: orderId,
        }
      });
    }
  };

  const handleOpenOrdersByTab = (tab: 'pending' | 'processing' | 'completed') => {
    if (!partnerProfile?.id) {
      Alert.alert('Error', 'No se pudo obtener la información del negocio');
      return;
    }

    router.push({
      pathname: '/partner/orders',
      params: {
        partnerId: partnerProfile.id,
        activeTab: tab,
      }
    });
  };

  // Función para verificar si una funcionalidad está habilitada
  const isFeatureEnabled = (featureKey: string): boolean => {
    if (!partnerProfile?.features) return false;
    return partnerProfile.features[featureKey] === true;
  };

  // Función para verificar si el negocio es de tipo tienda
  const isShopBusiness = (): boolean => {
    return partnerProfile?.businessType === 'shop';
  };

  const isShelterBusiness = (): boolean => {
    return partnerProfile?.businessType === 'shelter';
  };

  // Función para verificar si debe mostrar la gestión de productos
  const shouldShowProducts = (): boolean => {
    return isShopBusiness() || isFeatureEnabled('products');
  };

  // Función para verificar si debe mostrar la agenda
  const shouldShowAgenda = (): boolean => {
    const agendaEnabled = partnerProfile?.features?.agenda !== false;
    return partnerProfile?.businessType !== 'shop' && agendaEnabled;
  };
  const manageServicesLabel = isShopBusiness()
    ? 'Gestionar Productos'
    : isShelterBusiness()
      ? 'Gestionar Adopciones'
      : 'Gestionar Servicios';
  const accountSubscription = resolvePartnerAccountSubscription(partnerRows);
  const effectivePartnerTier = accountSubscription?.subscriptionPlanTier || resolvePartnerPlanTier(
    partnerProfile?.subscription_plan_tier,
    partnerProfile?.subscription_plan_status,
    partnerProfile?.subscription_plan_expires_at,
  );
  const accountPlanIndex = PARTNER_PLAN_ORDER.indexOf(effectivePartnerTier);
  const growthPlanIndex = PARTNER_PLAN_ORDER.indexOf('growth');
  const proPlanIndex = PARTNER_PLAN_ORDER.indexOf('pro');
  const partnerPlan = getPartnerPlan(effectivePartnerTier);
  const canViewClients = accountPlanIndex >= growthPlanIndex;
  const canViewInsights = accountPlanIndex >= growthPlanIndex;
  const canViewAdoptions = accountPlanIndex >= proPlanIndex && partnerProfile?.businessType === 'shelter';

  const showPlanUpgradeAlert = (module: 'clients' | 'insights' | 'adoptions') => {
    Alert.alert(
      'Plan requerido',
      `${getPartnerLockedActionLabel(module)} para este negocio.`,
      [{ text: 'Entendido' }]
    );
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
        <View style={styles.headerBadges}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {partnerProfile.isVerified ? '✅ Verificado' : '⏳ Pendiente'}
            </Text>
          </View>
          <View style={[styles.planBadge, { backgroundColor: partnerPlan.surface, borderColor: partnerPlan.border }]}>
            <Text style={[styles.planBadgeText, { color: partnerPlan.accent }]}>
              Plan {partnerPlan.name}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Date Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.sectionTitle}>Resumen de {getFilterLabel()}</Text>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Filter size={18} color="#3B82F6" />
            <Text style={styles.filterButtonText}>Filtrar</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Overview */}
        <View style={styles.section}>
          <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
              <View style={styles.statHeader}>
                <Calendar size={20} color="#3B82F6" />
                <Text style={styles.statValue}>{stats.bookings}</Text>
              </View>
              <Text style={styles.statLabel}>Citas/Reservas</Text>
            </Card>

            <Card style={styles.statCard}>
              <View style={styles.statHeader}>
                <DollarSign size={20} color="#10B981" />
                <Text style={styles.statValue}>{formatCurrency(stats.revenue)}</Text>
              </View>
              <Text style={styles.statLabel}>Ingresos</Text>
            </Card>

            <TouchableOpacity
              style={styles.statCardTouchable}
              onPress={() => handleOpenOrdersByTab('pending')}
            >
              <Card style={styles.statCard}>
                <View style={styles.statHeader}>
                  <Clock size={20} color="#F59E0B" />
                  <Text style={styles.statValue}>{stats.pendingBookings + stats.pendingOrders}</Text>
                </View>
                <Text style={styles.statLabel}>Pendientes</Text>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCardTouchable}
              onPress={() => handleOpenOrdersByTab('completed')}
            >
              <Card style={styles.statCard}>
                <View style={styles.statHeader}>
                  <TrendingUp size={20} color="#8B5CF6" />
                  <Text style={styles.statValue}>{stats.completedBookings + stats.completedOrders}</Text>
                </View>
                <Text style={styles.statLabel}>Completados</Text>
              </Card>
            </TouchableOpacity>
          </View>
        </View>

        <Card style={styles.crmCard}>
          <View style={styles.crmHeader}>
            <View style={styles.crmHeaderLeft}>
              <Users size={20} color="#F59E0B" />
              <View>
                <Text style={styles.crmTitle}>CRM y retención</Text>
                <Text style={styles.crmSubtitle}>
                  Segmenta clientes, reactivá a los que se enfriaron y seguí cada contacto.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.crmStats}>
            <View style={styles.crmStat}>
              <Text style={styles.crmStatValue}>{stats.totalCustomers}</Text>
              <Text style={styles.crmStatLabel}>Clientes</Text>
            </View>
            <View style={styles.crmStat}>
              <Text style={styles.crmStatValue}>{stats.pendingBookings + stats.pendingOrders}</Text>
              <Text style={styles.crmStatLabel}>Pendientes</Text>
            </View>
            <View style={styles.crmStat}>
              <Text style={styles.crmStatValue}>{stats.completedBookings + stats.completedOrders}</Text>
              <Text style={styles.crmStatLabel}>Completados</Text>
            </View>
          </View>

          <Text style={styles.crmNote}>
            Abrí la lista para ver último contacto, datos de contacto y oportunidades de reactivación.
          </Text>

          {canViewClients ? (
            <Button title="Abrir CRM" onPress={handleViewClients} size="medium" />
          ) : (
            <Text style={styles.crmLockedText}>{getPartnerLockedActionLabel('clients')}</Text>
          )}
        </Card>

        {/* Quick Actions */ }
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
          <View style={styles.quickActions}>
            {shouldShowAgenda() && (
              <TouchableOpacity 
                style={styles.quickAction} 
                onPress={handleViewAgenda}
              >
                <Calendar size={24} color="#3B82F6" />
                <Text style={styles.quickActionText}>Ver Agenda</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.quickAction} 
              onPress={handleManageServices}
            >
              <Package size={24} color="#10B981" />
              <Text style={styles.quickActionText}>{manageServicesLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickAction,
                !canViewClients ? styles.quickActionLocked : null,
              ]}
              onPress={canViewClients ? handleViewClients : () => showPlanUpgradeAlert('clients')}
            >
              <Users size={24} color={canViewClients ? '#F59E0B' : '#A855F7'} />
              <Text style={styles.quickActionText}>CRM y clientes</Text>
              {!canViewClients && (
                <Text style={styles.quickActionSubtext}>
                  {getPartnerLockedActionLabel('clients')}
                </Text>
              )}
              {canViewClients && (
                <Text style={styles.quickActionSubtext}>
                  Seguimiento y reactivación
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickAction,
                !canViewInsights ? styles.quickActionLocked : null,
              ]}
              onPress={canViewInsights ? () => router.push({
                pathname: '/partner/business-insights',
                params: { partnerId: partnerProfile?.id }
              }) : () => showPlanUpgradeAlert('insights')}
            >
              <BarChart3 size={24} color={canViewInsights ? '#8B5CF6' : '#A855F7'} />
              <Text style={styles.quickActionText}>Inteligencia de Negocio</Text>
              {!canViewInsights && (
                <Text style={styles.quickActionSubtext}>
                  {getPartnerLockedActionLabel('insights')}
                </Text>
              )}
            </TouchableOpacity>

            {shouldShowProducts() && (
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={handleViewOrders}
            >
              <Package size={24} color="#8B5CF6" />
                <Text style={styles.quickActionText}>
                  Ver Pedidos
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.quickAction,
                partnerProfile?.mercadopago_config?.is_oauth ? styles.quickActionSuccess : null,
              ]}
              onPress={() => router.push('/profile/mercadopago-config')}
            >
              <CreditCard
                size={24}
                color={partnerProfile?.mercadopago_config?.is_oauth ? '#10B981' : '#F59E0B'}
              />
              <Text style={styles.quickActionText}>Mercado Pago</Text>
              <Text style={styles.quickActionSubtext}>
                {partnerProfile?.mercadopago_config?.is_oauth
                  ? 'OAuth activo'
                  : partnerProfile?.mercadopago_connected
                    ? 'Conexión pendiente'
                    : 'Conectar cobros'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push({
                pathname: '/partner/subscription',
                params: { businessId: partnerProfile.id },
              })}
            >
              <DollarSign size={24} color="#10B981" />
              <Text style={styles.quickActionText}>Planes</Text>
              <Text style={styles.quickActionSubtext}>
                Gestiona tu plan y tu prueba
              </Text>
            </TouchableOpacity>

            {/* Mostrar contactos de adopción solo para refugios */}
            {partnerProfile?.businessType === 'shelter' && (
              <TouchableOpacity 
                style={[
                  styles.quickAction,
                  !canViewAdoptions ? styles.quickActionLocked : null,
                ]}
                onPress={canViewAdoptions ? () => router.push({
                  pathname: '/(partner-tabs)/chat-contacts',
                  params: { businessId: partnerProfile.id }
                }) : () => showPlanUpgradeAlert('adoptions')}
              >
                <MessageCircle size={24} color={canViewAdoptions ? '#8B5CF6' : '#A855F7'} />
                <Text style={styles.quickActionText}>Contactos Adopción</Text>
                {!canViewAdoptions && (
                  <Text style={styles.quickActionSubtext}>
                    {getPartnerLockedActionLabel('adoptions')}
                  </Text>
                )}
              </TouchableOpacity>
            )}
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pedidos en Proceso</Text>
          <Card style={styles.bookingsCard}>
            {processingOrdersPreview.length === 0 ? (
              <Text style={styles.emptyText}>No hay pedidos en proceso</Text>
            ) : (
              processingOrdersPreview.map((order) => (
                <View key={order.id} style={styles.processingOrderItem}>
                  <View style={styles.processingOrderInfo}>
                    <Text style={styles.processingOrderTitle}>
                      Pedido {order.orderNumber || `#${order.id.slice(-6)}`}
                    </Text>
                    <Text style={styles.processingOrderMeta}>
                      {new Date(order.createdAt).toLocaleDateString()} · {formatCurrency(order.totalAmount)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.processingOrderButton}
                    onPress={() => handleViewProcessingOrderDetail(order.id)}
                  >
                    <Text style={styles.processingOrderButtonText}>Ver detalle</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </Card>
        </View>
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrar por Fecha</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  dateFilter === 'today' && styles.filterOptionActive,
                ]}
                onPress={() => {
                  setDateFilter('today');
                  setShowFilterModal(false);
                }}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    dateFilter === 'today' && styles.filterOptionTextActive,
                  ]}
                >
                  Hoy
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  dateFilter === 'week' && styles.filterOptionActive,
                ]}
                onPress={() => {
                  setDateFilter('week');
                  setShowFilterModal(false);
                }}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    dateFilter === 'week' && styles.filterOptionTextActive,
                  ]}
                >
                  Última Semana
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  dateFilter === 'month' && styles.filterOptionActive,
                ]}
                onPress={() => {
                  setDateFilter('month');
                  setShowFilterModal(false);
                }}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    dateFilter === 'month' && styles.filterOptionTextActive,
                  ]}
                >
                  Este Mes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  dateFilter === 'all' && styles.filterOptionActive,
                ]}
                onPress={() => {
                  setDateFilter('all');
                  setShowFilterModal(false);
                }}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    dateFilter === 'all' && styles.filterOptionTextActive,
                  ]}
                >
                  Todo el Tiempo
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerBadges: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
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
  statCardTouchable: {
    flex: 1,
    minWidth: '45%',
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
  crmCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
  },
  crmHeader: {
    marginBottom: 12,
  },
  crmHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  crmTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  crmSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  crmStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  crmStat: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  crmStatValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  crmStatLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  crmNote: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    lineHeight: 19,
    marginBottom: 12,
  },
  crmLockedText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 4,
  },
  quickAction: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    minHeight: 108,
  },
  quickActionLocked: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  quickActionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 16,
  },
  quickActionSubtext: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 14,
  },
  quickActionSuccess: {
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
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
  processingOrderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  processingOrderInfo: {
    flex: 1,
  },
  processingOrderTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  processingOrderMeta: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  processingOrderButton: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  processingOrderButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
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
  filterSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  filterButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '85%',
    maxWidth: 400,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  modalClose: {
    fontSize: 24,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  filterOptions: {
    gap: 12,
  },
  filterOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  filterOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    textAlign: 'center',
  },
  filterOptionTextActive: {
    color: '#3B82F6',
    fontFamily: 'Inter-Bold',
  },
});
