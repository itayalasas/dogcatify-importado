import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Check, Clock, Crown, RefreshCw, Shield, Sparkles } from 'lucide-react-native';
import { SubscriptionReturnBanner } from '@/components/SubscriptionReturnBanner';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { IconButton } from '../../components/ui/IconButton';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { toast } from '../../components/ui/Toast';
import { colors, fonts, radius, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { buildSubscriptionDeepLink, getSingleParam } from '../../utils/subscriptionReturn';
import { buildUserLimitSummary, resolveSubscriptionPlanLimits } from '../../utils/subscriptionPlanLimits';

type BillingCycle = 'monthly' | 'yearly';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  features?: string[];
  limits?: Record<string, any> | null;
  is_recommended?: boolean;
  is_default?: boolean;
  audience_target?: string | null;
  mercadopago_monthly_plan_id?: string | null;
  mercadopago_yearly_plan_id?: string | null;
  mercadopago_monthly_init_point?: string | null;
  mercadopago_yearly_init_point?: string | null;
  trial_days?: number | null;
}

const normalizePlan = (row: any): SubscriptionPlan => ({
  id: row.id,
  name: row.name || '',
  description: row.description || '',
  price_monthly: Number(row.price_monthly || 0),
  price_yearly: Number(row.price_yearly || 0),
  currency: row.currency || 'UYU',
  features: Array.isArray(row.features) ? row.features.map(String) : [],
  limits: row.limits || null,
  is_recommended: row.is_recommended === true,
  is_default: row.is_default === true,
  audience_target: row.audience_target || null,
  mercadopago_monthly_plan_id: row.mercadopago_monthly_plan_id || null,
  mercadopago_yearly_plan_id: row.mercadopago_yearly_plan_id || null,
  mercadopago_monthly_init_point: row.mercadopago_monthly_init_point || null,
  mercadopago_yearly_init_point: row.mercadopago_yearly_init_point || null,
  trial_days: Number(row.trial_days || 0),
});

const getPlanPrice = (plan: SubscriptionPlan, cycle: BillingCycle) =>
  cycle === 'monthly' ? plan.price_monthly : plan.price_yearly;

const getPlanCardTone = (plan: SubscriptionPlan, cycle: BillingCycle) => {
  const isFree = getPlanPrice(plan, cycle) <= 0;

  return {
    isFree,
    iconSurface: isFree ? colors.successSoft : colors.primarySoft,
    iconBorder: isFree ? colors.successSoft : colors.primaryMuted,
    iconColor: isFree ? colors.success : colors.primary,
    audienceLabel: plan.audience_target === 'all' ? 'Todos' : 'Usuarios',
  };
};

const getPlanMercadoPagoId = (plan: SubscriptionPlan, cycle: BillingCycle) =>
  cycle === 'monthly' ? plan.mercadopago_monthly_plan_id : plan.mercadopago_yearly_plan_id;

