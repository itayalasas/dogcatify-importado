import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, RefreshControl } from 'react-native';
import { Skeleton, EmptyState, Button } from '../../components/ui';
import { TrendingUp, Users, Package, Clock, Crown, Shield, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { getPartnerPlan, normalizePartnerPlanTier, resolvePartnerAccountSubscription, type PartnerPlanTier } from '../../utils/partnerPlans';
import { colors, radius, spacing, typography } from '../../constants/theme';

const SYSTEM_CONFIG_KEY = 'system_config';
const SUBSCRIPTION_EXPIRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type UserPlanTier = 'free' | 'standard' | 'premium';

type UserSubscriptionPlan = {
  tier?: string | null;
  name?: string | null;
  audience_target?: string | null;
};

type UserSubscriptionRow = {
  id: string;
  user_id: string;
  status?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  trial_ends_at?: string | null;
  subscription_plans?: UserSubscriptionPlan | null;
};

type PartnerAnalyticsRow = {
  id: string;
  user_id?: string | null;
  created_at?: string | null;
  subscription_plan_tier?: string | null;
  subscription_plan_status?: string | null;
  subscription_plan_expires_at?: string | null;
  is_verified?: boolean | null;
  is_active?: boolean | null;
};

const normalizeUserPlanTier = (value?: string | null): UserPlanTier => {
  const normalized = String(value || '').toLowerCase();

  if (normalized === 'standard' || normalized === 'plus') return 'standard';
  if (normalized === 'premium' || normalized === 'pro') return 'premium';
  return 'free';
};

const parseTimestamp = (value?: string | null) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const isCurrentSubscriptionLike = (status?: string | null, expiresAt?: string | null) => {
  const normalized = String(status || '').toLowerCase();
  const expiresTimestamp = parseTimestamp(expiresAt);
  const hasFutureAccess = expiresTimestamp !== null && expiresTimestamp > Date.now();

  return (
    normalized === 'active' ||
    normalized === 'trialing' ||
    normalized === 'paused' ||
    (normalized === 'cancelled' && hasFutureAccess)
  );
};

const isPendingSubscriptionLike = (status?: string | null) => String(status || '').toLowerCase() === 'pending';

const isExpiredSubscriptionLike = (status?: string | null, expiresAt?: string | null) => {
  const normalized = String(status || '').toLowerCase();
  const expiresTimestamp = parseTimestamp(expiresAt);
  const hasFutureAccess = expiresTimestamp !== null && expiresTimestamp > Date.now();

  return (
    normalized === 'expired' ||
    normalized === 'past_due' ||
    (normalized === 'cancelled' && !hasFutureAccess)
  );
};

const getSubscriptionExpiryTimestamp = (
  status?: string | null,
  expiresAt?: string | null,
  trialEndsAt?: string | null,
) => {
  const normalized = String(status || '').toLowerCase();
  return parseTimestamp(normalized === 'trialing' ? trialEndsAt || expiresAt : expiresAt || trialEndsAt);
};

const isExpiringSoon = (
  status?: string | null,
  expiresAt?: string | null,
  trialEndsAt?: string | null,
) => {
  const expiryTimestamp = getSubscriptionExpiryTimestamp(status, expiresAt, trialEndsAt);
  if (!expiryTimestamp) return false;

  const now = Date.now();
  return expiryTimestamp > now && expiryTimestamp <= now + SUBSCRIPTION_EXPIRY_WINDOW_MS;
};

const getPartnerAccountCreatedAt = (rows: PartnerAnalyticsRow[]) => {
  const timestamps = rows
    .map((row) => parseTimestamp(row.created_at))
    .filter((value): value is number => value !== null);

  if (timestamps.length === 0) return null;

  return new Date(Math.min(...timestamps)).toISOString();
};

type AnalyticsState = {
  totalUsers: number;
  totalPartners: number;
  totalPartnerAccounts: number;
  currentUserSubscriptions: number;
  trialingUserSubscriptions: number;
  pendingUserSubscriptions: number;
  expiredUserSubscriptions: number;
  expiringSoonUserSubscriptions: number;
  currentPartnerAccounts: number;
  trialingPartnerAccounts: number;
  pendingPartnerAccounts: number;
  expiredPartnerAccounts: number;
  expiringSoonPartnerAccounts: number;
  currentMonthUserSubscriptions: number;
  previousMonthUserSubscriptions: number;
  currentMonthPartnerAccounts: number;
  previousMonthPartnerAccounts: number;
  userFreeSubscriptions: number;
  userStandardSubscriptions: number;
  userPremiumSubscriptions: number;
  partnerStarterAccounts: number;
  partnerGrowthAccounts: number;
  partnerProAccounts: number;
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
  totalPartnerAccounts: 0,
  currentUserSubscriptions: 0,
  trialingUserSubscriptions: 0,
  pendingUserSubscriptions: 0,
  expiredUserSubscriptions: 0,
  expiringSoonUserSubscriptions: 0,
  currentPartnerAccounts: 0,
  trialingPartnerAccounts: 0,
  pendingPartnerAccounts: 0,
  expiredPartnerAccounts: 0,
  expiringSoonPartnerAccounts: 0,
  currentMonthUserSubscriptions: 0,
  previousMonthUserSubscriptions: 0,
  currentMonthPartnerAccounts: 0,
  previousMonthPartnerAccounts: 0,
  userFreeSubscriptions: 0,
  userStandardSubscriptions: 0,
  userPremiumSubscriptions: 0,
  partnerStarterAccounts: 0,
  partnerGrowthAccounts: 0,
  partnerProAccounts: 0,
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

  const isAdmin = currentUser?.isAdmin === true;

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
        partnerSubscriptionRowsResult,
        userSubscriptionsResult,
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
        supabaseClient.from('partners').select('id, user_id, created_at, subscription_plan_tier, subscription_plan_status, subscription_plan_expires_at').eq('is_verified', true).eq('is_active', true),
        supabaseClient.from('user_subscriptions').select('id, user_id, status, created_at, expires_at, trial_ends_at, subscription_plans ( id, name, tier, audience_target )'),
        supabaseClient.from('bookings').select('id, total_amount'),
        supabaseClient.from('orders').select('id, status, total_amount, commission_amount, partner_amount, created_at').eq('is_split_master', false),
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
        partnerSubscriptionRowsResult,
        userSubscriptionsResult,
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

      const partnerRows = (partnerSubscriptionRowsResult.data || []) as PartnerAnalyticsRow[];
      const partnerRowsByUser = partnerRows.reduce((acc, row) => {
        const key = String(row.user_id || row.id);
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(row);
        return acc;
      }, {} as Record<string, PartnerAnalyticsRow[]>);

      const partnerAccounts = Object.entries(partnerRowsByUser).map(([userId, rows]) => {
        const accountSubscription = resolvePartnerAccountSubscription(rows);
        const normalizedTier = normalizePartnerPlanTier(accountSubscription?.subscriptionPlanTier || rows[0]?.subscription_plan_tier);

        return {
          userId,
          rows,
          createdAt: getPartnerAccountCreatedAt(rows),
          subscriptionPlanTier: normalizedTier,
          subscriptionPlanStatus: accountSubscription?.subscriptionPlanStatus || rows[0]?.subscription_plan_status || 'pending',
          subscriptionPlanExpiresAt: accountSubscription?.subscriptionPlanExpiresAt || rows[0]?.subscription_plan_expires_at || null,
        };
      });

      const userSubscriptions = (userSubscriptionsResult.data || []) as UserSubscriptionRow[];

      const totalPartnerAccounts = partnerAccounts.length;
      const currentPartnerAccounts = partnerAccounts.filter((account) =>
        isCurrentSubscriptionLike(account.subscriptionPlanStatus, account.subscriptionPlanExpiresAt)
      ).length;
      const trialingPartnerAccounts = partnerAccounts.filter((account) =>
        String(account.subscriptionPlanStatus || '').toLowerCase() === 'trialing'
      ).length;
      const pendingPartnerAccounts = partnerAccounts.filter((account) =>
        isPendingSubscriptionLike(account.subscriptionPlanStatus)
      ).length;
      const expiredPartnerAccounts = partnerAccounts.filter((account) =>
        isExpiredSubscriptionLike(account.subscriptionPlanStatus, account.subscriptionPlanExpiresAt)
      ).length;
      const expiringSoonPartnerAccounts = partnerAccounts.filter((account) =>
        isExpiringSoon(account.subscriptionPlanStatus, account.subscriptionPlanExpiresAt)
      ).length;
      const currentMonthPartnerAccounts = partnerAccounts.filter((account) => {
        const createdAtTimestamp = parseTimestamp(account.createdAt);
        return (
          createdAtTimestamp !== null &&
          createdAtTimestamp >= parseTimestamp(currentMonthStart)! &&
          createdAtTimestamp < parseTimestamp(nextMonthStart)!
        );
      }).length;
      const previousMonthPartnerAccounts = partnerAccounts.filter((account) => {
        const createdAtTimestamp = parseTimestamp(account.createdAt);
        return (
          createdAtTimestamp !== null &&
          createdAtTimestamp >= parseTimestamp(previousMonthStart)! &&
          createdAtTimestamp < parseTimestamp(currentMonthStart)!
        );
      }).length;

      const partnerStarterAccounts = partnerAccounts.filter((account) => account.subscriptionPlanTier === 'starter').length;
      const partnerGrowthAccounts = partnerAccounts.filter((account) => account.subscriptionPlanTier === 'growth').length;
      const partnerProAccounts = partnerAccounts.filter((account) => account.subscriptionPlanTier === 'pro').length;

      const currentUserSubscriptions = userSubscriptions.filter((row) =>
        isCurrentSubscriptionLike(row.status, row.expires_at || row.trial_ends_at)
      ).length;
      const trialingUserSubscriptions = userSubscriptions.filter((row) =>
        String(row.status || '').toLowerCase() === 'trialing'
      ).length;
      const pendingUserSubscriptions = userSubscriptions.filter((row) =>
        isPendingSubscriptionLike(row.status)
      ).length;
      const expiredUserSubscriptions = userSubscriptions.filter((row) =>
        isExpiredSubscriptionLike(row.status, row.expires_at || row.trial_ends_at)
      ).length;
      const expiringSoonUserSubscriptions = userSubscriptions.filter((row) =>
        isExpiringSoon(row.status, row.expires_at, row.trial_ends_at)
      ).length;
      const currentMonthUserSubscriptions = userSubscriptions.filter((row) => {
        const createdAtTimestamp = parseTimestamp(row.created_at);
        return (
          createdAtTimestamp !== null &&
          createdAtTimestamp >= parseTimestamp(currentMonthStart)! &&
          createdAtTimestamp < parseTimestamp(nextMonthStart)!
        );
      }).length;
      const previousMonthUserSubscriptions = userSubscriptions.filter((row) => {
        const createdAtTimestamp = parseTimestamp(row.created_at);
        return (
          createdAtTimestamp !== null &&
          createdAtTimestamp >= parseTimestamp(previousMonthStart)! &&
          createdAtTimestamp < parseTimestamp(currentMonthStart)!
        );
      }).length;

      const userFreeSubscriptions = userSubscriptions.filter((row) =>
        isCurrentSubscriptionLike(row.status, row.expires_at || row.trial_ends_at) &&
        normalizeUserPlanTier(row.subscription_plans?.tier || row.subscription_plans?.name) === 'free'
      ).length;
      const userStandardSubscriptions = userSubscriptions.filter((row) =>
        isCurrentSubscriptionLike(row.status, row.expires_at || row.trial_ends_at) &&
        normalizeUserPlanTier(row.subscription_plans?.tier || row.subscription_plans?.name) === 'standard'
      ).length;
      const userPremiumSubscriptions = userSubscriptions.filter((row) =>
        isCurrentSubscriptionLike(row.status, row.expires_at || row.trial_ends_at) &&
        normalizeUserPlanTier(row.subscription_plans?.tier || row.subscription_plans?.name) === 'premium'
      ).length;

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
        totalPartnerAccounts,
        currentUserSubscriptions,
        trialingUserSubscriptions,
        pendingUserSubscriptions,
        expiredUserSubscriptions,
        expiringSoonUserSubscriptions,
        currentPartnerAccounts,
        trialingPartnerAccounts,
        pendingPartnerAccounts,
        expiredPartnerAccounts,
        expiringSoonPartnerAccounts,
        currentMonthUserSubscriptions,
        previousMonthUserSubscriptions,
        currentMonthPartnerAccounts,
        previousMonthPartnerAccounts,
        userFreeSubscriptions,
        userStandardSubscriptions,
        userPremiumSubscriptions,
        partnerStarterAccounts,
        partnerGrowthAccounts,
        partnerProAccounts,
      });
    } catch (fetchError: any) {
      console.error('Error fetching admin analytics:', fetchError);
      setError(fetchError?.message || 'No se pudieron cargar las analíticas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatGrowth = (value: number) => {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(1)}%`;
  };

  const userPlanBreakdown = [
    { label: 'Free', value: analytics.userFreeSubscriptions, color: '#2563EB' },
    { label: 'Standard', value: analytics.userStandardSubscriptions, color: '#047857' },
    { label: 'Premium', value: analytics.userPremiumSubscriptions, color: '#7C3AED' },
  ];

  const partnerPlanBreakdown = [
    { label: getPartnerPlan('starter').name, value: analytics.partnerStarterAccounts, color: getPartnerPlan('starter').accent },
    { label: getPartnerPlan('growth').name, value: analytics.partnerGrowthAccounts, color: getPartnerPlan('growth').accent },
    { label: getPartnerPlan('pro').name, value: analytics.partnerProAccounts, color: getPartnerPlan('pro').accent },
  ];

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedTitle}>Acceso denegado</Text>
          <Text style={styles.accessDeniedText}>
            No tenés permisos para acceder a esta sección
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">Estadísticas</Text>
        <Text style={styles.subtitle}>Suscripciones de dueños y aliados, planes y crecimiento</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchAnalytics(true)} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {loading ? (
          <View style={styles.skeletonWrap} accessibilityRole="progressbar" accessibilityLabel="Cargando estadísticas">
            <Skeleton width="45%" height={18} />
            <View style={styles.skeletonGrid}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} width="48%" height={92} borderRadius={radius.lg} style={styles.skeletonTile} />
              ))}
            </View>
            <Skeleton width="45%" height={18} style={styles.skeletonGap} />
            <Skeleton height={160} borderRadius={radius.lg} style={styles.skeletonTile} />
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorTitle}>No se pudieron cargar las estadísticas</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Button title="Reintentar" onPress={() => fetchAnalytics()} fullWidth={false} style={styles.retryButton} />
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">Resumen de suscripciones</Text>
              <View style={styles.metricsGrid}>
                <Card style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Users size={24} color="#3B82F6" />
                    <Text style={styles.metricValue}>{analytics.totalUsers.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.metricLabel}>Total usuarios</Text>
                </Card>

                <Card style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Package size={24} color="#10B981" />
                    <Text style={styles.metricValue}>{analytics.totalPartners.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.metricLabel}>Negocios aliados</Text>
                </Card>

                <Card style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Shield size={24} color="#2563EB" />
                    <Text style={styles.metricValue}>{analytics.currentUserSubscriptions.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.metricLabel}>Dueños vigentes</Text>
                </Card>

                <Card style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Crown size={24} color="#047857" />
                    <Text style={styles.metricValue}>{analytics.currentPartnerAccounts.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.metricLabel}>Aliados vigentes</Text>
                </Card>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">Saldos de suscripciones</Text>
              <View style={styles.saldoGrid}>
                <Card style={styles.saldoCard}>
                  <View style={styles.saldoHeader}>
                    <Shield size={28} color="#2563EB" />
                    <View style={styles.saldoHeaderText}>
                      <Text style={styles.saldoLabel}>Dueños</Text>
                      <Text style={styles.saldoValue}>{analytics.currentUserSubscriptions.toLocaleString()}</Text>
                    </View>
                  </View>

                  <View style={styles.saldoRows}>
                    <View style={styles.saldoRow}>
                      <Text style={styles.saldoRowLabel}>Vigentes</Text>
                      <Text style={styles.saldoRowValue}>{analytics.currentUserSubscriptions}</Text>
                    </View>
                    <View style={styles.saldoRow}>
                      <Text style={styles.saldoRowLabel}>En prueba</Text>
                      <Text style={styles.saldoRowValue}>{analytics.trialingUserSubscriptions}</Text>
                    </View>
                    <View style={styles.saldoRow}>
                      <Text style={styles.saldoRowLabel}>Pendientes</Text>
                      <Text style={styles.saldoRowValue}>{analytics.pendingUserSubscriptions}</Text>
                    </View>
                    <View style={styles.saldoRow}>
                      <Text style={styles.saldoRowLabel}>Vencidas</Text>
                      <Text style={styles.saldoRowValue}>{analytics.expiredUserSubscriptions}</Text>
                    </View>
                  </View>
                </Card>

                <Card style={styles.saldoCard}>
                  <View style={styles.saldoHeader}>
                    <Crown size={28} color="#047857" />
                    <View style={styles.saldoHeaderText}>
                      <Text style={styles.saldoLabel}>Aliados</Text>
                      <Text style={styles.saldoValue}>{analytics.currentPartnerAccounts.toLocaleString()}</Text>
                    </View>
                  </View>

                  <View style={styles.saldoRows}>
                    <View style={styles.saldoRow}>
                      <Text style={styles.saldoRowLabel}>Vigentes</Text>
                      <Text style={styles.saldoRowValue}>{analytics.currentPartnerAccounts}</Text>
                    </View>
                    <View style={styles.saldoRow}>
                      <Text style={styles.saldoRowLabel}>En prueba</Text>
                      <Text style={styles.saldoRowValue}>{analytics.trialingPartnerAccounts}</Text>
                    </View>
                    <View style={styles.saldoRow}>
                      <Text style={styles.saldoRowLabel}>Pendientes</Text>
                      <Text style={styles.saldoRowValue}>{analytics.pendingPartnerAccounts}</Text>
                    </View>
                    <View style={styles.saldoRow}>
                      <Text style={styles.saldoRowLabel}>Vencidas</Text>
                      <Text style={styles.saldoRowValue}>{analytics.expiredPartnerAccounts}</Text>
                    </View>
                  </View>
                </Card>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">Estado de suscripciones</Text>
              <View style={styles.metricsGrid}>
                <Card style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Clock size={24} color="#F59E0B" />
                    <Text style={styles.metricValue}>
                      {(analytics.pendingUserSubscriptions + analytics.pendingPartnerAccounts).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.metricLabel}>Pendientes</Text>
                </Card>

                <Card style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Sparkles size={24} color="#7C3AED" />
                    <Text style={styles.metricValue}>
                      {(analytics.trialingUserSubscriptions + analytics.trialingPartnerAccounts).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.metricLabel}>En prueba</Text>
                </Card>

                <Card style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <AlertTriangle size={24} color="#EA580C" />
                    <Text style={styles.metricValue}>
                      {(analytics.expiringSoonUserSubscriptions + analytics.expiringSoonPartnerAccounts).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.metricLabel}>Vencen pronto</Text>
                </Card>

                <Card style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <RefreshCw size={24} color="#6B7280" />
                    <Text style={styles.metricValue}>
                      {(analytics.expiredUserSubscriptions + analytics.expiredPartnerAccounts).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.metricLabel}>Vencidas / Canceladas</Text>
                </Card>
              </View>

              <Card style={styles.ordersBreakdownCard}>
                <Text style={styles.ordersBreakdownTitle}>Detalle por audiencia</Text>
                <View style={styles.ordersBreakdown}>
                  <View style={styles.orderStatusItem}>
                    <View style={[styles.statusIndicator, { backgroundColor: '#2563EB' }]} />
                    <Text style={styles.orderStatusLabel}>Dueños vigentes</Text>
                    <Text style={styles.orderStatusValue}>{analytics.currentUserSubscriptions}</Text>
                  </View>

                  <View style={styles.orderStatusItem}>
                    <View style={[styles.statusIndicator, { backgroundColor: '#7C3AED' }]} />
                    <Text style={styles.orderStatusLabel}>Dueños en prueba</Text>
                    <Text style={styles.orderStatusValue}>{analytics.trialingUserSubscriptions}</Text>
                  </View>

                  <View style={styles.orderStatusItem}>
                    <View style={[styles.statusIndicator, { backgroundColor: '#047857' }]} />
                    <Text style={styles.orderStatusLabel}>Aliados vigentes</Text>
                    <Text style={styles.orderStatusValue}>{analytics.currentPartnerAccounts}</Text>
                  </View>

                  <View style={styles.orderStatusItem}>
                    <View style={[styles.statusIndicator, { backgroundColor: '#A855F7' }]} />
                    <Text style={styles.orderStatusLabel}>Aliados en prueba</Text>
                    <Text style={styles.orderStatusValue}>{analytics.trialingPartnerAccounts}</Text>
                  </View>
                </View>
              </Card>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">Planes de dueños</Text>
              <Card style={styles.revenueCard}>
                <View style={styles.revenueHeader}>
                  <Shield size={32} color="#2563EB" />
                  <View style={styles.revenueInfo}>
                    <Text style={styles.revenueAmount}>{analytics.currentUserSubscriptions.toLocaleString()}</Text>
                    <Text style={styles.revenueLabel}>Suscripciones vigentes de dueños</Text>
                  </View>
                </View>

                <View style={styles.revenueDetails}>
                  <View style={styles.revenueDetail}>
                    <Text style={styles.revenueDetailLabel}>Free</Text>
                    <Text style={[styles.revenueDetailValue, { color: '#2563EB' }]}>{analytics.userFreeSubscriptions}</Text>
                  </View>
                  <View style={styles.revenueDetail}>
                    <Text style={styles.revenueDetailLabel}>Standard</Text>
                    <Text style={[styles.revenueDetailValue, { color: '#047857' }]}>{analytics.userStandardSubscriptions}</Text>
                  </View>
                  <View style={styles.revenueDetail}>
                    <Text style={styles.revenueDetailLabel}>Premium</Text>
                    <Text style={[styles.revenueDetailValue, { color: '#7C3AED' }]}>{analytics.userPremiumSubscriptions}</Text>
                  </View>
                </View>

                <View style={styles.commissionBreakdown}>
                  <Text style={styles.commissionBreakdownTitle}>Estados del usuario</Text>
                  <View style={styles.commissionStats}>
                    <View style={styles.commissionStat}>
                      <Text style={styles.commissionStatLabel}>Pendientes</Text>
                      <Text style={styles.commissionStatValue}>{analytics.pendingUserSubscriptions}</Text>
                    </View>
                    <View style={styles.commissionStat}>
                      <Text style={styles.commissionStatLabel}>En prueba</Text>
                      <Text style={styles.commissionStatValue}>{analytics.trialingUserSubscriptions}</Text>
                    </View>
                    <View style={styles.commissionStat}>
                      <Text style={styles.commissionStatLabel}>Vencidas</Text>
                      <Text style={styles.commissionStatValue}>{analytics.expiredUserSubscriptions}</Text>
                    </View>
                  </View>
                </View>
              </Card>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">Planes de aliados</Text>
              <Card style={styles.revenueCard}>
                <View style={styles.revenueHeader}>
                  <Crown size={32} color="#047857" />
                  <View style={styles.revenueInfo}>
                    <Text style={styles.revenueAmount}>{analytics.currentPartnerAccounts.toLocaleString()}</Text>
                    <Text style={styles.revenueLabel}>Cuentas aliadas vigentes</Text>
                  </View>
                </View>

                <View style={styles.revenueDetails}>
                  {partnerPlanBreakdown.map((plan) => (
                    <View style={styles.revenueDetail} key={plan.label}>
                      <Text style={styles.revenueDetailLabel}>{plan.label}</Text>
                      <Text style={[styles.revenueDetailValue, { color: plan.color }]}>{plan.value}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.commissionBreakdown}>
                  <Text style={styles.commissionBreakdownTitle}>Estados del aliado</Text>
                  <View style={styles.commissionStats}>
                    <View style={styles.commissionStat}>
                      <Text style={styles.commissionStatLabel}>Pendientes</Text>
                      <Text style={styles.commissionStatValue}>{analytics.pendingPartnerAccounts}</Text>
                    </View>
                    <View style={styles.commissionStat}>
                      <Text style={styles.commissionStatLabel}>En prueba</Text>
                      <Text style={styles.commissionStatValue}>{analytics.trialingPartnerAccounts}</Text>
                    </View>
                    <View style={styles.commissionStat}>
                      <Text style={styles.commissionStatLabel}>Vencidas</Text>
                      <Text style={styles.commissionStatValue}>{analytics.expiredPartnerAccounts}</Text>
                    </View>
                  </View>
                </View>
              </Card>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Crecimiento mensual</Text>
              <Card style={styles.trendsCard}>
                <View style={styles.trendItem}>
                  <Text style={styles.trendLabel}>Suscripciones de dueños nuevas</Text>
                  <Text style={styles.trendValue}>{analytics.currentMonthUserSubscriptions}</Text>
                  <Text style={styles.trendPercentage}>
                    {formatGrowth(calculateGrowth(analytics.currentMonthUserSubscriptions, analytics.previousMonthUserSubscriptions))}
                  </Text>
                </View>

                <View style={styles.trendItem}>
                  <Text style={styles.trendLabel}>Cuentas aliadas nuevas</Text>
                  <Text style={styles.trendValue}>{analytics.currentMonthPartnerAccounts}</Text>
                  <Text style={styles.trendPercentage}>
                    {formatGrowth(calculateGrowth(analytics.currentMonthPartnerAccounts, analytics.previousMonthPartnerAccounts))}
                  </Text>
                </View>

                <View style={styles.trendItem}>
                  <Text style={styles.trendLabel}>Usuarios registrados este mes</Text>
                  <Text style={styles.trendValue}>{analytics.currentMonthUsers}</Text>
                  <Text style={styles.trendPercentage}>
                    {formatGrowth(calculateGrowth(analytics.currentMonthUsers, analytics.previousMonthUsers))}
                  </Text>
                </View>
              </Card>
            </View>

            {advancedAnalyticsEnabled ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Salud de suscripciones</Text>
                  <Card style={styles.healthCard}>
                    <View style={styles.healthMetrics}>
                      <View style={styles.healthMetric}>
                        <RefreshCw size={22} color="#0F766E" />
                        <Text style={styles.healthMetricLabel}>Renovaciones en curso</Text>
                        <Text style={styles.healthMetricValue}>
                          {analytics.currentUserSubscriptions + analytics.currentPartnerAccounts}
                        </Text>
                      </View>

                      <View style={styles.healthMetric}>
                        <Sparkles size={22} color="#7C3AED" />
                        <Text style={styles.healthMetricLabel}>En prueba</Text>
                        <Text style={styles.healthMetricValue}>
                          {analytics.trialingUserSubscriptions + analytics.trialingPartnerAccounts}
                        </Text>
                      </View>

                      <View style={styles.healthMetric}>
                        <AlertTriangle size={22} color="#EA580C" />
                        <Text style={styles.healthMetricLabel}>Vencen pronto</Text>
                        <Text style={styles.healthMetricValue}>
                          {analytics.expiringSoonUserSubscriptions + analytics.expiringSoonPartnerAccounts}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Resumen operativo</Text>
                  <View style={styles.metricsGrid}>
                    <Card style={styles.metricCard}>
                      <View style={styles.metricHeader}>
                        <Clock size={24} color="#DC2626" />
                        <Text style={styles.metricValue}>{analytics.pendingUserSubscriptions + analytics.pendingPartnerAccounts}</Text>
                      </View>
                      <Text style={styles.metricLabel}>Pendientes</Text>
                    </Card>

                    <Card style={styles.metricCard}>
                      <View style={styles.metricHeader}>
                        <Package size={24} color="#F97316" />
                        <Text style={styles.metricValue}>{analytics.expiredUserSubscriptions + analytics.expiredPartnerAccounts}</Text>
                      </View>
                      <Text style={styles.metricLabel}>Vencidas / canceladas</Text>
                    </Card>

                    <Card style={styles.metricCard}>
                      <View style={styles.metricHeader}>
                        <Users size={24} color="#7C3AED" />
                        <Text style={styles.metricValue}>{analytics.totalUsers.toLocaleString()}</Text>
                      </View>
                      <Text style={styles.metricLabel}>Total usuarios</Text>
                    </Card>

                    <Card style={styles.metricCard}>
                      <View style={styles.metricHeader}>
                        <TrendingUp size={24} color="#0F766E" />
                        <Text style={styles.metricValue}>{analytics.totalPartners.toLocaleString()}</Text>
                      </View>
                      <Text style={styles.metricLabel}>Negocios aliados</Text>
                    </Card>
                  </View>

                  <Card style={styles.trendsCard}>
                    <View style={styles.trendItem}>
                      <Text style={styles.trendLabel}>Suscripciones de dueños pendientes</Text>
                      <Text style={styles.trendValue}>{analytics.pendingUserSubscriptions}</Text>
                      <Text style={styles.trendPercentage}>{analytics.pendingUserSubscriptions > 0 ? 'Revisar' : 'OK'}</Text>
                    </View>

                    <View style={styles.trendItem}>
                      <Text style={styles.trendLabel}>Suscripciones de aliados pendientes</Text>
                      <Text style={styles.trendValue}>{analytics.pendingPartnerAccounts}</Text>
                      <Text style={styles.trendPercentage}>{analytics.pendingPartnerAccounts > 0 ? 'Revisar' : 'OK'}</Text>
                    </View>
                  </Card>
                </View>
              </>
            ) : (
              <View style={styles.section}>
                <Card style={styles.stateBox}>
                  <Text style={styles.stateText}>
                    Las analíticas detalladas están desactivadas desde Configuración del Sistema.
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
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: 50,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 27,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
  content: {
    flex: 1,
  },
  skeletonWrap: {
    padding: spacing.lg,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  skeletonTile: {
    marginBottom: spacing.md,
  },
  skeletonGap: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  stateBox: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: 40,
    alignItems: 'center',
  },
  stateText: {
    ...typography.bodySmall,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  errorTitle: {
    ...typography.heading,
    color: '#991B1B',
    marginBottom: spacing.sm,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.lg,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  metricValue: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 32,
    color: colors.text,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  revenueCard: {
    marginHorizontal: spacing.lg,
  },
  revenueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  revenueInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  revenueAmount: {
    ...typography.display,
    color: '#10B981',
  },
  revenueLabel: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  revenueDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  revenueDetail: {
    alignItems: 'center',
    flex: 1,
  },
  revenueDetailLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  revenueDetailValue: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  engagementGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  engagementCard: {
    flex: 1,
    padding: spacing.lg,
  },
  engagementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  engagementValue: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 27,
    color: colors.text,
  },
  engagementLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  trendsCard: {
    marginHorizontal: spacing.lg,
  },
  trendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  trendLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    paddingRight: spacing.sm,
  },
  trendValue: {
    ...typography.bodyStrong,
    color: colors.text,
    marginRight: spacing.sm,
  },
  trendPercentage: {
    ...typography.label,
    color: '#10B981',
    minWidth: 64,
    textAlign: 'right',
  },
  healthCard: {
    marginHorizontal: spacing.lg,
  },
  healthMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: spacing.md,
  },
  healthMetric: {
    alignItems: 'center',
    flex: 1,
  },
  healthMetricLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  healthMetricValue: {
    ...typography.heading,
    color: '#8B5CF6',
  },
  saldoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  saldoCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.lg,
  },
  saldoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  saldoHeaderText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  saldoLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.xxs,
  },
  saldoValue: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 32,
    color: colors.text,
  },
  saldoRows: {
    gap: spacing.sm,
  },
  saldoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saldoRowLabel: {
    ...typography.bodySmall,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textTertiary,
  },
  saldoRowValue: {
    ...typography.label,
    color: colors.text,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  accessDeniedTitle: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 32,
    color: '#EF4444',
    marginBottom: spacing.sm,
  },
  accessDeniedText: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  ordersBreakdownCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  ordersBreakdownTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  ordersBreakdown: {
    gap: spacing.md,
  },
  orderStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.md,
  },
  orderStatusLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  orderStatusValue: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  commissionBreakdown: {
    backgroundColor: '#F8FAFC',
    padding: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.lg,
  },
  commissionBreakdownTitle: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.md,
  },
  commissionStats: {
    gap: spacing.sm,
  },
  commissionStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commissionStatLabel: {
    ...typography.bodySmall,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textTertiary,
  },
  commissionStatValue: {
    ...typography.label,
    color: colors.text,
  },
});


