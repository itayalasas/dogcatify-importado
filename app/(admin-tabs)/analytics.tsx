import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, RefreshControl } from 'react-native';
import { TrendingUp, Users, DollarSign, Package, Calendar, Eye, Clock } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

const SYSTEM_CONFIG_KEY = 'system_config';

type AnalyticsState = {
  totalUsers: number;
  totalPartners: number;
  totalPosts: number;
  totalBookings: number;
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  totalCommissions: number;
  totalPartnerPayments: number;
  averageCommissionRate: number;
  monthlyGrowth: number;
  activePromotions: number;
  totalViews: number;
  currentMonthUsers: number;
  previousMonthUsers: number;
  currentMonthPartners: number;
  previousMonthPartners: number;
  currentMonthPosts: number;
  previousMonthPosts: number;
  conversionRate: number;
  orderSuccessRate: number;
  bookingPerPartnerRate: number;
  paymentFailedOrders: number;
  stalePendingOrders: number;
  webhookFailureCount: number;
  webhookDeliveryRate: number;
  pendingPromotionApprovals: number;
  rejectedPromotions: number;
};

const INITIAL_ANALYTICS: AnalyticsState = {
  totalUsers: 0,
  totalPartners: 0,
  totalPosts: 0,
  totalBookings: 0,
  totalOrders: 0,
  pendingOrders: 0,
  confirmedOrders: 0,
  processingOrders: 0,
  shippedOrders: 0,
  deliveredOrders: 0,
  cancelledOrders: 0,
  totalRevenue: 0,
  totalCommissions: 0,
  totalPartnerPayments: 0,
  averageCommissionRate: 0,
  monthlyGrowth: 0,
  activePromotions: 0,
  totalViews: 0,
  currentMonthUsers: 0,
  previousMonthUsers: 0,
  currentMonthPartners: 0,
  previousMonthPartners: 0,
  currentMonthPosts: 0,
  previousMonthPosts: 0,
  conversionRate: 0,
  orderSuccessRate: 0,
  bookingPerPartnerRate: 0,
  paymentFailedOrders: 0,
  stalePendingOrders: 0,
  webhookFailureCount: 0,
  webhookDeliveryRate: 0,
  pendingPromotionApprovals: 0,
  rejectedPromotions: 0,
};

const safePercent = (numerator: number, denominator: number) => {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
};

const calculateGrowth = (current: number, previous: number) => {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
};

const getMonthBoundaries = () => {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  return {
    currentMonthStart: currentMonthStart.toISOString(),
    nextMonthStart: nextMonthStart.toISOString(),
    previousMonthStart: previousMonthStart.toISOString(),
  };
};

