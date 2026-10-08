import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Image, Alert, Modal, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, DollarSign, Users, Package, TrendingUp, Clock, MessageCircle, ChartBar as BarChart3, Filter, CreditCard, ShoppingBag, Building, BadgeCheck, X } from 'lucide-react-native';
import { Card, AppText, Badge, EmptyState, IconButton, Skeleton } from '../../components/ui';
import type { BadgeTone } from '../../components/ui';
import { MetricCard } from '../../components/partner/MetricCard';
import { BusinessTypeAvatar } from '../../components/partner/BusinessTypeAvatar';
import { formatMoney, formatNumber } from '../../components/partner/format';
import { colors, radius, shadows, spacing, touchTarget } from '../../constants/theme';
import { OneTimeTooltip } from '../../components/ui/OneTimeTooltip';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { useOrderChatUnread } from '../../hooks/useOrderChatUnread';
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
  const orderChatUnread = useOrderChatUnread(businessId as string | undefined, currentUser?.id);
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
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!currentUser?.id || !businessId) {
      setLoading(false);
      setPartnerRows([]);
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
          const { data: creds } = await supabaseClient
            .from('partner_payment_credentials')
            .select('is_oauth')
            .eq('user_id', data.user_id)
            .maybeSingle();

          const partnerData = {
            id: data.id,
            businessName: data.business_name,
            businessType: data.business_type,
            logo: data.logo,
            isVerified: data.is_verified,
            isActive: data.is_active,
            ...data,
            mercadopagoIsOAuth: creds?.is_oauth === true,
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
        console.error('Error fetching partner profile:', error);
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
          console.log('Booking changed, refreshing dashboard data');
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
          console.log('Order changed, refreshing dashboard data');
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
      console.log('Fetching dashboard data for partner ID:', partnerId, 'with filter:', dateFilter);

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
      console.log(`Found ${bookings.length} bookings for partner in date range`);

      // Calculate stats
      const pendingBookings = bookings.filter(booking => booking.status === 'pending');
      const completedBookings = bookings.filter(booking => booking.status === 'completed');

      const bookingsRevenue = bookings.reduce((sum, booking) => sum + (booking.total_amount || 0), 0);
      console.log(`Bookings stats: ${bookings.length} bookings, $${bookingsRevenue} revenue`);
      
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
        console.error('Error fetching orders:', ordersError);
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
      console.log(`Found ${orders.length} orders for partner in date range`);

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

      console.log(`Orders stats: ${pendingOrders.length} pending, ${completedOrders.length} completed, ${processingOrders.length} processing`);

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

  const getFilterLabel = () => {
    switch (dateFilter) {
      case 'today':
        return 'Hoy';
      case 'week':
        return 'Última semana';
      case 'month':
        return 'Este mes';
      case 'all':
        return 'Todo el tiempo';
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
        console.log('Dashboard: Redirecting to adoption form for shelter');
        router.push({
          pathname: '/partner/add-adoption-pet',
          params: {
            partnerId: partnerProfile.id
          }
        });
      } else {
        console.log('Dashboard: Redirecting to service form for business type:', partnerProfile.businessType);
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

  const formatCurrency = (amount: number) => formatMoney(amount);

  const handleRefresh = async () => {
    if (!partnerProfile?.id) return;
    setRefreshing(true);
    try {
      await fetchDashboardData(partnerProfile.id);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header} accessibilityLabel="Cargando panel">
          <View style={styles.headerLeft}>
            <Skeleton width={48} height={48} borderRadius={24} />
            <View style={styles.headerTitles}>
              <Skeleton width={120} height={12} />
              <Skeleton width={180} height={18} style={{ marginTop: spacing.sm }} />
            </View>
          </View>
        </View>
        <View style={styles.skeletonGrid}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width="48%" height={116} borderRadius={radius.lg} style={{ marginBottom: spacing.md }} />
          ))}
        </View>
        <View style={styles.sectionPadded}>
          <Skeleton height={180} borderRadius={radius.lg} />
        </View>
      </SafeAreaView>
    );
  }

  if (!partnerProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon={<Building size={32} color={colors.primary} />}
          title="No encontramos el negocio"
          description="Elegí un negocio para ver su panel."
          actionLabel="Ver mis negocios"
          onAction={() => router.replace('/(partner-tabs)/business-selector')}
          style={styles.flexCenter}
        />
      </SafeAreaView>
    );
  }

  const filterOptions: { key: DateFilter; label: string }[] = [
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Última semana' },
    { key: 'month', label: 'Este mes' },
    { key: 'all', label: 'Todo el tiempo' },
  ];

  const quickActionIcon = (Icon: typeof Calendar, enabled: boolean = true) => (
    <View style={[styles.quickActionIcon, !enabled && styles.quickActionIconLocked]}>
      <Icon size={22} color={enabled ? colors.primary : colors.textTertiary} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {partnerProfile.logo ? (
            <Image source={{ uri: partnerProfile.logo }} style={styles.businessLogo} />
          ) : (
            <BusinessTypeAvatar type={partnerProfile.businessType} size={48} />
          )}
          <View style={styles.headerTitles}>
            <AppText variant="bodySmall" color="textSecondary" numberOfLines={1}>
              {getGreeting()}
            </AppText>
            <AppText variant="heading" numberOfLines={1} accessibilityRole="header">
              {partnerProfile.businessName}
            </AppText>
          </View>
        </View>
        <View style={styles.headerBadges}>
          <Badge
            label={partnerProfile.isVerified ? 'Verificado' : 'Pendiente'}
            tone={partnerProfile.isVerified ? 'success' : 'warning'}
            size="small"
            icon={partnerProfile.isVerified
              ? <BadgeCheck size={12} color={colors.success} />
              : <Clock size={12} color={colors.warning} />}
          />
          <View style={[styles.planBadge, { backgroundColor: partnerPlan.surface, borderColor: partnerPlan.border }]}>
            <AppText variant="captionStrong" style={{ color: partnerPlan.accent }} numberOfLines={1}>
              Plan {partnerPlan.name}
            </AppText>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Mensajes de clientes en chats de pedidos */}
        {orderChatUnread.total > 0 && (
          <TouchableOpacity
            style={styles.messagesBanner}
            onPress={() => handleOpenOrdersByTab('processing')}
            accessibilityRole="button"
            accessibilityLabel={`Tenés ${orderChatUnread.total} mensajes de clientes sin leer. Ver pedidos`}
          >
            <View style={styles.messagesBannerIcon}>
              <MessageCircle size={20} color={colors.onPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong" style={{ color: colors.primaryStrong }}>
                {orderChatUnread.total === 1
                  ? 'Tenés 1 mensaje de un cliente'
                  : `Tenés ${orderChatUnread.total} mensajes de clientes`}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                Respondé desde el pedido en Pedidos en proceso.
              </AppText>
            </View>
          </TouchableOpacity>
        )}

        {/* Date Filter */}
        <View style={styles.filterSection}>
          <AppText variant="heading" style={styles.filterTitle} numberOfLines={1}>
            Resumen: {getFilterLabel().toLowerCase()}
          </AppText>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
            accessibilityRole="button"
            accessibilityLabel={`Filtrar por fecha. Ahora: ${getFilterLabel()}`}
          >
            <Filter size={18} color={colors.primary} />
            <AppText variant="label" color="primary">Filtrar</AppText>
          </TouchableOpacity>
        </View>

        {/* Stats Overview: grilla de 2 columnas */}
        <View style={styles.statsGrid}>
          <MetricCard
            style={styles.statCell}
            icon={<Calendar size={20} color={colors.primary} />}
            value={formatNumber(stats.bookings)}
            label="Citas y reservas"
          />
          <MetricCard
            style={styles.statCell}
            icon={<DollarSign size={20} color={colors.success} />}
            iconBackground={colors.successSoft}
            value={formatCurrency(stats.revenue)}
            label="Ingresos"
          />
          <MetricCard
            style={styles.statCell}
            icon={<Clock size={20} color={colors.warning} />}
            iconBackground={colors.warningSoft}
            value={formatNumber(stats.pendingBookings + stats.pendingOrders)}
            label="Pendientes"
            onPress={() => handleOpenOrdersByTab('pending')}
            accessibilityHint="Abre los pedidos pendientes"
          />
          <MetricCard
            style={styles.statCell}
            icon={<TrendingUp size={20} color={colors.info} />}
            iconBackground={colors.infoSoft}
            value={formatNumber(stats.completedBookings + stats.completedOrders)}
            label="Completados"
            onPress={() => handleOpenOrdersByTab('completed')}
            accessibilityHint="Abre los pedidos completados"
          />
        </View>

        <Card style={styles.crmCard}>
          <View style={styles.crmHeader}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.accentSoft }]}>
              <Users size={20} color={colors.warning} />
            </View>
            <View style={styles.flex1}>
              <AppText variant="bodyStrong">CRM y retención</AppText>
              <AppText variant="bodySmall" color="textSecondary" style={styles.crmSubtitle}>
                Segmentá clientes, reactivá a los que se enfriaron y seguí cada contacto.
              </AppText>
            </View>
          </View>

          <View style={styles.crmStats}>
            <View style={styles.crmStat}>
              <AppText variant="heading" numberOfLines={1} adjustsFontSizeToFit>{formatNumber(stats.totalCustomers)}</AppText>
              <AppText variant="caption" color="textSecondary">Clientes</AppText>
            </View>
            <View style={styles.crmStat}>
              <AppText variant="heading" numberOfLines={1} adjustsFontSizeToFit>{formatNumber(stats.pendingBookings + stats.pendingOrders)}</AppText>
              <AppText variant="caption" color="textSecondary">Pendientes</AppText>
            </View>
            <View style={styles.crmStat}>
              <AppText variant="heading" numberOfLines={1} adjustsFontSizeToFit>{formatNumber(stats.completedBookings + stats.completedOrders)}</AppText>
              <AppText variant="caption" color="textSecondary">Completados</AppText>
            </View>
          </View>

          <AppText variant="bodySmall" color="textSecondary" style={styles.crmNote}>
            Abrí la lista para ver último contacto, datos de contacto y oportunidades de reactivación.
          </AppText>

          {canViewClients ? (
            <Button title="Abrir CRM" onPress={handleViewClients} size="medium" />
          ) : (
            <AppText variant="bodySmall" color="textSecondary">{getPartnerLockedActionLabel('clients')}</AppText>
          )}
        </Card>

        {/* Quick Actions */}
        <View style={styles.section}>
          <OneTimeTooltip
            hintKey="partner_dashboard_quick_actions"
            userId={currentUser?.id}
            text="Tip: desde acá gestionás tu agenda, servicios y clientes en un click"
            placement="bottom"
            containerStyle={styles.quickActionsTooltipAnchor}
          >
            <AppText variant="heading" style={styles.sectionTitle} accessibilityRole="header">
              Acciones rápidas
            </AppText>
          </OneTimeTooltip>
          <View style={styles.quickActions}>
            {shouldShowAgenda() && (
              <TouchableOpacity
                style={styles.quickAction}
                onPress={handleViewAgenda}
                accessibilityRole="button"
                accessibilityLabel="Ver agenda"
              >
                {quickActionIcon(Calendar)}
                <AppText variant="label" align="center" style={styles.quickActionText}>Ver agenda</AppText>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.quickAction}
              onPress={handleManageServices}
              accessibilityRole="button"
              accessibilityLabel={manageServicesLabel}
            >
              {quickActionIcon(Package)}
              <AppText variant="label" align="center" style={styles.quickActionText}>{manageServicesLabel}</AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickAction,
                !canViewClients ? styles.quickActionLocked : null,
              ]}
              onPress={canViewClients ? handleViewClients : () => showPlanUpgradeAlert('clients')}
              accessibilityRole="button"
              accessibilityLabel="CRM y clientes"
            >
              {quickActionIcon(Users, canViewClients)}
              <AppText variant="label" align="center" style={styles.quickActionText}>CRM y clientes</AppText>
              <AppText variant="caption" color="textSecondary" align="center" style={styles.quickActionSubtext}>
                {canViewClients ? 'Seguimiento y reactivación' : getPartnerLockedActionLabel('clients')}
              </AppText>
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
              accessibilityRole="button"
              accessibilityLabel="Estadísticas del negocio"
            >
              {quickActionIcon(BarChart3, canViewInsights)}
              <AppText variant="label" align="center" style={styles.quickActionText}>Estadísticas</AppText>
              {!canViewInsights && (
                <AppText variant="caption" color="textSecondary" align="center" style={styles.quickActionSubtext}>
                  {getPartnerLockedActionLabel('insights')}
                </AppText>
              )}
            </TouchableOpacity>

            {shouldShowProducts() && (
              <TouchableOpacity
                style={styles.quickAction}
                onPress={handleViewOrders}
                accessibilityRole="button"
                accessibilityLabel="Ver pedidos"
              >
                {quickActionIcon(ShoppingBag)}
                <AppText variant="label" align="center" style={styles.quickActionText}>Ver pedidos</AppText>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.quickAction,
                partnerProfile?.mercadopagoIsOAuth ? styles.quickActionSuccess : null,
              ]}
              onPress={() => router.push('/profile/mercadopago-config')}
              accessibilityRole="button"
              accessibilityLabel="Cobros con Mercado Pago"
            >
              <View style={[
                styles.quickActionIcon,
                { backgroundColor: partnerProfile?.mercadopagoIsOAuth ? colors.successSoft : colors.warningSoft },
              ]}>
                <CreditCard size={22} color={partnerProfile?.mercadopagoIsOAuth ? colors.success : colors.warning} />
              </View>
              <AppText variant="label" align="center" style={styles.quickActionText}>Mercado Pago</AppText>
              <AppText variant="caption" color="textSecondary" align="center" style={styles.quickActionSubtext}>
                {partnerProfile?.mercadopagoIsOAuth
                  ? 'OAuth activo'
                  : partnerProfile?.mercadopago_connected
                    ? 'Conexión pendiente'
                    : 'Conectar cobros'}
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push({
                pathname: '/partner/subscription',
                params: { businessId: partnerProfile.id },
              })}
              accessibilityRole="button"
              accessibilityLabel="Planes"
            >
              {quickActionIcon(DollarSign)}
              <AppText variant="label" align="center" style={styles.quickActionText}>Planes</AppText>
              <AppText variant="caption" color="textSecondary" align="center" style={styles.quickActionSubtext}>
                Gestioná tu plan y tu prueba
              </AppText>
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
                accessibilityRole="button"
                accessibilityLabel="Contactos de adopción"
              >
                {quickActionIcon(MessageCircle, canViewAdoptions)}
                <AppText variant="label" align="center" style={styles.quickActionText}>Contactos de adopción</AppText>
                {!canViewAdoptions && (
                  <AppText variant="caption" color="textSecondary" align="center" style={styles.quickActionSubtext}>
                    {getPartnerLockedActionLabel('adoptions')}
                  </AppText>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Recent Bookings */}
        <View style={styles.section}>
          <AppText variant="heading" style={styles.sectionTitle} accessibilityRole="header">
            Reservas recientes
          </AppText>
          <Card style={styles.listCard}>
            {recentBookings.length === 0 ? (
              <AppText variant="bodySmall" color="textSecondary" align="center" style={styles.emptyText}>
                No hay reservas recientes
              </AppText>
            ) : (
              recentBookings.map((booking, index) => (
                <View
                  key={booking.id}
                  style={[styles.listItem, index === recentBookings.length - 1 && styles.listItemLast]}
                >
                  <View style={styles.flex1}>
                    <AppText variant="label" numberOfLines={1}>{booking.serviceName || 'Servicio'}</AppText>
                    <AppText variant="caption" color="textSecondary" style={styles.listMeta}>
                      {booking.date ? new Date(booking.date).toLocaleDateString('es-UY') : 'Fecha no disponible'}
                    </AppText>
                  </View>
                  <Badge label={getStatusText(booking.status)} tone={getStatusTone(booking.status)} size="small" />
                </View>
              ))
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <AppText variant="heading" style={styles.sectionTitle} accessibilityRole="header">
            Pedidos en proceso
          </AppText>
          <Card style={styles.listCard}>
            {processingOrdersPreview.length === 0 ? (
              <AppText variant="bodySmall" color="textSecondary" align="center" style={styles.emptyText}>
                No hay pedidos en proceso
              </AppText>
            ) : (
              processingOrdersPreview.map((order, index) => (
                <View
                  key={order.id}
                  style={[styles.listItem, index === processingOrdersPreview.length - 1 && styles.listItemLast]}
                >
                  <View style={styles.flex1}>
                    <AppText variant="label" numberOfLines={1}>
                      Pedido {order.orderNumber || `#${order.id.slice(-6)}`}
                    </AppText>
                    <AppText variant="caption" color="textSecondary" style={styles.listMeta}>
                      {new Date(order.createdAt).toLocaleDateString('es-UY')} · {formatCurrency(order.totalAmount)}
                    </AppText>
                  </View>
                  <Button
                    title="Ver detalle"
                    onPress={() => handleViewProcessingOrderDetail(order.id)}
                    variant="secondary"
                    size="small"
                    fullWidth={false}
                  />
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
              <AppText variant="heading" accessibilityRole="header">Filtrar por fecha</AppText>
              <IconButton
                icon={<X size={22} color={colors.textSecondary} />}
                onPress={() => setShowFilterModal(false)}
                accessibilityLabel="Cerrar"
              />
            </View>

            <View style={styles.filterOptions}>
              {filterOptions.map((option) => {
                const active = dateFilter === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.filterOption, active && styles.filterOptionActive]}
                    onPress={() => {
                      setDateFilter(option.key);
                      setShowFilterModal(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <AppText
                      variant={active ? 'bodyStrong' : 'body'}
                      color={active ? 'primary' : 'text'}
                      align="center"
                    >
                      {option.label}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStatusTone = (status: string): BadgeTone => {
  switch (status) {
    case 'pending': return 'warning';
    case 'confirmed': return 'success';
    case 'completed': return 'primary';
    case 'cancelled': return 'danger';
    default: return 'neutral';
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
  messagesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    minHeight: touchTarget,
  },
  messagesBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  flex1: {
    flex: 1,
  },
  flexCenter: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitles: {
    flex: 1,
    marginLeft: spacing.md,
  },
  businessLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  headerBadges: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  planBadge: {
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingBottom: spacing.xxxl,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  sectionPadded: {
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  quickActionsTooltipAnchor: {
    alignSelf: 'flex-start',
  },
  sectionTitle: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  filterSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  filterTitle: {
    flex: 1,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  // Grilla de 2 columnas con ancho fijo por celda: sin flex ni minWidth
  // para que cada fila tenga su altura real y nada se superponga con la tarjeta de CRM.
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  statCell: {
    width: '48%',
    marginBottom: spacing.md,
  },
  crmCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
  },
  crmHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  crmSubtitle: {
    marginTop: spacing.xxs,
  },
  crmStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  crmStat: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  crmNote: {
    marginBottom: spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  quickAction: {
    width: '48%',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    minHeight: 116,
    ...shadows.sm,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIconLocked: {
    backgroundColor: colors.surfaceAlt,
  },
  quickActionLocked: {
    backgroundColor: colors.background,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
  },
  quickActionSuccess: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  quickActionText: {
    marginTop: spacing.sm,
  },
  quickActionSubtext: {
    marginTop: spacing.xxs,
  },
  listCard: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  listItemLast: {
    borderBottomWidth: 0,
  },
  listMeta: {
    marginTop: spacing.xxs,
  },
  emptyText: {
    paddingVertical: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    width: '85%',
    maxWidth: 400,
    padding: spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  filterOptions: {
    gap: spacing.md,
  },
  filterOption: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterOptionActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
});
