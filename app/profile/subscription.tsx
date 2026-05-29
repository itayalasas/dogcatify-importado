import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, Clock, Crown, RefreshCw, Shield, Sparkles } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
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
    iconSurface: isFree ? '#F0FDF4' : '#ECFEFF',
    iconBorder: isFree ? '#BBF7D0' : '#BAE6FD',
    iconColor: isFree ? '#059669' : '#2D6A6F',
    audienceLabel: plan.audience_target === 'all' ? 'Todos' : 'Usuarios',
  };
};

const getPlanMercadoPagoId = (plan: SubscriptionPlan, cycle: BillingCycle) =>
  cycle === 'monthly' ? plan.mercadopago_monthly_plan_id : plan.mercadopago_yearly_plan_id;

const getSingleParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const buildSubscriptionDeepLink = (subscriptionId?: string | string[]) => {
  const id = getSingleParam(subscriptionId);
  return `dogcatify://profile/subscription${id ? `?subscription_id=${encodeURIComponent(id)}` : ''}`;
};

const isMobileWebBrowser = () => {
  const userAgent = String((globalThis as any).navigator?.userAgent || '');
  return /Android|iPhone|iPad|iPod/i.test(userAgent);
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Subscription() {
  const { currentUser } = useAuth();
  const { subscription_id } = useLocalSearchParams<{ subscription_id?: string }>();
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
      Linking.openURL(buildSubscriptionDeepLink(subscription_id)).catch((error) => {
        console.warn('Could not open subscription deep link from web:', error);
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [subscription_id]);

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
        const plansLoaded = await loadPlans();
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

  const loadPlans = async () => {
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
      Alert.alert('Error', 'No se pudieron cargar los planes de suscripción');
      return false;
    }
  };

  const loadUserSubscription = async () => {
    if (!currentUser?.id) return;

    try {
      const selectedSubscriptionId = getSingleParam(subscription_id);
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
        let syncedSubscription = await syncSubscriptionStatus(data.id);

        if (shouldForceSync) {
          for (let attempt = 0; attempt < 2; attempt += 1) {
            const currentStatus = String(syncedSubscription?.status || data.status || '').toLowerCase();
            if (currentStatus !== 'pending') {
              break;
            }

            await delay(1500);
            const retriedSubscription = await syncSubscriptionStatus(data.id);
            if (retriedSubscription) {
              syncedSubscription = retriedSubscription;
            }
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

  const syncSubscriptionStatus = async (subscriptionId: string) => {
    try {
      setSyncingSubscriptionId(subscriptionId);

      const { data, error } = await supabaseClient.functions.invoke('create-user-subscription', {
        body: {
          action: 'sync-status',
          subscriptionId,
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
      `${trialLabel}\n\nVas a gestionar el plan ${plan.name} por Mercado Pago. ¿Deseas continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: () => createSubscription(plan),
        },
      ]
    );
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
        const canOpen = await Linking.canOpenURL(data.paymentUrl);
        if (!canOpen) {
          throw new Error('No se pudo abrir Mercado Pago en este dispositivo.');
        }
        await Linking.openURL(data.paymentUrl);
      } else if (data.status === 'active') {
        Alert.alert('Plan activado', 'Tu plan quedó activo correctamente.');
      }

      await loadUserSubscription();
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

    if (!paymentUrl) {
      Alert.alert('Mercado Pago', 'No hay un link de pago disponible para esta suscripción.');
      return;
    }

    try {
      await Linking.openURL(paymentUrl);
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D6A6F" />
          <Text style={styles.loadingText}>Cargando planes...</Text>
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
        <Text style={styles.title}>Suscripción de Mascota</Text>
        <TouchableOpacity onPress={() => loadSubscriptionData({ refreshPlans: true })} style={styles.backButton}>
          <RefreshCw size={21} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isWaitingForMpConfirmation && !userSubscription && (
          <Card style={styles.syncingCard}>
            <View style={styles.syncingHeader}>
              <ActivityIndicator size="small" color="#F59E0B" />
              <Text style={styles.syncingTitle}>Estamos verificando tu suscripción</Text>
            </View>
            <Text style={styles.syncingText}>
              Si acabas de pagar en Mercado Pago, espera unos segundos o refresca la pantalla para traer el estado real del plan.
            </Text>
          </Card>
        )}

        {hasTrialBeenUsed && !userSubscription && (
          <Card style={styles.noticeCard}>
            <View style={styles.noticeHeader}>
              <Sparkles size={16} color="#92400E" />
              <Text style={styles.noticeTitle}>Prueba gratuita ya utilizada</Text>
            </View>
            <Text style={styles.noticeCardText}>
              Ya utilizaste una prueba gratuita en un plan de usuario. Podrás contratar otros planes, pero no volver a probar gratis.
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
                  <Clock size={18} color="#D97706" />
                ) : (
                  <Shield size={18} color="#2D6A6F" />
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
                ? 'Estamos confirmando tu pago con Mercado Pago. Si acabas de pagar, espera unos segundos o toca actualizar.'
                : currentSubscriptionStatus === 'pending'
                ? 'Mercado Pago todavía no confirmó el cobro. Si ya pagaste, toca actualizar para traer el estado real.'
                : currentSubscriptionStatus === 'active'
                  ? 'Este es el plan activo de tu cuenta personal.'
                  : 'Aquí verás el estado real de tu suscripción cuando Mercado Pago la confirme.'}
            </Text>

            {currentSubscriptionDescription ? (
              <Text style={styles.currentSubscriptionDescription}>
                {currentSubscriptionDescription}
              </Text>
            ) : null}

            {hasTrialBeenUsed && (
              <View style={styles.noticeBox}>
                <Sparkles size={16} color="#92400E" />
                <Text style={styles.noticeText}>
                  Ya utilizaste una prueba gratuita en un plan de usuario. Podrás contratar otros planes, pero no volver a probar gratis.
                </Text>
              </View>
            )}

            {currentSubscriptionStatus === 'pending' && syncingSubscriptionId === userSubscription.id && (
              <View style={styles.syncInlineBanner}>
                <ActivityIndicator size="small" color="#B45309" />
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
              Si también eres aliado, tu plan de negocio se administra aparte desde la sección de aliado.
            </Text>
          </Card>
        )}

        {!userSubscription && (
          <Card style={styles.emptySubscriptionCard}>
            <Text style={styles.emptySubscriptionTitle}>Tu plan contratado aún no aparece aquí</Text>
            <Text style={styles.emptySubscriptionText}>
              Cuando Mercado Pago confirme tu pago, esta pantalla mostrará el plan activo, su estado y los límites que tienes habilitados.
            </Text>
          </Card>
        )}

        <View style={styles.billingCycleContainer}>
          <TouchableOpacity
            style={[
              styles.billingCycleOption,
              selectedBillingCycle === 'monthly' && styles.billingCycleOptionActive
            ]}
            onPress={() => setSelectedBillingCycle('monthly')}
          >
            <Text
              style={[
                styles.billingCycleText,
                selectedBillingCycle === 'monthly' && styles.billingCycleTextActive
              ]}
            >
              Mensual
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.billingCycleOption,
              selectedBillingCycle === 'yearly' && styles.billingCycleOptionActive
            ]}
            onPress={() => setSelectedBillingCycle('yearly')}
          >
            <Text
              style={[
                styles.billingCycleText,
                selectedBillingCycle === 'yearly' && styles.billingCycleTextActive
              ]}
            >
              Anual
            </Text>
          </TouchableOpacity>
        </View>

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
                  {plan.trial_days && plan.trial_days > 0 && (
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
                        <Check size={14} color="#10B981" />
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
                      ? 'Usar Plan Free'
                      : plan.trial_days && plan.trial_days > 0 && !hasTrialBeenUsed
                        ? `Probar ${plan.trial_days} días`
                        : userSubscription
                          ? 'Cambiar Plan'
                          : 'Seleccionar Plan'
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
            Si también eres aliado, tu plan de negocio se gestiona por separado.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 38,
    height: 38,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
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
    marginTop: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  currentSubscriptionCard: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeSubscriptionCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#D1FAE5',
  },
  pendingSubscriptionCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  currentSubscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFEFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  currentSubscriptionInfo: {
    flex: 1,
  },
  currentSubscriptionTitle: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  currentSubscriptionPlan: {
    marginTop: 4,
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  currentSubscriptionDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  subscriptionPill: {
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  subscriptionPillLabel: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  subscriptionPillValue: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  currentSubscriptionDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  subscriptionStatusNote: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    lineHeight: 18,
    marginBottom: 12,
  },
  syncInlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  syncInlineBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#0F766E',
    lineHeight: 18,
  },
  planSummaryContainer: {
    marginBottom: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  planSummaryTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  limitRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  manageButton: {
    marginTop: 8,
  },
  syncingCard: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  syncingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  syncingTitle: {
    marginLeft: 10,
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#0F766E',
  },
  syncingText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  noticeCard: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  noticeTitle: {
    marginLeft: 10,
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
  },
  noticeCardText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#7C2D12',
    lineHeight: 20,
  },
  emptySubscriptionCard: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptySubscriptionTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubscriptionText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  billingCycleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  billingCycleOption: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  billingCycleOptionActive: {
    borderColor: '#2D6A6F',
    backgroundColor: '#ECFEFF',
  },
  billingCycleText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  billingCycleTextActive: {
    color: '#2D6A6F',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 12,
  },
  plansContainer: {
    marginBottom: 24,
  },
  planCard: {
    marginBottom: 14,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  currentPlanCard: {
    borderColor: '#2D6A6F',
    borderWidth: 1.2,
  },
  recommendedPlan: {
    borderColor: '#D1FAE5',
    borderWidth: 1.2,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 12,
  },
  planHeaderCopy: {
    flex: 1,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  planName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  recommendedBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recommendedBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
  },
  planDescription: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
  planMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  planLabelBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  planLabelText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  currentBadge: {
    backgroundColor: '#D1FAE5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  currentBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#065F46',
  },
  trialBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trialBadgeUsed: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderWidth: 1,
  },
  trialBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#1D4ED8',
  },
  trialBadgeTextUsed: {
    color: '#64748B',
  },
  priceBox: {
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    padding: 14,
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  priceValue: {
    marginTop: 4,
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  savingsText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#0F766E',
    marginBottom: 12,
  },
  featuresBox: {
    marginBottom: 14,
  },
  featuresTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 18,
  },
  emptyFeatureText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  planLimitsBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  planLimitsTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  planLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  planLimitLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  planLimitValue: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  selectPlanButton: {
    marginTop: 8,
  },
  infoCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    lineHeight: 22,
  },
  statusPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  statusPillLabel: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  statusPillValue: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  accountScopeText: {
    marginTop: 2,
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 20,
    color: '#4B5563',
    fontFamily: 'Inter-Regular',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#92400E',
    lineHeight: 19,
  },
  limitsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
  },
  limitsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 6,
  },
  limitsSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  limitLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  limitValue: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  limitsNote: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
});




