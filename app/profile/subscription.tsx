import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, Clock, Crown, ExternalLink, RefreshCw } from 'lucide-react-native';
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
});

const getPlanPrice = (plan: SubscriptionPlan, cycle: BillingCycle) =>
  cycle === 'monthly' ? plan.price_monthly : plan.price_yearly;

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
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>('monthly');

  useEffect(() => {
    loadSubscriptionData();
  }, [currentUser?.id, subscription_id]);

  useFocusEffect(
    React.useCallback(() => {
      loadSubscriptionData();
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

  const loadSubscriptionData = async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      await Promise.all([loadPlans(), loadUserSubscription()]);
    } finally {
      setLoading(false);
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
    } catch (error) {
      console.error('Error loading plans:', error);
      Alert.alert('Error', 'No se pudieron cargar los planes de suscripcion');
    }
  };

  const loadUserSubscription = async () => {
    if (!currentUser?.id) return;

    try {
      const selectedSubscriptionId = getSingleParam(subscription_id);
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
        .in('status', ['active', 'pending', 'paused']);

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

        for (let attempt = 0; attempt < 2; attempt += 1) {
          const currentStatus = String(syncedSubscription?.status || data.status || '').toLowerCase();
          if (currentStatus !== 'pending') {
            break;
          }

          await delay(2000);
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

    if (price > 0 && !mpPlanId) {
      Alert.alert(
        'Plan no disponible',
        'Este plan todavia no esta conectado a Mercado Pago para el ciclo elegido.'
      );
      return;
    }

    Alert.alert(
      'Confirmar suscripcion',
      `Vas a gestionar el plan ${plan.name} por Mercado Pago. Deseas continuar?`,
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
        Alert.alert('Plan activado', 'Tu plan quedo activo correctamente.');
      }

      await loadUserSubscription();
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      Alert.alert(
        'Error',
        error?.message || 'No se pudo iniciar la suscripcion.'
      );
    } finally {
      setSubscribingPlanId(null);
    }
  };

  const handleContinuePendingSubscription = async () => {
    const paymentUrl = userSubscription?.payment_url;

    if (!paymentUrl) {
      Alert.alert('Mercado Pago', 'No hay un link de pago disponible para esta suscripcion.');
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
    if (status === 'pending') return 'Pendiente';
    if (status === 'paused') return 'Pausada';
    return status || 'Sin estado';
  };

  const currentPlanLimits = resolveSubscriptionPlanLimits(userSubscription?.subscription_plans || null);
  const currentSubscriptionStatus = String(userSubscription?.status || '').toLowerCase();
  const currentSubscriptionName = userSubscription?.subscription_plans?.name || 'Plan Personal';
  const currentSubscriptionDescription = userSubscription?.subscription_plans?.description || '';
  const currentLimitSummary = buildUserLimitSummary(currentPlanLimits.users);
  const isWaitingForMpConfirmation = Boolean(syncingSubscriptionId || (subscription_id && !userSubscription && !loading));

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
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
        <Text style={styles.title}>Suscripcion de Mascota</Text>
        <TouchableOpacity onPress={loadSubscriptionData} style={styles.backButton}>
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
              Si acabas de pagar en Mercado Pago, refresca esta pantalla en unos segundos para traer el estado real del plan.
            </Text>
          </Card>
        )}

        {userSubscription && (
          <Card style={[
            styles.currentSubscriptionCard,
            currentSubscriptionStatus === 'pending' && styles.pendingSubscriptionCard,
            currentSubscriptionStatus === 'active' && styles.activeSubscriptionCard,
          ] as any}>
            <View style={styles.currentSubscriptionHeader}>
              {currentSubscriptionStatus === 'pending' ? (
                <Clock size={32} color="#D97706" />
              ) : (
                <Crown size={32} color="#F59E0B" />
              )}
              <View style={styles.currentSubscriptionInfo}>
                <Text style={styles.currentSubscriptionTitle}>Tu plan contratado</Text>
                <Text style={styles.currentSubscriptionPlan}>
                  {currentSubscriptionName}
                </Text>
              </View>
            </View>
            <Text style={styles.subscriptionStatusNote}>
              {currentSubscriptionStatus === 'pending' && syncingSubscriptionId === userSubscription.id
                ? 'Estamos confirmando tu pago con Mercado Pago. Si acabas de pagar, espera unos segundos o toca actualizar.'
                : currentSubscriptionStatus === 'pending'
                ? 'Mercado Pago todavía no confirmó el cobro. Si ya pagaste, toca actualizar para traer el estado real.'
                : currentSubscriptionStatus === 'active'
                  ? 'Este es el plan activo de tu cuenta personal.'
                  : 'Aquí verás el estado real de tu suscripción cuando Mercado Pago la confirme.'}
            </Text>
            {currentSubscriptionStatus === 'pending' && syncingSubscriptionId === userSubscription.id && (
              <View style={styles.syncInlineBanner}>
                <ActivityIndicator size="small" color="#B45309" />
                <Text style={styles.syncInlineBannerText}>
                  Confirmando pago con Mercado Pago...
                </Text>
              </View>
            )}
            <View style={styles.currentSubscriptionDetails}>
              <Text style={styles.subscriptionDetailText}>
                Estado: <Text style={styles.subscriptionDetailValue}>{getSubscriptionStatus()}</Text>
              </Text>
              {userSubscription.expires_at && (
                <Text style={styles.subscriptionDetailText}>
                  Renovacion: {' '}
                  <Text style={styles.subscriptionDetailValue}>
                    {new Date(userSubscription.expires_at).toLocaleDateString()}
                  </Text>
                </Text>
              )}
              <Text style={styles.subscriptionDetailText}>
                Ciclo: {' '}
                <Text style={styles.subscriptionDetailValue}>
                  {userSubscription.billing_cycle === 'yearly' ? 'Anual' : 'Mensual'}
                </Text>
              </Text>
              {userSubscription.mercadopago_preapproval_id && (
                <Text style={styles.subscriptionDetailText} numberOfLines={1}>
                  Mercado Pago: <Text style={styles.subscriptionDetailValue}>{userSubscription.mercadopago_preapproval_id}</Text>
                </Text>
              )}
            </View>
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
            {currentSubscriptionDescription ? (
              <Text style={styles.currentSubscriptionDescription}>
                {currentSubscriptionDescription}
              </Text>
            ) : null}
            <Button
              title={
                syncingSubscriptionId === userSubscription.id
                  ? 'Confirmando suscripcion...'
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

        {!userSubscription && (
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
        )}

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

            return (
              <Card
                key={plan.id}
                style={[
                  styles.planCard,
                  isCurrentPlan && styles.currentPlanCard,
                  isRecommended && styles.recommendedPlan
                ] as any}
              >
                {isRecommended && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedBadgeText}>Recomendado</Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planDescription}>{plan.description}</Text>
                </View>

                <View style={styles.planPricing}>
                  <Text style={styles.planPrice}>
                    {formatPrice(price, plan.currency)}
                  </Text>
                  {price > 0 && (
                    <Text style={styles.planPricePeriod}>
                      / {selectedBillingCycle === 'monthly' ? 'mes' : 'ano'}
                    </Text>
                  )}
                </View>

                {selectedBillingCycle === 'yearly' && savings && (
                  <Text style={styles.savingsText}>{savings}</Text>
                )}

                <View style={styles.mpPlanRow}>
                  <ExternalLink size={14} color={paidPlanWithoutMp ? '#B45309' : '#0F766E'} />
                  <Text style={[styles.mpPlanText, paidPlanWithoutMp && styles.mpPlanWarning]}>
                    {price <= 0
                      ? 'No requiere Mercado Pago'
                      : paidPlanWithoutMp
                        ? 'Mercado Pago pendiente'
                        : 'Checkout recurrente conectado'}
                  </Text>
                </View>

                <View style={styles.featuresContainer}>
                  {features.map((feature: string, idx: number) => (
                    <View key={`${plan.id}-${idx}`} style={styles.featureItem}>
                      <Check size={16} color="#10B981" />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                {isCurrentPlan ? (
                  <View style={styles.currentPlanBadge}>
                    <Text style={styles.currentPlanBadgeText}>
                      {userSubscription?.status === 'pending' ? 'Pendiente' : 'Plan Actual'}
                    </Text>
                  </View>
                ) : (
                  <Button
                    title={
                      userSubscription
                        ? 'Cambiar Plan'
                        : plan.is_default
                          ? 'Usar Plan Free'
                          : 'Seleccionar Plan'
                    }
                    onPress={() => handleSelectPlan(plan)}
                    variant={isRecommended ? 'primary' : 'outline'}
                    size="medium"
                    style={styles.selectPlanButton}
                    disabled={paidPlanWithoutMp || isSubscribing}
                    loading={isSubscribing}
                  />
                )}
              </Card>
            );
          })}
        </View>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>Informacion importante</Text>
          <Text style={styles.infoText}>
            Los planes pagos se autorizan y cobran desde Mercado Pago.{'\n'}
            Esta suscripcion pertenece a tu perfil personal y activa funciones de mascota.{'\n'}
            Si tambien eres aliado, tu plan de negocio se gestiona por separado.
          </Text>
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
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
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
    padding: 16,
  },
  currentSubscriptionCard: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#FFFBEB',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  activeSubscriptionCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  pendingSubscriptionCard: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  currentSubscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentSubscriptionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  currentSubscriptionTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#92400E',
    marginBottom: 4,
  },
  currentSubscriptionPlan: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#92400E',
  },
  currentSubscriptionDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#7C2D12',
    lineHeight: 20,
    marginBottom: 12,
  },
  subscriptionStatusNote: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#9A3412',
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
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  syncInlineBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#9A3412',
    lineHeight: 18,
  },
  currentSubscriptionDetails: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#FED7AA',
  },
  subscriptionDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
    marginBottom: 6,
  },
  subscriptionDetailValue: {
    fontFamily: 'Inter-SemiBold',
  },
  planSummaryContainer: {
    marginBottom: 14,
    padding: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  planSummaryTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
    marginBottom: 8,
  },
  limitRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  manageButton: {
    marginTop: 8,
  },
  syncingCard: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
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
    color: '#1D4ED8',
  },
  syncingText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
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
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  billingCycleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  billingCycleOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  billingCycleText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  billingCycleTextActive: {
    color: '#111827',
    fontFamily: 'Inter-SemiBold',
  },
  plansContainer: {
    marginBottom: 24,
  },
  planCard: {
    marginBottom: 16,
    padding: 20,
    position: 'relative',
  },
  currentPlanCard: {
    borderWidth: 2,
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  recommendedPlan: {
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  recommendedBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  planHeader: {
    marginBottom: 16,
  },
  planName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
  },
  planDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  planPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 34,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  planPricePeriod: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  savingsText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
    marginBottom: 12,
  },
  mpPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  mpPlanText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#0F766E',
  },
  mpPlanWarning: {
    color: '#B45309',
  },
  limitsCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
    marginBottom: 16,
  },
  limitsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
    marginBottom: 6,
  },
  limitsSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#B45309',
    lineHeight: 18,
    marginBottom: 12,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  limitLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#78350F',
  },
  limitValue: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
  },
  limitsNote: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#A16207',
    lineHeight: 18,
  },
  featuresContainer: {
    marginBottom: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  currentPlanBadge: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  currentPlanBadgeText: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  selectPlanButton: {
    marginTop: 8,
  },
  infoCard: {
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
    lineHeight: 22,
  },
});