const isMobileWebBrowser = () => {
  const userAgent = String((globalThis as any).navigator?.userAgent || '');
  return /Android|iPhone|iPad|iPod/i.test(userAgent);
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Subscription() {
  const { currentUser } = useAuth();
  const params = useLocalSearchParams();
  const subscription_id = getSingleParam(params.subscription_id);
  const subscription_status = getSingleParam(params.subscription_status);
  const subscription_message = getSingleParam(params.subscription_message);
  const subscription_scope = getSingleParam(params.subscription_scope) || getSingleParam(params.scope);
  const target_param = getSingleParam(params.target);
  const external_reference_param = getSingleParam(params.external_reference);
  const business_id_param = getSingleParam(params.businessId);
  const business_id_legacy_param = getSingleParam(params.business_id);
  const [loading, setLoading] = useState(true);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [syncingSubscriptionId, setSyncingSubscriptionId] = useState<string | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [trialAlreadyUsed, setTrialAlreadyUsed] = useState(false);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>('monthly');
  const isLoadingDataRef = React.useRef(false);
  const skipInitialFocusRefreshRef = React.useRef(true);
  const hasLoadedPlansRef = React.useRef(false);

  useEffect(() => {
    loadSubscriptionData({ refreshPlans: true });
  }, [currentUser?.id, subscription_id]);

  useFocusEffect(
    React.useCallback(() => {
      if (skipInitialFocusRefreshRef.current) {
        skipInitialFocusRefreshRef.current = false;
        return;
      }

      loadSubscriptionData({ refreshPlans: false });
    }, [currentUser?.id, subscription_id]),
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || !isMobileWebBrowser()) return;

    const timeoutId = setTimeout(() => {
      Linking.openURL(buildSubscriptionDeepLink({
        ...params,
        target: 'dogcatify://profile/subscription',
      })).catch((error) => {
        console.warn('Could not open subscription deep link from web:', error);
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    subscription_id,
    subscription_status,
    subscription_message,
    subscription_scope,
    target_param,
    external_reference_param,
    business_id_param,
    business_id_legacy_param,
  ]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabaseClient
      .channel(`user-subscriptions-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          const selectedSubscriptionId = getSingleParam(subscription_id);
          const payloadNew = payload.new as Record<string, any> | null | undefined;
          const payloadOld = payload.old as Record<string, any> | null | undefined;
          const changedSubscriptionId = String(payloadNew?.id || payloadOld?.id || '');

          if (
            selectedSubscriptionId &&
            changedSubscriptionId &&
            selectedSubscriptionId !== changedSubscriptionId
          ) {
            return;
          }

          loadSubscriptionData({ refreshPlans: false });
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentUser?.id, subscription_id]);

  const loadSubscriptionData = async ({ refreshPlans = false }: { refreshPlans?: boolean } = {}) => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }

    if (isLoadingDataRef.current) {
      return;
    }

    try {
      isLoadingDataRef.current = true;
      setLoading(true);
      const shouldRefreshPlans = refreshPlans || !hasLoadedPlansRef.current || plans.length === 0;
      const trialUsagePromise = loadTrialUsage();

      if (shouldRefreshPlans) {
        // Right after coming back from Mercado Pago the connection can still
        // be waking up, so a first failure is retried quietly; only the last
        // attempt is allowed to alert the user.
        let plansLoaded = false;
        for (let attempt = 0; attempt < 3 && !plansLoaded; attempt += 1) {
          plansLoaded = await loadPlans({ silent: attempt < 2 });
          if (!plansLoaded && attempt < 2) {
            await delay(1500);
          }
        }
        if (plansLoaded) {
          hasLoadedPlansRef.current = true;
        }
      }

      await loadUserSubscription();
      await trialUsagePromise;
    } finally {
      isLoadingDataRef.current = false;
      setLoading(false);
    }
  };

  const loadTrialUsage = async () => {
    if (!currentUser?.id) {
      setTrialAlreadyUsed(false);
      return false;
    }

    try {
      const { data, error } = await supabaseClient
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('trial_used', true)
        .limit(1);

      if (error) throw error;

      setTrialAlreadyUsed((data || []).length > 0);
      return true;
    } catch (error) {
      console.error('Error loading trial usage:', error);
      setTrialAlreadyUsed(false);
      return false;
    }
  };

  const loadPlans = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      const { data, error } = await supabaseClient
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setPlans(
        (data || [])
          .filter((row) => String(row?.audience_target || 'users').toLowerCase() !== 'partners')
          .map(normalizePlan),
      );
      return true;
    } catch (error) {
      console.error('Error loading plans:', error);
      if (!silent) {
        Alert.alert('Error', 'No se pudieron cargar los planes de suscripción');
      }
      return false;
    }
  };

  const loadUserSubscription = async (forceSubscriptionId?: string) => {
    if (!currentUser?.id) return;

    try {
      const selectedSubscriptionId = forceSubscriptionId || getSingleParam(subscription_id);
      const shouldForceSync = Boolean(selectedSubscriptionId);
      const buildQuery = () => supabaseClient
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (
            name,
            description,
            features,
            limits
          )
        `)
        .eq('user_id', currentUser.id)
        .in('status', ['active', 'trialing', 'pending', 'paused']);

      let data: any = null;
      let error: any = null;

      if (selectedSubscriptionId) {
        const selectedResult = await buildQuery()
          .eq('id', selectedSubscriptionId)
          .maybeSingle();

        data = selectedResult.data || null;
        error = selectedResult.error || null;

        if (!data && !error) {
          const fallbackResult = await buildQuery()
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          data = fallbackResult.data || null;
          error = fallbackResult.error || null;
        }
      } else {
        const latestResult = await buildQuery()
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        data = latestResult.data || null;
        error = latestResult.error || null;
      }

      if (error) throw error;

      if (data && shouldSyncSubscriptionStatus(data)) {
        if (!shouldForceSync) {
          // Just opening the screen and happening to find an old "pending"
          // row (e.g. from an earlier rejected attempt) is not worth making
          // the whole screen wait on Mercado Pago — render with what we have
          // now and let the quick, single-attempt sync below update it once
          // it resolves. The multi-attempt polling loop below is reserved
          // for shouldForceSync, when the user just got redirected back from
          // paying and is actively watching this screen for the result.
          setUserSubscription(data);
          void syncSubscriptionStatus(data.id, { quick: true }).then((synced) => {
            if (synced) setUserSubscription(synced);
          });
          return;
        }

        let syncedSubscription = await syncSubscriptionStatus(data.id);

        for (let attempt = 0; attempt < 4; attempt += 1) {
          const currentStatus = String(syncedSubscription?.status || data.status || '').toLowerCase();
          if (currentStatus !== 'pending') {
            break;
          }

          await delay(1200);
          const retriedSubscription = await syncSubscriptionStatus(data.id);
          if (retriedSubscription) {
            syncedSubscription = retriedSubscription;
          }
        }

        setUserSubscription(syncedSubscription || data);
        return;
      }

      setUserSubscription(data || null);
    } catch (error) {
      console.error('Error loading user subscription:', error);
    }
  };

  const shouldSyncSubscriptionStatus = (subscription: any) => {
    if (!subscription?.id) return false;
    if (String(subscription_id || '') === subscription.id) return true;
    return (
      subscription.status === 'pending' &&
      subscription.metadata?.source === 'mercadopago'
    );
  };

  const syncSubscriptionStatus = async (subscriptionId: string, options: { quick?: boolean } = {}) => {
    try {
      setSyncingSubscriptionId(subscriptionId);

      const { data, error } = await supabaseClient.functions.invoke('create-user-subscription', {
        body: {
          action: 'sync-status',
          subscriptionId,
          quick: Boolean(options.quick),
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'SUBSCRIPTION_SYNC_FAILED');

      return data.subscription || null;
    } catch (error) {
      console.error('Error syncing subscription status:', error);
      return null;
    } finally {
      setSyncingSubscriptionId(null);
    }
  };

  // Reaching this screen with a subscription_id/target param means we just
  // got deep-linked back from Mercado Pago's checkout (see
  // app/subscription/return.tsx and _layout.tsx's handleDeepLink), often
  // after the OS relaunched or resumed the app from the background. The
  // navigation stack at that point can carry leftover entries from that
  // relaunch (e.g. a transient auth-check redirect to /auth/login that fired
  // before the session finished restoring) that router.canGoBack()/back()
  // would happily step into, landing an already-logged-in user back on the
  // login screen. Sidestep that uncertainty entirely for this case and go
  // straight to a known-good destination instead of trusting stack history.
  const cameFromPaymentReturn = Boolean(
    subscription_id || target_param || external_reference_param || subscription_status || subscription_message,
  );

  const handleGoBack = () => {
    if (cameFromPaymentReturn) {
      router.replace('/(tabs)');
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/profile');
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    const price = getPlanPrice(plan, selectedBillingCycle);
    const mpPlanId = getPlanMercadoPagoId(plan, selectedBillingCycle);
    const trialLabel = plan.trial_days && plan.trial_days > 0 && !hasTrialBeenUsed
      ? `Incluye ${plan.trial_days} días de prueba.`
      : plan.trial_days && plan.trial_days > 0
        ? 'Ya utilizaste tu prueba en otro plan; este se cobrará desde el inicio.'
        : 'Este plan se cobrará desde el inicio.';

    if (price > 0 && !mpPlanId) {
      Alert.alert(
        'Plan no disponible',
        'Este plan todavía no está conectado a Mercado Pago para el ciclo elegido.'
      );
      return;
    }

    Alert.alert(
      'Confirmar suscripción',
      `${trialLabel}\n\nVas a gestionar el plan ${plan.name} por Mercado Pago. ¿Querés continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: () => createSubscription(plan),
        },
      ]
    );
  };

  // Mercado Pago's checkout opens in an in-app browser sheet instead of
  // sending the user to Safari: when they finish (via "Ir al sitio del
  // vendedor", which our subscription-return function turns into a
  // dogcatify:// redirect) or simply close it, they land back on this same
  // screen with the navigation stack untouched, and we immediately re-check
  // the real status with the retrying sync.
  const openCheckout = async (url: string, subscriptionId?: string | null) => {
    try {
      await WebBrowser.openAuthSessionAsync(url, 'dogcatify://');
    } finally {
      await loadUserSubscription(subscriptionId || undefined);
    }
  };

  const createSubscription = async (plan: SubscriptionPlan) => {
    try {
      setSubscribingPlanId(plan.id);

      const { data, error } = await supabaseClient.functions.invoke('create-user-subscription', {
        body: {
          planId: plan.id,
          billingCycle: selectedBillingCycle,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'SUBSCRIPTION_CREATE_FAILED');

      if (data.paymentUrl) {
        await openCheckout(data.paymentUrl, data.subscription?.id);
      } else if (data.status === 'active') {
        toast.success('Plan activado', 'Tu plan quedó activo correctamente.');
        await loadUserSubscription();
      } else {
        await loadUserSubscription();
      }
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      Alert.alert(
        'Error',
        error?.message || 'No se pudo iniciar la suscripción.'
      );
    } finally {
      setSubscribingPlanId(null);
    }
  };

  const handleContinuePendingSubscription = async () => {
    const paymentUrl = userSubscription?.payment_url;

    // A pending row without a Mercado Pago preapproval id never got a real
    // checkout of its own (its saved link is the generic plan page, which can't
    // be tied back to this account), so continuing it would only dead-end.
    if (!userSubscription?.mercadopago_preapproval_id) {
      Alert.alert(
        'Suscripción incompleta',
        'Esta suscripción no llegó a iniciarse correctamente en Mercado Pago. Elegí el plan de nuevo para continuar.'
      );
      return;
    }

    if (!paymentUrl) {
      Alert.alert('Mercado Pago', 'No hay un link de pago disponible para esta suscripción.');
      return;
    }

    try {
      await openCheckout(paymentUrl, userSubscription?.id);
    } catch (error) {
      console.error('Error opening pending subscription URL:', error);
      Alert.alert('Error', 'No se pudo abrir Mercado Pago.');
    }
  };

  const formatPrice = (price: number, currency: string) => {
    if (price <= 0) return 'Gratis';
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: currency || 'UYU',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const getYearlySavings = (monthlyPrice: number, yearlyPrice: number) => {
    if (monthlyPrice <= 0 || yearlyPrice <= 0) return null;
    const monthlyCost = monthlyPrice * 12;
    const savings = monthlyCost - yearlyPrice;
    if (savings <= 0) return null;
    const percentage = (savings / monthlyCost) * 100;
    return `Ahorra ${percentage.toFixed(0)}%`;
  };

  const getSubscriptionStatus = () => {
    const status = String(userSubscription?.status || '').toLowerCase();
    if (status === 'active') return 'Activa';
    if (status === 'trialing') return 'En prueba';
    if (status === 'pending') return 'Pendiente';
    if (status === 'paused') return 'Pausada';
    return status || 'Sin estado';
  };

  const currentPlanLimits = resolveSubscriptionPlanLimits(userSubscription?.subscription_plans || null);
  const currentSubscriptionStatus = String(userSubscription?.status || '').toLowerCase();
  const currentSubscriptionName = userSubscription?.subscription_plans?.name || 'Plan Personal';
  const currentSubscriptionDescription = userSubscription?.subscription_plans?.description || '';
  const currentLimitSummary = buildUserLimitSummary(currentPlanLimits.users);
  const hasTrialBeenUsed = trialAlreadyUsed || Boolean(userSubscription?.trial_used);
  const currentSubscriptionTrialEndsAt = userSubscription?.trial_ends_at || userSubscription?.expires_at || null;
  const currentAccessLabel = currentSubscriptionTrialEndsAt
    ? new Date(currentSubscriptionTrialEndsAt).toLocaleDateString()
    : currentSubscriptionStatus === 'active'
      ? 'Renovación automática'
      : 'Sin fecha';
  const isWaitingForMpConfirmation = Boolean(syncingSubscriptionId || (subscription_id && !userSubscription && !loading));

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Suscripción de mascota" onBack={handleGoBack} />
        <View style={styles.skeletonContainer} accessibilityLabel="Cargando planes">
          <SkeletonCard imageHeight={96} />
          <SkeletonCard imageHeight={160} />
          <SkeletonCard imageHeight={160} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Suscripción de mascota"
        onBack={handleGoBack}
        right={
          <IconButton
            icon={<RefreshCw size={21} color={colors.text} />}
            onPress={() => loadSubscriptionData({ refreshPlans: true })}
            accessibilityLabel="Actualizar estado de la suscripción"
          />
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {(getSingleParam(subscription_status) || getSingleParam(subscription_message)) && (
          <SubscriptionReturnBanner
            scope={subscription_scope}
            status={subscription_status}
            message={subscription_message}
          />
        )}

        {isWaitingForMpConfirmation && !userSubscription && (
          <Card style={styles.syncingCard}>
            <View style={styles.syncingHeader}>
              <ActivityIndicator size="small" color={colors.warning} />
              <Text style={styles.syncingTitle}>Estamos verificando tu suscripción</Text>
            </View>
            <Text style={styles.syncingText}>
              Si acabás de pagar en Mercado Pago, esperá unos segundos o tocá actualizar para traer el estado real del plan.
            </Text>
          </Card>
        )}

        {hasTrialBeenUsed && !userSubscription && (
          <Card style={styles.noticeCard}>
            <View style={styles.noticeHeader}>
              <Sparkles size={16} color={colors.warning} />
              <Text style={styles.noticeTitle}>Prueba gratuita ya utilizada</Text>
            </View>
            <Text style={styles.noticeCardText}>
              Ya utilizaste una prueba gratuita en un plan de usuario. Podés contratar otros planes, pero no volver a probar gratis.
            </Text>
          </Card>
        )}

        {userSubscription && (
          <Card style={[
            styles.currentSubscriptionCard,
            currentSubscriptionStatus === 'pending' && styles.pendingSubscriptionCard,
            currentSubscriptionStatus === 'active' && styles.activeSubscriptionCard,
            currentSubscriptionStatus === 'trialing' && styles.activeSubscriptionCard,
          ] as any}>
            <View style={styles.currentSubscriptionHeader}>
              <View style={styles.statusIcon}>
                {currentSubscriptionStatus === 'pending' ? (
                  <Clock size={18} color={colors.warning} />
                ) : (
                  <Shield size={18} color={colors.primary} />
                )}
              </View>
              <View style={styles.currentSubscriptionInfo}>
                <Text style={styles.currentSubscriptionTitle}>Estado actual</Text>
                <Text style={styles.currentSubscriptionPlan}>{getSubscriptionStatus()}</Text>
              </View>
            </View>

            <View style={styles.currentSubscriptionDetails}>
              <View style={styles.subscriptionPill}>
                <Text style={styles.subscriptionPillLabel}>Plan actual</Text>
                <Text style={styles.subscriptionPillValue}>{currentSubscriptionName}</Text>
              </View>
              <View style={styles.subscriptionPill}>
                <Text style={styles.subscriptionPillLabel}>Acceso hasta</Text>
                <Text style={styles.subscriptionPillValue}>{currentAccessLabel}</Text>
              </View>
            </View>

            <Text style={styles.subscriptionStatusNote}>
              {currentSubscriptionStatus === 'trialing'
                ? 'Tu prueba gratuita está activa. Cuando termine, se aplicará el cobro según el plan contratado.'
                : currentSubscriptionStatus === 'pending' && syncingSubscriptionId === userSubscription.id
                ? 'Estamos confirmando tu pago con Mercado Pago. Si acabás de pagar, esperá unos segundos o tocá actualizar.'
                : currentSubscriptionStatus === 'pending'
                ? 'Mercado Pago todavía no confirmó el cobro. Si ya pagaste, tocá actualizar para traer el estado real.'
                : currentSubscriptionStatus === 'active'
                  ? 'Este es el plan activo de tu cuenta personal.'
                  : 'Acá vas a ver el estado real de tu suscripción cuando Mercado Pago la confirme.'}
            </Text>

            {currentSubscriptionDescription ? (
              <Text style={styles.currentSubscriptionDescription}>
                {currentSubscriptionDescription}
              </Text>
            ) : null}

            {hasTrialBeenUsed && (
              <View style={styles.noticeBox}>
                <Sparkles size={16} color={colors.warning} />
                <Text style={styles.noticeText}>
                  Ya utilizaste una prueba gratuita en un plan de usuario. Podés contratar otros planes, pero no volver a probar gratis.
                </Text>
              </View>
            )}

            {currentSubscriptionStatus === 'pending' && syncingSubscriptionId === userSubscription.id && (
              <View style={styles.syncInlineBanner}>
                <ActivityIndicator size="small" color={colors.warning} />
                <Text style={styles.syncInlineBannerText}>
                  Confirmando pago con Mercado Pago...
                </Text>
              </View>
            )}
            {currentLimitSummary.length > 0 && (
              <View style={styles.planSummaryContainer}>
                <Text style={styles.planSummaryTitle}>Resumen de límites</Text>
                {currentLimitSummary.slice(0, 4).map((limit) => (
                  <View key={limit.label} style={styles.limitRowCompact}>
                    <Text style={styles.limitLabel}>{limit.label}</Text>
                    <Text style={styles.limitValue}>{limit.value}</Text>
                  </View>
                ))}
              </View>
            )}
            <Button
              title={
                syncingSubscriptionId === userSubscription.id
                  ? 'Confirmando suscripción...'
                  : userSubscription.status === 'pending'
                    ? 'Continuar en Mercado Pago'
                    : 'Gestionar en Mercado Pago'
              }
              onPress={
                userSubscription.status === 'pending'
                  ? handleContinuePendingSubscription
                  : () => Alert.alert('Mercado Pago', 'Las pausas, cancelaciones y cambios de medio de pago se gestionan desde Mercado Pago.')
              }
              variant="outline"
              size="medium"
              style={styles.manageButton}
              disabled={syncingSubscriptionId === userSubscription.id}
              loading={syncingSubscriptionId === userSubscription.id}
            />
          </Card>
        )}

        {userSubscription?.subscription_plans && (
          <Card style={styles.limitsCard}>
            <Text style={styles.limitsTitle}>Límites de tu plan</Text>
            <Text style={styles.limitsSubtitle}>
              Estos son los topes activos para tu perfil personal y tus mascotas.
            </Text>
            {buildUserLimitSummary(currentPlanLimits.users).map((limit) => (
              <View key={limit.label} style={styles.limitRow}>
                <Text style={styles.limitLabel}>{limit.label}</Text>
                <Text style={styles.limitValue}>{limit.value}</Text>
              </View>
            ))}
            <Text style={styles.limitsNote}>
              Si también sos aliado, tu plan de negocio se administra aparte desde la sección de aliado.
            </Text>
          </Card>
        )}

        {!userSubscription && (
          <Card style={styles.emptySubscriptionCard}>
            <Text style={styles.emptySubscriptionTitle}>Tu plan contratado todavía no aparece acá</Text>
            <Text style={styles.emptySubscriptionText}>
              Cuando Mercado Pago confirme tu pago, esta pantalla mostrará el plan activo, su estado y los límites que tenés habilitados.
            </Text>
          </Card>
        )}

        <SegmentedControl
          options={[
            { value: 'monthly', label: 'Mensual' },
            { value: 'yearly', label: 'Anual' },
          ]}
          value={selectedBillingCycle}
          onChange={(value) => setSelectedBillingCycle(value)}
          style={styles.billingCycleContainer}
        />

        <Text style={styles.sectionTitle}>Planes disponibles</Text>

        <View style={styles.plansContainer}>
          {plans.map((plan, index) => {
            const isCurrentPlan = userSubscription?.plan_id === plan.id;
            const price = getPlanPrice(plan, selectedBillingCycle);
            const mpPlanId = getPlanMercadoPagoId(plan, selectedBillingCycle);
            const features = plan.features || [];
            const savings = getYearlySavings(plan.price_monthly, plan.price_yearly);
            const isRecommended = plan.is_recommended || index === 1;
            const isSubscribing = subscribingPlanId === plan.id;
            const paidPlanWithoutMp = price > 0 && !mpPlanId;
            const isTrialAvailable = (plan.trial_days || 0) > 0 && !hasTrialBeenUsed;
            const tone = getPlanCardTone(plan, selectedBillingCycle);

            return (
              <Card
                key={plan.id}
                style={[
                  styles.planCard,
                  isCurrentPlan && styles.currentPlanCard,
                ] as any}
              >
                <View style={styles.planHeader}>
                  <View
                    style={[
                      styles.planIcon,
                      {
                        backgroundColor: tone.iconSurface,
                        borderColor: tone.iconBorder,
                      },
                    ]}
                  >
                    {tone.isFree ? (
                      <Sparkles size={20} color={tone.iconColor} />
                    ) : (
                      <Crown size={20} color={tone.iconColor} />
                    )}
                  </View>
                  <View style={styles.planHeaderCopy}>
                    <View style={styles.planNameRow}>
                      <Text style={styles.planName}>{plan.name}</Text>
                      {isRecommended && (
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recommendedBadgeText}>Recomendado</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.planDescription}>{plan.description}</Text>
                  </View>
                </View>

                <View style={styles.planMetaRow}>
                  <View style={[styles.planLabelBadge, { backgroundColor: tone.iconSurface }]}>
                    <Text style={[styles.planLabelText, { color: tone.iconColor }]}>
                      {tone.audienceLabel}
                    </Text>
                  </View>
                  {Boolean(plan.trial_days && plan.trial_days > 0) && (
                    <View style={[styles.trialBadge, !isTrialAvailable && styles.trialBadgeUsed]}>
                      <Text style={[styles.trialBadgeText, !isTrialAvailable && styles.trialBadgeTextUsed]}>
                        {isTrialAvailable ? `${plan.trial_days} días de prueba` : 'Prueba ya utilizada'}
                      </Text>
                    </View>
                  )}
                  {isCurrentPlan && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>
                        {currentSubscriptionStatus === 'trialing'
                          ? 'En prueba'
                          : userSubscription?.status === 'pending'
                            ? 'Pendiente'
                            : 'Plan actual'}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.priceBox}>
                  <Text style={styles.priceLabel}>
                    {selectedBillingCycle === 'monthly' ? 'Precio mensual' : 'Precio anual'}
                  </Text>
                  <Text style={styles.priceValue}>
                    {formatPrice(price, plan.currency)}
                  </Text>
                </View>

                {selectedBillingCycle === 'yearly' && savings && (
                  <Text style={styles.savingsText}>{savings}</Text>
                )}

                <View style={styles.featuresBox}>
                  <Text style={styles.featuresTitle}>Incluye</Text>
                  {features.length > 0 ? (
                    features.map((feature: string, idx: number) => (
                      <View key={`${plan.id}-${idx}`} style={styles.featureRow}>
                        <Check size={14} color={colors.success} />
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyFeatureText}>No hay funcionalidades configuradas.</Text>
                  )}
                </View>

                <View style={styles.planLimitsBox}>
                <Text style={styles.planLimitsTitle}>Límites del plan</Text>
                  {buildUserLimitSummary(resolveSubscriptionPlanLimits(plan as any).users).slice(0, 4).map((limit) => (
                    <View key={`${plan.id}-limit-${limit.label}`} style={styles.planLimitRow}>
                      <Text style={styles.planLimitLabel}>{limit.label}</Text>
                      <Text style={styles.planLimitValue}>{limit.value}</Text>
                    </View>
                  ))}
                </View>

                <Button
                  title={isCurrentPlan ? 'Plan actual' : (
                    plan.price_monthly === 0 && plan.price_yearly === 0
                      ? 'Usar plan Free'
                      : plan.trial_days && plan.trial_days > 0 && !hasTrialBeenUsed
                        ? `Probar ${plan.trial_days} días`
                        : userSubscription
                          ? 'Cambiar plan'
                          : 'Elegir plan'
                  )}
                  onPress={() => handleSelectPlan(plan)}
                  variant={isCurrentPlan ? 'outline' : 'primary'}
                  size="large"
                  style={styles.selectPlanButton}
                  disabled={paidPlanWithoutMp || isSubscribing}
                  loading={isSubscribing}
                />
              </Card>
            );
          })}
        </View>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>Información importante</Text>
          <Text style={styles.infoText}>
            Los planes pagos se autorizan y cobran desde Mercado Pago.{'\n'}
            Esta suscripción pertenece a tu perfil personal y activa funciones de mascota.{'\n'}
            Si también sos aliado, tu plan de negocio se gestiona por separado.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  skeletonContainer: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 38,
    height: 38,
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  currentSubscriptionCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeSubscriptionCard: {
    backgroundColor: colors.background,
    borderColor: colors.successSoft,
  },
  pendingSubscriptionCard: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft,
  },
  currentSubscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  currentSubscriptionInfo: {
    flex: 1,
  },
  currentSubscriptionTitle: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  currentSubscriptionPlan: {
    marginTop: spacing.xs,
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  currentSubscriptionDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.md,
  },
  subscriptionPill: {
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  subscriptionPillLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  subscriptionPillValue: {
    marginTop: spacing.xs,
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  currentSubscriptionDescription: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  subscriptionStatusNote: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  syncInlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  syncInlineBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.primary,
    lineHeight: 18,
  },
  planSummaryContainer: {
    marginBottom: 14,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planSummaryTitle: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  limitRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  manageButton: {
    marginTop: spacing.sm,
  },
  syncingCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  syncingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  syncingTitle: {
    marginLeft: 10,
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  syncingText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  noticeCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warningSoft,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  noticeTitle: {
    marginLeft: 10,
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.warning,
  },
  noticeCardText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.warning,
    lineHeight: 20,
  },
  emptySubscriptionCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptySubscriptionTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubscriptionText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    lineHeight: 20,
  },
  billingCycleContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  billingCycleOption: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  billingCycleOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  billingCycleText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
  },
  billingCycleTextActive: {
    color: colors.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  plansContainer: {
    marginBottom: spacing.xxl,
  },
  planCard: {
    marginBottom: 14,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currentPlanCard: {
    borderColor: colors.primary,
    borderWidth: 1.2,
  },
  recommendedPlan: {
    borderColor: colors.successSoft,
    borderWidth: 1.2,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: spacing.md,
  },
  planHeaderCopy: {
    flex: 1,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  planName: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  recommendedBadge: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
  },
  recommendedBadgeText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.warning,
  },
  planDescription: {
    marginTop: spacing.xs,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    lineHeight: 18,
  },
  planMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  planLabelBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  planLabelText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
  },
  currentBadge: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  currentBadgeText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.success,
  },
  trialBadge: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trialBadgeUsed: {
    backgroundColor: colors.background,
    borderColor: colors.borderStrong,
    borderWidth: 1,
  },
  trialBadgeText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.primaryStrong,
  },
  trialBadgeTextUsed: {
    color: colors.textSecondary,
  },
  priceBox: {
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    padding: 14,
    marginBottom: spacing.md,
  },
  priceLabel: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  priceValue: {
    marginTop: spacing.xs,
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  savingsText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  featuresBox: {
    marginBottom: 14,
  },
  featuresTitle: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  emptyFeatureText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
  },
  planLimitsBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  planLimitsTitle: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  planLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  planLimitLabel: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
  },
  planLimitValue: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  selectPlanButton: {
    marginTop: spacing.sm,
  },
  infoCard: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xxxl,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  infoText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  statusPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  statusPillLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  statusPillValue: {
    marginTop: spacing.xs,
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  accountScopeText: {
    marginTop: 2,
    marginBottom: spacing.md,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.warning,
    lineHeight: 19,
  },
  limitsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  limitsTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: 6,
  },
  limitsSubtitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  limitLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  limitValue: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  limitsNote: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    lineHeight: 18,
  },
});