export default function AdminAnalytics() {
  const { currentUser } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsState>(INITIAL_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedAnalyticsEnabled, setAdvancedAnalyticsEnabled] = useState(true);

  const isAdmin = currentUser?.isAdmin || currentUser?.email?.toLowerCase() === 'admin@dogcatify.com';

  useEffect(() => {
    if (!currentUser || !isAdmin) {
      setLoading(false);
      return;
    }

    fetchAnalytics();
  }, [currentUser?.id, isAdmin]);

  const fetchAnalytics = async (isRefresh = false) => {
    if (!isAdmin) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const { currentMonthStart, nextMonthStart, previousMonthStart } = getMonthBoundaries();
      const nowIso = new Date().toISOString();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

      const [
        systemConfigResult,
        totalUsersResult,
        currentMonthUsersResult,
        previousMonthUsersResult,
        totalPartnersResult,
        currentMonthPartnersResult,
        previousMonthPartnersResult,
        totalPostsResult,
        currentMonthPostsResult,
        previousMonthPostsResult,
        bookingsResult,
        ordersResult,
        promotionsResult,
        webhookLogsResult,
        crmWebhookLogsResult,
        accountingWebhookLogsResult,
      ] = await Promise.all([
        supabaseClient.from('admin_settings').select('value').eq('key', SYSTEM_CONFIG_KEY).maybeSingle(),
        supabaseClient.from('profiles').select('*', { count: 'exact', head: true }),
        supabaseClient.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', currentMonthStart).lt('created_at', nextMonthStart),
        supabaseClient.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', previousMonthStart).lt('created_at', currentMonthStart),
        supabaseClient.from('partners').select('*', { count: 'exact', head: true }).eq('is_verified', true).eq('is_active', true),
        supabaseClient.from('partners').select('*', { count: 'exact', head: true }).eq('is_verified', true).eq('is_active', true).gte('created_at', currentMonthStart).lt('created_at', nextMonthStart),
        supabaseClient.from('partners').select('*', { count: 'exact', head: true }).eq('is_verified', true).eq('is_active', true).gte('created_at', previousMonthStart).lt('created_at', currentMonthStart),
        supabaseClient.from('posts').select('*', { count: 'exact', head: true }),
        supabaseClient.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', currentMonthStart).lt('created_at', nextMonthStart),
        supabaseClient.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', previousMonthStart).lt('created_at', currentMonthStart),
        supabaseClient.from('bookings').select('id, total_amount'),
        supabaseClient.from('orders').select('id, status, total_amount, commission_amount, partner_amount, created_at'),
        supabaseClient.from('promotions').select('id, views, is_active, start_date, end_date, approval_status'),
        supabaseClient.from('webhook_logs').select('id, success').gte('created_at', sevenDaysAgo),
        supabaseClient.from('crm_webhook_logs').select('id, success').gte('created_at', sevenDaysAgo),
        supabaseClient.from('accounting_webhook_logs').select('id, success').gte('created_at', sevenDaysAgo),
      ]);

      const failedQuery = [
        totalUsersResult,
        currentMonthUsersResult,
        previousMonthUsersResult,
        totalPartnersResult,
        currentMonthPartnersResult,
        previousMonthPartnersResult,
        totalPostsResult,
        currentMonthPostsResult,
        previousMonthPostsResult,
        bookingsResult,
        ordersResult,
        promotionsResult,
        webhookLogsResult,
        crmWebhookLogsResult,
        accountingWebhookLogsResult,
      ].find((result) => result.error);

      if (failedQuery?.error) {
        throw failedQuery.error;
      }

      const totalUsers = totalUsersResult.count || 0;
      setAdvancedAnalyticsEnabled(systemConfigResult.data?.value?.advanced_analytics_enabled ?? true);
      const currentMonthUsers = currentMonthUsersResult.count || 0;
      const previousMonthUsers = previousMonthUsersResult.count || 0;

      const totalPartners = totalPartnersResult.count || 0;
      const currentMonthPartners = currentMonthPartnersResult.count || 0;
      const previousMonthPartners = previousMonthPartnersResult.count || 0;

      const totalPosts = totalPostsResult.count || 0;
      const currentMonthPosts = currentMonthPostsResult.count || 0;
      const previousMonthPosts = previousMonthPostsResult.count || 0;

      const bookings = bookingsResult.data || [];
      const orders = ordersResult.data || [];
      const promotions = promotionsResult.data || [];

      const totalBookings = bookings.length;
      const totalOrders = orders.length;

      const pendingOrders = orders.filter((order) => order.status === 'pending').length;
      const paymentFailedOrders = orders.filter((order) => order.status === 'payment_failed').length;
      const confirmedOrders = orders.filter((order) => order.status === 'confirmed').length;
      const processingOrders = orders.filter((order) => order.status === 'processing').length;
      const shippedOrders = orders.filter((order) => order.status === 'shipped').length;
      const deliveredOrders = orders.filter((order) => order.status === 'delivered').length;
      const cancelledOrders = orders.filter((order) => order.status === 'cancelled').length;
      const stalePendingOrders = orders.filter((order) => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at).getTime();
        return createdAt < twoHoursAgo && (order.status === 'pending' || order.status === 'processing' || order.status === 'reserved');
      }).length;

      const bookingsRevenue = bookings.reduce((sum, booking) => sum + (Number(booking.total_amount) || 0), 0);
      const ordersRevenue = orders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
      const totalRevenue = bookingsRevenue + ordersRevenue;
      const totalCommissions = orders.reduce((sum, order) => sum + (Number(order.commission_amount) || 0), 0);
      const totalPartnerPayments = orders.reduce((sum, order) => sum + (Number(order.partner_amount) || 0), 0);
      const averageCommissionRate = safePercent(totalCommissions, ordersRevenue);

      const activePromotions = promotions.filter((promotion) => {
        const approved = !promotion.approval_status || promotion.approval_status === 'approved';
        const started = new Date(promotion.start_date).toISOString() <= nowIso;
        const notExpired = new Date(promotion.end_date).toISOString() >= nowIso;
        return promotion.is_active && approved && started && notExpired;
      }).length;
      const pendingPromotionApprovals = promotions.filter((promotion) => promotion.approval_status === 'pending').length;
      const rejectedPromotions = promotions.filter((promotion) => promotion.approval_status === 'rejected').length;
      const totalViews = promotions.reduce((sum, promotion) => sum + (Number(promotion.views) || 0), 0);

      const recentWebhookLogs = [
        ...(webhookLogsResult.data || []),
        ...(crmWebhookLogsResult.data || []),
        ...(accountingWebhookLogsResult.data || []),
      ];
      const webhookFailureCount = recentWebhookLogs.filter((log) => log.success === false).length;
      const webhookDeliveryRate = safePercent(
        recentWebhookLogs.filter((log) => log.success === true).length,
        recentWebhookLogs.length
      );

      const monthlyGrowth = calculateGrowth(currentMonthUsers, previousMonthUsers);
      const conversionRate = safePercent(totalOrders + totalBookings, totalUsers);
      const orderSuccessRate = safePercent(confirmedOrders + processingOrders + shippedOrders + deliveredOrders, totalOrders);
      const bookingPerPartnerRate = totalPartners > 0 ? totalBookings / totalPartners : 0;

      setAnalytics({
        totalUsers,
        totalPartners,
        totalPosts,
        totalBookings,
        totalOrders,
        pendingOrders,
        confirmedOrders,
        processingOrders,
        shippedOrders,
        deliveredOrders,
        cancelledOrders,
        totalRevenue,
        totalCommissions,
        totalPartnerPayments,
        averageCommissionRate,
        monthlyGrowth,
        activePromotions,
        totalViews,
        currentMonthUsers,
        previousMonthUsers,
        currentMonthPartners,
        previousMonthPartners,
        currentMonthPosts,
        previousMonthPosts,
        conversionRate,
        orderSuccessRate,
        bookingPerPartnerRate,
        paymentFailedOrders,
        stalePendingOrders,
        webhookFailureCount,
        webhookDeliveryRate,
        pendingPromotionApprovals,
        rejectedPromotions,
      });
    } catch (fetchError: any) {
      console.error('Error fetching admin analytics:', fetchError);
      setError(fetchError?.message || 'No se pudieron cargar las analiticas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
    }).format(amount);

  const formatGrowth = (value: number) => {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(1)}%`;
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedTitle}>Acceso Denegado</Text>
          <Text style={styles.accessDeniedText}>
            No tienes permisos para acceder a esta sección
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Analiticas de la Plataforma</Text>
        <Text style={styles.subtitle}>Metricas reales de usuarios, operaciones y promociones</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchAnalytics(true)} tintColor="#2D6A6F" />
        }
      >
        {loading ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>Cargando analiticas...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorTitle}>No se pudo cargar analytics</Text>
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Metricas Principales</Text>
              <View style={styles.metricsGrid}>
                <Card style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Users size={24} color="#3B82F6" />
                    <Text style={styles.metricValue}>{analytics.totalUsers.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.metricLabel}>Total Usuarios</Text>
                </Card>

                <Card style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Package size={24} color="#10B981" />
                    <Text style={styles.metricValue}>{analytics.totalPartners.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.metricLabel}>Aliados Activos</Text>
                </Card>

                <Card style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <TrendingUp size={24} color="#F59E0B" />
                    <Text style={styles.metricValue}>{analytics.totalPosts.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.metricLabel}>Publicaciones</Text>
                </Card>

                <Card style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Calendar size={24} color="#8B5CF6" />
                    <Text style={styles.metricValue}>{analytics.totalBookings.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.metricLabel}>Reservas Totales</Text>
                </Card>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Analiticas de Pedidos</Text>
              <View style={styles.metricsGrid}>
                <Card style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Package size={24} color="#3B82F6" />
                    <Text style={styles.metricValue}>{analytics.totalOrders.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.metricLabel}>Total Pedidos</Text>
                </Card>

                <Card style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Clock size={24} color="#F59E0B" />
                    <Text style={styles.metricValue}>{analytics.pendingOrders.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.metricLabel}>Pendientes</Text>
                </Card>

                <Card style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <TrendingUp size={24} color="#10B981" />
                    <Text style={styles.metricValue}>{analytics.confirmedOrders.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.metricLabel}>Confirmados</Text>
                </Card>

                <Card style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Package size={24} color="#8B5CF6" />
                    <Text style={styles.metricValue}>{analytics.deliveredOrders.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.metricLabel}>Entregados</Text>
                </Card>
              </View>

              <Card style={styles.ordersBreakdownCard}>
                <Text style={styles.ordersBreakdownTitle}>Estado de Pedidos</Text>
                <View style={styles.ordersBreakdown}>
                  <View style={styles.orderStatusItem}>
                    <View style={[styles.statusIndicator, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.orderStatusLabel}>Pendientes</Text>
                    <Text style={styles.orderStatusValue}>{analytics.pendingOrders}</Text>
                  </View>

                  <View style={styles.orderStatusItem}>
                    <View style={[styles.statusIndicator, { backgroundColor: '#3B82F6' }]} />
                    <Text style={styles.orderStatusLabel}>Confirmados</Text>
                    <Text style={styles.orderStatusValue}>{analytics.confirmedOrders}</Text>
                  </View>

                  <View style={styles.orderStatusItem}>
                    <View style={[styles.statusIndicator, { backgroundColor: '#0EA5E9' }]} />
                    <Text style={styles.orderStatusLabel}>Procesando</Text>
                    <Text style={styles.orderStatusValue}>{analytics.processingOrders}</Text>
                  </View>

                  <View style={styles.orderStatusItem}>
                    <View style={[styles.statusIndicator, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.orderStatusLabel}>Enviados</Text>
                    <Text style={styles.orderStatusValue}>{analytics.shippedOrders}</Text>
                  </View>

                  <View style={styles.orderStatusItem}>
                    <View style={[styles.statusIndicator, { backgroundColor: '#059669' }]} />
                    <Text style={styles.orderStatusLabel}>Entregados</Text>
                    <Text style={styles.orderStatusValue}>{analytics.deliveredOrders}</Text>
                  </View>

                  <View style={styles.orderStatusItem}>
                    <View style={[styles.statusIndicator, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.orderStatusLabel}>Cancelados</Text>
                    <Text style={styles.orderStatusValue}>{analytics.cancelledOrders}</Text>
                  </View>
                </View>
              </Card>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ingresos y Comisiones</Text>
              <Card style={styles.revenueCard}>
                <View style={styles.revenueHeader}>
                  <DollarSign size={32} color="#10B981" />
                  <View style={styles.revenueInfo}>
                    <Text style={styles.revenueAmount}>{formatCurrency(analytics.totalRevenue)}</Text>
                    <Text style={styles.revenueLabel}>Ingresos Totales Generados</Text>
                  </View>
                </View>

                <View style={styles.revenueDetails}>
                  <View style={styles.revenueDetail}>
                    <Text style={styles.revenueDetailLabel}>Comision promedio real</Text>
                    <Text style={styles.revenueDetailValue}>{analytics.averageCommissionRate.toFixed(2)}%</Text>
                  </View>
                  <View style={styles.revenueDetail}>
                    <Text style={styles.revenueDetailLabel}>Ingresos por comisiones</Text>
                    <Text style={styles.revenueDetailValue}>{formatCurrency(analytics.totalCommissions)}</Text>
                  </View>
                </View>

                <View style={styles.commissionBreakdown}>
                  <Text style={styles.commissionBreakdownTitle}>Desglose de Comisiones</Text>
                  <View style={styles.commissionStats}>
                    <View style={styles.commissionStat}>
                      <Text style={styles.commissionStatLabel}>Total facturado</Text>
                      <Text style={styles.commissionStatValue}>{formatCurrency(analytics.totalRevenue)}</Text>
                    </View>
                    <View style={styles.commissionStat}>
                      <Text style={styles.commissionStatLabel}>Comisiones DogCatiFy</Text>
                      <Text style={styles.commissionStatValue}>{formatCurrency(analytics.totalCommissions)}</Text>
                    </View>
                    <View style={styles.commissionStat}>
                      <Text style={styles.commissionStatLabel}>Pagado a aliados</Text>
                      <Text style={styles.commissionStatValue}>{formatCurrency(analytics.totalPartnerPayments)}</Text>
                    </View>
                  </View>
                </View>
              </Card>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Engagement y Promociones</Text>
              <View style={styles.engagementGrid}>
                <Card style={styles.engagementCard}>
                  <View style={styles.engagementHeader}>
                    <Eye size={20} color="#6B7280" />
                    <Text style={styles.engagementValue}>{analytics.totalViews.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.engagementLabel}>Vistas reales de promociones</Text>
                </Card>

                <Card style={styles.engagementCard}>
                  <View style={styles.engagementHeader}>
                    <TrendingUp size={20} color="#6B7280" />
                    <Text style={styles.engagementValue}>{analytics.activePromotions}</Text>
                  </View>
                  <Text style={styles.engagementLabel}>Promociones activas</Text>
                </Card>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tendencias de Crecimiento</Text>
              <Card style={styles.trendsCard}>
                <View style={styles.trendItem}>
                  <Text style={styles.trendLabel}>Usuarios registrados este mes</Text>
                  <Text style={styles.trendValue}>{analytics.currentMonthUsers}</Text>
                  <Text style={styles.trendPercentage}>{formatGrowth(calculateGrowth(analytics.currentMonthUsers, analytics.previousMonthUsers))}</Text>
                </View>

                <View style={styles.trendItem}>
                  <Text style={styles.trendLabel}>Nuevos aliados este mes</Text>
                  <Text style={styles.trendValue}>{analytics.currentMonthPartners}</Text>
                  <Text style={styles.trendPercentage}>{formatGrowth(calculateGrowth(analytics.currentMonthPartners, analytics.previousMonthPartners))}</Text>
                </View>

                <View style={styles.trendItem}>
                  <Text style={styles.trendLabel}>Publicaciones este mes</Text>
                  <Text style={styles.trendValue}>{analytics.currentMonthPosts}</Text>
                  <Text style={styles.trendPercentage}>{formatGrowth(calculateGrowth(analytics.currentMonthPosts, analytics.previousMonthPosts))}</Text>
                </View>
              </Card>
            </View>

            {advancedAnalyticsEnabled ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Salud de la Plataforma</Text>
                  <Card style={styles.healthCard}>
                    <View style={styles.healthMetrics}>
                      <View style={styles.healthMetric}>
                        <Text style={styles.healthMetricLabel}>Conversion a transacciones</Text>
                        <Text style={styles.healthMetricValue}>{analytics.conversionRate.toFixed(1)}%</Text>
                      </View>

                      <View style={styles.healthMetric}>
                        <Text style={styles.healthMetricLabel}>Exito operativo de pedidos</Text>
                        <Text style={styles.healthMetricValue}>{analytics.orderSuccessRate.toFixed(1)}%</Text>
                      </View>

                      <View style={styles.healthMetric}>
                        <Text style={styles.healthMetricLabel}>Reservas por aliado</Text>
                        <Text style={styles.healthMetricValue}>{analytics.bookingPerPartnerRate.toFixed(1)}</Text>
                      </View>
                    </View>
                  </Card>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Salud Operativa</Text>
                  <View style={styles.metricsGrid}>
                    <Card style={styles.metricCard}>
                      <View style={styles.metricHeader}>
                        <Clock size={24} color="#DC2626" />
                        <Text style={styles.metricValue}>{analytics.paymentFailedOrders}</Text>
                      </View>
                      <Text style={styles.metricLabel}>Pagos fallidos</Text>
                    </Card>

                    <Card style={styles.metricCard}>
                      <View style={styles.metricHeader}>
                        <Package size={24} color="#F97316" />
                        <Text style={styles.metricValue}>{analytics.stalePendingOrders}</Text>
                      </View>
                      <Text style={styles.metricLabel}>Pedidos atascados +2h</Text>
                    </Card>

                    <Card style={styles.metricCard}>
                      <View style={styles.metricHeader}>
                        <Eye size={24} color="#7C3AED" />
                        <Text style={styles.metricValue}>{analytics.webhookFailureCount}</Text>
                      </View>
                      <Text style={styles.metricLabel}>Fallos webhook 7 dias</Text>
                    </Card>

                    <Card style={styles.metricCard}>
                      <View style={styles.metricHeader}>
                        <TrendingUp size={24} color="#0F766E" />
                        <Text style={styles.metricValue}>{analytics.webhookDeliveryRate.toFixed(1)}%</Text>
                      </View>
                      <Text style={styles.metricLabel}>Entrega webhook 7 dias</Text>
                    </Card>
                  </View>

                  <Card style={styles.trendsCard}>
                    <View style={styles.trendItem}>
                      <Text style={styles.trendLabel}>Promociones pendientes de aprobacion</Text>
                      <Text style={styles.trendValue}>{analytics.pendingPromotionApprovals}</Text>
                      <Text style={styles.trendPercentage}>{analytics.pendingPromotionApprovals > 0 ? 'Revisar' : 'OK'}</Text>
                    </View>

                    <View style={styles.trendItem}>
                      <Text style={styles.trendLabel}>Promociones rechazadas</Text>
                      <Text style={styles.trendValue}>{analytics.rejectedPromotions}</Text>
                      <Text style={styles.trendPercentage}>{analytics.rejectedPromotions > 0 ? 'Atencion' : 'OK'}</Text>
                    </View>
                  </Card>
                </View>
              </>
            ) : (
              <View style={styles.section}>
                <Card style={styles.stateBox}>
                  <Text style={styles.stateText}>
                    Las analíticas avanzadas están desactivadas desde Configuración del Sistema.
                  </Text>
                </Card>
              </View>
            )}
          </>
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  stateBox: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
  },
  stateText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#991B1B',
    marginBottom: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  metricLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  revenueCard: {
    marginHorizontal: 16,
  },
  revenueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  revenueInfo: {
    marginLeft: 12,
    flex: 1,
  },
  revenueAmount: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  revenueLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  revenueDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  revenueDetail: {
    alignItems: 'center',
    flex: 1,
  },
  revenueDetailLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  revenueDetailValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  engagementGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  engagementCard: {
    flex: 1,
    padding: 16,
  },
  engagementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  engagementValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  engagementLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  trendsCard: {
    marginHorizontal: 16,
  },
  trendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  trendLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    flex: 1,
    paddingRight: 8,
  },
  trendValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginRight: 8,
  },
  trendPercentage: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
    minWidth: 64,
    textAlign: 'right',
  },
  healthCard: {
    marginHorizontal: 16,
  },
  healthMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  healthMetric: {
    alignItems: 'center',
    flex: 1,
  },
  healthMetricLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  healthMetricValue: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#8B5CF6',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#EF4444',
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  ordersBreakdownCard: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  ordersBreakdownTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  ordersBreakdown: {
    gap: 12,
  },
  orderStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  orderStatusLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    flex: 1,
  },
  orderStatusValue: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  commissionBreakdown: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  commissionBreakdownTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  commissionStats: {
    gap: 8,
  },
  commissionStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commissionStatLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  commissionStatValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
});
